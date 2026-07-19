'use client';

import { useEffect, useRef } from 'react';

// Isometric voxel staircase for the pinned step sequence.
//
// This replaces a rotating numeral ring. A ring implies a cycle, and the
// request path is not a cycle — it is a descent from "you speak" to "it reports
// back", each stage faster than the last. A staircase says that; a wheel does
// not. It is also blocks, which is what the product actually manipulates.
//
// Each step is one cube on a descending diagonal. The active step's cube is
// raised and lit, the completed ones stay solid, the pending ones sit dark. A
// signal pulse runs the path continuously so the diagram reads as live rather
// than as a progress bar with extra geometry.

// Base unit; the draw pass scales these to fill the container so the diagram
// is the column's subject rather than a motif floating inside it.
const BASE_TW = 34;
const BASE_TH = 17; // 2:1 gives the standard isometric angle
const BASE_LIFT = 26;

type Palette = { top: string; left: string; right: string };

const DONE: Palette = { top: '#3a3a3e', left: '#232326', right: '#2c2c30' };
const PENDING: Palette = { top: '#232326', left: '#1a1a1c', right: '#1e1e21' };
const ACTIVE: Palette = { top: '#c8fa00', left: '#7d9c00', right: '#a3cc00' };
// The rolling block is brighter than the lit step so the two never merge.
const ROLLER: Palette = { top: '#e8ff7a', left: '#9dbf00', right: '#c2ee1a' };

function cube(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  pal: Palette,
  h: number,
  TW: number,
  TH: number,
) {
  ctx.fillStyle = pal.top;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + TW, sy + TH);
  ctx.lineTo(sx, sy + TH * 2);
  ctx.lineTo(sx - TW, sy + TH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.left;
  ctx.beginPath();
  ctx.moveTo(sx - TW, sy + TH);
  ctx.lineTo(sx, sy + TH * 2);
  ctx.lineTo(sx, sy + TH * 2 + h);
  ctx.lineTo(sx - TW, sy + TH + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.right;
  ctx.beginPath();
  ctx.moveTo(sx + TW, sy + TH);
  ctx.lineTo(sx, sy + TH * 2);
  ctx.lineTo(sx, sy + TH * 2 + h);
  ctx.lineTo(sx + TW, sy + TH + h);
  ctx.closePath();
  ctx.fill();
}

export default function VoxelSteps({
  count,
  active,
  progress,
  className = '',
}: {
  count: number;
  active: number;
  /** 0..1 scroll position through the pinned track. Drives the rolling block. */
  progress: { current: number };
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Kept in refs so the animation loop reads current values without being torn
  // down and rebuilt on every step change.
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = 0;
    // Lagged scroll position of the rolling block, in step units.
    let eased = 0;
    // Eased height per cube, so the active one rises rather than snapping.
    const heights = new Array(count).fill(0);

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

      // Fit: the run spans (count-1) steps diagonally, so derive the unit from
      // whichever axis binds first, then centre what results.
      const runX = (count - 1) * 1.55;
      const runY = (count - 1) * 0.9;
      const fitW = (w * 0.98) / (runX * BASE_TW * 2 + BASE_TW * 2);
      const fitH = (h * 0.94) / (runY * BASE_TH * 2 + BASE_LIFT * 2 + BASE_TH * 2);
      const k = Math.max(0.6, Math.min(fitW, fitH) * 2);
      const TW = BASE_TW * k, TH = BASE_TH * k, LIFT = BASE_LIFT * k;

      const originX = w * 0.5 + runX * TW * 0.5;
      const originY = h * 0.5 - runY * TH * 0.5 - LIFT * 0.5;

      const cur = activeRef.current;
      const at = (n: number) => ({
        x: originX - n * TW * 1.55,
        y: originY + n * TH * 0.9,
      });

      for (let i = 0; i < count; i++) {
        const isActive = i === cur;
        const target = isActive ? LIFT + 16 * k : LIFT;
        // Critically damped-ish approach; no spring overshoot, because the
        // sequence should feel mechanical rather than bouncy.
        heights[i] += (target - heights[i]) * 0.12;

        // gx and gy advance together, so the isometric x-term cancels and the
        // run comes entirely from the per-step offsets below.
        const sx = originX - i * TW * 1.55;
        const sy = originY + i * TH * 0.9;

        const pal = isActive ? ACTIVE : i < cur ? DONE : PENDING;
        cube(ctx, sx, sy, pal, heights[i], TW, TH);

        // Connector: a thin isometric rail between consecutive cubes so the
        // path reads as a path and not as scattered blocks.
        if (i < count - 1) {
          const nx = originX - (i + 1) * TW * 1.55;
          const ny = originY + (i + 1) * TH * 0.9;
          ctx.strokeStyle = i < cur ? 'rgba(200,250,0,0.32)' : 'rgba(255,255,255,0.10)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, sy + TH * 2 + heights[i] * 0.5);
          ctx.lineTo(nx, ny + TH * 2 + heights[i + 1] * 0.5);
          ctx.stroke();
        }
      }

      // A block rolls down the staircase, its position driven by scroll.
      //
      // `eased` lags the raw scroll value, which is what gives the block weight
      // — it keeps travelling for a moment after the wheel stops instead of
      // pinning to the cursor. Between steps it follows a parabolic hop and
      // tumbles a quarter turn; on landing it squashes and recovers. That
      // combination is what reads as rolling rather than sliding.
      const target = Math.min(1, Math.max(0, progress.current)) * (count - 1);
      eased += (target - eased) * 0.09;

      const i = Math.floor(eased);
      const f = eased - i;
      const a = at(i);
      const b = at(Math.min(count - 1, i + 1));

      // Parabolic arc between steps, flat at rest.
      const hop = Math.sin(f * Math.PI) * TH * 2.1;
      const bx = a.x + (b.x - a.x) * f;
      const by = a.y + (b.y - a.y) * f - hop;

      // Squash near the landing, stretch through the middle of the arc.
      const land = Math.min(f, 1 - f) * 2; // 0 at a step, 1 mid-flight
      const squash = 1 + (1 - land) * -0.2 + land * 0.1;

      // No rotation. An isometric cube only holds its read at a fixed
      // orientation — spinning it in 2D collapses the projection and it stops
      // looking like a block at all. The tumble is carried by the arc and the
      // landing squash instead, which is what the eye actually reads as rolling.
      ctx.save();
      ctx.translate(bx, by + TH);
      ctx.scale(1 / squash, squash);
      ctx.translate(-bx, -(by + TH));
      cube(ctx, bx, by - TH * 0.9, ROLLER, LIFT * 0.5, TW * 0.34, TH * 0.34);
      ctx.restore();

      // Contact shadow: grounds the block and sells the height of the arc.
      ctx.globalAlpha = 0.35 * (1 - hop / (TH * 2.1)) + 0.08;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(bx, a.y + (b.y - a.y) * f + TH * 1.6, TW * 0.4, TH * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      t += 0.016;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [count]);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />;
}
