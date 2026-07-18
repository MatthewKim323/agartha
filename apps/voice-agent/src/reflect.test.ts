import { describe, expect, test } from "bun:test";
import type { GbrainClient } from "@agartha/memory";
import { formatSession, reflect, sessionSlug } from "./reflect.js";

const AT = new Date("2026-07-18T21:05:00Z");

/** Minimal stand-in; reflect only ever touches remember(). */
function fakeGbrain(result: boolean, spy?: (args: string[]) => void): GbrainClient {
  return {
    remember: async (slug: string, title: string, content: string) => {
      spy?.([slug, title, content]);
      return result;
    },
  } as unknown as GbrainClient;
}

describe("sessionSlug", () => {
  test("is namespaced and zero-padded so slugs sort", () => {
    const slug = sessionSlug(new Date(2026, 6, 8, 9, 5));
    expect(slug).toBe("minecraft/2026-07-08-0905");
  });

  test("two sessions in the same minute collide, different minutes do not", () => {
    expect(sessionSlug(new Date(2026, 0, 1, 3, 4))).toBe(sessionSlug(new Date(2026, 0, 1, 3, 4)));
    expect(sessionSlug(new Date(2026, 0, 1, 3, 4))).not.toBe(sessionSlug(new Date(2026, 0, 1, 3, 5)));
  });
});

describe("formatSession", () => {
  test("records who said what", () => {
    const out = formatSession([{ who: "matt", said: "let's build a base" }], AT, []);
    expect(out).toContain("**matt**: let's build a base");
  });

  test("collapses newlines so one utterance stays one bullet", () => {
    const out = formatSession([{ who: "matt", said: "line one\n\nline two" }], AT, []);
    expect(out).toContain("line one line two");
  });

  test("counts repeated tool use rather than listing duplicates", () => {
    const out = formatSession([], AT, ["chop_tree", "chop_tree", "chop_tree", "craft"]);
    expect(out).toContain("chop_tree x3");
    expect(out).toContain("craft");
  });

  test("orders tools by frequency", () => {
    // Match the summary line itself: searching the whole document for "a"
    // finds prose in the header, not the tool name.
    const out = formatSession([], AT, ["alpha", "beta", "beta"]);
    const summary = out.split("\n").find((l) => l.includes("beta"))!;
    expect(summary).toBe("beta x2, alpha");
  });

  test("omits empty sections", () => {
    expect(formatSession([], AT, ["chop_tree"])).not.toContain("What was said");
    expect(formatSession([{ who: "m", said: "hi" }], AT, [])).not.toContain("What got done");
  });

  test("attaches an action to the utterance that caused it", () => {
    const out = formatSession([{ who: "matt", said: "get wood", did: "chop_tree" }], AT, []);
    expect(out).toContain("did: chop_tree");
  });
});

describe("reflect", () => {
  test("writes nothing when the session was empty", async () => {
    let called = false;
    const ok = await reflect(fakeGbrain(true, () => (called = true)), [], [], AT);
    expect(ok).toBe(false);
    expect(called).toBe(false);
  });

  test("writes when there was speech", async () => {
    const args: string[][] = [];
    const ok = await reflect(fakeGbrain(true, (a) => args.push(a)), [{ who: "matt", said: "yo" }], [], AT);
    expect(ok).toBe(true);
    expect(args[0]![0]).toContain("minecraft/");
  });

  test("writes when there was only action and no speech", async () => {
    expect(await reflect(fakeGbrain(true), [], ["chop_tree"], AT)).toBe(true);
  });

  test("reports failure without throwing, since this runs during shutdown", async () => {
    expect(await reflect(fakeGbrain(false), [{ who: "matt", said: "yo" }], [], AT)).toBe(false);
  });
});
