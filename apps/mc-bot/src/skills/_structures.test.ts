import { describe, expect, test } from "bun:test";
import {
  expandShape,
  materialCost,
  orderForPlacement,
  type BuildSpec,
  type Placement,
} from "./_structures.js";

const O = { x: 0, y: 64, z: 0 };
const spec = (over: Partial<BuildSpec>): BuildSpec => ({
  shape: "floor",
  origin: O,
  material: "oak_planks",
  ...over,
});

const key = (p: { x: number; y: number; z: number }) => `${p.x},${p.y},${p.z}`;
const adjacent = (a: Placement, b: Placement): boolean => {
  const d = Math.abs(a.pos.x - b.pos.x) + Math.abs(a.pos.y - b.pos.y) + Math.abs(a.pos.z - b.pos.z);
  return d === 1;
};

describe("shape expansion", () => {
  test("floor is a solid slab", () => {
    const b = expandShape(spec({ shape: "floor", width: 4, length: 3 }));
    expect(b).toHaveLength(12);
    expect(b.every((p) => p.pos.y === 64)).toBe(true);
  });

  test("pillar goes up, not out", () => {
    const b = expandShape(spec({ shape: "pillar", height: 5 }));
    expect(b).toHaveLength(5);
    expect(b.map((p) => p.pos.y)).toEqual([64, 65, 66, 67, 68]);
  });

  test("box is hollow — the interior is not filled", () => {
    const b = expandShape(spec({ shape: "box", width: 5, length: 5, height: 2 }));
    // Perimeter of 5x5 is 16 per layer, 2 layers.
    expect(b).toHaveLength(32);
    const hasCentre = b.some((p) => p.pos.x === 2 && p.pos.z === 2);
    expect(hasCentre).toBe(false);
  });

  test("wall runs along the requested axis", () => {
    const x = expandShape(spec({ shape: "wall", width: 6, height: 2, axis: "x" }));
    expect(new Set(x.map((p) => p.pos.z)).size).toBe(1);
    const z = expandShape(spec({ shape: "wall", length: 6, height: 2, axis: "z" }));
    expect(new Set(z.map((p) => p.pos.x)).size).toBe(1);
  });

  test("a room has a floor, walls, a roof, and a hole to walk through", () => {
    const b = expandShape(spec({ shape: "room", width: 5, length: 5, height: 3 }));
    const ys = new Set(b.map((p) => p.pos.y));
    expect(ys.has(64)).toBe(true); // floor
    expect(ys.has(65)).toBe(true); // walls
    expect(ys.has(68)).toBe(true); // roof caps 3 wall courses (65,66,67)

    // The doorway: x=2, z=0, y=65 and 66 must be absent.
    const present = new Set(b.map((p) => key(p.pos)));
    expect(present.has("2,65,0")).toBe(false);
    expect(present.has("2,66,0")).toBe(false);
    // But the wall above the door is still there.
    expect(present.has("2,67,0")).toBe(true);
  });

  test("door can be turned off", () => {
    const b = expandShape(spec({ shape: "room", width: 5, length: 5, door: false }));
    expect(new Set(b.map((p) => key(p.pos))).has("2,65,0")).toBe(true);
  });

  test("a gable roof is pitched, not flat", () => {
    const b = expandShape(spec({ shape: "roof", width: 3, length: 5, roofStyle: "gable" }));
    expect(new Set(b.map((p) => p.pos.y)).size).toBeGreaterThan(1);
  });

  test("dimensions are clamped so a silly request can't produce a 100k-block goal", () => {
    const b = expandShape(spec({ shape: "floor", width: 500, length: 500 }));
    expect(b.length).toBeLessThanOrEqual(32 * 32);
  });

  test("no duplicate positions in any shape", () => {
    for (const shape of ["floor", "wall", "box", "room", "pillar", "roof"] as const) {
      const b = expandShape(spec({ shape, width: 5, length: 5, height: 3 }));
      expect(new Set(b.map((p) => key(p.pos))).size).toBe(b.length);
    }
  });
});

describe("placement ordering", () => {
  /**
   * The property that makes a spec buildable: you cannot place a block in
   * midair, so every block after the first must touch one already placed.
   */
  const isBuildable = (blocks: Placement[]): boolean => {
    const placed: Placement[] = [];
    for (const b of blocks) {
      if (placed.length > 0 && !placed.some((p) => adjacent(p, b))) return false;
      placed.push(b);
    }
    return true;
  };

  test("every shape comes out in a buildable order", () => {
    for (const shape of ["floor", "wall", "box", "room", "pillar", "roof"] as const) {
      const b = expandShape(spec({ shape, width: 5, length: 5, height: 3 }));
      expect(isBuildable(b)).toBe(true);
    }
  });

  test("a roof never precedes the wall holding it up", () => {
    const b = expandShape(spec({ shape: "room", width: 5, length: 5, height: 3 }));
    const firstRoof = b.findIndex((p) => p.pos.y === 68);
    const lastWall = b.map((p) => p.pos.y).lastIndexOf(67);
    expect(firstRoof).toBeGreaterThan(0);
    expect(firstRoof).toBeLessThan(b.length);
    // Some wall exists before the first roof block.
    expect(b.slice(0, firstRoof).some((p) => p.pos.y === 67)).toBe(true);
    expect(lastWall).toBeGreaterThan(-1);
  });

  test("ordering starts from the ground layer", () => {
    const b = expandShape(spec({ shape: "room", width: 5, length: 5, height: 3 }));
    expect(b[0]!.pos.y).toBe(64);
  });

  test("keeps every block — ordering never silently drops one", () => {
    const raw: Placement[] = [
      { pos: { x: 0, y: 0, z: 0 }, item: "stone" },
      { pos: { x: 0, y: 1, z: 0 }, item: "stone" },
      { pos: { x: 9, y: 9, z: 9 }, item: "stone" }, // island, unreachable
    ];
    const out = orderForPlacement(raw);
    expect(out).toHaveLength(3);
    // The unreachable one is last, not lost.
    expect(out[2]!.pos).toEqual({ x: 9, y: 9, z: 9 });
  });

  test("is deterministic", () => {
    const a = expandShape(spec({ shape: "room", width: 6, length: 4 }));
    const b = expandShape(spec({ shape: "room", width: 6, length: 4 }));
    expect(a.map((p) => key(p.pos))).toEqual(b.map((p) => key(p.pos)));
  });

  test("empty input is fine", () => {
    expect(orderForPlacement([])).toEqual([]);
  });
});

describe("material cost", () => {
  test("counts what the build needs", () => {
    const b = expandShape(spec({ shape: "floor", width: 4, length: 4 }));
    expect(materialCost(b).get("oak_planks")).toBe(16);
  });
});
