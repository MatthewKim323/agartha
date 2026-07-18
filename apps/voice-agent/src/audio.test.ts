import { describe, expect, test } from "bun:test";
import { discordToModel, modelToDiscord, monoToStereo, resampleMono, stereoToMono } from "./audio.js";

/** Build a mono s16le buffer from sample values. */
function mono(samples: number[]): Buffer {
  const b = Buffer.allocUnsafe(samples.length * 2);
  samples.forEach((s, i) => b.writeInt16LE(s, i * 2));
  return b;
}

/** Build a stereo s16le buffer from [left, right] pairs. */
function stereo(pairs: Array<[number, number]>): Buffer {
  const b = Buffer.allocUnsafe(pairs.length * 4);
  pairs.forEach(([l, r], i) => {
    b.writeInt16LE(l, i * 4);
    b.writeInt16LE(r, i * 4 + 2);
  });
  return b;
}

const read = (b: Buffer) => Array.from({ length: b.length / 2 }, (_, i) => b.readInt16LE(i * 2));

describe("channel conversion", () => {
  test("stereoToMono averages the channels", () => {
    expect(read(stereoToMono(stereo([[100, 200], [0, 0], [-100, -300]])))).toEqual([150, 0, -200]);
  });

  test("monoToStereo duplicates into both channels", () => {
    expect(read(monoToStereo(mono([50, -50])))).toEqual([50, 50, -50, -50]);
  });

  test("round trip preserves the signal", () => {
    expect(read(stereoToMono(monoToStereo(mono([1, -1, 32767, -32768]))))).toEqual([1, -1, 32767, -32768]);
  });
});

describe("resampleMono", () => {
  test("is a no-op at equal rates", () => {
    const b = mono([1, 2, 3]);
    expect(resampleMono(b, 48000, 48000)).toBe(b);
  });

  test("doubling the rate doubles the sample count", () => {
    // 24k -> 48k is the model output path.
    expect(read(resampleMono(mono([0, 100, 200, 300]), 24000, 48000))).toHaveLength(8);
  });

  test("halving the rate halves the sample count", () => {
    expect(read(resampleMono(mono([0, 100, 200, 300]), 48000, 24000))).toHaveLength(2);
  });

  test("preserves a constant signal exactly", () => {
    // Interpolation between equal neighbours must not drift.
    expect(read(resampleMono(mono([500, 500, 500, 500]), 24000, 48000))).toEqual(Array(8).fill(500));
  });

  test("never returns an empty buffer for non-empty input", () => {
    expect(read(resampleMono(mono([42]), 48000, 16000)).length).toBeGreaterThanOrEqual(1);
  });
});

describe("the Discord <-> model paths", () => {
  test("48k stereo in becomes 16k mono, a 6:1 byte reduction", () => {
    // 48k->16k is 3:1, stereo->mono is another 2:1.
    const input = stereo(Array.from({ length: 300 }, () => [1000, 1000] as [number, number]));
    const out = discordToModel(input);
    expect(out.length).toBe(input.length / 6);
  });

  test("decimation averages triplets rather than dropping samples", () => {
    // Averaging is a crude low-pass; naive dropping would alias.
    const input = stereo([[300, 300], [600, 600], [900, 900]]);
    expect(read(discordToModel(input))).toEqual([600]);
  });

  test("24k mono out becomes 48k stereo, a 4:1 byte increase", () => {
    const input = mono(Array.from({ length: 240 }, () => 800));
    expect(modelToDiscord(input, 24000).length).toBe(input.length * 4);
  });

  test("model output defaults to Gemini's 24k rate", () => {
    const input = mono(Array(100).fill(123));
    expect(modelToDiscord(input).length).toBe(modelToDiscord(input, 24000).length);
  });

  test("a full 20ms Discord frame converts to the expected size", () => {
    // Discord frames are exactly 3840 bytes (960 samples x 2ch x 2 bytes).
    const frame = Buffer.alloc(3840);
    expect(discordToModel(frame).length).toBe(640); // 320 samples of 16k mono
  });
});
