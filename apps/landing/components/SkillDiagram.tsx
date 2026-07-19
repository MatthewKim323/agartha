'use client';

import { useEffect, useRef } from 'react';
import { MARK_HEX, MARK_LEFT, MARK_RIGHT, MARK_STROKE } from '@/lib/mark';

// One small isometric scene per skill, drawn in code.
//
// The slider previously ran the same terrain generator as the hero, so both
// sections read as the same treatment twice and neither said anything about the
// skill it sat behind. These scenes each depict their own action instead.
//
// Everything is built from abstract blocks, a trunk is a stack, a mob is a
// cube with eyes, a chest is a plate with a band. Nothing here copies game art;
// the aim is the least detail that still reads as the concept.

export type SkillKind =
  | 'chop'
  | 'mine'
  | 'fetch'
  | 'combat'
  | 'scout'
  | 'craft';

// Every scene shares one cycle length with a hold at the end. Instructional
// animation research is consistent that brief rests are what let a viewer
// segment a sequence, without one, the loop reads as continuous churn.
const CYCLE = 7;
const HOLD = 1.1;

// 2:1 isometric.
const TW = 26;
const TH = 13;
const LIFT = 22;

type Pal = { top: string; left: string; right: string };
const STONE: Pal = { top: '#3a3a3e', left: '#212124', right: '#2b2b2f' };
const DIRT: Pal = { top: '#33312c', left: '#1e1d1a', right: '#272621' };
const WOOD: Pal = { top: '#6b5636', left: '#3d3120', right: '#4f402a' };
const LEAF: Pal = { top: '#5c7a12', left: '#33440a', right: '#43570e' };
const LIME: Pal = { top: '#c8fa00', left: '#7d9c00', right: '#a3cc00' };
const HOSTILE: Pal = { top: '#7a2f2f', left: '#431919', right: '#5a2222' };
const CHEST: Pal = { top: '#8a6a2f', left: '#4d3a19', right: '#664c22' };

// Grid → screen. Height is in whole blocks.
function iso(gx: number, gy: number, gz: number, cx: number, cy: number) {
  return {
    x: cx + (gx - gy) * TW,
    y: cy + (gx + gy) * TH - gz * LIFT,
  };
}

function cube(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  gz: number,
  pal: Pal,
  cx: number,
  cy: number,
  alpha = 1,
) {
  const { x, y } = iso(gx, gy, gz, cx, cy);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pal.top;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + TW, y + TH);
  ctx.lineTo(x, y + TH * 2);
  ctx.lineTo(x - TW, y + TH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.left;
  ctx.beginPath();
  ctx.moveTo(x - TW, y + TH);
  ctx.lineTo(x, y + TH * 2);
  ctx.lineTo(x, y + TH * 2 + LIFT);
  ctx.lineTo(x - TW, y + TH + LIFT);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.right;
  ctx.beginPath();
  ctx.moveTo(x + TW, y + TH);
  ctx.lineTo(x, y + TH * 2);
  ctx.lineTo(x, y + TH * 2 + LIFT);
  ctx.lineTo(x + TW, y + TH + LIFT);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Flat ground plate, drawn back to front.
function ground(
  ctx: CanvasRenderingContext2D,
  w: number,
  d: number,
  cx: number,
  cy: number,
  pal: Pal = DIRT,
) {
  for (let gy = 0; gy < d; gy++)
    for (let gx = 0; gx < w; gx++) cube(ctx, gx, gy, 0, pal, cx, cy);
}

// Dotted path along a grid line, the standard isometric device for "this
// thing travelled".
function path(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  cx: number,
  cy: number,
  prog: number,
) {
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (t > prog) break;
    const gx = from[0] + (to[0] - from[0]) * t;
    const gy = from[1] + (to[1] - from[1]) * t;
    const { x, y } = iso(gx, gy, 1, cx, cy);
    ctx.fillStyle = 'rgba(200,250,0,0.5)';
    ctx.fillRect(x - 1.5, y + TH - 1.5, 3, 3);
  }
}

// The agar mark, drawn from the same path data as components/Logo.tsx.
//
// The first version redrew it with primitives, a hexagon and two straight bars,
// which was not the mark: the real one has slanted interlocking panels. Path2D
// takes the SVG path strings directly, so this is the actual geometry scaled
// down rather than an impression of it.
let markPaths: { hex: Path2D; l: Path2D; r: Path2D } | null = null;
function getMark() {
  if (!markPaths) {
    markPaths = {
      hex: new Path2D(MARK_HEX),
      l: new Path2D(MARK_LEFT),
      r: new Path2D(MARK_RIGHT),
    };
  }
  return markPaths;
}

