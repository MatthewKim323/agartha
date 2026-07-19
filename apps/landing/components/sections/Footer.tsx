'use client';

import { motion } from 'motion/react';
import { fadeUp, stagger, inView } from '@/lib/motion';

const LINKS = [
  { label: 'Repository', href: 'https://github.com/MatthewKim323/agartha' },
  {
    label: 'Architecture',
    href: 'https://github.com/MatthewKim323/agartha/blob/main/docs/ARCHITECTURE.md',
  },
  {
    label: 'Decisions',
    href: 'https://github.com/MatthewKim323/agartha/blob/main/docs/DECISIONS.md',
  },
  {
    label: 'Measurements',
    href: 'https://github.com/MatthewKim323/agartha/blob/main/docs/MEASUREMENTS.md',
  },
] as const;

export default function Footer() {
  return (
    <footer className="bg-paper px-6 py-20 md:px-16">
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        className="flex flex-col gap-12 md:flex-row md:items-end md:justify-between"
      >
        <motion.div variants={fadeUp}>
          <p className="text-2xl font-medium tracking-[-0.02em] text-ink">agartha</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            A Minecraft companion that answers at about the speed a person would,
            and acts while it is still talking.
          </p>
        </motion.div>

        <motion.nav variants={fadeUp} className="flex flex-wrap gap-x-8 gap-y-3">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-mono text-[11px] tracking-widest text-muted uppercase transition-colors duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </motion.nav>
      </motion.div>

      <div className="mt-16 border-t border-line pt-8">
        <p className="font-mono text-[11px] tracking-widest text-faint">
          EARLY BUILD · NOT AFFILIATED WITH MOJANG
        </p>
      </div>
    </footer>
  );
}
