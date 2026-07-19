'use client';

import { useEffect, useRef } from 'react';

// Two halves on one clock.
//
// Left: the old shape. A process spawns, does its work, dies, and the next turn
// pays for all of it again — so the counter keeps resetting and never gets
// anywhere. Right: one session, opened once, with work circulating inside it.
//
// The halves share a single time base, which is the entire argument. By the
// time the left side has finished one spawn, the right has completed dozens of
// turns. Nobody has to be told that; they can watch it.
//
// Honest about scale: the real ratio is roughly 9,000ms against 3ms, which is
// 3000:1 and cannot be shown literally in one frame. What is literal here is
// the shape — one restarts constantly, one never does. The numbers alongside
// carry the magnitude.

const SPAWN_LIFE = 2.4; // seconds of "process alive" before it dies
const SPAWN_GAP = 0.55; // dead air between turns — the cost nobody sees
const CYCLE = SPAWN_LIFE + SPAWN_GAP;

type Pal = { top: string; left: string; right: string };
const DEAD: Pal = { top: '#3a3a3e', left: '#212124', right: '#2b2b2f' };
const LIME: Pal = { top: '#c8fa00', left: '#7d9c00', right: '#a3cc00' };

const TW = 30;
const TH = 15;
const LIFT = 26;

function cube(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pal: Pal,
  alpha = 1,
  scale = 1,
) {
  const w = TW * scale;
  const h = TH * scale;
  const l = LIFT * scale;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pal.top;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h * 2);
  ctx.lineTo(x - w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.left;
  ctx.beginPath();
  ctx.moveTo(x - w, y + h);
  ctx.lineTo(x, y + h * 2);
  ctx.lineTo(x, y + h * 2 + l);
  ctx.lineTo(x - w, y + h + l);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.right;
  ctx.beginPath();
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(x, y + h * 2);
  ctx.lineTo(x, y + h * 2 + l);
  ctx.lineTo(x + w, y + h + l);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

export default function ProcessCompare({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = reduced ? CYCLE * 0.5 : 0;
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

      const midX = w * 0.5;
      // Scale with the panel, floored so it never becomes a speck and capped so
      // it does not overwhelm at very wide widths.
      const k = Math.max(1.15, Math.min(2.1, Math.min(w / 620, h / 300)));
      const baseY = h * 0.42;

      // ---- Divider -------------------------------------------------------
      ctx.strokeStyle = 'rgba(23,23,23,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(midX, h * 0.06);
      ctx.lineTo(midX, h * 0.94);
      ctx.stroke();

      // ---- Left: spawn, work, die, repeat --------------------------------
      const lx = w * 0.25;
      const phase = t % CYCLE;
      const alive = phase < SPAWN_LIFE;
      // Rise on birth, fall on death — the process is never simply there.
      const born = Math.min(1, phase / 0.35);
      const dying = alive ? 0 : Math.min(1, (phase - SPAWN_LIFE) / SPAWN_GAP);

      if (alive) {
        const settle = 1 - Math.pow(1 - born, 3);
        cube(ctx, lx, baseY - 34 * k + (1 - settle) * 26, DEAD, settle, k);
        // Work ticks inside it, but only while it happens to be alive.
        const ticks = Math.floor(phase * 6);
        for (let i = 0; i < Math.min(6, ticks); i++) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#c8fa00';
          ctx.fillRect(lx - 16 * k + i * 6 * k, baseY + 6 * k, 3 * k, 3 * k);
        }
        ctx.globalAlpha = 1;
      } else {
        // Gone. The gap is the point.
        cube(ctx, lx, baseY - 34 * k, DEAD, 0.16 * (1 - dying), k);
      }

      // Elapsed readout: climbs while alive, resets to zero on every turn.
      ctx.fillStyle = 'rgba(23,23,23,0.55)';
      ctx.font = `${13 * Math.min(1.25, k)}px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      const shown = alive ? (phase / SPAWN_LIFE) * 9.4 : 0;
      ctx.fillText(`${shown.toFixed(1)}s`, lx, baseY + 46 * k);
      ctx.fillStyle = 'rgba(133,133,133,1)';
      ctx.fillText(alive ? 'spawning · working' : 'dead — respawn', lx, baseY + 62 * k);

      // ---- Right: one session, never restarted ---------------------------
      const rx = w * 0.75;
      cube(ctx, rx, baseY - 34 * k, LIME, 1, k);

      // Work circulating inside a thing that stays open.
      const laps = t * 2.6;
      for (let i = 0; i < 3; i++) {
        const a = laps + (i * Math.PI * 2) / 3;
        const px = rx + Math.cos(a) * TW * 0.72 * k;
        const py = baseY + 4 * k + Math.sin(a) * TH * 0.72 * k;
        ctx.globalAlpha = 0.35 + 0.65 * ((Math.sin(a) + 1) / 2);
        ctx.fillStyle = '#1e1e1f';
        ctx.fillRect(px - 2.5 * k, py - 2.5 * k, 5 * k, 5 * k);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(23,23,23,0.55)';
      ctx.fillText(`${(3 + Math.sin(t * 3) * 1).toFixed(0)}ms`, rx, baseY + 46 * k);
      ctx.fillStyle = 'rgba(133,133,133,1)';
      ctx.fillText('open · already connected', rx, baseY + 62 * k);

      // Turn counter: the asymmetry, stated once.
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(23,23,23,0.35)';
      ctx.font = `${11 * Math.min(1.2, k)}px "Space Mono", monospace`;
      ctx.fillText(`turns completed: ${Math.floor(t / CYCLE)}`, lx, h * 0.93);
      ctx.fillText(`turns completed: ${Math.floor(t * 2.6)}`, rx, h * 0.93);
    };

    draw();

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      t += dt;
      draw();
      raf = requestAnimationFrame(loop);
    };

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
