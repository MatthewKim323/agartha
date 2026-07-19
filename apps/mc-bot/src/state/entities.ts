/**
 * Entity classification: what a thing IS, and whether we're allowed to hit it.
 *
 * This replaces the old hardcoded HOSTILE set, which conflated two different
 * questions that happened to share an answer for 19 mob names:
 *
 *   "is this a threat I should report?"   → the state extractor's job
 *   "am I allowed to swing at this?"      → the combat targeting's job
 *
 * Keeping one Set for both meant the bot could only ever attack things it was
 * also afraid of, so cows and pigs were unhittable. Widening that Set would
 * have made the threat scanner report livestock as danger. They're separate
 * predicates now.
 *
 * Classification comes from minecraft-data via mineflayer, which tags every
 * entity with `type` ("animal", "hostile", "player", …) and `kind` (the
 * category: "Hostile mobs", "Passive mobs", …). That's 42 hostiles in 1.20.5
 * against the 19 we had hardcoded — we were silently ignoring slimes, guardians,
 * wither skeletons, zombified piglins, vexes, and the entire 1.21 mob set.
 * Deriving from the registry means new mobs work without a code change.
 */

/** The subset of a Mineflayer entity we classify on. Structural so it's testable. */
export interface ClassifiableEntity {
  id: number;
  /** Registry name, e.g. "zombie", "cow". Absent for some object entities. */
  name?: string;
  /** minecraft-data `type`: "animal" | "hostile" | "player" | "mob" | … */
  type?: string;
  /** minecraft-data `category`: "Hostile mobs" | "Passive mobs" | … */
  kind?: string;
  /** Set on player entities only. */
  username?: string;
}

/**
 * Name fallback for hostility, used only when the registry lookup came back
 * empty (unknown mob on a modded or newer server). Deliberately NOT the source
 * of truth — `kind` is.
 */
const HOSTILE_FALLBACK = new Set([
  "zombie", "husk", "drowned", "skeleton", "stray", "creeper",
  "spider", "cave_spider", "enderman", "witch", "phantom", "pillager",
  "vindicator", "ravager", "blaze", "ghast", "piglin", "hoglin", "warden",
]);

/**
 * Passive mobs we refuse to target as part of a *group* ("kill the animals").
 * Each is a specific regret:
 *   iron_golem  — categorized Passive, hits back for 21 hearts
 *   villager    — irreplaceable trades, and killing them tanks reputation
 *   wolf/cat/parrot — someone's pet
 *   allay       — rare, useful
 * Naming one explicitly still works; this only guards the broad sweeps.
 */
export const PROTECTED_PASSIVE = new Set([
  "iron_golem", "snow_golem", "villager", "wandering_trader",
  "wolf", "cat", "ocelot", "parrot", "allay", "horse", "donkey", "mule",
]);

/** Mobs worth killing for food and materials. The default `hunt` target. */
export const FOOD_ANIMALS = new Set([
  "cow", "pig", "sheep", "chicken", "rabbit", "mooshroom",
]);

/** Not living things — never valid combat targets regardless of the query. */
const NON_COMBAT_KINDS = new Set(["Projectiles", "Vehicles", "Immobile"]);
const NON_COMBAT_TYPES = new Set(["orb", "object", "projectile", "global", "other"]);

export function isHostile(e: ClassifiableEntity): boolean {
  if (e.kind === "Hostile mobs") return true;
  if (e.type === "hostile") return true;
  // Registry miss — fall back to the name list.
  if (!e.kind && !e.type && e.name) return HOSTILE_FALLBACK.has(e.name);
  return false;
}

export function isPassive(e: ClassifiableEntity): boolean {
  return e.kind === "Passive mobs" || e.type === "animal" || e.type === "water_creature";
}

export function isPlayer(e: ClassifiableEntity): boolean {
  return e.type === "player" || typeof e.username === "string";
}

/** A living thing that can meaningfully be attacked (excludes arrows, boats, item drops). */
export function isAttackable(e: ClassifiableEntity): boolean {
  if (!e.name && !e.username) return false;
  if (e.kind && NON_COMBAT_KINDS.has(e.kind)) return false;
  if (e.type && NON_COMBAT_TYPES.has(e.type)) return false;
  return true;
}

/**
 * Target groups the model can ask for by name, so it doesn't have to enumerate
 * mob names itself. Anything not listed here is treated as a literal mob name.
 */
export type TargetGroup = "hostile" | "monster" | "animal" | "food" | "passive" | "player" | "any";

const GROUPS = new Set<string>([
  "hostile", "monster", "animal", "food", "passive", "player", "any",
]);

export function isGroup(match: string): match is TargetGroup {
  return GROUPS.has(match);
}

export interface MatchOptions {
  /** Mob name ("cow") or a group ("hostile", "food"). Defaults to "hostile". */
  match?: string;
  /** Username the bot must never hit. */
  owner?: string;
  /** Allow players as targets. Off by default — PvP is opt-in, never inferred. */
  allowPlayers?: boolean;
}

/**
 * Does this entity satisfy the target query?
 *
 * The owner check is first and unconditional. There is no query — not "any",
 * not an explicit username match — that resolves to hitting the person the bot
 * works for.
 */
export function matchesTarget(e: ClassifiableEntity, opts: MatchOptions = {}): boolean {
  const match = (opts.match ?? "hostile").toLowerCase().trim();

  if (opts.owner && e.username === opts.owner) return false;
  if (!isAttackable(e)) return false;

  if (isPlayer(e)) {
    // Players are only ever hit when asked for by group or by username.
    if (!opts.allowPlayers) return false;
    if (match === "player" || match === "any") return true;
    return e.username?.toLowerCase() === match;
  }

  if (!isGroup(match)) {
    // Literal mob name. Explicit naming overrides the protected list — if you
    // say "kill that wolf", that's a decision, not an accident.
    return e.name?.toLowerCase() === match;
  }

  switch (match) {
    case "hostile":
    case "monster":
      return isHostile(e);
    case "food":
      return !!e.name && FOOD_ANIMALS.has(e.name);
    case "animal":
    case "passive":
      return isPassive(e) && !!e.name && !PROTECTED_PASSIVE.has(e.name);
    case "player":
      return false; // handled above; a non-player can't match
    case "any":
      // "any" means anything worth fighting, not literally anything. Protected
      // passives stay protected — a broad sweep should never eat a villager.
      return isHostile(e) || (isPassive(e) && !!e.name && !PROTECTED_PASSIVE.has(e.name));
  }
  return false;
}

/**
 * Attack cooldown for a weapon, in ms. Since 1.9 a swing before the cooldown
 * elapses deals a fraction of full damage, so swinging faster is strictly worse
 * than swinging on time. These are the vanilla attack-speed values.
 */
export function attackCooldownMs(weapon: string | null): number {
  if (!weapon) return 250; // fist: attack speed 4.0
  if (/_sword$/.test(weapon)) return 625; // attack speed 1.6
  if (/^(wooden|stone)_axe$/.test(weapon)) return 1250; // attack speed 0.8
  if (/^iron_axe$/.test(weapon)) return 1112; // attack speed 0.9
  if (/_axe$/.test(weapon)) return 1000; // diamond/netherite: attack speed 1.0
  return 500;
}

/**
 * Kept for the state extractor's threat scan, which asks a narrower question
 * than combat targeting does: "what should I warn about / flee from".
 */
export const HOSTILE = HOSTILE_FALLBACK;
