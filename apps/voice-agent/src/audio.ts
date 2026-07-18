/**
 * Audio format bridging between Discord and the voice model.
 *
 *   Discord voice:      48000 Hz, 16-bit signed LE, STEREO (2ch)
 *   Gemini Live input:  16000 Hz, 16-bit signed LE, MONO
 *   Gemini Live output: 24000 Hz, 16-bit signed LE, MONO
 *
 * Both conversions land on integer ratios (48k->16k is 3:1, 24k->48k is 1:2),
 * which is why linear interpolation is fine here. If quality ever matters, swap
 * in a real resampler (soxr).
 */

/** Stereo 16-bit PCM -> mono 16-bit PCM (average the two channels). */
export function stereoToMono(buf: Buffer): Buffer {
  const samples = buf.length / 4; // 2 channels * 2 bytes
  const out = Buffer.allocUnsafe(samples * 2);
  for (let i = 0; i < samples; i++) {
    const l = buf.readInt16LE(i * 4);
    const r = buf.readInt16LE(i * 4 + 2);
    out.writeInt16LE((l + r) >> 1, i * 2);
  }
  return out;
}

/** Mono 16-bit PCM -> stereo 16-bit PCM (duplicate the channel). */
export function monoToStereo(buf: Buffer): Buffer {
  const samples = buf.length / 2;
  const out = Buffer.allocUnsafe(samples * 4);
  for (let i = 0; i < samples; i++) {
    const s = buf.readInt16LE(i * 2);
    out.writeInt16LE(s, i * 4);
    out.writeInt16LE(s, i * 4 + 2);
  }
  return out;
}

/** Resample mono 16-bit PCM from `inRate` to `outRate` via linear interpolation. */
export function resampleMono(buf: Buffer, inRate: number, outRate: number): Buffer {
  if (inRate === outRate) return buf;
  const inSamples = buf.length / 2;
  const ratio = outRate / inRate;
  const outSamples = Math.max(1, Math.floor(inSamples * ratio));
  const out = Buffer.allocUnsafe(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const srcPos = i / ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, inSamples - 1);
    const frac = srcPos - i0;
    const s0 = buf.readInt16LE(i0 * 2);
    const s1 = buf.readInt16LE(i1 * 2);
    out.writeInt16LE(Math.round(s0 + (s1 - s0) * frac), i * 2);
  }
  return out;
}

/** Average-decimate mono 16-bit PCM by an integer factor (crude anti-alias low-pass). */
function decimateAvg(buf: Buffer, factor: number): Buffer {
  const inSamples = buf.length / 2;
  const outSamples = Math.floor(inSamples / factor);
  const out = Buffer.allocUnsafe(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += buf.readInt16LE((i * factor + j) * 2);
    out.writeInt16LE(Math.round(sum / factor), i * 2);
  }
  return out;
}

/** Discord (48k stereo) -> model input (mono at `outRate`, default 16k). */
export function discordToModel(pcm48Stereo: Buffer, outRate = 16000): Buffer {
  const mono = stereoToMono(pcm48Stereo);
  // 48k -> 16k is exactly 3:1 — average each triplet (cleaner than linear decimation).
  if (outRate === 16000) return decimateAvg(mono, 3);
  return resampleMono(mono, 48000, outRate);
}

/** Model output (mono at `inRate`, 24k for Gemini Live) -> Discord (48k stereo). */
export function modelToDiscord(pcmMono: Buffer, inRate = 24000): Buffer {
  return monoToStereo(resampleMono(pcmMono, inRate, 48000));
}
