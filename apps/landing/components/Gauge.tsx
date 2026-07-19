'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// Radial dial. The arc and the numeral run on one tween, so the number can
// never disagree with the sweep — they read the same tweened object.
//
// Ticks are drawn at every step rather than continuously, which makes the dial
// read as an instrument with a resolution instead of a decorative ring.
const R = 46;
const C = +(2 * Math.PI * R).toFixed(3);
const TICKS = 30;

export default function Gauge({
  value,
  max,
  unit = '',
  label,
  className = '',
}: {
  value: number;
  max: number;
  unit?: string;
  label: string;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const n = num.current;
    if (!el || !n) return;

    const arc = el.querySelector<SVGCircleElement>('[data-arc]');
    if (!arc) return;
    const target = C * (1 - Math.min(1, value / max));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      arc.style.strokeDashoffset = `${target}`;
      n.textContent = String(value);
      return;
    }

    const obj = { v: 0 };
    const ctx = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
        .fromTo(
          arc,
          { strokeDashoffset: C },
          { strokeDashoffset: target, duration: 1.3, ease: 'power3.out' },
        )
        .to(
          obj,
          {
            v: value,
            duration: 1.3,
            ease: 'power3.out',
            onUpdate: () => {
              n.textContent = String(Math.round(obj.v));
            },
          },
          0,
        );
    }, el);
    return () => ctx.revert();
  }, [value, max]);

  return (
    <div ref={root} className={`flex items-center gap-5 ${className}`}>
      <div className="relative shrink-0">
        <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
          {/* Tick ring */}
          {Array.from({ length: TICKS }).map((_, i) => {
            const a = (i / TICKS) * Math.PI * 2;
            // Rounded before it reaches the DOM. Math.cos/Math.sin are not
            // guaranteed bit-identical between the server's engine and the
            // browser's, so raw floats can serialise as `56` on one side and
            // `56.00000000000001` on the other — which React reports as a
            // hydration mismatch on an attribute it refuses to patch.
            const r3 = (n: number) => +n.toFixed(3);
            const x1 = r3(56 + Math.cos(a) * (R + 8));
            const y1 = r3(56 + Math.sin(a) * (R + 8));
            const x2 = r3(56 + Math.cos(a) * (R + 12));
            const y2 = r3(56 + Math.sin(a) * (R + 12));
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1"
              />
            );
          })}
          <circle
            cx="56"
            cy="56"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="6"
          />
          <circle
            data-arc
            cx="56"
            cy="56"
            r={R}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="6"
            strokeDasharray={C}
            strokeDashoffset={C}
            strokeLinecap="butt"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="text-[26px] font-medium text-white tabular-nums">
            <span ref={num}>0</span>
            <span className="text-[13px] text-white/50">{unit}</span>
          </span>
        </span>
      </div>
      <p className="font-mono text-[11px] leading-[1.8] tracking-widest text-white/40 uppercase">
        {label}
      </p>
    </div>
  );
}
