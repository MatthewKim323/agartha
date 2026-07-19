'use client';

import { motion } from 'motion/react';
import { riseIn, stagger, inView } from '@/lib/motion';

// Every figure here is measured and reproducible from docs/MEASUREMENTS.md.
// The voice-path numbers are deliberately absent: no Gemini key has been
// issued, so time-to-first-audio has never been observed. Putting an
// aspirational number in a section titled "measured" is how the predecessor
// ended up shipping a commit message its own logs contradicted.
const LEAD = {
  value: '64 ms',
  label: 'Cold retrieval',
  body: 'A cold memory lookup, handshake included. The version before this spawned a fresh process per query and needed 3,980ms to answer the same question. Almost all of the difference was process start-up.',
};

const CARDS = [
  {
    value: '25 ms',
    body: 'Median warm retrieval, measured across five distinct queries over one persistent connection.',
  },
  {
    value: '0 ms',
    body: 'Repeat queries, served from an LRU cache. There was previously no caching at all, so identical questions paid full price every time.',
  },
  {
    value: '28 / 40',
    body: 'Prefetch attempts that timed out in the predecessor against a 2.5s budget. One hung run was logged at 157,746ms.',
  },
] as const;

function Plus() {
  return (
    <span className="mt-auto inline-flex size-7 items-center justify-center rounded-full bg-ink/5 text-sm text-muted">
      +
    </span>
  );
}

export default function Stats() {
  return (
    <section className="bg-paper px-6 py-28 md:px-16 md:py-36">
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={inView}
      >
        <motion.p
          variants={riseIn}
          className="font-mono text-[11px] tracking-widest text-muted"
        >
          ◆ MEASURED
        </motion.p>
        <motion.h2
          variants={riseIn}
          className="mt-4 text-5xl font-medium tracking-[-0.03em] text-ink md:text-6xl"
        >
          By the numbers
        </motion.h2>

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Lead card: dark, taller, carries the headline comparison. */}
          <motion.div
            variants={riseIn}
            className="flex flex-col rounded-2xl bg-surface p-8 md:row-span-2"
          >
            <p className="text-5xl font-medium tracking-[-0.02em] text-white md:text-6xl">
              {LEAD.value}
            </p>
            <p className="mt-8 font-mono text-[11px] tracking-widest text-white/50 uppercase">
              {LEAD.label}
            </p>
            <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-white/70">
              {LEAD.body}
            </p>
            <span className="mt-auto inline-flex size-7 items-center justify-center rounded-full bg-white/10 text-sm text-white/70">
              +
            </span>
          </motion.div>

          {CARDS.map((c) => (
            <motion.div
              key={c.value}
              variants={riseIn}
              className="flex min-h-[220px] flex-col rounded-2xl bg-ink/[0.04] p-8"
            >
              <p className="text-4xl font-medium tracking-[-0.02em] text-ink md:text-5xl">
                {c.value}
              </p>
              <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-muted">
                {c.body}
              </p>
              <Plus />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
