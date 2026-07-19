'use client';

import { useEffect, useRef } from 'react';

// Generated hero backdrop: an isometric voxel field, drawn in code.
//
// This replaces the borrowed placeholder footage. That video was the reference
// template's, which meant it could not ship in the repo and the deployed page
// would have rendered with an empty hero. Generating the art removes the
// dependency entirely and it is actually on-subject — the product lives in a
// block game, so blocks are the honest visual.
//
// Canvas 2D rather than SVG: a few hundred cubes with per-face shading is more
// drawing than the DOM wants to own, and none of it needs to be selectable.
//
// The terrain is deterministic. A seeded hash means the same field renders on
// server and client and on every reload, so there is no hydration flicker and
// no "why does it look different now".

const TILE_W = 56; // half-width of a cube's top face
const TILE_H = 28; // half-height — 2:1 gives the standard isometric angle
const LIFT = 30; // vertical pixels per height step

// Cheap deterministic value noise. Two octaves is enough for a readable
// silhouette without looking like a sine wave.
function hash(x: number, y: number, seed: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
  return n - Math.floor(n);
}
function smooth(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function height(x: number, y: number, seed: number) {
  return smooth(x * 0.16, y * 0.16, seed) * 3.6 + smooth(x * 0.4, y * 0.4, seed) * 0.9;
}

type Face = 'top' | 'left' | 'right';
// Flat shading: one tone per face orientation is what makes voxels read as
// solid. Lime picks out the highest blocks so the accent is earned by the
// terrain rather than painted on.
const SHADE: Record<Face, string> = {
  top: '#2b2b2e',
  left: '#1c1c1f',
  right: '#232326',
};
const SHADE_HI: Record<Face, string> = {
  top: '#8fae12',
  left: '#4f6109',
  right: '#68800e',
};

export default function VoxelField({
  className = '',
  seed = 1337,
  scale = 1,
}: {
  className?: string;
  /** Different seeds give visibly different terrain from the same generator. */
  seed?: number;
  /** <1 draws smaller blocks, which reads as a wider view. */
  scale?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = 0;

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

      const tw = TILE_W * scale, th = TILE_H * scale, lift = LIFT * scale;
      const cols = Math.ceil(w / tw) + 6;
      const rows = Math.ceil(h / th) + 14;
      const originX = w * 0.5;
      const originY = h * 0.28;

      // Painter's algorithm: back to front so nearer cubes overlap farther ones.
      for (let gy = -rows; gy < rows; gy++) {
        for (let gx = -cols; gx < cols; gx++) {
          // Slow drift through the noise field rather than moving the camera —
          // the terrain evolves in place, which reads as ambient not scrolling.
          const hgt = height(gx + t * 0.06, gy + t * 0.02, seed);
          const lvl = Math.round(hgt);
          const sx = originX + (gx - gy) * tw;
          const sy = originY + (gx + gy) * th - lvl * lift;
          if (sx < -tw * 2 || sx > w + tw * 2) continue;
          if (sy < -lift * 4 || sy > h + th * 4) continue;

          const hi = lvl >= 4;
          const pal = hi ? SHADE_HI : SHADE;
          // Depth fade: far blocks sink toward the background colour so the
          // field has an horizon instead of tiling forever at full contrast.
          const depth = Math.min(1, Math.max(0, (sy / h) * 1.15));
          ctx.globalAlpha = 0.25 + depth * 0.75;

          // top
          ctx.fillStyle = pal.top;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + tw, sy + th);
          ctx.lineTo(sx, sy + th * 2);
          ctx.lineTo(sx - tw, sy + th);
          ctx.closePath();
          ctx.fill();

          // left
          ctx.fillStyle = pal.left;
          ctx.beginPath();
          ctx.moveTo(sx - tw, sy + th);
          ctx.lineTo(sx, sy + th * 2);
          ctx.lineTo(sx, sy + th * 2 + lift);
          ctx.lineTo(sx - tw, sy + th + lift);
          ctx.closePath();
          ctx.fill();

          // right
          ctx.fillStyle = pal.right;
          ctx.beginPath();
          ctx.moveTo(sx + tw, sy + th);
          ctx.lineTo(sx, sy + th * 2);
          ctx.lineTo(sx, sy + th * 2 + lift);
          ctx.lineTo(sx + tw, sy + th + lift);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    draw();
    if (!reduced) {
      const loop = () => {
        t += 0.016;
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [seed, scale]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`block h-full w-full ${className}`}
    />
  );
}
