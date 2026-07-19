/**
 * Voice latency bench.
 *
 * Streams real speech audio through the exact Live pipeline the Discord agent
 * uses, in real-time-sized chunks, and measures every stage. This exists so the
 * voice path can be measured and tuned WITHOUT needing a human in a call —
 * otherwise the one number the whole project is about is only observable when
 * someone happens to be sitting in Discord.
 *
 * Generate input first:
 *   say -v Samantha -o speech.wav --data-format=LEI16@16000 "your line here"
 *
 * Then:
 *   bun --env-file=../../.env apps/voice-agent/bench.ts speech.wav
 *   bun --env-file=../../.env apps/voice-agent/bench.ts speech.wav --runs 5
 *
 * Reported: speech-end -> first audio out, and speech-end -> first tool call.
 * Those are the two numbers that decide whether this feels alive.
 */
import { readFileSync } from "node:fs";
import { GoogleGenAI, Modality } from "@google/genai";
import { GbrainClient } from "@agartha/memory";
import { McClient } from "./src/mc.js";
import { buildPersona } from "./src/persona.js";
import { MEMORY_TOOLS, callMemoryTool, isMemoryTool } from "./src/memory-tools.js";
import { percentile } from "@agartha/shared";

const args = process.argv.slice(2);
const wavPath = args.find((a) => !a.startsWith("--")) ?? "speech.wav";
const runs = Number(args[args.indexOf("--runs") + 1]) || 1;

/** Strip a RIFF header and return raw PCM. Assumes 16-bit mono. */
function pcmFromWav(buf: Buffer): { pcm: Buffer; rate: number } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (buf.toString("ascii", 0, 4) !== "RIFF") return { pcm: buf, rate: 16000 };
  let rate = 16000;
  let offset = 12;
  let pcm: Buffer = Buffer.alloc(0);
  while (offset < buf.length - 8) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") rate = buf.readUInt32LE(offset + 12);
    if (id === "data") {
      pcm = buf.subarray(offset + 8, offset + 8 + size) as Buffer;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  return { pcm, rate };
}

const { pcm, rate } = pcmFromWav(readFileSync(wavPath));
const durationMs = Math.round((pcm.length / 2 / rate) * 1000);
console.log(`input: ${wavPath} — ${rate}Hz mono, ${durationMs}ms of speech\n`);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const mc = new McClient(process.env.AGARTHA_MCP_URL ?? "http://localhost:3001/mcp");
let haveBot = false;
try {
  await mc.connect();
  haveBot = true;
} catch {
  console.log("(bot offline — tool calls will fail, latency still measured)\n");
}
const gbrain = new GbrainClient({
  url: process.env.GBRAIN_MCP_URL ?? "http://localhost:3131/mcp",
  token: process.env.GBRAIN_TOKEN ?? "",
  timeoutMs: 2000,
});
const persona = await buildPersona(process.env.JABBY_DIR);

interface Result {
  firstAudioMs: number | null;
  firstToolMs: number | null;
  transcriptMs: number | null;
  tools: string[];
  transcript: string;
  said: string;
}

