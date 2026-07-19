'use client';

import { useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'motion/react';
import { DUR, EASE } from '@/lib/motion';
import { RevealOnMount } from '@/components/RevealText';

// Pinned step sequence.
//
// Structure recovered from the reference's own scroll keyframes: six steps, not
// the three this previously had; labels 460x32 stacked at a single position and
// crossfaded in place rather than moved; right column starting at 46% of the
// viewport. The first build invented a three-lane layout because the capture's
// pinned internals came back empty — the keyframe pass filled that in.
//
// Content is the real request path, and every timing is from
// docs/MEASUREMENTS.md. The steps that have not been separately measured say so
// rather than carrying a number that looks measured.
const STEPS = [
  {
    n: '01',
    name: 'You Speak',
    timing: 'native VAD',
    body: 'Discord voice reaches a session that is already open. There is no wake word and no per-turn connection, because the session never closed.',
  },
  {
    n: '02',
    name: 'The Model Answers',
    timing: 'speech to speech',
    body: 'One model takes audio in and gives audio out. Nothing transcribes to text and back, which is where composable pipelines spend their budget.',
  },
  {
    n: '03',
    name: 'A Call Is Emitted',
    timing: '345ms to first tool',
    body: 'Measured over a live session. The model decides it needs the world or the memory, and emits a function call mid-sentence.',
  },
  {
    n: '04',
    name: 'MCP Dispatches',
    timing: '3ms median',
    body: 'Straight to the bot over localhost. The handshake was paid once at startup, so this is the whole cost of getting from intent to the body.',
  },
  {
    n: '05',
    name: 'The Goal Starts',
    timing: '1ms to return',
    body: 'set_goal returns before the work begins. That single millisecond is what lets "aight, otw" land while the bot is already pathing.',
  },
  {
    n: '06',
    name: 'It Reports Back',
    timing: 'on completion',
    body: 'The goal runner pings when the work is actually done, not when it started. "Got the wood" arrives with the wood.',
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
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });

  // The numeral ring turns one step's worth per step.
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, -300]);

  return (
    <section
      ref={track}
      // Six steps need more track than three did. Still shorter on mobile,
      // where the ring is hidden and there is less to look at.
      className="relative h-[400vh] bg-surface md:h-[560vh]"
    >
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 md:grid-cols-[1fr_1.1fr] md:px-10">
          {/* Numeral ring */}
          <motion.div
            className="relative hidden aspect-square w-full max-w-md md:block"
            style={{ rotate: ringRotate }}
          >
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-[18%] rounded-full border border-white/[0.06]" />
            {STEPS.map((s, i) => {
              const angle = (i / STEPS.length) * 360;
              const isOn = i === active;
              return (
                <span
                  key={s.n}
                  className={`absolute top-1/2 left-1/2 font-mono text-[18px] transition-colors duration-[400ms] ${
                    isOn ? 'text-accent' : 'text-white/20'
                  }`}
                  style={{
                    transform: `rotate(${angle}deg) translateY(-11.5rem) rotate(${-angle}deg)`,
                  }}
                >
                  {s.n}
                </span>
              );
            })}
          </motion.div>

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
