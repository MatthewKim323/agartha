'use client';

import { motion } from 'motion/react';
import GridLines from '@/components/GridLines';
import { fadeUp, stagger, inView } from '@/lib/motion';

// This slot holds testimonials in the reference. agartha has no users yet, so
// quotes would have to be invented — and a fabricated testimonial is the one
// thing on a launch page that is genuinely dishonest rather than merely
// optimistic. The lineage is real, checkable, and more interesting anyway.
const SOURCES = [
  {
    name: 'itto',
    repo: 'silaswu4/itto',
    role: 'The body',
    body: 'A UCSB hackathon build. The BotControl seam, the two-loop split, the skill library, and the hand-rolled 3x3 crafting all came from here and are kept largely intact. The MCP server never imports Mineflayer, which is the best property the inherited code has.',
  },
  {
    name: 'jabby',
    repo: 'private',
    role: 'The brain',
    body: 'Identity and long-term memory. agartha builds its persona from jabby’s actual prompt files rather than keeping a copy, and reads and writes the same store. Same memory, same personality, separate lifecycle.',
  },
] as const;

export default function Lineage() {
  return (
    <section className="relative bg-paper py-28 md:py-40">
      <GridLines />

      <motion.div
        className="relative mx-auto max-w-[80%]"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={inView}
      >
        <motion.p
          variants={fadeUp}
          className="font-mono text-[11px] tracking-widest text-muted"
        >
          ◆ LINEAGE
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-4 max-w-3xl text-4xl font-medium tracking-[-0.03em] text-ink md:text-5xl"
        >
          Two working halves that could not reach each other
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-6 max-w-2xl leading-relaxed text-muted"
        >
          The pieces already existed and were individually good. One could talk
          but had no tools loaded. The other could act but pushed speech into a
          queue nothing drained. agartha is the rewrite that connects them
          without a process spawn in between.
        </motion.p>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-line md:grid-cols-2">
          {SOURCES.map((s) => (
            <motion.article key={s.name} variants={fadeUp} className="bg-paper p-8 md:p-10">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-2xl font-medium tracking-[-0.02em] text-ink">
                  {s.name}
                </h3>
                <span className="font-mono text-[11px] tracking-widest text-faint">
                  {s.repo}
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] tracking-widest text-muted uppercase">
                {s.role}
              </p>
              <p className="mt-5 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
