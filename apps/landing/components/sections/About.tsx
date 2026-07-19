'use client';

import { motion } from 'motion/react';
import GridLines from '@/components/GridLines';
import { fadeUp, stagger, inView } from '@/lib/motion';

// Two columns: what the thing is, and why the engineering choice behind it
// matters. Both are drawn from the repo's own docs rather than invented — the
// latency numbers are the ones recorded in docs/MEASUREMENTS.md.
const COLUMNS = [
  {
    heading: 'What it is',
    body: 'A voice companion for Minecraft. It sits in your Discord call, listens, talks back, and drives a Mineflayer bot in your world. One persistent session holds the conversation and the controls, so speaking and acting are the same act.',
  },
  {
    heading: 'Why it matters',
    body: 'The version before this spawned a fresh CLI process for every turn and took six to thirteen seconds to say a word. Removing that spawn is the entire rewrite. Nothing slow is allowed in front of speech.',
  },
] as const;

export default function About() {
  return (
    <section className="relative bg-paper py-20 md:py-28">
      <GridLines />

      <motion.div
        className="relative mx-auto grid max-w-[80%] grid-cols-1 gap-12 md:grid-cols-[1fr_1.2fr_1.2fr] md:gap-16"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={inView}
      >
        <motion.h2
          variants={fadeUp}
          className="text-4xl font-medium tracking-[-0.02em] text-ink md:text-5xl"
        >
          About
        </motion.h2>

        {COLUMNS.map((col) => (
          <motion.div key={col.heading} variants={fadeUp}>
            <h3 className="text-base font-semibold text-ink">{col.heading}</h3>
            <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-muted">
              {col.body}
            </p>
          </motion.div>
        ))}

        <motion.div variants={fadeUp} className="md:col-start-2">
          <a
            href="https://github.com/MatthewKim323/agartha"
            className="inline-flex items-center rounded-full bg-ink px-7 py-3.5 text-sm text-white transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06]"
          >
            Read the architecture
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
