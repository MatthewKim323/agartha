'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RevealLines } from '@/components/RevealText';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// Answers the obvious objection: isn't this just a Minecraft bot?
//
// The answer is that Minecraft is where this was proven, not what it is. The
// companion meets the world through one typed control surface and never learns
// which world is behind it, so new environments are additive rather than
// rebuilds.
//
// Framing note: an earlier version of this section led with how quickly the
// Minecraft layer came together. That undersold the product to anyone reading
// for substance, and pointed at provenance instead of at reach.
//
// Careful framing: Minecraft is the only environment where this has actually
// run. Everything to the right of it is stated as a shape the architecture
// allows, not as something shipped. A judge who asks "what else have you
// connected?" should get the same answer from the page that they would get
// from us.
const PORTS = [
  {
    env: 'Minecraft',
    via: 'Mineflayer',
    status: 'running',
    note: 'Verified in-world on a real server.',
  },
  {
    env: 'Any game with a bot API',
    via: 'the same seam',
    status: 'possible',
    note: 'Whatever exposes movement and state can sit behind the interface.',
  },
  {
    env: 'Robotics, sims, desktop',
    via: 'the same seam',
    status: 'possible',
    note: 'The brain never learns which body it is driving.',
  },
] as const;

export default function WhatsNext() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el.querySelectorAll('[data-draw]'), { strokeDashoffset: 0 });
      gsap.set(el.querySelectorAll('[data-fade]'), { opacity: 1 });
      return;
    }
    const ctx = gsap.context(() => {
      const draw = Array.from(el.querySelectorAll<SVGPathElement>('[data-draw]'));
      draw.forEach((s) => {
        const len = s.getTotalLength();
        s.style.strokeDasharray = `${len}`;
        s.style.strokeDashoffset = `${len}`;
      });
      gsap
        .timeline({ scrollTrigger: { trigger: el, start: 'top 75%', once: true } })
        .to(draw, {
          strokeDashoffset: 0,
          duration: 0.85,
          ease: 'power2.inOut',
          stagger: 0.08,
        })
        .to(
          el.querySelectorAll('[data-fade]'),
          { opacity: 1, duration: 0.45, stagger: 0.06 },
          '-=0.45',
        );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative bg-paper px-6 py-28 md:px-10 md:py-36">
      <div ref={root} className="mx-auto max-w-6xl">
        <p className="font-mono text-[12px] tracking-widest text-muted">
          WHERE THIS GOES
        </p>

        <RevealLines
          as="h2"
          className="mt-5 max-w-3xl text-[42px] leading-[1.18] font-medium tracking-[-0.04em] text-ink md:text-[56px]"
          duration={1}
          lines={['Minecraft is where', 'we proved it']}
        />

        <RevealLines
          className="mt-7 max-w-2xl text-[16px] leading-[1.62] text-muted"
          delay={0.1}
          lines={[
            'agartha meets the world through a single typed interface and',
            'never learns which world is on the other side. The companion,',
            'the voice and the memory stay exactly as they are. Only the',
            'body changes.',
          ]}
        />

        {/* One brain, a seam, and the bodies behind it. */}
        <div className="mt-16 overflow-x-auto">
          <svg
            viewBox="0 0 900 260"
            className="w-full min-w-[680px]"
            role="img"
            aria-label="One brain connects through a single control interface to interchangeable bodies"
          >
            {/* Brain */}
            <rect
              data-fade
              x="30" y="98" width="150" height="64" rx="10"
              className="fill-ink" style={{ opacity: 0 }}
            />
            <text data-fade x="105" y="126" textAnchor="middle" fill="#f4f4f2"
              style={{ opacity: 0, fontSize: 15, fontWeight: 500 }}>agartha</text>
            <text data-fade x="105" y="146" textAnchor="middle" fill="rgba(244,244,242,0.55)"
              style={{ opacity: 0, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
              voice + memory
            </text>

            {/* The seam */}
            <path data-draw d="M 180 130 H 360" stroke="rgba(23,23,23,0.35)" strokeWidth="1" fill="none" />
            <rect data-fade x="360" y="86" width="128" height="88" rx="10"
              fill="none" stroke="rgba(23,23,23,0.30)" strokeWidth="1" style={{ opacity: 0 }} />
            <text data-fade x="424" y="120" textAnchor="middle" className="fill-ink"
              style={{ opacity: 0, fontSize: 13, fontWeight: 500 }}>BotControl</text>
            <text data-fade x="424" y="140" textAnchor="middle" fill="rgba(89,89,89,1)"
              style={{ opacity: 0, fontSize: 11, fontFamily: 'var(--font-mono)' }}>one interface</text>
            <text data-fade x="424" y="158" textAnchor="middle" fill="rgba(133,133,133,1)"
              style={{ opacity: 0, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
              MCP · 3ms
            </text>

            {/* Fan-out to bodies */}
            {[62, 130, 198].map((y, i) => (
              <g key={y}>
                <path
                  data-draw
                  d={`M 488 130 C 560 130, 560 ${y}, 640 ${y}`}
                  stroke={i === 0 ? 'rgba(23,23,23,0.4)' : 'rgba(23,23,23,0.16)'}
                  strokeWidth="1"
                  fill="none"
                  strokeDasharray={i === 0 ? undefined : '3 4'}
                />
                <rect
                  data-fade
                  x="640" y={y - 22} width="228" height="44" rx="8"
                  fill={i === 0 ? 'rgba(200,250,0,0.16)' : 'transparent'}
                  stroke={i === 0 ? 'rgba(120,150,0,0.5)' : 'rgba(23,23,23,0.16)'}
                  strokeWidth="1"
                  style={{ opacity: 0 }}
                />
                <text
                  data-fade x="660" y={y - 2} className="fill-ink"
                  style={{ opacity: 0, fontSize: 13, fontWeight: 500 }}
                >
                  {PORTS[i].env}
                </text>
                <text
                  data-fade x="660" y={y + 14} fill="rgba(133,133,133,1)"
                  style={{ opacity: 0, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
                >
                  {PORTS[i].status.toUpperCase()} · {PORTS[i].via}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Honest status line for each. */}
        <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-ink/10 md:grid-cols-3">
          {PORTS.map((p) => (
            <div key={p.env} className="bg-paper p-7">
              <dt className="flex items-center gap-2.5">
                <span
                  className={`inline-block size-2 rounded-full ${
                    p.status === 'running' ? 'bg-accent' : 'bg-ink/20'
                  }`}
                />
                <span className="font-mono text-[11px] tracking-widest text-muted uppercase">
                  {p.status}
                </span>
              </dt>
              <dd className="mt-4 text-[16px] text-ink">{p.env}</dd>
              <dd className="mt-2 max-w-[34ch] text-[14px] leading-[1.55] text-muted">
                {p.note}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 max-w-[60ch] font-mono text-[11px] leading-[1.8] text-faint">
          Only the first of those has actually run. The other two are what the
          interface allows, not work already done, and we would rather say so
          than let a diagram imply otherwise.
        </p>
      </div>
    </section>
  );
}