function mark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const m = getMark();
  const k = size / 120; // paths are authored on a 120 viewBox
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(k, k);
  ctx.strokeStyle = 'rgba(20,24,8,0.92)';
  ctx.fillStyle = 'rgba(20,24,8,0.92)';
  ctx.lineWidth = MARK_STROKE;
  ctx.lineJoin = 'round';
  ctx.stroke(m.hex);
  ctx.fill(m.l);
  ctx.fill(m.r);
  ctx.restore();
}

// The agent. A lime cube carrying the agar mark so it reads as a body, and as
// a specific body, rather than as another block.
function agent(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  gz: number,
  cx: number,
  cy: number,
  bob = 0,
) {
  const { x, y } = iso(gx, gy, gz, cx, cy);
  ctx.save();
  ctx.translate(0, -bob);
  cube(ctx, gx, gy, gz, LIME, cx, cy);
  mark(ctx, x, y + TH + 6, TW * 0.86);
  ctx.restore();
}

function particles(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  cx: number,
  cy: number,
  t: number,
  pal: Pal,
) {
  for (let i = 0; i < 5; i++) {
    const life = (t + i * 0.19) % 1;
    const ang = i * 1.257;
    const r = life * 26;
    const { x, y } = iso(gx, gy, 1, cx, cy);
    ctx.globalAlpha = Math.max(0, 1 - life) * 0.9;
    ctx.fillStyle = pal.top;
    const s = 5 - life * 2;
    ctx.fillRect(
      x + Math.cos(ang) * r - s / 2,
      y + TH - life * 22 + Math.sin(ang) * r * 0.5,
      s,
      s,
    );
  }
  ctx.globalAlpha = 1;
}



// ---- Depth sorting ---------------------------------------------------------
//
// Scenes were previously drawn in hand-written order, which is fine on a single
// plane and wrong the moment anything descends below it, the mine shaft was
// painted before the ground that should sit behind it, so it vanished.
//
// For equal-size axis-aligned unit cubes, sorting ascending by (gx + gy + gz)
// is a correct painter's order. Entities at fractional positions sort correctly
// against tiles because the key is continuous.
type Draw = { key: number; run: () => void };

function makeQueue() {
  const items: Draw[] = [];
  return {
    add(gx: number, gy: number, gz: number, run: () => void) {
      items.push({ key: gx + gy + gz, run });
    },
    flush() {
      items.sort((a, b) => a.key - b.key).forEach((d) => d.run());
      items.length = 0;
    },
  };
}

// ---- Easing + staging ------------------------------------------------------
//
// The first version ran every scene on linear interpolation, which is the main
// reason they read as cheap: nothing accelerated, nothing settled, everything
// slid. These are the standard curves, plus a `beat` helper that carves the
// cycle into stages so only ONE thing moves at a time.
//
// That last constraint is the important one. Viewers reason through a causal
// sequence one step at a time, so overlapping motion does not read as rich,
// it reads as noise, and the eye cannot tell which movement caused which.
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Progress through a stage that runs [start, start+dur), eased.
const beat = (t: number, start: number, dur: number, ease = easeInOutCubic) =>
  ease(clamp01((t - start) / dur));

// A single decaying burst fired at `at`, rather than a continuous emitter.
// Continuous particles are ambient; a burst is punctuation, and punctuation is
// what makes an impact legible.
function burst(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  gz: number,
  cx: number,
  cy: number,
  t: number,
  at: number,
  pal: Pal,
  count = 7,
) {
  const age = t - at;
  if (age < 0 || age > 0.85) return;
  const p = age / 0.85;
  const { x, y } = iso(gx, gy, gz, cx, cy);
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + at;
    // Out fast, then gravity takes over.
    const r = easeOutCubic(p) * 30;
    const lift = Math.sin(p * Math.PI) * 16 - easeInCubic(p) * 10;
    const size = (1 - p) * 5 + 1.5;
    ctx.globalAlpha = (1 - p) * 0.95;
    ctx.fillStyle = pal.top;
    ctx.fillRect(
      x + Math.cos(ang) * r - size / 2,
      y + TH - lift + Math.sin(ang) * r * 0.5,
      size,
      size,
    );
  }
  ctx.globalAlpha = 1;
}

// Onion-skin trail: 2-3 ghosts offset backward along the motion vector. Reads
// as speed at voxel scale, where motion blur is unavailable.
function ghost(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  gz: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  pal: Pal,
) {
  for (let i = 3; i >= 1; i--) {
    cube(ctx, gx - dx * i * 0.16, gy - dy * i * 0.16, gz, pal, cx, cy, 0.1 * i);
  }
}

