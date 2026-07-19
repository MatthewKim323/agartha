import { describe, expect, test } from "bun:test";
import { RunSkillInput, SKILL_NAMES, isSkillName, suggestSkill } from "@agartha/shared";
import { SKILLS, assertRegistryMatchesSchema } from "./index.js";

const byName = new Map(SKILLS.map((s) => [s.name, s]));

describe("registry integrity", () => {
  test("the schema enum and the implementations describe the same set", () => {
    expect(() => assertRegistryMatchesSchema()).not.toThrow();
  });

  test("no duplicate skill names", () => {
    expect(new Set(SKILLS.map((s) => s.name)).size).toBe(SKILLS.length);
  });

  test("run_skill rejects a name that isn't a real skill", () => {
    // The whole point of the enum: the model cannot emit a plausible-sounding
    // skill that doesn't exist and have it validate.
    expect(RunSkillInput.safeParse({ name: "mine_ore" }).success).toBe(false);
    expect(RunSkillInput.safeParse({ name: "get_wood" }).success).toBe(false);
    expect(RunSkillInput.safeParse({ name: "build_house" }).success).toBe(false);
    expect(RunSkillInput.safeParse({ name: "chop_tree" }).success).toBe(true);
  });

  test("near-miss names get a suggestion so a bad call self-corrects", () => {
    expect(suggestSkill("chop_trees")).toBe("chop_tree");
    expect(suggestSkill("mine_down_")).toBe("mine_down");
    expect(suggestSkill("huntt")).toBe("hunt");
  });

  test("isSkillName agrees with the enum", () => {
    for (const n of SKILL_NAMES) expect(isSkillName(n)).toBe(true);
    expect(isSkillName("definitely_not_a_skill")).toBe(false);
  });
});

/**
 * Pairs the voice model actually confuses. Each entry means "A's description
 * must name B", so that when the model is deciding between them the tie-breaker
 * is in the text it's reading rather than left to chance.
 *
 * This is the cheap, testable half of tool-call reliability. The expensive half
 * is an eval against the real model, which belongs in the RunType work — but a
 * description that never mentions its neighbour fails deterministically here,
 * before it ever costs a live turn.
 */
const MUST_DISAMBIGUATE: Array<[string, string]> = [
  // wood vs ore — the classic
  ["chop_tree", "mine_vein"],
  ["mine_vein", "chop_tree"],
  // which kind of mining
  ["mine_vein", "mine_down"],
  ["mine_down", "mine_vein"],
  ["tunnel", "mine_down"],
  ["tunnel", "mine_vein"],
  ["gather", "mine_vein"],
  // fight what
  ["hunt", "combat_assist"],
  ["combat_assist", "hunt"],
  // build how
  ["build", "build_helper"],
  ["build_helper", "build"],
  // item direction: to the player vs from a chest
  ["fetch_item", "give_item"],
  ["give_item", "fetch_item"],
  ["collect_drops", "fetch_item"],
  // crafting one thing vs a set
  ["craft", "make_tools"],
  ["make_tools", "craft"],
];

describe("tool-call disambiguation", () => {
  test("every skill has a description substantial enough to choose on", () => {
    for (const s of SKILLS) {
      expect(s.description.length).toBeGreaterThan(40);
    }
  });

  test.each(MUST_DISAMBIGUATE)("%s's description points at %s", (a, b) => {
    const skill = byName.get(a);
    expect(skill).toBeDefined();
    expect(skill!.description).toContain(b);
  });

  test("run_skill advertises every skill name to the model", () => {
    // The tool description is built by joining SKILLS — if a skill is missing
    // from it the model can't discover the capability exists.
    const advertised = SKILLS.map((s) => s.name).join(", ");
    for (const n of SKILL_NAMES) expect(advertised).toContain(n);
  });
});
