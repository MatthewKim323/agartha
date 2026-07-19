import type { InventoryItem, Vec3Lit } from "@agartha/shared";
import { BuildInput } from "@agartha/shared";
import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";
import { expandShape, materialCost, type BuildSpec, type ShapeKind } from "./_structures.js";

/**
 * Blocks that are actually reasonable to build out of, best first. Used when
 * the model doesn't name a material — over voice "build me a house" almost
 * never comes with a material, and failing on that is a bad experience when
 * there's a stack of cobble right there.
 */
const BUILD_PRIORITY = [
  /^cobblestone$/, /_planks$/, /^stone$/, /^cobbled_deepslate$/, /^deepslate$/,
  /^dirt$/, /^sand$/, /^netherrack$/,
];

/** Never build with these even if they match — they're tools, ore, or precious. */
const NOT_BUILDING_MATERIAL = /^(.*_ore|raw_.*|.*_sword|.*_pickaxe|.*_axe|.*_shovel|.*_hoe|torch|.*_bed|tnt|chest|crafting_table|furnace)$/;

export function pickMaterial(inv: InventoryItem[], needed: number): string | null {
  for (const rx of BUILD_PRIORITY) {
    const hit = inv.find((i) => rx.test(i.name) && !NOT_BUILDING_MATERIAL.test(i.name) && i.count >= needed);
    if (hit) return hit.name;
  }
  // Nothing with enough on its own — take the biggest stack that's buildable.
  const fallback = inv
    .filter((i) => !NOT_BUILDING_MATERIAL.test(i.name))
    .sort((a, b) => b.count - a.count)[0];
  return fallback?.name ?? null;
}

/** Human-readable name for a shape, for the spoken report. */
const SHAPE_WORD: Record<ShapeKind, string> = {
  room: "shelter",
  box: "walls",
  floor: "floor",
  wall: "wall",
  pillar: "pillar",
  roof: "roof",
};

/**
 * build(shape, ...) — build a STRUCTURE from a description.
 *
 * The replacement for making the model author every coordinate. `build_helper`
 * still exists for exact placements, but a 7x7 room is ~180 blocks and no voice
 * model emits 180 correct coordinates. Here it says "room, 7 by 7, oak planks"
 * and the geometry layer expands, orders, and pre-flights it.
 */
export const build: Skill = {
  name: "build",
  description:
    "Build a structure from a description: { shape: 'room'|'floor'|'wall'|'box'|'pillar'|'roof', " +
    "width, length, height, material? }. USE THIS for 'build me a house/shelter/hut/wall/platform' — " +
    "'room' gives a complete little house with a doorway. It picks a material and a spot on its own " +
    "if you don't say. For placing specific blocks at exact coordinates, use build_helper instead.",
  async run(ctx, args) {
    const parsed = BuildInput.safeParse(args ?? {});
    if (!parsed.success) {
      return `build needs a shape — ${parsed.error.issues[0]?.message ?? "invalid spec"}`;
    }
    const input = parsed.data;

    return runWithTask(ctx, async () => {
      const state = ctx.control.getState();

      // Where. Default: a few blocks clear of the player (or the bot), settled
      // onto the ground so the structure isn't floating or buried.
      let origin = input.origin ?? defaultOrigin(state.player?.pos ?? null, state.self.pos);
      origin = ctx.control.findGround(origin) ?? origin;

      // What it costs. Expand once with a placeholder so we can size the
      // material need before choosing the material.
      const probe: BuildSpec = { ...input, shape: input.shape, origin, material: "placeholder" };
      const needed = expandShape(probe).length;

      const material = input.material ?? pickMaterial(state.inventory, needed);
      if (!material) return "i've got nothing to build with";

      const blocks = expandShape({ ...probe, material });
      const cost = materialCost(blocks).get(material) ?? 0;
      const have = state.inventory.filter((i) => i.name === material).reduce((a, i) => a + i.count, 0);

      const word = SHAPE_WORD[input.shape];
      if (have === 0) return `i don't have any ${material} to build that ${word} with`;

      const result = await ctx.control.placeMany(blocks);
      const nice = material.replace(/_/g, " ");

      if (result.placed === 0) {
        return `couldn't get that ${word} started — nothing would place there`;
      }

      const parts = [`built you a ${nice} ${word} (${result.placed} blocks)`];
      if (have < cost) parts.push(`ran out of ${nice} ${cost - have} short`);
      else if (result.failed > 0) parts.push(`${result.failed} blocks wouldn't place`);
      if (result.skipped > 0) parts.push(`${result.skipped} were already solid`);
      return parts.join(", ");
    });
  },
};

/**
 * Pick a spot near the player, offset so the bot doesn't try to build a floor
 * under someone's feet. Floored to block coords — a structure has to be grid
 * aligned or every placement is off by a fraction.
 */
export function defaultOrigin(player: Vec3Lit | null, self: Vec3Lit): Vec3Lit {
  const base = player ?? self;
  return { x: Math.floor(base.x) + 2, y: Math.floor(base.y), z: Math.floor(base.z) + 2 };
}
