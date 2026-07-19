import type { Vec3Lit } from "@agartha/shared";

/**
 * Structure geometry: turn a described shape into an ordered list of block
 * placements. Pure functions, no mineflayer — same discipline as _geometry.ts.
 *
 * This exists because `build_helper` required the *model* to author every
 * coordinate. That works for a five-block bridge and falls apart completely on
 * "build me a house": a 7x7 hut is ~180 placements, and a language model
 * emitting 180 correct coordinates over voice is not a thing that happens.
 *
 * So the model describes a shape and this expands it. The model's job goes from
 * "enumerate 180 coordinates" to "room, 7 by 7, oak planks".
 */

export interface Placement {
  pos: Vec3Lit;
  item: string;
}

export type ShapeKind = "floor" | "wall" | "box" | "room" | "pillar" | "roof";

export interface BuildSpec {
  shape: ShapeKind;
  /** Minimum corner: the lowest x, y, z of the structure's bounding box. */
  origin: Vec3Lit;
  /** X extent. Default 5. */
  width?: number;
  /** Z extent. Default 5. */
  length?: number;
  /** Y extent (wall height for room/box). Default 3. */
  height?: number;
  material: string;
  /** For `room`: leave a 1x2 doorway in the -Z wall. Default true. */
  door?: boolean;
  /** For `room`/`roof`: "flat" (default) or "gable" (pitched). */
  roofStyle?: "flat" | "gable";
  /** For `wall`: run along "x" (default) or "z". */
  axis?: "x" | "z";
}

const key = (p: Vec3Lit) => `${p.x},${p.y},${p.z}`;

/** The 6 face-adjacent neighbours. Placement support is face-based, not diagonal. */
const NEIGHBOURS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

function clampDim(n: number | undefined, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : fallback;
  // Upper bound is a guard against "build me a 500x500 castle" turning into a
  // 100k-placement goal that pins the runner for an hour.
  return Math.max(1, Math.min(v, 32));
}

// ── shape expansion ─────────────────────────────────────────────────────────

function floorSlab(o: Vec3Lit, w: number, l: number, y: number, item: string): Placement[] {
  const out: Placement[] = [];
  for (let dx = 0; dx < w; dx++) {
    for (let dz = 0; dz < l; dz++) {
      out.push({ pos: { x: o.x + dx, y, z: o.z + dz }, item });
    }
  }
  return out;
}

/** The four walls of a w x l footprint, `h` tall, starting at `y`. Hollow. */
function shell(o: Vec3Lit, w: number, l: number, h: number, y: number, item: string): Placement[] {
  const out: Placement[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      for (let dz = 0; dz < l; dz++) {
        const onEdge = dx === 0 || dx === w - 1 || dz === 0 || dz === l - 1;
        if (!onEdge) continue;
        out.push({ pos: { x: o.x + dx, y: y + dy, z: o.z + dz }, item });
      }
    }
  }
  return out;
}

/**
 * A pitched roof over a w x l footprint, ridge running along X. Each course
 * steps in from both Z edges and up one, until the courses meet.
 */
function gableRoof(o: Vec3Lit, w: number, l: number, y: number, item: string): Placement[] {
  const out: Placement[] = [];
  const steps = Math.ceil(l / 2);
  for (let s = 0; s < steps; s++) {
    const zLow = s;
    const zHigh = l - 1 - s;
    for (let dx = 0; dx < w; dx++) {
      out.push({ pos: { x: o.x + dx, y: y + s, z: o.z + zLow }, item });
      if (zHigh !== zLow) {
        out.push({ pos: { x: o.x + dx, y: y + s, z: o.z + zHigh }, item });
      }
    }
  }
  return out;
}

/**
 * Expand a spec into placements. Returns them in build order — see
 * `orderForPlacement`, which every shape result goes through.
 */
