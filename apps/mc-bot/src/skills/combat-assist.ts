import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";
import { attackCooldownMs } from "../state/entities.js";
import { pickWeapon } from "./_combat.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * combat_assist() — equip the best weapon, engage the hostile most threatening
 * to the player, attack on a cooldown, and disengage when the area's clear or
 * the player wanders off (no infinite chasing). The fast-loop creeper reflex
 * still runs concurrently, so itto won't suicide into a creeper here.
 *
 * Takes an optional { target } so "go kill that skeleton" works, but defaults
 * to the threat-ranked hostile scan, which is what "help me fight" means.
 *
 * Two changes beyond targeting:
 *   - the swing timer comes from the equipped weapon rather than a fixed 600ms.
 *     Since 1.9, swinging before the cooldown elapses deals a fraction of full
 *     damage, so a wooden axe (1250ms) on a sword's rhythm was throwing away
 *     most of its damage.
 *   - the bot only re-paths when actually out of reach. It used to call moveTo
 *     every single pass, which restarts pathfinding mid-fight and produces the
 *     stutter-step where it walks instead of swinging.
 */
export const combatAssist: Skill = {
  name: "combat_assist",
  description:
    "Fight nearby hostile mobs threatening the player. Equips a weapon, engages the closest threat, " +
    "disengages when clear. Pass { target } to fight something specific. To kill animals for food " +
    "use hunt instead.",
  async run(ctx, args) {
    const maxRange = typeof args?.maxRange === "number" ? args.maxRange : 16;
    const match = typeof args?.target === "string" ? args.target : "hostile";

    return runWithTask(ctx, async () => {
      const weapon = pickWeapon(ctx.control.getState().inventory);
      if (weapon) await ctx.control.equip(weapon);
      const cooldown = attackCooldownMs(weapon);

      let engaged = false;
      for (let i = 0; i < 120; i++) {
        const player = ctx.control.getState().player;
        if (player?.distance != null && player.distance > 24) {
          return engaged ? "fell back to you" : "you walked off, standing down";
        }
        const target = ctx.control.nearestEntity({
          match,
          maxDistance: maxRange,
          preferThreatTo: player?.pos ?? undefined,
        });
        if (!target) break;
        engaged = true;
        try {
          if (target.distance > 2.5) {
            await ctx.control.moveTo(target.pos, { range: 2, sprint: true });
          }
          await ctx.control.attack(target.id);
        } catch {
          /* target moved or died mid-swing — re-target next loop */
        }
        await sleep(cooldown);
      }
      return engaged ? "cleared the area" : "nothing to fight";
    });
  },
};
