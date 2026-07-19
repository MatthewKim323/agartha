// MUST be first: neutralizes native @discordjs/opus before prism can load it.
import "./opus-patch.js";

import { Client as DiscordClient, GatewayIntentBits } from "discord.js";
import { GbrainClient, formatMemory } from "@agartha/memory";
import { startTrace, formatStats, traceStats } from "@agartha/shared";
import { VoiceHub } from "./voice.js";
import { discordToModel, modelToDiscord } from "./audio.js";
import { LiveSession, OUTPUT_SAMPLE_RATE } from "./live.js";
import { McClient } from "./mc.js";
import { buildPersona } from "./persona.js";
import { reflect, type SessionExchange } from "./reflect.js";
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

  // Retrieved context for the NEXT turn. Never awaited before speaking.
  let memoryBlock = "";
  let memoryInflight = false;

  // Session record, for the post-call reflection write.
  const exchanges: SessionExchange[] = [];
  const toolsUsed: string[] = [];

  const hub = new VoiceHub((pcm48) => live.sendAudio(discordToModel(pcm48)));

  const turns = new TurnQueue(async (text) => {
    exchanges.push({ who: "matt", said: text });
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
    tools: mc.functionDeclarations,
    callbacks: {
      onAudio: (pcm) => hub.play(modelToDiscord(pcm, OUTPUT_SAMPLE_RATE)),
      onInterrupted: () => hub.flush(),
      onUserTranscript: (text) => turns.push(text),
      onToolCall: async (name, args) => {
        const t = startTrace("tool");
        const result = await mc.call(name, args);
        t.mark("dispatched");
        t.end("ok");
        toolsUsed.push(name);
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
      await hub.join(guild, channelId);
      await live.start();
      log.info("in the call");
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
    turns.reset();
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
