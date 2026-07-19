'use client';

import { motion } from 'motion/react';
import { DUR, EASE, inView } from '@/lib/motion';

// Full-bleed wordmark moment. In the reference this sits over video; the same
// asset gap applies here as in the hero, so it currently runs on the surface
// colour alone and reads fine that way.
export default function LogoMark() {
  return (
    <section className="relative flex min-h-[70svh] items-center justify-center overflow-hidden bg-surface px-6">
      <motion.div
        className="relative text-center"
        initial="hidden"
        whileInView="visible"
        viewport={inView}
      >
        {/* Clip-masked rise, same treatment as the hero display type. */}
        <span className="block overflow-hidden">
          <motion.span
            className="block text-[22vw] leading-[0.8] font-semibold tracking-[-0.07em] text-white lowercase md:text-[16vw]"
            variants={{
              hidden: { y: '110%' },
              visible: { y: '0%' },
            }}
            transition={{ duration: DUR.slow, ease: EASE.expo }}
          >
            agartha
          </motion.span>
        </span>

        <motion.p
          className="mt-8 font-mono text-[11px] tracking-[0.3em] text-white/40 uppercase"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
          }}
          transition={{ duration: DUR.base, ease: EASE.expo, delay: 0.25 }}
        >
          Talks back · Acts while talking · Remembers
        </motion.p>
      </motion.div>
    </section>
  );
}
