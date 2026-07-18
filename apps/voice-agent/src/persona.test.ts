import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { buildPersona, FALLBACK_PERSONA, SPEECH_RULES } from "./persona.js";

const JABBY_DIR = process.env.JABBY_DIR ?? "/Users/matthewkim/dev/jabby";
const haveJabby = existsSync(`${JABBY_DIR}/prompts/IDENTITY.md`);

describe("SPEECH_RULES", () => {
  test("bans the formatting that reads badly as audio", () => {
    expect(SPEECH_RULES).toContain("markdown");
    expect(SPEECH_RULES).toContain("emoji");
  });

  test("expands slang that TTS would spell out", () => {
    expect(SPEECH_RULES).toContain("good game");
  });

  test("states the speak-vs-chat distinction", () => {
    expect(SPEECH_RULES).toContain("chat is the in-game text");
  });

  test("tells the agent not to claim work is done early", () => {
    expect(SPEECH_RULES).toContain("before the tool says it is");
  });
});

describe("buildPersona", () => {
  test("degrades to the fallback when jabby is not configured", async () => {
    const p = await buildPersona(undefined);
    expect(p.loaded).toEqual([]);
    expect(p.missing.length).toBeGreaterThan(0);
    expect(p.text).toContain(FALLBACK_PERSONA);
  });

  test("degrades rather than throwing on a bad path", async () => {
    const p = await buildPersona("/nonexistent/path/xyz");
    expect(p.loaded).toEqual([]);
    expect(p.text).toContain(FALLBACK_PERSONA);
  });

  test("always appends the speech rules, even when falling back", async () => {
    expect((await buildPersona(undefined)).text).toContain("SPOKEN OUT LOUD");
  });

  test.skipIf(!haveJabby)("loads jabby's real prompt files", async () => {
    const p = await buildPersona(JABBY_DIR);
    expect(p.loaded).toContain("IDENTITY.md");
    expect(p.loaded).toContain("MINECRAFT_IDENTITY.md");
    expect(p.text).not.toContain(FALLBACK_PERSONA);
  });

  test.skipIf(!haveJabby)("inherits jabby's actual identity and house rules", async () => {
    const p = await buildPersona(JABBY_DIR);
    // The point of the whole exercise: same character, not a lookalike.
    expect(p.text.toLowerCase()).toContain("jabby");
    expect(p.text).toContain("em dash"); // house rule 2 carries through
  });

  test.skipIf(!haveJabby)("knows who matt is, which is the reason for sharing a brain", async () => {
    expect((await buildPersona(JABBY_DIR)).text.toLowerCase()).toContain("matt");
  });
});
