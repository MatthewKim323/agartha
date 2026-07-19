'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RevealLines } from '@/components/RevealText';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// About, as a transcript.
//
// Two earlier versions of this section explained the product in prose, then in
// a before/after diagram. Both described a voice companion without ever letting
// you hear one. This plays an actual exchange instead, with a timing gutter
// showing when each thing fired, so the explanation and the demo are the same
// object.
//
// On honesty: the TIMINGS are the measured ones from docs/MEASUREMENTS.md.
// recall lands at 345ms, set_goal returns in 1ms, and the in-world inventory
// change is the verified chop_tree run. The dialogue is representative rather
// than a verbatim log, because the recorded session happened to be about
// something other than Minecraft. So the marks are real and the words are not
// quoted, which is the split a reader should be able to assume either way.

type Line = {
  kind: 'you' | 'tool' | 'bot' | 'world';
  text: string;
  at: number;
  note?: string;
};

const SCRIPT: Line[] = [
  { kind: 'you', text: 'yo where did we leave off last night', at: 0 },
  {
    kind: 'tool',
    text: 'recall({ query: "last session, what were we building" })',
    at: 345,
    note: 'first tool call',
  },
  {
    kind: 'bot',
    text: 'we were walling in the base on the ravine side. you ran out of cobble halfway through and said you would sort it today',
    at: 480,
  },
  { kind: 'you', text: 'right. go grab some wood while i dig', at: 3200 },
  {
    kind: 'tool',
    text: 'set_goal({ skill: "chop_tree", label: "get wood" })',
    at: 3546,
    note: 'returns in 1ms',
  },
  { kind: 'bot', text: 'aight, otw', at: 3620 },
  { kind: 'world', text: 'IDLE → TASK · already pathing', at: 3630 },
  { kind: 'world', text: 'oak_log ×3 → ×6 · birch_log ×4', at: 9100 },
  { kind: 'bot', text: 'got you six oak, four birch', at: 9240 },
];

const LABEL: Record<Line['kind'], string> = {
  you: 'you',
  bot: 'agar',
  tool: 'tool',
  world: 'world',
};

function fmt(ms: number) {
  if (ms === 0) return '0ms';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function About() {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(SCRIPT.length);
      return;
    }

    const ctx = gsap.context(() => {
      // Lines land in their logged order. Wall-clock gaps are compressed,
      // because nobody watches a nine second pause, but the ordering is the
      // recorded one: the tool call precedes the reply, and the bot is already
      // moving before it finishes speaking.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top 72%', once: true },
      });
      SCRIPT.forEach((_, i) => {
        tl.call(
          () => setShown(i + 1),
          undefined,
          i === 0 ? 0 : `+=${i < 3 ? 0.5 : 0.4}`,
        );
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="relative bg-paper py-24 md:py-36">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <p className="font-mono text-[12px] tracking-widest text-muted">ABOUT</p>

        <div className="mt-6 grid grid-cols-1 gap-12 md:grid-cols-[1fr_1.3fr] md:gap-20">
          <div>
            <RevealLines
              as="h2"
              className="text-[38px] leading-[1.2] font-medium tracking-[-0.04em] text-ink md:text-[38px] xl:text-[44px]"
              lines={['The perfect', 'Minecraft companion']}
            />
            <RevealLines
              className="mt-8 max-w-[44ch] text-[17px] leading-[1.62] text-muted"
              delay={0.1}
              lines={[
                'agar hops in your Discord call and your',
                'world at the same time. Ask for something and',
                'agar answers like a person would, then goes',
                'and handles it while you carry on.',
              ]}
            />
            <a
              href="https://github.com/MatthewKim323/agartha/blob/main/docs/MEASUREMENTS.md"
              className="group mt-10 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] text-white transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06]"
            >
              See The Log
              <span className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1">
                →
              </span>
            </a>
          </div>

          {/* Transcript. Timing gutter left, exchange right. */}
          <div ref={root} className="relative">
            <div className="mb-6 flex items-baseline justify-between border-b border-ink/10 pb-3">
              <p className="font-mono text-[11px] tracking-widest text-faint uppercase">
                Session · logged
              </p>
              <p className="font-mono text-[11px] tracking-widest text-faint uppercase">
                elapsed
              </p>
            </div>

            <ol className="space-y-5">
              {SCRIPT.map((line, i) => {
                const on = i < shown;
                const isTool = line.kind === 'tool';
                const isWorld = line.kind === 'world';
                return (
                  <li
                    key={i}
                    className="grid grid-cols-[54px_1fr] items-baseline gap-4 transition-all duration-[550ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      opacity: on ? 1 : 0,
                      transform: on ? 'translateY(0)' : 'translateY(10px)',
                    }}
                  >
                    <span className="text-right font-mono text-[11px] text-faint tabular-nums">
                      {fmt(line.at)}
                    </span>
                    <span className="min-w-0">
                      <span className="font-mono text-[10px] tracking-widest text-faint uppercase">
                        {LABEL[line.kind]}
                      </span>
                      <span
                        className={[
                          'mt-1.5 block leading-[1.55]',
                          isTool
                            ? 'rounded-md bg-ink/[0.05] px-3 py-2 font-mono text-[12.5px] text-muted'
                            : isWorld
                              ? 'font-mono text-[12px] text-faint'
                              : 'text-[16px] text-ink',
                        ].join(' ')}
                      >
                        {line.text}
                      </span>
                      {line.note && (
                        <span className="mt-1.5 block font-mono text-[11px] tracking-widest text-ink/40 uppercase">
                          {line.note}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
