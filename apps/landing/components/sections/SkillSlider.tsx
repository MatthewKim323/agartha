'use client';

import { useCallback, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useAnimationFrame,
  useMotionValue,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'motion/react';
import { DUR, EASE } from '@/lib/motion';
import { RevealOnMount } from '@/components/RevealText';
import SkillDiagram, { type SkillKind } from '@/components/SkillDiagram';

// Full-bleed image slider.
//
// Timing note, this is the third attempt at the progress rail and the first
// correct one. Earlier versions ran a setInterval for the slide advance and a
// separate CSS transition for the fill, so the two drifted apart; worse, the
// paused branch animated the fill *to 100%* instead of holding it, which meant
// hovering the section (now full-viewport, so: always) snapped the timer to
// full instead of pausing it. The line looked broken because it was.
//
// Now a single rAF-driven value owns both: the fill IS the clock, and reaching
// 1 is what advances the slide. Pausing stops the clock, so the line freezes
// exactly where it sits. They cannot disagree because there is only one of them.
//
// Each slide draws its own seeded voxel terrain rather than carrying a bitmap.
// The previous version used the design reference's product renders, which could
// not ship in the repo, so the deployed page would have shown six empty
// panels. Generated art has no such problem and is on-subject besides.
//
// Each skill maps to a real file in apps/mc-bot/src/skills/.
const SKILLS = [
  {
    name: 'Chop tree',
    file: 'chop-tree.ts',
    kind: 'chop' as SkillKind,
    body: 'Walks to the nearest tree, fells it, and collects what drops. The goal returns on the first tick, so "aight, otw" lands while the bot is already pathing.',
  },
  {
    name: 'Mine down',
    file: 'mine-down.ts',
    kind: 'mine' as SkillKind,
    body: 'Digs a safe staircase rather than a straight drop, with the reflex loop watching for lava the entire way down. No model involved in the safety check.',
  },
  {
    name: 'Fetch item',
    file: 'fetch-item.ts',
    kind: 'fetch' as SkillKind,
    body: 'Finds an item in the world or in storage and brings it back. Reports completion when it actually has the thing, not when it starts looking.',
  },
  {
    name: 'Combat assist',
    file: 'combat-assist.ts',
    kind: 'combat' as SkillKind,
    body: 'Engages hostiles near you and disengages when they are gone. Runs on the fast loop, so it reacts at a speed a language model could never hit.',
  },
  {
    name: 'Scout ahead',
    file: 'scout-ahead.ts',
    kind: 'scout' as SkillKind,
    body: 'Ranges out in front of you and reports what it finds. Useful precisely because it can talk about what it sees while it is still moving.',
  },
  {
    name: 'Craft',
    file: 'craft.ts',
    kind: 'craft' as SkillKind,
    body: 'Hand-rolled 3x3 crafting that works around a mineflayer no-op on 1.20.6. Inherited from itto and kept intact, because rewriting it re-earns the bug.',
  },
] as const;

const ADVANCE_MS = 6000;

// One segment of the rail. Extracted so its useTransform sits at the top level
// of a component rather than inside a .map() callback.
function Segment({
  i,
  index,
  progress,
  onSelect,
  name,
}: {
  i: number;
  index: number;
  progress: MotionValue<number>;
  onSelect: (i: number) => void;
  name: string;
}) {
  const isActive = i === index;
  const isPast = i < index;
  // scaleX rather than width: it runs on the compositor, so a 6s fill costs no
  // layout work per frame.
  const scaleX = useTransform(progress, (v) => (isActive ? v : isPast ? 1 : 0));

  return (
    <button
      onClick={() => onSelect(i)}
      aria-label={`Show ${name}`}
      aria-current={isActive}
      className="group flex-1 cursor-pointer py-3"
    >
      <span className="relative block h-[2px] w-full bg-[rgba(255,255,255,0.25)]">
        <motion.span
          style={{ scaleX }}
          className="absolute inset-y-0 left-0 block w-full origin-left bg-[rgba(255,255,255,0.7)]"
        />
      </span>
    </button>
  );
}

export default function SkillSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  // 0 → 1 across one slide's dwell. Single source of truth for the rail fill
  // and the advance.
  const progress = useMotionValue(0);

  const go = useCallback(
    (next: number) => {
      progress.set(0);
      setIndex(((next % SKILLS.length) + SKILLS.length) % SKILLS.length);
    },
    [progress],
  );

  useAnimationFrame((_, delta) => {
    if (paused || reduced) return;
    // delta is ms since last frame, so this advances in real time regardless
    // of refresh rate.
    const next = progress.get() + delta / ADVANCE_MS;
    if (next >= 1) {
      progress.set(0);
      setIndex((i) => (i + 1) % SKILLS.length);
    } else {
      progress.set(next);
    }
  });

  const active = SKILLS[index];

  return (
    <section
      className="relative isolate min-h-svh overflow-hidden bg-black"
      aria-roledescription="carousel"
      aria-label="Skill library"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1);
        if (e.key === 'ArrowLeft') go(index - 1);
      }}
      tabIndex={-1}
    >
      <div className="relative mx-auto flex min-h-svh w-full max-w-6xl flex-col justify-center px-6 py-20 md:px-10">
        <p className="font-mono text-[12px] tracking-widest text-white/40">
          SKILL LIBRARY
        </p>

        <div className="mt-10 grid grid-cols-1 items-center gap-12 md:grid-cols-[1.05fr_1fr] md:gap-16">
          {/* Diagram panel. Framed rather than full-bleed, so this section does
              not repeat the hero's composition. */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#131315]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${active.kind}-viz`}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast, ease: EASE.expo }}
              >
                <SkillDiagram kind={active.kind} />
              </motion.div>
            </AnimatePresence>
            <span className="pointer-events-none absolute bottom-4 left-5 font-mono text-[11px] tracking-widest text-white/25 uppercase">
              {active.file}
            </span>
          </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.name}
            initial={{ opacity: 0.001, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: DUR.base, ease: EASE.expo }}
            className="max-w-xl"
          >
            <RevealOnMount
              as="h3"
              className="text-[42px] leading-[1.2] font-medium tracking-[-0.04em] text-white md:text-[48px]"
              delay={0.05}
            >
              {active.name}
            </RevealOnMount>
            <p className="mt-5 text-[15px] leading-[1.62] text-white/75">
              {active.body}
            </p>
          </motion.div>
        </AnimatePresence>
        </div>

        <a
          href="https://github.com/MatthewKim323/agartha/tree/main/apps/mc-bot/src/skills"
          className="mt-9 inline-flex w-fit items-center rounded-full bg-white px-7 py-3.5 text-sm text-ink transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06]"
        >
          Read the skill library
        </a>

        {/* Progress rail: 2px, rgba(255,255,255,0.25) track with a 0.7 fill,
            all measured off the live reference. */}
        <div
          className="mt-14 flex gap-3"
          // Scoped here rather than on the section: hovering the rail means you
          // are reading it, and that is worth holding. Hovering the artwork is
          // not.
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {SKILLS.map((s, i) => (
            <Segment
              key={s.name}
              i={i}
              index={index}
              progress={progress}
              onSelect={go}
              name={s.name}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
