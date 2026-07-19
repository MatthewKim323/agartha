import { GoogleGenAI, Modality } from "@google/genai";
import type { FunctionDeclaration } from "./mc.js";
import { logger } from "./log.js";

const log = logger("live");

/**
 * The Gemini Live session: audio in, audio out, one model, one persistent
 * connection.
 *
 * Native speech-to-speech is the reason latency lands near conversational
 * range. Voice activity detection and barge-in are the model's, not ours, so
 * there is no local VAD to tune and no interruption logic to get wrong.
 *
 * The tradeoff, accepted deliberately: Gemini's realtime function calling has
 * weaker tool control than GPT-realtime's, and changing the tool set requires
 * restarting the session. Our tools are fixed at startup, so it doesn't bite.
 * See docs/DECISIONS.md.
 *
 * Model choice: `gemini-2.5-flash-native-audio-latest` is the only model this
 * project's key advertises `bidiGenerateContent` on, which is the method the
 * Live API rides. `gemini-2.0-flash-live-001` also opens a session and is kept
 * as a documented fallback. Both verified 2026-07-18.
 *
 * Still unverified: audio actually flowing both directions, tool calls
 * round-tripping, and end-to-end latency. Opening a socket is not a demo.
 */

export interface LiveCallbacks {
  /** PCM audio from the model, 24kHz mono signed 16-bit. */
  onAudio(pcm: Buffer): void;
  /** The model started a new reply; cut whatever is still playing. */
  onInterrupted(): void;
  /** A finished user utterance, for memory prefetch and logging. */
  onUserTranscript(text: string): void;
  /** Dispatch a tool call and return a short result string for the model. */
  onToolCall(name: string, args: Record<string, unknown>): Promise<string>;
}

export interface LiveOptions {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  tools: FunctionDeclaration[];
  callbacks: LiveCallbacks;
}

const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/** Live API audio contract: 16kHz mono in, 24kHz mono out, both s16le. */
export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;

export class LiveSession {
  private session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
  private readonly ai: GoogleGenAI;

  constructor(private readonly opts: LiveOptions) {
    this.ai = new GoogleGenAI({ apiKey: opts.apiKey });
  }

  get connected(): boolean {
    return this.session !== null;
  }

  async start(): Promise<void> {
    const model = this.opts.model ?? env("GEMINI_LIVE_MODEL") ?? "gemini-2.5-flash-native-audio-latest";

    this.session = await this.ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.opts.systemInstruction,
        // Declared once. Gemini cannot swap these mid-session.
        //
        // Cast at the SDK boundary: these declarations originate as MCP JSON
        // Schema, which is a superset of Gemini's Schema type. Validating the
        // narrowing properly would mean reimplementing JSON Schema, and a tool
        // whose schema Gemini dislikes fails loudly at connect anyway. Keeping
        // the cast here is what lets mc.ts stay free of any SDK types.
        tools: this.opts.tools.length
          ? ([{ functionDeclarations: this.opts.tools }] as unknown as NonNullable<
              NonNullable<Parameters<GoogleGenAI["live"]["connect"]>[0]["config"]>["tools"]
            >)
          : undefined,
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => log.info(`live session open (${model}, ${this.opts.tools.length} tools)`),
        onmessage: (msg: unknown) => void this.handle(msg),
        onerror: (e: unknown) => log.error("live error:", (e as Error)?.message ?? e),
        onclose: () => {
          log.warn("live session closed");
          this.session = null;
        },
      },
    });
  }

  private async handle(msg: unknown): Promise<void> {
    // Log the shape of anything unrecognized. A silent agent is usually the
    // model sending something this switch quietly ignores, and without this
    // there is no way to tell that from "no audio ever arrived".
    if (process.env.LOG_LEVEL === "debug") {
      log.debug("msg keys:", Object.keys(msg as object).join(","));
    }
    const m = msg as {
      setupComplete?: unknown;
      goAway?: { timeLeft?: string };
      serverContent?: {
        interrupted?: boolean;
        inputTranscription?: { text?: string };
        modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
      };
      toolCall?: { functionCalls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }> };
    };

    // setupComplete is the handshake ack: if this never arrives, the session
    // opened but the model is not actually listening.
    if (m.setupComplete !== undefined) log.info("setup complete — model is listening");
    if (m.goAway) log.warn(`server going away in ${m.goAway.timeLeft ?? "?"} — session will need to reconnect`);

    if (m.serverContent?.interrupted) this.opts.callbacks.onInterrupted();

    const transcript = m.serverContent?.inputTranscription?.text?.trim();
    if (transcript) this.opts.callbacks.onUserTranscript(transcript);

    for (const part of m.serverContent?.modelTurn?.parts ?? []) {
      const b64 = part.inlineData?.data;
      if (b64) this.opts.callbacks.onAudio(Buffer.from(b64, "base64"));
    }

    const calls = m.toolCall?.functionCalls ?? [];
    if (calls.length > 0) await this.dispatch(calls);
  }

  /**
   * Tool calls run in parallel. They're independent bot actions, and running
   * them serially would stack their latency inside a single turn.
   */
  private async dispatch(
    calls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>,
  ): Promise<void> {
    const responses = await Promise.all(
      calls.map(async (c) => {
        const name = c.name ?? "";
        const result = await this.opts.callbacks.onToolCall(name, c.args ?? {});
        return { id: c.id, name, response: { result } };
      }),
    );
    this.session?.sendToolResponse({ functionResponses: responses });
  }

  /** Stream mic audio in. 16kHz mono s16le. */
  sendAudio(pcm: Buffer): void {
    if (!this.session) return;
    this.session.sendRealtimeInput({
      audio: { data: pcm.toString("base64"), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
    });
  }

  /**
   * Inject ambient context (retrieved memory, world events) without it being
   * treated as something the user said out loud.
   */
  sendContext(text: string): void {
    if (!this.session || !text.trim()) return;
    this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: false,
    });
  }

  close(): void {
    try {
      this.session?.close();
    } catch {
      /* already gone */
    }
    this.session = null;
  }
}
