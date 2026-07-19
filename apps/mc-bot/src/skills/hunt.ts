import type { Skill, SkillContext } from "./types.js";
import { runWithTask } from "./types.js";
import { attackCooldownMs } from "../state/entities.js";
import { pickWeapon } from "./_combat.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * hunt(target, count) — kill non-hostile mobs for food and materials.
 *
 * The thing `combat_assist` structurally could not do: its targeting ran
 * through `nearestHostile`, so anything the bot wasn't afraid of was invisible
 * to it. Hunting is a different behaviour anyway, not just a different filter:
 *
 *   - prey RUNS. Cows and pigs flee the moment they're hit, so the target
 *     position has to be re-read every swing rather than pathed to once.
 *   - kills are counted, because "get me some food" has a finish condition
 *     that "the area is clear" doesn't.
 *   - drops are the entire point, so it always sweeps at the end.
 */
async function huntBody(ctx: SkillContext, args?: Record<string, unknown>): Promise<string> {
  const target = typeof args?.target === "string" ? args.target : "food";
  const count = typeof args?.count === "number" ? Math.max(1, Math.min(args.count, 16)) : 3;
  const maxRange = typeof args?.maxRange === "number" ? args.maxRange : 32;

  return runWithTask(ctx, async () => {
    const weapon = pickWeapon(ctx.control.getState().inventory);
    if (weapon) await ctx.control.equip(weapon);
    const cooldown = attackCooldownMs(weapon);

    let swings = 0;
    let escaped = 0;
    const killed = new Set<number>();
    let engagedId: number | null = null;

    // Bounded so a mob that can't be reached (across water, in a pen) ends the
    // skill instead of pinning the goal runner forever.
    for (let i = 0; i < 240 && killed.size < count; i++) {
      // Did the thing we were hitting die, or just get away? Those are
      // different outcomes and only one of them is food.
      if (engagedId !== null && !ctx.control.entityExists(engagedId)) {
        if (ctx.control.entityDied(engagedId)) killed.add(engagedId);
        else escaped++;
        engagedId = null;
        if (killed.size >= count) break;
      }

      const prey = ctx.control.nearestEntity({ match: target, maxDistance: maxRange });
      if (!prey) break;
      engagedId = prey.id;

      try {
        // Re-path every swing: prey flees, so a position read one second ago is
        // already wrong. moveTo is a no-op when we're already in range.
        if (prey.distance > 2.5) {
          await ctx.control.moveTo(prey.pos, { range: 2, sprint: true });
        }
        await ctx.control.attack(prey.id);
        swings++;
      } catch {
        // Out of reach, died mid-swing, or it moved. Re-target next pass.
      }
      await sleep(cooldown);
    }

    // One final check so the last kill of the loop is counted.
    if (engagedId !== null && !ctx.control.entityExists(engagedId)) {
      if (ctx.control.entityDied(engagedId)) killed.add(engagedId);
      else escaped++;
    }

    await ctx.control.collectNearbyDrops({ radius: 8 });

    const kills = killed.size;
    const what = target === "food" ? "food" : target;

    if (kills === 0 && swings === 0) return `couldn't find any ${what} around here`;
    if (kills === 0) return `swung at a ${what} but it got away`;
    // Escapes are reported because they're the difference between "we have
    // dinner" and "we chased something into a lake".
    const tail = escaped > 0 ? `, ${escaped} got away` : "";
    return `killed ${kills} ${what}${tail}`;
  });
}

export const hunt: Skill = {
  name: "hunt",
  description:
    "Kill animals or any specific mob — for food, leather, wool, feathers. Pass { target } as a mob " +
    "name ('cow', 'sheep') or a group ('food', 'animal'), and { count } (default 3). For fighting " +
    "monsters that are threatening the player use combat_assist instead.",
  run: huntBody,
};