export function expandShape(spec: BuildSpec): Placement[] {
  const o = spec.origin;
  const w = clampDim(spec.width, 5);
  const l = clampDim(spec.length, 5);
  const h = clampDim(spec.height, 3);
  const item = spec.material;

  let blocks: Placement[];

  switch (spec.shape) {
    case "floor":
      blocks = floorSlab(o, w, l, o.y, item);
      break;

    case "pillar":
      blocks = Array.from({ length: h }, (_, dy) => ({
        pos: { x: o.x, y: o.y + dy, z: o.z },
        item,
      }));
      break;

    case "wall": {
      const along = spec.axis ?? "x";
      const span = along === "x" ? w : l;
      blocks = [];
      for (let dy = 0; dy < h; dy++) {
        for (let d = 0; d < span; d++) {
          blocks.push({
            pos: {
              x: o.x + (along === "x" ? d : 0),
              y: o.y + dy,
              z: o.z + (along === "z" ? d : 0),
            },
            item,
          });
        }
      }
      break;
    }

    case "box":
      blocks = shell(o, w, l, h, o.y, item);
      break;

    case "roof":
      blocks =
        (spec.roofStyle ?? "flat") === "gable"
          ? gableRoof(o, w, l, o.y, item)
          : floorSlab(o, w, l, o.y, item);
      break;

    case "room": {
      // floor at origin.y, walls above it, roof capping the walls.
      blocks = [
        ...floorSlab(o, w, l, o.y, item),
        ...shell(o, w, l, h, o.y + 1, item),
      ];
      const roofY = o.y + 1 + h;
      blocks.push(
        ...((spec.roofStyle ?? "flat") === "gable"
          ? gableRoof(o, w, l, roofY, item)
          : floorSlab(o, w, l, roofY, item)),
      );
      if (spec.door !== false) blocks = cutDoorway(blocks, o, w, l);
      break;
    }
  }

  return orderForPlacement(blocks);
}

/**
 * Remove a 1x2 doorway from the -Z wall, centred on X. Done by subtraction
 * rather than by never generating it, so the wall logic stays one code path.
 */
export function cutDoorway(blocks: Placement[], o: Vec3Lit, w: number, _l: number): Placement[] {
  const doorX = o.x + Math.floor(w / 2);
  const doorZ = o.z;
  const doorYs = new Set([o.y + 1, o.y + 2]);
  return blocks.filter((b) => !(b.pos.x === doorX && b.pos.z === doorZ && doorYs.has(b.pos.y)));
}

// ── ordering ────────────────────────────────────────────────────────────────

/**
 * Order placements so each one is face-adjacent to something already placed.
 *
 * This is the difference between a spec that builds and a spec that fails. A
 * block can only be placed against an existing face — you cannot place into
 * midair — so a naive list that puts a roof before its walls just errors out
 * on every roof block. The old build_helper had no ordering at all and reported
 * those failures as "short on materials", which was actively misleading.
 *
 * Strategy: BFS outward from the lowest layer (which rests on the ground, so it
 * has support from the world). Anything the BFS can't reach is appended at the
 * end — it genuinely needs scaffolding or an existing structure to attach to,
 * and the caller reports it honestly rather than pretending.
 */
export function orderForPlacement(blocks: Placement[]): Placement[] {
  if (blocks.length === 0) return [];

  const byKey = new Map<string, Placement>();
  for (const b of blocks) byKey.set(key(b.pos), b);

  const minY = Math.min(...blocks.map((b) => b.pos.y));
  // Seeds: the whole bottom layer. Sorted for determinism (tests, and so two
  // runs of the same spec place in the same order).
  const seeds = blocks
    .filter((b) => b.pos.y === minY)
    .sort((a, b) => a.pos.x - b.pos.x || a.pos.z - b.pos.z);

  const ordered: Placement[] = [];
  const seen = new Set<string>();
  const queue: Placement[] = [];

  for (const s of seeds) {
    const k = key(s.pos);
    if (seen.has(k)) continue;
    seen.add(k);
    ordered.push(s);
    queue.push(s);
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const nk = `${cur.pos.x + dx},${cur.pos.y + dy},${cur.pos.z + dz}`;
      if (seen.has(nk)) continue;
      const next = byKey.get(nk);
      if (!next) continue;
      seen.add(nk);
      ordered.push(next);
      queue.push(next);
    }
  }

  // Unreachable remainder — kept, but last, and the caller knows they may fail.
  for (const b of blocks) {
    const k = key(b.pos);
    if (!seen.has(k)) {
      seen.add(k);
      ordered.push(b);
    }
  }

  return ordered;
}

/** How many of each material a spec needs. Lets a skill pre-flight inventory. */
export function materialCost(blocks: Placement[]): Map<string, number> {
  const cost = new Map<string, number>();
  for (const b of blocks) cost.set(b.item, (cost.get(b.item) ?? 0) + 1);
  return cost;
}
