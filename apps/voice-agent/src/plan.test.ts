import { describe, expect, test } from "bun:test";
import { SKILL_NAMES } from "@agartha/shared";
import { extractJson, parsePlan, speakablePlan, PLAN_TOOL, Planner } from "./plan.js";

describe("extractJson", () => {
  test("parses a bare object, which is what the agent is told to return", () => {
    expect(extractJson('{"summary":"ok","steps":[]}')).toEqual({ summary: "ok", steps: [] });
  });

  test("survives a markdown fence", () => {
    expect(extractJson('```json\n{"summary":"ok"}\n```')).toEqual({ summary: "ok" });
  });

  test("survives prose around the object", () => {
    expect(extractJson('Here is the plan:\n{"summary":"ok"}\nHope that helps!')).toEqual({ summary: "ok" });
  });

  test("returns null rather than throwing on garbage", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("{not valid}")).toBeNull();
    expect(extractJson("")).toBeNull();
  });
});

describe("parsePlan", () => {
  test("keeps steps naming real skills", () => {
    const plan = parsePlan(
      { summary: "get wood then dig", steps: [{ skill: "chop_tree", why: "need logs" }], risks: [] },
      120,
    );
    expect(plan?.steps).toHaveLength(1);
    expect(plan?.steps[0]?.skill).toBe("chop_tree");
    expect(plan?.dropped).toEqual([]);
    expect(plan?.ms).toBe(120);
  });

  /**
   * The local model cannot invent a skill name because `run_skill` takes an
   * enum. The remote planner has no such constraint — it is a prompt, and
   * prompts drift. This is that same guarantee re-established on the way back
   * in, so an invented skill never reaches the goal runner.
   */
  test("drops invented skills and reports them", () => {
    const plan = parsePlan(
      {
        summary: "do stuff",
        steps: [
          { skill: "chop_tree" },
          { skill: "build_nether_portal" },
          { skill: "mine_iron" },
          { skill: "craft", args: { item: "stone_pickaxe" } },
        ],
        risks: ["might be slow"],
      },
      500,
    );
    expect(plan?.steps.map((s) => s.skill)).toEqual(["chop_tree", "craft"]);
    expect(plan?.dropped).toEqual(["build_nether_portal", "mine_iron"]);
  });

  test("every declared skill name is accepted", () => {
    const plan = parsePlan({ summary: "all", steps: SKILL_NAMES.map((skill) => ({ skill })) }, 1);
    expect(plan?.steps).toHaveLength(SKILL_NAMES.length);
    expect(plan?.dropped).toEqual([]);
  });

  test("preserves args and drops non-object args", () => {
    const plan = parsePlan(
      { summary: "s", steps: [{ skill: "tunnel", args: { length: 16 } }, { skill: "chop_tree", args: "nope" }] },
      1,
    );
    expect(plan?.steps[0]?.args).toEqual({ length: 16 });
    expect(plan?.steps[1]?.args).toBeUndefined();
  });

  test("returns null when there is nothing usable", () => {
    expect(parsePlan(null, 1)).toBeNull();
    expect(parsePlan("a string", 1)).toBeNull();
    expect(parsePlan({ steps: [{ skill: "not_a_skill" }] }, 1)).toBeNull();
  });

  test("a summary with no valid steps still counts as a plan", () => {
    // The agent is told to explain itself when a goal isn't servable by the
    // skill set. That explanation is worth speaking.
    const plan = parsePlan({ summary: "can't do that with what i've got", steps: [] }, 1);
    expect(plan?.summary).toBe("can't do that with what i've got");
  });
});

describe("speakablePlan", () => {
  test("leads with the spoken summary", () => {
    const out = speakablePlan({ summary: "wood first", steps: [{ skill: "chop_tree" }], risks: [], dropped: [], ms: 1 });
    expect(out.startsWith("wood first")).toBe(true);
    expect(out).toContain("chop_tree");
  });

  test("mentions dropped skills so a gap in the skill set is visible", () => {
    const out = speakablePlan({ summary: "s", steps: [], risks: [], dropped: ["smelt_ore"], ms: 1 });
    expect(out).toContain("smelt_ore");
  });

  test("caps risks so it stays sayable", () => {
    const out = speakablePlan({ summary: "s", steps: [], risks: ["a", "b", "c", "d"], dropped: [], ms: 1 });
    expect(out).toContain("a");
    expect(out).not.toContain("d");
  });
});

describe("Planner", () => {
  test("is disabled without config, and disabled means inert", async () => {
    const p = new Planner({});
    expect(p.enabled).toBe(false);
    expect(await p.plan("build a base", "")).toBeNull();
  });

  test("is disabled with a url but no key", () => {
    expect(new Planner({ url: "https://example.com/mcp" }).enabled).toBe(false);
  });

  test("an empty goal never leaves the process", async () => {
    const p = new Planner({ url: "https://example.com/mcp", key: "mcp_x" });
    expect(p.enabled).toBe(true);
    expect(await p.plan("   ", "")).toBeNull();
  });
});

describe("PLAN_TOOL", () => {
  /**
   * The description is what keeps this off the fast path. If it stops telling
   * the model that the tool is slow and returns nothing useful immediately,
   * the model will sit in silence waiting for a plan.
   */
  test("warns the model that it is slow and returns immediately", () => {
    expect(PLAN_TOOL.description).toMatch(/second/i);
    expect(PLAN_TOOL.description).toMatch(/immediately|keep talking/i);
  });

  test("takes a goal", () => {
    expect(PLAN_TOOL.parameters?.required).toEqual(["goal"]);
  });
});
