'use client';

import { motion, useReducedMotion } from 'motion/react';

// The reference runs a marquee of placeholder client logos. agartha has no
// clients, so this carries what it is actually built on instead — every entry
// is a real dependency you can find in the lockfile.
const STACK = [
  'Mineflayer',
  'Gemini Live',
  'Model Context Protocol',
  'Discord',
  'Bun',
  'PGLite',
  'TypeScript',
  'Lenis',
] as const;

// The capture recorded exactly one `linear` easing, noted as "often a marquee
// or scroll". This is that case: constant speed, no ease at the seam.
const DURATION_S = 32;

export default function StackTicker() {
  const reduced = useReducedMotion();

  // Rendered twice so the second copy is entering as the first leaves; the
  // -50% translate lands exactly on the seam, so the loop is invisible.
  const row = [...STACK, ...STACK];

  return (
    <section
      className="overflow-hidden border-y border-line bg-paper py-10"
      aria-label="Built with"
    >
      <motion.div
        className="flex w-max gap-16 pr-16"
        animate={reduced ? undefined : { x: ['0%', '-50%'] }}
        transition={
          reduced
            ? undefined
            : { duration: DURATION_S, ease: 'linear', repeat: Infinity }
        }
      >
        {row.map((name, i) => (
          <span
            key={`${name}-${i}`}
            // The duplicated half is decorative; only the first pass should be
            // announced, otherwise a screen reader hears the list twice.
            aria-hidden={i >= STACK.length}
            className="font-mono text-sm tracking-widest whitespace-nowrap text-faint uppercase"
          >
            {name}
          </span>
        ))}
      </motion.div>
    </section>
  );
}
