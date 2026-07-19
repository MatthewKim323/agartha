import { describe, expect, test } from "bun:test";
import {
  attackCooldownMs,
  isHostile,
  isPassive,
  matchesTarget,
  type ClassifiableEntity,
} from "./entities.js";

/** Entities shaped the way mineflayer builds them from minecraft-data. */
const cow: ClassifiableEntity = { id: 1, name: "cow", type: "animal", kind: "Passive mobs" };
const zombie: ClassifiableEntity = { id: 2, name: "zombie", type: "hostile", kind: "Hostile mobs" };
const slime: ClassifiableEntity = { id: 3, name: "slime", type: "mob", kind: "Hostile mobs" };
const villager: ClassifiableEntity = { id: 4, name: "villager", type: "villager", kind: "Passive mobs" };
const golem: ClassifiableEntity = { id: 5, name: "iron_golem", type: "mob", kind: "Passive mobs" };
const owner: ClassifiableEntity = { id: 6, username: "sachi1234", type: "player" };
const stranger: ClassifiableEntity = { id: 7, username: "griefer99", type: "player" };
const arrow: ClassifiableEntity = { id: 8, name: "arrow", type: "projectile", kind: "Projectiles" };
const drop: ClassifiableEntity = { id: 9, name: "item", type: "object", kind: "UNKNOWN" };

describe("classification", () => {
  test("hostiles come from the registry, not a hardcoded list", () => {
    expect(isHostile(zombie)).toBe(true);
    // slime was NOT in the old 19-name set — the exact class of bug this fixes.
    expect(isHostile(slime)).toBe(true);
    expect(isHostile(cow)).toBe(false);
  });

  test("falls back to names only when the registry lookup came back empty", () => {
    expect(isHostile({ id: 10, name: "creeper" })).toBe(true);
    expect(isHostile({ id: 11, name: "some_modded_thing" })).toBe(false);
  });

  test("passive covers animals", () => {
    expect(isPassive(cow)).toBe(true);
    expect(isPassive(zombie)).toBe(false);
  });
});

describe("target matching", () => {
  test("the bug: animals are targetable", () => {
    expect(matchesTarget(cow, { match: "cow" })).toBe(true);
    expect(matchesTarget(cow, { match: "food" })).toBe(true);
    expect(matchesTarget(cow, { match: "animal" })).toBe(true);
  });

  test("hostile targeting still works and is now wider", () => {
    expect(matchesTarget(zombie, { match: "hostile" })).toBe(true);
    expect(matchesTarget(slime, { match: "hostile" })).toBe(true);
    expect(matchesTarget(cow, { match: "hostile" })).toBe(false);
  });

  test("the owner is never a target, under any query", () => {
    for (const match of ["any", "player", "sachi1234", "hostile"]) {
      expect(matchesTarget(owner, { match, owner: "sachi1234", allowPlayers: true })).toBe(false);
    }
  });

  test("players require opt-in", () => {
    expect(matchesTarget(stranger, { match: "any" })).toBe(false);
    expect(matchesTarget(stranger, { match: "griefer99" })).toBe(false);
    expect(matchesTarget(stranger, { match: "griefer99", allowPlayers: true })).toBe(true);
  });

  test("group sweeps spare villagers and golems, naming them does not", () => {
    expect(matchesTarget(villager, { match: "animal" })).toBe(false);
    expect(matchesTarget(golem, { match: "any" })).toBe(false);
    // Explicit is a decision, not an accident.
    expect(matchesTarget(villager, { match: "villager" })).toBe(true);
  });

  test("non-living entities are never targets", () => {
    expect(matchesTarget(arrow, { match: "any" })).toBe(false);
    expect(matchesTarget(drop, { match: "any" })).toBe(false);
    expect(matchesTarget(arrow, { match: "arrow" })).toBe(false);
  });

  test("defaults to hostile when no match is given", () => {
    expect(matchesTarget(zombie)).toBe(true);
    expect(matchesTarget(cow)).toBe(false);
  });
});

describe("attack cooldown", () => {
  test("tracks vanilla attack speed per weapon class", () => {
    expect(attackCooldownMs("iron_sword")).toBe(625);
    expect(attackCooldownMs("wooden_axe")).toBe(1250);
    expect(attackCooldownMs("diamond_axe")).toBe(1000);
    expect(attackCooldownMs(null)).toBe(250);
  });

  test("an axe waits longer than a sword — the old fixed 600ms under-hit both", () => {
    expect(attackCooldownMs("stone_axe")).toBeGreaterThan(attackCooldownMs("stone_sword"));
  });
});
