// MUST be first: neutralizes native @discordjs/opus before prism can load it.
import "./opus-patch.js";

import { Client as DiscordClient, GatewayIntentBits } from "discord.js";
import { EpisodicMemory, GbrainClient, formatMemory } from "@agartha/memory";
import { startTrace, formatStats, traceStats } from "@agartha/shared";
import { VoiceHub } from "./voice.js";
import { discordToModel, modelToDiscord } from "./audio.js";
import { LiveSession, OUTPUT_SAMPLE_RATE } from "./live.js";
import { McClient } from "./mc.js";
import { buildPersona } from "./persona.js";
import { callMemoryTool, isMemoryTool, MEMORY_TOOLS } from "./memory-tools.js";
import { reflect, type SessionExchange } from "./reflect.js";
import { Dashboard } from "./dashboard.js";
import { TurnQueue } from "./turn-queue.js";
import { logger } from "./log.js";

const log = logger("agent");

/**
 * The voice agent.
 *
 * Three lanes, and the ordering rule that defines the whole design: nothing
 * slow is allowed in front of speech.
 *
 *   reflex        15Hz, in the bot process, no LLM
 *   conversation  this file — audio in, audio out, tools dispatched directly
 *   reflection    memory retrieval, always speculative, never awaited
 */

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const geminiKey = env("GEMINI_API_KEY");
  const discordToken = env("AGARTHA_DISCORD_TOKEN");
  const guildId = env("DISCORD_GUILD_ID");
  const channelId = env("DISCORD_VOICE_CHANNEL_ID");

  const missing = [
    ["GEMINI_API_KEY", geminiKey],
    ["AGARTHA_DISCORD_TOKEN", discordToken],
    ["DISCORD_GUILD_ID", guildId],
    ["DISCORD_VOICE_CHANNEL_ID", channelId],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    log.error(`missing required config: ${missing.join(", ")}`);
    process.exit(1);
  }

  // ── persona: jabby's, not a local copy ──
  const persona = await buildPersona(env("JABBY_DIR") || undefined);
  log.info(`persona: ${persona.loaded.join(", ") || "FALLBACK"}${persona.missing.length ? ` (missing: ${persona.missing.join(", ")})` : ""}`);
  if (persona.loaded.length === 0) {
    log.warn("running on the fallback persona — this agent will not sound like jabby");
  }

  // ── the bot's control surface ──
  const mc = new McClient(env("AGARTHA_MCP_URL", "http://localhost:3001/mcp"), env("MCP_AUTH_TOKEN") || undefined);
  try {
    await mc.connect();
    log.info(`bot connected: ${mc.functionDeclarations.length} tools`);
  } catch (e) {
    // Voice without hands still beats no voice; the bot may come up later.
    log.warn(`bot not reachable yet (${(e as Error).message}) — starting without tools`);
  }

  // ── shared memory ──
  const gbrain = new GbrainClient({
    url: env("GBRAIN_MCP_URL", "http://localhost:3131/mcp"),
    token: env("GBRAIN_TOKEN"),
    timeoutMs: 2000,
  });
  log.info(gbrain.enabled ? "gbrain enabled" : "gbrain disabled (no token) — running without memory");

  // ── episodic memory: what the agent HAS DONE ──
  // Separate store from gbrain on purpose. gbrain is semantic and private;
  // this is behavioural, and it is what makes the history() tool possible.
  // Writes are fire-and-forget so telemetry can never slow a turn.
  const episodic = new EpisodicMemory({
    url: env("INSFORGE_URL"),
    apiKey: env("INSFORGE_API_KEY"),
  });
  if (episodic.enabled) {
    const sid = await episodic.startSession({
      world: env("MC_SERVER_HOST"),
      player: env("MC_OWNER_USERNAME"),
    });
    log.info(sid ? `episodic memory recording (session ${sid.slice(0, 8)})` : "episodic memory unreachable");
  } else {
    log.info("episodic memory disabled (no InsForge config)");
  }

  // ── live coordination view ──
  let reliabilityCache: Array<Record<string, unknown>> = [];
  const dash = new Dashboard(() => ({
    startedAt,
    session: episodic.currentSession,
    persona: persona.loaded,
    connected: {
      bot: mc.connected,
      gbrain: gbrain.enabled,
      episodic: episodic.enabled,
      live: live.connected,
    },
    counters: {
      turns: stats.transcripts,
      tools: stats.tools,
      "mic kb": Math.round(stats.micBytes / 1024),
    },
    reliability: reliabilityCache,
  }));
  if (env("DASHBOARD_PORT")) {
    dash.start(Number(env("DASHBOARD_PORT")));
    // Refresh reliability off the hot path; it is a DB round trip.
    setInterval(() => {
      void episodic.toolReliability().then((r) => (reliabilityCache = r)).catch(() => {});
    }, 5000);

    // The reflex loop runs in the BOT process, so surface its real state rather
    // than inventing ticks here. This shows what the body is actually doing
    // while the conversation lane is busy — which is the whole point of the
    // three-lane split.
    let lastReflex = "";
    setInterval(() => {
      if (!mc.connected) return;
      void mc
        .call("get_goal", {})
        .then((r) => {
          const goal = /no current goal/i.test(r) ? "idle" : r.slice(0, 40);
          if (goal !== lastReflex) {
            lastReflex = goal;
            dash.push("reflex", goal);
          }
        })
        .catch(() => {});
    }, 1000);
  }

  // Retrieved context for the NEXT turn. Never awaited before speaking.
  let memoryBlock = "";
  let memoryInflight = false;

  // Session record, for the post-call reflection write.
  const exchanges: SessionExchange[] = [];
  const toolsUsed: string[] = [];

  /**
   * Audio-path counters.
   *
   * Without these, "it isn't talking back" is undiagnosable: you cannot tell
   * whether the mic is silent, the model never answered, or playback is
   * dropping. Each stage gets a counter and they print together, so the first
   * zero in the chain tells you where it broke.
   */
  const stats = { micFrames: 0, micBytes: 0, modelChunks: 0, modelBytes: 0, transcripts: 0, tools: 0 };
  let lastReport = "";
  setInterval(() => {
    const line = `mic ${stats.micFrames}f/${Math.round(stats.micBytes / 1024)}kb | model ${stats.modelChunks}c/${Math.round(stats.modelBytes / 1024)}kb | transcripts ${stats.transcripts} | tools ${stats.tools}`;
    if (line !== lastReport) {
      log.info(`audio: ${line}`);
      lastReport = line;
    }
  }, 5000);

  /**
   * Continuous input clock.
   *
   * Gemini's VAD decides your turn ended by HEARING silence. Discord's receiver
   * only emits frames while someone is actually speaking, so if we forward
   * frames as they arrive, the model gets speech and then nothing — no silence,
   * so the turn never closes and it waits forever. Measured: without this the
   * transcript truncates mid-sentence and no reply is ever generated.
   *
   * So we run a 20ms clock and always send something: mic audio when there is
   * any, silence otherwise. This mirrors the playback side, which already pads
   * with silence for the same class of reason.
   */
  const FRAME_MS = 20;
  const MODEL_FRAME_BYTES = (16_000 * 2 * FRAME_MS) / 1000; // 640 bytes @16kHz mono
  const SILENCE = Buffer.alloc(MODEL_FRAME_BYTES);
  let micBuffer = Buffer.alloc(0);

  const hub = new VoiceHub((pcm48) => {
    stats.micFrames++;
    stats.micBytes += pcm48.length;
    micBuffer = Buffer.concat([micBuffer, discordToModel(pcm48)]);
  });

  setInterval(() => {
    if (!live.connected) return;
    let frame: Buffer;
    if (micBuffer.length >= MODEL_FRAME_BYTES) {
      frame = micBuffer.subarray(0, MODEL_FRAME_BYTES);
      micBuffer = micBuffer.subarray(MODEL_FRAME_BYTES);
      // Don't let a backlog build if decoding briefly outruns the clock.
      if (micBuffer.length > MODEL_FRAME_BYTES * 25) micBuffer = micBuffer.subarray(micBuffer.length - MODEL_FRAME_BYTES * 25);
    } else {
      frame = SILENCE;
    }
    live.sendAudio(frame);
  }, FRAME_MS);

  const turns = new TurnQueue(async (text) => {
    exchanges.push({ who: "matt", said: text });
    episodic.recordUtterance({ heard: text });
    const t = startTrace("utterance");
    t.mark("turn_start");
    // Hand the model whatever memory has already landed, then refresh behind
    // the reply. Awaiting retrieval here is the predecessor's ~2.4s mistake.
    if (memoryBlock) {
      live.sendContext(memoryBlock);
      t.mark("memory_injected");
    }
    void refreshMemory(text);
    t.end("dispatched");
  });

  function refreshMemory(query: string): void {
    if (!gbrain.enabled || memoryInflight) return;
    memoryInflight = true;
    void gbrain
      .recall(query)
      .then((res) => {
        memoryBlock = formatMemory(res.hits);
        if (res.hits.length) log.debug(`gbrain: ${res.hits.length} hits in ${res.ms}ms (ready for next turn)`);
      })
      .catch(() => {})
      .finally(() => {
        memoryInflight = false;
      });
  }

  const live = new LiveSession({
    apiKey: geminiKey,
    systemInstruction: persona.text,
    // Bot tools plus memory tools. Memory is callable, not just ambient:
    // when someone asks a direct question about their own life, the agent has
    // to actually go and look. Affordable because recall is ~25ms.
    tools: [...mc.functionDeclarations, ...MEMORY_TOOLS],
    callbacks: {
      onAudio: (pcm) => {
        stats.modelChunks++;
        stats.modelBytes += pcm.length;
        hub.play(modelToDiscord(pcm, OUTPUT_SAMPLE_RATE));
      },
      onInterrupted: () => hub.flush(),
      onUserTranscript: (text) => {
        stats.transcripts++;
        log.info(`heard: "${text}"`);
        dash.push("voice", `heard: ${text.slice(0, 40)}`);
        turns.push(text);
      },
      onToolCall: async (name, args) => {
        const t = startTrace("tool");
        const result = isMemoryTool(name)
          ? await callMemoryTool(gbrain, name, args, new Date(), episodic)
          : await mc.call(name, args);
        t.mark("dispatched");
        const rec = t.end("ok");
        // A tool that reports failure in its text is a failure. Recording that
        // honestly is what makes tool_reliability worth querying.
        const failed = /^(that failed|couldn't|error|unknown)/i.test(result);
        episodic.recordToolCall({
          tool: name,
          args,
          result,
          ok: !failed,
          duration_ms: rec.totalMs,
          trace_id: rec.id,
        });
        stats.tools++;
        toolsUsed.push(name);
        dash.push(isMemoryTool(name) ? "memory" : "action", name, { ms: rec.totalMs, ok: !failed });
        // Attach the action to the utterance that prompted it, so the session
        // page reads as cause and effect rather than two parallel lists.
        const last = exchanges[exchanges.length - 1];
        if (last) last.did = last.did ? `${last.did}, ${name}` : name;
        log.info(`tool ${name} -> ${result.slice(0, 80)}`);
        return result;
      },
    },
  });

  // ── Discord ──
  const discord = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  discord.once("clientReady", async () => {
    log.info(`discord ready as ${discord.user?.tag}`);
    // An async listener that throws becomes an unhandled 'error' event and
    // takes the whole process down with a stack trace. Fail with something
    // actionable instead.
    try {
      const guild = await discord.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      await hub.join(guild, channelId);
      await live.start();
      // Name the channel explicitly: "in the call" is useless when you're
      // staring at Discord wondering which one to click.
      log.info(`>>> LISTENING in "${channel?.name ?? channelId}" (${guild.name}) — join that channel and talk <<<`);
    } catch (e) {
      log.error(`could not join voice: ${(e as Error).message}`);
      log.error(`guild=${guildId} channel=${channelId}`);
      live.close();
      discord.destroy();
      process.exit(1);
    }
  });
  await discord.login(discordToken);

  const shutdown = async () => {
    log.info("shutting down");
    const stats = traceStats("utterance");
    if (stats.length) log.info(`latency:\n${formatStats(stats)}`);
    // Reflection runs here, after the call, never in the speech path.
    await reflect(gbrain, exchanges, toolsUsed).catch(() => false);
    await episodic
      .endSession(exchanges.map((e) => e.said).join(" | ").slice(0, 500), {
        tools: toolsUsed.length,
        utterances: exchanges.length,
      })
      .catch(() => {});
    turns.reset();
    dash.stop();
    live.close();
    hub.leave();
    await mc.close();
    await gbrain.close();
    discord.destroy();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  log.error("fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
