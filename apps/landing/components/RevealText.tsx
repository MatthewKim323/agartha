'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Masked line reveal, GSAP-driven.
//
// This is the hero's treatment extended to the rest of the page. Everything
// below the hero previously used a plain fade-up, which read as generic next to
// the hero's clip-masked rise; now they share one vocabulary.
//
// Velocity shaping: hesitate, snap, settle.
//
// cubic-bezier(.79, .14, .15, .86) — lifted from Browserbase's heading reveal.
// It holds still at the start, accelerates hard through the middle, then takes
// a long time to arrive. Standard expo.out is the opposite shape (immediate
// then decaying), which is what made the first pass feel weightless.
//
// GSAP's CustomEase is a paid plugin, so the curve is registered manually from
// its control points via a sampled path.
const VELO_POINTS = [0.79, 0.14, 0.15, 0.86] as const;

// Cubic bezier solver -> a GSAP-compatible ease function. Cheap: 12 Newton
// iterations converge well inside a frame budget for a curve this smooth.
function cubicBezierEase([x1, y1, x2, y2]: readonly number[]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 12; i++) {
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sampleX(t) - x) / d;
    }
    return sampleY(Math.min(Math.max(t, 0), 1));
  };
}

const EASE = cubicBezierEase(VELO_POINTS);

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Seconds. Staggered siblings should step this by ~0.06. */
  delay?: number;
  /** Split into lines and stagger them. Off for single-line labels. */
  split?: boolean;
  duration?: number;
};

export default function RevealText({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  split = true,
  duration = 0.9,
}: Props) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    // Respect the OS setting: no masked rise, just present.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el.querySelectorAll('[data-line-inner]'), { yPercent: 0 });
      return;
    }

    const inners = el.querySelectorAll('[data-line-inner]');
    const ctx = gsap.context(() => {
      gsap.fromTo(
        inners,
        { yPercent: 110 },
        {
          yPercent: 0,
          duration,
          delay,
          ease: EASE,
          // Stagger ramps: later lines move slightly faster, which reads as the
          // block catching up to itself rather than marching.
          stagger: { each: 0.075, from: 'start' },
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            once: true,
          },
        },
      );
    }, el);

    return () => ctx.revert();
  }, [delay, duration]);

  return (
    <Tag ref={root} className={className}>
      <span className="block overflow-hidden pb-[0.12em]">
        <span data-line-inner className="block will-change-transform">
          {children}
        </span>
      </span>
    </Tag>
  );
}

// Multi-line variant: pass an array of strings and each gets its own mask, so
// they stagger against each other. Splitting real prose by measured line boxes
// needs a layout pass and reflows on resize; authored lines are more reliable
// and let the writing control the break.
export function RevealLines({
  lines,
  as: Tag = 'p',
  className = '',
  delay = 0,
  duration = 0.9,
}: {
  lines: readonly string[];
  as?: ElementType;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el.querySelectorAll('[data-line-inner]'), { yPercent: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll('[data-line-inner]'),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration,
          delay,
          ease: EASE,
          stagger: { each: 0.075 },
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [delay, duration]);

  return (
    <Tag ref={root} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.12em]">
          <span data-line-inner className="block will-change-transform">
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
