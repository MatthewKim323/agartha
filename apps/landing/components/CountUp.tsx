'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// Counter that rolls to its value once, on entry.
//
// Two details do the work. It writes through `textContent` rather than React
// state, so a 1.4s roll costs zero re-renders. And it renders a hidden copy of
// the final string to reserve width, otherwise the box resizes as digits
// change and everything beside it twitches for the length of the animation.
export default function CountUp({
  value,
  decimals = 0,
  suffix = '',
  className = '',
  duration = 1.4,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const out = useRef<HTMLSpanElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);

  const format = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  useEffect(() => {
    const el = out.current;
    const root = wrap.current;
    if (!el || !root) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = format(value);
      return;
    }

    el.textContent = format(0);
    const obj = { v: 0 };
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        v: value,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = format(obj.v);
        },
        scrollTrigger: { trigger: root, start: 'top 90%', once: true },
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, duration]);

  return (
    <span ref={wrap} className={`relative inline-block tabular-nums ${className}`}>
      {/* Width reservation. Hidden from AT and from sight, but it still lays out. */}
      <span aria-hidden className="invisible">
        {format(value)}
        {suffix}
      </span>
      <span className="absolute inset-0">
        <span ref={out}>{format(value)}</span>
        {suffix}
      </span>
    </span>
  );
}
