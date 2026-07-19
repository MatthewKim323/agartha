'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import RevealText, { RevealLines } from '@/components/RevealText';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// Request path as a flow rail, drawn to scale.
//
// The conceit: every leg's tween duration is the real measured latency, scaled
// by one constant. So the packet does not just travel the diagram, it spends
// proportionally as long on each leg as the system does. The 345ms think is a
// visible pause; the 3ms dispatch is a snap you almost miss. That contrast is
// the product's entire argument, and a diagram with arbitrary timings would
// throw it away.
//
// Scale chosen so the full path takes ~4s: slow enough to read, fast enough to
// loop without becoming furniture.
const MS_TO_S = 0.0055;

const W = 900;
const H = 250;
const RAIL_Y = 140;

const STAGES = [
  { x: 70, label: 'You', sub: 'Discord VC' },
  { x: 330, label: 'Session', sub: 'Gemini Live' },
  { x: 590, label: 'MCP', sub: 'localhost' },
  { x: 830, label: 'Bot', sub: 'Mineflayer' },
] as const;

// Measured, from docs/MEASUREMENTS.md.
const LEGS = [
  { ms: 345, note: 'to first tool call' },
  { ms: 3, note: 'dispatch, median' },
  { ms: 1, note: 'set_goal returns' },
] as const;

export default function LatencyFlow() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el.querySelectorAll('[data-draw]'), { strokeDashoffset: 0 });
      gsap.set(el.querySelectorAll('[data-node], [data-label]'), { opacity: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      // Self-drawing entrance: measure each stroked path and run its dash
      // offset to zero, cascading left to right.
      const draw = Array.from(
        el.querySelectorAll<SVGPathElement>('[data-draw]'),
      );
      draw.forEach((s) => {
        const len = s.getTotalLength();
        s.style.strokeDasharray = `${len}`;
        s.style.strokeDashoffset = `${len}`;
      });

      const intro = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top 80%', once: true },
      });
      intro
        .to(draw, {
          strokeDashoffset: 0,
          duration: 0.9,
          ease: 'power2.inOut',
          stagger: 0.06,
        })
        .to(
          el.querySelectorAll('[data-node]'),
          { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.07 },
          '-=0.5',
        )
        .to(
          el.querySelectorAll('[data-label]'),
          { opacity: 1, duration: 0.4, stagger: 0.05 },
          '-=0.35',
        );

      // The packet loop. Suspends when offscreen rather than burning frames.
      const packet = el.querySelector('[data-packet]');
      const loop = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.6,
        scrollTrigger: {
          trigger: el,
          start: 'top 92%',
          end: 'bottom 8%',
          toggleActions: 'play pause resume pause',
        },
      });
      loop.set(packet, { attr: { x: STAGES[0].x - 5 }, opacity: 0 });
      loop.to(packet, { opacity: 1, duration: 0.2 });
      LEGS.forEach((leg, i) => {
        loop.to(packet, {
          attr: { x: STAGES[i + 1].x - 5 },
          duration: Math.max(0.08, leg.ms * MS_TO_S),
          ease: i === 0 ? 'power1.inOut' : 'none',
        });
        // A beat at each node so the arrival registers as an arrival.
        loop.to({}, { duration: 0.18 });
      });
      loop.to(packet, { opacity: 0, duration: 0.25 });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="relative overflow-hidden bg-paper px-6 py-28 md:px-10 md:py-36">
      <div ref={root} className="mx-auto max-w-6xl">
        <p className="font-mono text-[12px] tracking-widest text-muted">TO SCALE, HONESTLY</p>
        <RevealText
          as="h2"
          className="mt-5 max-w-3xl text-[48px] leading-[1.2] font-medium tracking-[-0.06em] text-ink md:text-[64px]"
          duration={1}
        >
          What happens when you talk
        </RevealText>
        <RevealLines
          className="mt-6 max-w-2xl text-[16px] leading-[1.62] text-muted"
          delay={0.1}
          lines={[
            'Every leg below runs for its real measured duration, scaled by one',
            'constant. The long bit is agar thinking. Everything after that',
            'used to be what kept you waiting.',
          ]}
        />

        <div className="mt-14 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[720px]"
            role="img"
            aria-label="Request path from voice to bot, with measured latency per stage"
          >
            {/* Rail */}
            <path
              data-draw
              d={`M ${STAGES[0].x} ${RAIL_Y} H ${STAGES[STAGES.length - 1].x}`}
              stroke="rgba(23,23,23,0.18)"
              strokeWidth="1"
              fill="none"
            />

            {/* Leg brackets with their measured cost */}
            {LEGS.map((leg, i) => {
              const a = STAGES[i].x;
              const b = STAGES[i + 1].x;
              const mid = (a + b) / 2;
              return (
                <g key={leg.note}>
                  <path
                    data-draw
                    d={`M ${a} ${RAIL_Y + 26} V ${RAIL_Y + 34} H ${b} V ${RAIL_Y + 26}`}
                    stroke="rgba(23,23,23,0.16)"
                    strokeWidth="1"
                    fill="none"
                  />
                  <text
                    data-label
                    x={mid}
                    y={RAIL_Y + 56}
                    textAnchor="middle"
                    className="fill-ink"
                    style={{ opacity: 0, fontSize: 15, fontWeight: 500 }}
                  >
                    {leg.ms}ms
                  </text>
                  <text
                    data-label
                    x={mid}
                    y={RAIL_Y + 74}
                    textAnchor="middle"
                    fill="rgba(89,89,89,1)"
                    style={{
                      opacity: 0,
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {leg.note}
                  </text>
                </g>
              );
            })}

            {/* Stage nodes: squares, because everything here is blocks */}
            {STAGES.map((s) => (
              <g key={s.label}>
                <rect
                  data-node
                  x={s.x - 9}
                  y={RAIL_Y - 9}
                  width={18}
                  height={18}
                  className="fill-ink"
                  style={{ opacity: 0, transformOrigin: `${s.x}px ${RAIL_Y}px` }}
                />
                <text
                  data-label
                  x={s.x}
                  y={RAIL_Y - 34}
                  textAnchor="middle"
                  className="fill-ink"
                  style={{ opacity: 0, fontSize: 16, fontWeight: 500 }}
                >
                  {s.label}
                </text>
                <text
                  data-label
                  x={s.x}
                  y={RAIL_Y - 16}
                  textAnchor="middle"
                  fill="rgba(133,133,133,1)"
                  style={{
                    opacity: 0,
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {s.sub}
                </text>
              </g>
            ))}

            {/* The travelling packet */}
            <rect
              data-packet
              x={STAGES[0].x - 5}
              y={RAIL_Y - 5}
              width={10}
              height={10}
              fill="#c8fa00"
              opacity={0}
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