async function runOnce(i: number): Promise<Result> {
  let firstAudioAt = 0;
  let firstToolAt = 0;
  let transcriptAt = 0;
  const tools: string[] = [];
  let transcript = "";
  let said = "";
  let sentAt = 0;

  const session = await ai.live.connect({
    model: process.env.GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio-latest",
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      thinkingConfig: { thinkingBudget: Number(process.env.GEMINI_THINKING_BUDGET ?? 0) },
      systemInstruction: persona.text,
      tools: [{ functionDeclarations: [...mc.functionDeclarations, ...MEMORY_TOOLS] as never }],
    } as never,
    callbacks: {
      onopen: () => {},
      onerror: (e: unknown) => console.log("  error:", (e as Error)?.message),
      onclose: () => {},
      onmessage: (async (m: never) => {
        const msg = m as Record<string, never>;
        const sc = msg.serverContent as Record<string, never> | undefined;
        const it = (sc?.inputTranscription as { text?: string } | undefined)?.text;
        if (it) {
          transcript += it;
          if (!transcriptAt) transcriptAt = Date.now();
        }
        const ot = (sc?.outputTranscription as { text?: string } | undefined)?.text;
        if (ot) said += ot;
        for (const p of ((sc?.modelTurn as unknown as { parts?: Array<{ inlineData?: { data?: string } }> })?.parts ?? [])) {
          if (p.inlineData?.data && !firstAudioAt) firstAudioAt = Date.now();
        }
        const calls = (msg.toolCall as unknown as { functionCalls?: Array<{ id?: string; name?: string; args?: never }> })?.functionCalls ?? [];
        if (calls.length && !firstToolAt) firstToolAt = Date.now();
        for (const c of calls) {
          const name = c.name ?? "";
          tools.push(name);
          const r = isMemoryTool(name)
            ? await callMemoryTool(gbrain, name, c.args ?? {})
            : haveBot
              ? await mc.call(name, c.args ?? {})
              : "ok";
          session.sendToolResponse({ functionResponses: [{ id: c.id, name, response: { result: r } }] });
        }
      }) as never,
    },
  });

  await Bun.sleep(1500); // let setup settle

  // Stream in 20ms chunks, paced like a real mic. Blasting it all at once
  // would measure something that never happens in production.
  const bytesPer20ms = Math.round((rate * 2 * 20) / 1000);
  for (let off = 0; off < pcm.length; off += bytesPer20ms) {
    const chunk = pcm.subarray(off, Math.min(off + bytesPer20ms, pcm.length));
    session.sendRealtimeInput({
      audio: { data: chunk.toString("base64"), mimeType: `audio/pcm;rate=${rate}` },
    });
    await Bun.sleep(20);
  }
  sentAt = Date.now(); // end of speech

  // Trailing silence. Gemini's VAD decides the turn ended by HEARING silence.
  // Discord's receiver only emits frames while someone is speaking, so without
  // this the model waits forever for a turn that never closes.
  const silence = Buffer.alloc(bytesPer20ms);
  const trailingMs = Number(process.env.BENCH_TRAILING_SILENCE_MS ?? 1000);
  for (let t = 0; t < trailingMs; t += 20) {
    session.sendRealtimeInput({
      audio: { data: silence.toString("base64"), mimeType: `audio/pcm;rate=${rate}` },
    });
    await Bun.sleep(20);
  }

  await Bun.sleep(12000);
  session.close();

  const rel = (t: number) => (t ? t - sentAt : null);
  const r: Result = {
    firstAudioMs: rel(firstAudioAt),
    firstToolMs: rel(firstToolAt),
    transcriptMs: rel(transcriptAt),
    tools,
    transcript: transcript.trim(),
    said: said.trim(),
  };
  console.log(
    `run ${i + 1}: audio ${r.firstAudioMs ?? "—"}ms | tool ${r.firstToolMs ?? "—"}ms (${r.tools.join(",") || "none"})`,
  );
  if (r.transcript) console.log(`        heard: "${r.transcript}"`);
  if (r.said) console.log(`        said:  "${r.said.slice(0, 100)}"`);
  return r;
}

const results: Result[] = [];
for (let i = 0; i < runs; i++) results.push(await runOnce(i));

const audio = results.map((r) => r.firstAudioMs).filter((v): v is number => v !== null).sort((a, b) => a - b);
const tool = results.map((r) => r.firstToolMs).filter((v): v is number => v !== null).sort((a, b) => a - b);

console.log("\n--- measured from END OF SPEECH ---");
if (audio.length) {
  console.log(`first audio out: p50 ${percentile(audio, 50)}ms | p95 ${percentile(audio, 95)}ms | min ${audio[0]} | max ${audio[audio.length - 1]}`);
} else console.log("first audio out: NEVER");
if (tool.length) {
  console.log(`first tool call: p50 ${percentile(tool, 50)}ms | p95 ${percentile(tool, 95)}ms`);
} else console.log("first tool call: none");
console.log(`\ntool call rate: ${results.filter((r) => r.tools.length > 0).length}/${results.length} runs`);

await mc.close();
await gbrain.close();
process.exit(0);