// Each scene gets the same signature: draw at time t (seconds) into a frame
// whose centre is (cx, cy).
const SCENES: Record<
  SkillKind,
  (ctx: CanvasRenderingContext2D, t: number, cx: number, cy: number) => void
> = {
  // Walk to a tree, fell it top-down, drops pop out.
  chop: (ctx, t, cx, cy) => {
    ground(ctx, 5, 5, cx, cy);

    // Beats: walk (0-1.5) · swing (1.5-3.4) · fall (3.4-4.3) · collect (4.3-5.4)
    const walk = beat(t, 0, 1.5);
    const swingWin = t >= 1.5 && t < 3.4;
    const fall = beat(t, 3.4, 0.9, easeInCubic);
    const collect = beat(t, 4.3, 1.1, easeOutCubic);

    // Trunk shortens only during the fall beat, one log at a time.
    const logsGone = Math.floor(fall * 3);
    for (let z = 1; z <= 4 - logsGone; z++) cube(ctx, 3, 1, z, WOOD, cx, cy);
    if (fall < 1) {
      const top = 4 - logsGone;
      const drop = fall > 0 ? easeInCubic(fall) * 2 : 0;
      [[3, 0], [2, 1], [4, 1], [3, 2]].forEach(([lx, ly]) =>
        cube(ctx, lx, ly, top - drop, LEAF, cx, cy, 0.95 * (1 - fall * 0.5)),
      );
    }

    path(ctx, [0, 4], [2, 1], cx, cy, walk);
    const ax = 0 + 2 * walk;
    const ay = 4 - 3 * walk;

    // Two bobs per tile of travel reads as a walk cycle.
    const bob = walk < 1 ? Math.abs(Math.sin(walk * Math.PI * 6)) * 4 : 0;

    if (swingWin) {
      // Swing on a 0.48s beat: wind up slow, strike fast, recover.
      const sw = ((t - 1.5) % 0.48) / 0.48;
      const lift = sw < 0.55 ? easeOutCubic(sw / 0.55) * 9 : (1 - easeInCubic((sw - 0.55) / 0.45)) * 9;
      if (sw > 0.55) ghost(ctx, ax, ay, 1, 0.1, -0.1, cx, cy, LIME);
      agent(ctx, ax, ay, 1, cx, cy, lift);
      // One burst per strike, on the frame the swing lands.
      const strikeAt = 1.5 + Math.floor((t - 1.5) / 0.48) * 0.48 + 0.55 * 0.48;
      burst(ctx, 3, 1, 2, cx, cy, t, strikeAt, WOOD, 6);
    } else {
      agent(ctx, ax, ay, 1, cx, cy, bob);
    }

    if (fall >= 1) burst(ctx, 3, 1, 1, cx, cy, t, 4.3, WOOD, 8);

    // Collected logs rise into a stack, eased, one after another.
    if (collect > 0) {
      for (let i = 0; i < 3; i++) {
        const p = clamp01((collect - i * 0.22) / 0.5);
        if (p <= 0) continue;
        cube(ctx, 1, 3, 1 + i * easeOutBack(p), WOOD, cx, cy, p);
      }
    }
  },

  // A staircase shaft descending, with the agent following it down.
  mine: (ctx, t, cx, cy) => {
    // Cutaway section, not a plan view.
    //
    // Looking down into a shaft from an isometric camera hides everything in
    // it, the first attempt put the agent at the bottom of a hole where it
    // rendered as a speck. Technical illustration solves this by cutting the
    // mass away on the near side so the descent is visible in section, which
    // is what this does: a back wall of earth, and the staircase stepping down
    // in front of it.
    const q = makeQueue();
    const STEPS = 5;
    const per = 0.85;
    const progress = clamp01(t / (per * STEPS)) * STEPS;
    const done = Math.min(STEPS - 1, Math.floor(progress));

    // Earth mass behind the cut. Two rows deep so the section has thickness.
    for (let gy = 0; gy < 2; gy++)
      for (let i = 0; i < STEPS + 1; i++) {
        const z = -i;
        q.add(i, gy, z, () => cube(ctx, i, gy, z, gy === 0 ? DIRT : STONE, cx, cy, gy === 0 ? 1 : 0.55));
      }

    // The staircase itself, revealed one step at a time as it is dug.
    for (let i = 0; i <= done; i++) {
      const z = -i;
      q.add(i, 2, z, () => cube(ctx, i, 2, z, STONE, cx, cy));
    }

    // Agent descends, easing between steps.
    const idx = Math.min(STEPS - 1, Math.floor(progress));
    const within = easeInOutCubic(clamp01(progress - idx));
    const pos = idx + within;
    q.add(pos, 2, -pos + 1, () =>
      agent(ctx, pos, 2, -pos + 1, cx, cy, within > 0.15 && within < 0.85 ? 3 : 0),
    );

    q.flush();

    // A torch every other step: the standard way this reads as a real shaft.
    for (let i = 0; i <= done; i += 2) {
      const { x, y } = iso(i, 1, -i + 1, cx, cy);
      ctx.fillStyle = 'rgba(200,250,0,0.9)';
      ctx.fillRect(x - 2, y + TH - 10, 4, 4);
      ctx.globalAlpha = 0.10 + Math.sin(t * 3 + i) * 0.03;
      ctx.beginPath();
      ctx.arc(x, y + TH - 8, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#c8fa00';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < STEPS; i++)
      burst(ctx, i, 2, -i + 1, cx, cy, t, i * per + 0.5, STONE, 5);
  },

  // Cross to a chest, take an item, carry it back.
  fetch: (ctx, t, cx, cy) => {
    ground(ctx, 5, 5, cx, cy);

    // Beats: cross (0-1.8) · open + take (1.8-2.7) · return (2.7-4.6)
    const out = beat(t, 0, 1.8);
    const take = beat(t, 1.8, 0.9, easeOutBack);
    const back = beat(t, 2.7, 1.9);

    // Chest: lid lifts on the take beat.
    cube(ctx, 4, 0, 1, CHEST, cx, cy);
    if (take > 0 && back < 1) {
      const lid = Math.sin(clamp01(take) * Math.PI) * 0.35;
      cube(ctx, 4, 0, 1.5 + lid, CHEST, cx, cy, 0.85);
    }

    path(ctx, [0, 4], [4, 0], cx, cy, out);
    if (back > 0) path(ctx, [4, 0], [0, 4], cx, cy, back);

    const ax = back > 0 ? 4 - 4 * back : 4 * out;
    const ay = back > 0 ? 4 * back : 4 - 4 * out;
    const moving = (out > 0 && out < 1) || (back > 0 && back < 1);
    agent(ctx, ax, ay, 1, cx, cy, moving ? Math.abs(Math.sin(t * 9)) * 4 : 0);

    if (take > 0.15) {
      // Carried item settles above the agent instead of jittering.
      const { x, y } = iso(ax, ay, 1, cx, cy);
      const rise = easeOutBack(clamp01(take)) * 16;
      ctx.globalAlpha = Math.min(1, take * 2);
      ctx.fillStyle = LIME.top;
      ctx.fillRect(x - 5, y - 6 - rise, 10, 10);
      ctx.globalAlpha = 1;
    }
    burst(ctx, 4, 0, 2, cx, cy, t, 1.95, LIME, 5);
  },

  // Hold a radius around the player; intercept what enters it.
  combat: (ctx, t, cx, cy) => {
    ground(ctx, 5, 5, cx, cy);

    // Beats: approach (0-1.9) · strike (1.9-2.4) · knockback (2.4-3.6)
    const near = beat(t, 0, 1.9);
    const struck = t >= 1.9;
    const away = beat(t, 2.4, 1.2, easeOutCubic);

    // Engagement ring, drawn on the ground plane.
    ctx.strokeStyle = 'rgba(200,250,0,0.26)';
    ctx.lineWidth = 1;
    const c = iso(2, 2, 1, cx, cy);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + TH, TW * 2.3, TH * 2.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    const hx = 4.6 - 1.7 * near + away * 2.4;
    const hy = 4.6 - 1.7 * near + away * 2.4;
    // On the hit, all three faces collapse to one flat tone for a beat.
    const flash = struck && t < 2.25;
    const pal: Pal = flash
      ? { top: '#d84a4a', left: '#d84a4a', right: '#d84a4a' }
      : HOSTILE;
    if (away < 1) cube(ctx, hx, hy, 1, pal, cx, cy, 1 - away * 0.85);

    const lunge = struck && t < 2.4 ? easeOutCubic(clamp01((t - 1.9) / 0.5)) : 0;
    agent(ctx, 2 + lunge * 0.35, 2 + lunge * 0.35, 1, cx, cy, lunge * 7);
    if (lunge > 0.2) ghost(ctx, 2 + lunge * 0.35, 2 + lunge * 0.35, 1, 0.3, 0.3, cx, cy, LIME);
    burst(ctx, 2.9, 2.9, 1, cx, cy, t, 2.0, LIME, 8);
  },

  // Range out ahead; terrain resolves inside a view cone.
  scout: (ctx, t, cx, cy) => {
    // Tiles resolve outward from the agent, staggered by distance. That
    // stagger IS the concept: the world is discovered, not revealed.
    const reach = beat(t, 0, 3.2);
    for (let gy = 0; gy < 6; gy++)
      for (let gx = 0; gx < 6; gx++) {
        const d = Math.hypot(gx, 5 - gy) / 7;
        const seen = clamp01((reach - d) * 3.2);
        if (seen <= 0) continue;
        // Rise 8px into place while fading up, rather than popping.
        const lift = (1 - easeOutCubic(seen)) * 0.35;
        cube(ctx, gx, gy, -lift, gx + gy > 6 ? STONE : DIRT, cx, cy, seen * 0.92);
      }

    const a0 = iso(0.4, 4.6, 1, cx, cy);
    const far = iso(0.4 + 5 * reach, 4.6 - 5 * reach, 1, cx, cy);
    ctx.fillStyle = 'rgba(200,250,0,0.08)';
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y + TH);
    ctx.lineTo(far.x - TW * 1.9, far.y);
    ctx.lineTo(far.x + TW * 1.9, far.y + TH * 2);
    ctx.closePath();
    ctx.fill();

    agent(ctx, 0.4, 4.6, 1, cx, cy, Math.sin(t * 2.6) * 2.5);
  },

  // 3x3 grid: ingredients land, output leaves.
  craft: (ctx, t, cx, cy) => {
    ground(ctx, 3, 3, cx, cy, STONE);

    // Ingredients drop into four cells in sequence, each on its own eased
    // arc, not all nine at once, and not linearly.
    const CELLS: Array<[number, number]> = [[0, 0], [2, 0], [0, 2], [2, 2]];
    CELLS.forEach(([gx, gy], i) => {
      const p = beat(t, 0.25 + i * 0.42, 0.55, easeOutBack);
      if (p <= 0) return;
      cube(ctx, gx, gy, 1 + (1 - p) * 2.2, WOOD, cx, cy, Math.min(1, p * 1.6));
      burst(ctx, gx, gy, 1, cx, cy, t, 0.25 + i * 0.42 + 0.5, WOOD, 4);
    });

    // Output rises from the centre once the grid is fed.
    const made = beat(t, 2.3, 1.1, easeOutBack);
    if (made > 0) {
      const { x, y } = iso(1, 1, 2, cx, cy);
      ctx.globalAlpha = Math.min(1, made * 1.4);
      ctx.fillStyle = LIME.top;
      const s2 = 18 * Math.min(1, made * 1.2);
      ctx.fillRect(x - s2 / 2, y - 24 * made, s2, s2);
      ctx.globalAlpha = 1;
    }
  },
};

export default function SkillDiagram({
  kind,
  className = '',
}: {
  kind: SkillKind;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const kindRef = useRef(kind);
  kindRef.current = kind;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = 0;
    let last = 0;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Scenes are authored on a ~6x6 grid with stacks up to 5 blocks tall.
      // Fit that box to the panel and centre it, rather than drawing at a fixed
      // block size that leaves the scene marooned in the middle of the frame.
      const GRID = 6;
      const TALL = 5;
      const artW = GRID * TW * 2;
      const artH = GRID * TH * 2 + TALL * LIFT;
      const k = Math.min((w * 0.84) / artW, (h * 0.84) / artH);
      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.scale(k, k);
      // Origin sits above centre by half the stack height so tall scenes stay
      // in frame and flat ones do not float.
      // Freeze on the final frame for the hold, then reset.
      const c = t % CYCLE;
      const local = Math.min(c, CYCLE - HOLD);
      SCENES[kindRef.current](ctx, local, 0, -GRID * TH + TALL * LIFT * 0.18);
      ctx.restore();
    };

    // Reduced motion gets the FINAL state, not t=0, at zero most of these
    // scenes are empty (an uncut tree, a bare crafting grid), which tells the
    // reader nothing about the skill.
    if (reduced) {
      t = CYCLE * 0.95;
      draw();
    }

    const loop = (now: number) => {
      // Real delta, not an assumed 16ms. On a 120Hz display the fixed step ran
      // every scene at double speed. Clamped so a backgrounded tab does not
      // jump the animation forward on return.
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      t += dt;
      draw();
      raf = requestAnimationFrame(loop);
    };

    // rAF pauses for background tabs but NOT for offscreen elements on a
    // visible page, so the loop has to be cancelled outright rather than just
    // skipping the draw.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !raf && !reduced) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else if (!e.isIntersecting && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0.25 },
    );
    io.observe(canvas);

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />;
}
