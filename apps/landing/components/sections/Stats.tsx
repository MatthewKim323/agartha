'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import RevealText, { RevealLines } from '@/components/RevealText';
import CountUp from '@/components/CountUp';

// Every figure traces to docs/MEASUREMENTS.md. Nothing here is a target or an
// estimate, the file marks those separately, and none of them are on this page.
//
// Updated after Matthew landed tool-dispatch and in-world verification: the
// dispatch numbers and the chop-tree proof below did not exist in the first
// build of this section.

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// Log scale, because 3980ms next to 64ms on a linear axis renders the fast bar
// as a single pixel. Log makes both legible while keeping the gap honest.
const logScale = (ms: number) => Math.log10(Math.max(ms, 1)) / Math.log10(4000);

const COMPARISONS = [
  // 6901ms is a real logged line from the predecessor's own output, not the
  // midpoint of its 6.5-13s range. 1600 is the measured time to first audio
  // now. Deliberately not rounded to "about a second": the brief is explicit
  // that this number must not be rounded in our favour, and 1.6s is still the
  // difference between waiting and being answered.
  { label: 'Time to first audio', before: 6901, after: 1600 },
  { label: 'Cold memory lookup', before: 3980, after: 64 },
  { label: 'Warm lookup (median)', before: 1965, after: 25 },
  { label: 'Time to first tool call', before: 7244, after: 345 },
] as const;

// Measured against the live bot on a real 1.20.6 server, over MCP on localhost.
const DISPATCH = [
  { label: 'connect + handshake', ms: 15, note: 'paid once at startup' },
  { label: 'read tool (median)', ms: 3, note: 'perception, inventory' },
  { label: 'chat', ms: 3, note: 'in-game text' },
  { label: 'set_goal', ms: 1, note: 'returns before the work starts' },
] as const;

// Decade markers on the log axis: 1ms, 10ms, 100ms, 1s. Without a ruler the
// bars only say "shorter"; with one they say how much shorter, and the log
// scale stops being something the reader has to take on trust.
const DECADES = [1, 10, 100, 1000];

function Ticks() {
  return (
    <span aria-hidden className="absolute inset-0">
      {DECADES.map((d) => (
        <span
          key={d}
          className="absolute inset-y-0 w-px bg-ink/[0.16]"
          style={{ left: `${logScale(d) * 100}%` }}
        />
      ))}
    </span>
  );
}

function Bar({
  before,
  after,
  label,
  index,
}: {
  before: number;
  after: number;
  label: string;
  index: number;
}) {
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el.querySelectorAll('[data-fill]'), { scaleX: 1 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll('[data-fill]'),
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.1,
          // Slow entry, hard acceleration, long settle, the bars should feel
          // driven rather than eased out.
          ease: 'power3.inOut',
          stagger: 0.12,
          delay: index * 0.08,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [index]);

  return (
    <div ref={row} className="border-t border-line py-7">
      <p className="font-mono text-[12px] tracking-widest text-muted uppercase">
        {label}
      </p>
      <div className="mt-4 space-y-2.5">
        <div className="flex items-center gap-4">
          <span className="w-24 shrink-0 font-mono text-[11px] text-faint">
            before
          </span>
          <span className="relative h-6 flex-1 overflow-hidden rounded-[2px] bg-ink/[0.05]">
            <Ticks />
            <span
              data-fill
              className="absolute inset-y-0 left-0 block origin-left rounded-[2px] bg-ink/25"
              style={{ width: `${logScale(before) * 100}%` }}
            />
          </span>
          <span className="w-20 shrink-0 text-right font-mono text-[12px] text-muted tabular-nums">
            {before.toLocaleString()}ms
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="w-24 shrink-0 font-mono text-[11px] text-ink">
            agartha
          </span>
          <span className="relative h-6 flex-1 overflow-hidden rounded-[2px] bg-ink/[0.05]">
            <Ticks />
            <span
              data-fill
              className="absolute inset-y-0 left-0 block origin-left rounded-[2px] bg-accent"
              style={{ width: `${logScale(after) * 100}%` }}
            />
          </span>
          <span className="w-20 shrink-0 text-right font-mono text-[12px] font-medium text-ink tabular-nums">
            {after}ms
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Stats() {
  return (
    <section className="bg-paper px-6 py-28 md:px-10 md:py-36">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[12px] tracking-widest text-muted">
          MEASURED
        </p>
        <RevealText
          as="h2"
          className="mt-5 text-[48px] leading-[1.2] font-medium tracking-[-0.06em] text-ink md:text-[64px]"
          duration={1}
        >
          Numbers we actually measured
        </RevealText>
        <RevealLines
          className="mt-6 max-w-2xl text-[16px] leading-[1.62] text-muted"
          delay={0.12}
          lines={[
            'Nothing here is estimated or rounded up. The scale below is',
            'logarithmic so both bars stay readable, but the gap is real.',
          ]}
        />

        {/* Comparison bars */}
        <div className="mt-16">
          {COMPARISONS.map((c, i) => (
            <Bar key={c.label} {...c} index={i} />
          ))}
        </div>

        {/* Dispatch waterfall + in-world proof */}
        <div className="mt-20 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="card-lift hover:border-white/25 rounded-2xl bg-ink/[0.04] p-8">
            <p className="font-mono text-[12px] tracking-widest text-muted uppercase">
              Tool dispatch
            </p>
            <p className="mt-3 max-w-[42ch] text-[15px] leading-[1.62] text-muted">
              The moment it decides to do something, the body moves. Three
              milliseconds, give or take. The old version booted a whole agent
              for every reaction and sat behind a ten second cooldown.
            </p>
            <dl className="mt-8 space-y-4">
              {DISPATCH.map((d) => (
                <div key={d.label} className="flex items-baseline gap-4">
                  <dt className="w-40 shrink-0 font-mono text-[12px] text-muted">
                    {d.label}
                  </dt>
                  <dd className="flex flex-1 items-baseline gap-3">
                    <span className="text-[24px] font-medium text-ink">
                      <CountUp value={d.ms} />
                      <span className="text-[14px] text-muted">ms</span>
                    </span>
                    <span className="font-mono text-[11px] text-faint">
                      {d.note}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Terminal proof: this is the receipt, quoted from MEASUREMENTS.md */}
          <div className="overflow-hidden rounded-2xl bg-surface p-8">
            <p className="font-mono text-[12px] tracking-widest text-white/40 uppercase">
              Verified in-world
            </p>
            <pre className="mt-6 overflow-x-auto font-mono text-[12px] leading-[1.9] text-white/80">
              <code>{`$ set_goal chop_tree "get wood"

state:     IDLE ─▶ TASK
goal:      get wood [active]

inventory
  oak_log     ×3  ─▶  ×6
  birch_log   ×0  ─▶  ×4`}</code>
            </pre>
            <p className="mt-6 text-[14px] leading-[1.62] text-white/50">
              Call, goal runner, skill, blocks in the ground. On a real server,
              not a test fixture.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
