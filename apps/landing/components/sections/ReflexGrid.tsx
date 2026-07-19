'use client';

import { useEffect, useRef, useState } from 'react';
import RevealText, { RevealLines } from '@/components/RevealText';
import Gauge from '@/components/Gauge';

// Replaces the old lineage section.
//
// That one was a prose block about two predecessor repos, true, but it asked
// the reader to care about project history before they cared about the project.
// This shows the single claim the whole architecture rests on: the reflex loop
// samples the world 15 times a second with no model in the path, while the
// language model's lane runs orders of magnitude slower alongside it.
//
// Treatment borrowed from Linear's hero lattice: quantized `steps()` blinking,
// binary opacity, no easing anywhere. Easing a data element makes it read as
// decoration; sampling should look like sampling. The grid below is on a real
// 66ms period, so what you are watching is the actual tick rate.

const COLS = 40;
const ROWS = 6;
const TICK_MS = 66; // 15Hz, from docs/MEASUREMENTS.md

// The three lanes at their measured budgets, log-scaled so 66ms and "seconds"
// can share an axis without the fast one vanishing.
const LANES = [
  { name: 'Reflex', budget: '66ms', detail: 'no model, ever', ms: 66 },
  { name: 'Conversation', budget: '~400ms', detail: 'speech to speech', ms: 400 },
  { name: 'Reflection', budget: 'seconds', detail: 'never blocks a word', ms: 4000 },
] as const;

function LaneBar({ ms, name }: { ms: number; name: string }) {
  const pct = (Math.log10(ms) / Math.log10(4000)) * 100;
  return (
    <span className="relative block h-[6px] w-full overflow-hidden rounded-[1px] bg-white/10">
      <span
        className={`absolute inset-y-0 left-0 block rounded-[1px] ${
          name === 'Reflex' ? 'bg-accent' : 'bg-white/35'
        }`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

export default function ReflexGrid() {
  const [tick, setTick] = useState(0);
  const raf = useRef<number>(0);

  // Drive the sweep on a real 66ms period rather than a CSS animation, so the
  // column that lights is genuinely the current tick and the readout below it
  // is not a decorative counter.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += now - last;
      last = now;
      if (acc >= TICK_MS) {
        acc %= TICK_MS;
        setTick((t) => t + 1);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const head = tick % COLS;

  return (
    <section className="relative overflow-hidden bg-surface px-6 py-28 md:px-10 md:py-36">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[12px] tracking-widest text-accent">
          THE ONE RULE
        </p>
        <RevealLines
          as="h2"
          className="mt-5 max-w-4xl text-[48px] leading-[1.2] font-medium tracking-[-0.06em] text-white md:text-[64px]"
          duration={1}
          lines={['Never make anyone', 'wait to be heard']}
        />
        <RevealLines
          className="mt-6 max-w-2xl text-[16px] leading-[1.62] text-white/60"
          delay={0.1}
          lines={[
            'Three lanes that never block each other. The quick one keeps',
            'running no matter what the slow one is up to, which is why',
            'agar still feels alive while thinking.',
          ]}
        />

        {/* Sampling lattice */}
        <div className="mt-16 rounded-2xl border border-white/10 p-6 md:p-8">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[11px] tracking-widest text-white/40 uppercase">
              Reflex loop · live
            </p>
            <p className="font-mono text-[11px] tracking-widest text-white/40 tabular-nums">
              tick {String(tick % 1000).padStart(3, '0')} · 66ms
            </p>
          </div>

          <div
            className="mt-6 grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            aria-hidden
          >
            {Array.from({ length: COLS * ROWS }).map((_, i) => {
              const col = i % COLS;
              // Distance behind the sweep head, wrapped.
              const dist = (head - col + COLS) % COLS;
              const lit = dist < 4;
              return (
                <span
                  key={i}
                  className="aspect-square rounded-[1px]"
                  style={{
                    backgroundColor: lit
                      ? 'var(--color-accent)'
                      : 'rgba(255,255,255,0.10)',
                    // No transition: the sample is on or it is not.
                    opacity: lit ? 1 - dist * 0.22 : 1,
                  }}
                />
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-8 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
            <Gauge
              value={15}
              max={20}
              unit="Hz"
              label={'Sustained tick rate\nconfirmed from a live boot'}
              className="whitespace-pre-line"
            />
            <p className="max-w-[46ch] font-mono text-[11px] leading-[1.8] text-white/35">
              Following you, dodging lava, eating when it should. Plain code on a
              fixed loop with everything else running. No model has ever touched
              this path, and none ever will.
            </p>
          </div>
        </div>

        {/* Lane budgets */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {LANES.map((l) => (
            <div key={l.name} className="card-lift hover:border-white/25 rounded-2xl border border-white/10 p-6">
              <div className="flex items-baseline justify-between">
                <p className="text-[18px] font-medium text-white">{l.name}</p>
                <p className="font-mono text-[12px] text-white/50 tabular-nums">
                  {l.budget}
                </p>
              </div>
              <div className="mt-4">
                <LaneBar ms={l.ms} name={l.name} />
              </div>
              <p className="mt-3 font-mono text-[11px] tracking-widest text-white/35 uppercase">
                {l.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
