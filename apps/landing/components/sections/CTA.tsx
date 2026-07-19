'use client';

import { motion } from 'motion/react';
import { fadeUp, stagger, inView, DUR } from '@/lib/motion';

// Pre-footer close. The reference runs a full-bleed statement with a single
// action; the honest version here points at the repo rather than a signup,
// because there is nothing to sign up for yet.
export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-surface px-6 py-32 md:px-16 md:py-48">
      <motion.div
        className="relative mx-auto max-w-5xl"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={inView}
      >
        <motion.p
          variants={fadeUp}
          className="font-mono text-[11px] tracking-widest text-accent"
        >
          ◆ STATUS: EARLY
        </motion.p>

        <motion.h2
          variants={fadeUp}
          className="mt-6 text-5xl leading-[0.95] font-medium tracking-[-0.03em] text-white md:text-7xl"
        >
          Built in dependency order,
          <br />
          one commit per step.
        </motion.h2>

        <motion.p
          variants={fadeUp}
          className="mt-8 max-w-2xl text-lg leading-relaxed text-white/60"
        >
          The memory layer is measured and fast. The voice path is written,
          unit-tested, and has never carried audio, because no key has been
          issued yet. Everything here says which of those it is.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-12 flex flex-wrap gap-4">
          <a
            href="https://github.com/MatthewKim323/agartha"
            className="inline-flex items-center rounded-full bg-accent px-8 py-4 text-sm font-medium text-ink transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06]"
          >
            Read the source
          </a>
          <a
            href="https://github.com/MatthewKim323/agartha/blob/main/docs/MEASUREMENTS.md"
            className="inline-flex items-center rounded-full border border-white/20 px-8 py-4 text-sm text-white transition-colors duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-white/50"
          >
            See what is measured
          </a>
        </motion.div>
      </motion.div>

      {/* Slow ambient rule, using the capture's 1.5s duration. */}
      <motion.div
        aria-hidden
        className="absolute bottom-0 left-0 h-px w-full origin-left bg-white/15"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: DUR.ambient, ease: [0.16, 1, 0.3, 1] }}
      />
    </section>
  );
}
