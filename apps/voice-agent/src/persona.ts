import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Persona, assembled from jabby's own prompt files.
 *
 * This is the concrete meaning of "part of jabby": there is no local copy of
 * the personality to drift. The predecessor had FIVE copies (the canonical
 * SYSTEM_PROMPT that nothing imported, the ElevenLabs agent persona, the nudge
 * PERSONA, the forward-to-brain prompt, and jabby's own voice PERSONA), each
 * describing a slightly different character.
 *
 * If jabby's identity changes, this changes with it on the next restart.
 */

/** Files merged in order. Missing ones are skipped, not fatal. */
const JABBY_PROMPTS = ["IDENTITY.md", "USER.md", "SOUL.md", "MINECRAFT_IDENTITY.md"] as const;

export interface PersonaSources {
  /** Which files were actually found, for startup logging. */
  loaded: string[];
  missing: string[];
  text: string;
}

/**
 * Spoken-output rules.
 *
 * Everything this agent emits becomes audio, so markdown, emoji, and raw
 * coordinate dumps read as noise. The slang expansions exist because
 * text-to-speech pronounces "gg" as a letter pair.
 */
export const SPEECH_RULES = `
## How you sound

Everything you say is SPOKEN OUT LOUD. Never emit markdown, bullet points,
headers, asterisks, emoji, or stage directions. No numbered lists.

Keep it to one or two sentences. This is a live call, not an essay. You are
mostly quiet: you listen far more than you talk.

Say things the way they're pronounced:
- "gg" -> "good game"
- "wtf" -> "what the fuck"
- "idk" -> "i dunno"
- "brb" -> "be right back"
- "afk" -> "away from keyboard"
- "irl" -> "in real life"
- "tp" -> "teleport"
- "diamonds x3" -> "three diamonds"

Don't read coordinates as raw numbers unless someone actually asks for them.
"just north of the base" beats "at 142, 64, negative 88".

## Your hands

You have a body in the Minecraft world and you drive it by calling tools.
When someone asks for something, call the tool. Don't narrate what you would
do, and don't claim something is finished before the tool says it is.

For anything multi-step, set a goal and acknowledge it out loud in a few words
("aight, otw", "on it"). The goal runs in the background and tells you when
it's done, and that's when you report back.

Two different things:
- speaking is what you say out loud in the call
- chat is the in-game text channel, which is a separate deliberate act
`.trim();

/**
 * Build the system prompt. Falls back to a minimal built-in persona if jabby's
 * files aren't reachable, so a bad path degrades the character rather than
 * preventing the agent from starting.
 */
export async function buildPersona(jabbyDir: string | undefined): Promise<PersonaSources> {
  const loaded: string[] = [];
  const missing: string[] = [];
  const parts: string[] = [];

  if (jabbyDir) {
    for (const file of JABBY_PROMPTS) {
      const path = join(jabbyDir, "prompts", file);
      if (!existsSync(path)) {
        missing.push(file);
        continue;
      }
      try {
        parts.push((await readFile(path, "utf8")).trim());
        loaded.push(file);
      } catch {
        missing.push(file);
      }
    }
  } else {
    missing.push(...JABBY_PROMPTS);
  }

  if (parts.length === 0) parts.push(FALLBACK_PERSONA);
  parts.push(SPEECH_RULES);

  return { loaded, missing, text: parts.join("\n\n---\n\n") };
}

/**
 * Used only when jabby's prompts can't be read. Deliberately thin: it should be
 * obviously degraded, so a misconfiguration is noticeable rather than silently
 * shipping a second personality that competes with the real one.
 */
export const FALLBACK_PERSONA = `
You are a chill friend playing Minecraft alongside someone, in a live voice
call. Not an assistant, not a narrator, not a coach. A duo partner who happens
to be good at the game. Casual, lowercase, short. Mostly quiet.
`.trim();
