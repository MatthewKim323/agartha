'use client';

import { useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from 'motion/react';
import { DUR, EASE } from '@/lib/motion';
import { RevealOnMount } from '@/components/RevealText';
import VoxelSteps from '@/components/VoxelSteps';

// Pinned step sequence.
//
// Structure recovered from the reference's own scroll keyframes: six steps, not
// the three this previously had; labels 460x32 stacked at a single position and
// crossfaded in place rather than moved; right column starting at 46% of the
// viewport. The first build invented a three-lane layout because the capture's
// pinned internals came back empty, the keyframe pass filled that in.
//
// Content is the real request path, and every timing is from
// docs/MEASUREMENTS.md. The steps that have not been separately measured say so
// rather than carrying a number that looks measured.
const STEPS = [
  {
    n: '01',
    name: 'You Speak',
    timing: 'native VAD',
    body: 'Your voice lands in a session that never closed. No wake word, no connecting, nothing to sit through before it hears you.',
  },
  {
    n: '02',
    name: 'The Model Answers',
    timing: 'speech to speech',
    body: 'One model takes audio in and gives audio back. Nothing gets turned into text and back again, which is where most of the waiting usually goes.',
  },
  {
    n: '03',
    name: 'A Call Is Emitted',
    timing: '345ms to first tool',
    body: 'Measured on a live session. It works out that it needs the world, or needs to remember something, and reaches for it mid sentence.',
  },
  {
    n: '04',
    name: 'MCP Dispatches',
    timing: '3ms median',
    body: 'Straight through to the body. The connection was made once at startup, so this is the entire cost of going from deciding to doing.',
  },
  {
    n: '05',
    name: 'The Goal Starts',
    timing: '1ms to return',
    body: 'The goal comes back before the work starts. That one millisecond is the reason it can say "aight, otw" and already be moving.',
  },
  {
    n: '06',
    name: 'It Reports Back',
    timing: 'on completion',
    body: 'It tells you when the job is genuinely finished, not when it began. "Got the wood" turns up with the wood.',
  },
] as const;

function Step({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <motion.article
      className="absolute inset-0"
      initial={{ opacity: 0, y: 35 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -22 }}
      transition={{ duration: DUR.base, ease: EASE.expo }}
    >
      <p className="font-mono text-[12px] tracking-widest text-accent">
        {step.n} / {String(STEPS.length).padStart(2, '0')}
      </p>
      {/* 32px, matching the reference's measured label box. */}
      <RevealOnMount
        as="h3"
        className="mt-5 text-[32px] leading-[1.2] font-medium tracking-[-0.04em] text-white"
        delay={0.04}
      >
        {step.name}
      </RevealOnMount>
      <p className="mt-3 font-mono text-[12px] tracking-widest text-white/40 uppercase">
        {step.timing}
      </p>
      <p className="mt-6 max-w-[460px] text-[15px] leading-[1.62] text-white/70">
        {step.body}
      </p>
    </motion.article>
  );
}

export default function ThreeLanes() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ['start start', 'end end'],
  });

  const [active, setActive] = useState(0);
  // Raw progress in a ref: the canvas reads it every frame, and routing it
  // through state instead would re-render the whole section 60 times a second.
  const progressRef = useRef(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    progressRef.current = v;
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });

  return (
    <section
      ref={track}
      // ~66vh of scroll per step: enough for each panel to land, short enough
      // that the section does not become a tunnel. Shorter again on mobile,
      // where the staircase is hidden and there is less to look at.
      className="relative h-[300vh] bg-surface md:h-[400vh]"
    >
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 md:grid-cols-[1fr_1.1fr] md:px-10">
          {/* Voxel staircase. A ring implied a cycle; this path is a descent,
              each stage faster than the last, so a staircase is the honest
              shape, and blocks are what the product actually manipulates. */}
          <div className="relative hidden aspect-square w-full md:block">
            <VoxelSteps count={STEPS.length} active={active} progress={progressRef} />
          </div>

          {/* Stacked labels, crossfading in place. */}
          <div className="relative min-h-[19rem]">
            <AnimatePresence mode="popLayout" initial={false}>
              <Step key={STEPS[active].n} step={STEPS[active]} />
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          className="absolute bottom-0 left-0 h-px w-full origin-left bg-accent"
          style={{ scaleX: scrollYProgress }}
        />
      </div>
    </section>
  );
}
