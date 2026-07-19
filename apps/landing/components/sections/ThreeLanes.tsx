'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from 'motion/react';
import { DUR, EASE } from '@/lib/motion';


// Pinned scroll sequence, modelled on the reference's orbit section.
//
// NOTE ON FIDELITY: the extraction did not recover this section's scrub range.
// The `pinned` behaviours in scroll-motion.json turned out to be Framer's store
// badge and "Made in Framer" banner, not the sequence itself. So the track
// length below is a chosen value, not a measured one — it's the one piece
// of motion on the page not backed by the capture. Verify against the live site
// with probe.mjs before treating it as matched.


// The three lanes are the actual architecture: strictly separated, with nothing
// slow allowed in front of speech. Budgets are from docs/ARCHITECTURE.md.
const LANES = [
  {
    n: '01',
    name: 'Reflex',
    budget: '66 ms · 15 Hz',
    body: 'Follow, safety, lava, auto-eat. Plain code on a fixed loop, with no model in the path. This is what keeps the bot feeling alive while the model is still thinking.',
  },
  {
    n: '02',
    name: 'Conversation and action',
    budget: '~400 ms',
    body: 'One persistent speech-to-speech session with native voice activity detection and barge-in. Function calls dispatch straight to the bot over localhost, which costs single-digit milliseconds.',
  },
  {
    n: '03',
    name: 'Reflection',
    budget: 'seconds, async',
    body: 'Memory retrieval and fact writeback. Speculative, and hidden behind the previous turn. If it is not ready, we speak without it rather than making anyone wait.',
  },
] as const;

// Renders whichever lane is active. Only one is ever mounted.
//
// This replaced a per-lane opacity scrub. Overlapping absolutely-positioned
// panels each driven by their own useTransform proved fragile: keyframe offsets
// had to be clamped into 0..1 to satisfy the Web Animations API, and clamping
// the first lane's ramp left it reading a stale position, so all three painted
// on top of each other at the end of the track. Picking one lane from progress
// is deterministic and cannot stack.
function Lane({ lane }: { lane: (typeof LANES)[number] }) {
  return (
    <motion.article
      className="absolute inset-0"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: DUR.base, ease: EASE.expo }}
    >
      <p className="font-mono text-[11px] tracking-widest text-accent">
        {lane.n} / {String(LANES.length).padStart(2, '0')}
      </p>
      <h3 className="mt-5 text-4xl font-medium tracking-[-0.02em] text-white md:text-5xl">
        {lane.name}
      </h3>
      <p className="mt-4 font-mono text-[11px] tracking-widest text-white/40 uppercase">
        Budget · {lane.budget}
      </p>
      <p className="mt-6 max-w-[46ch] leading-relaxed text-white/70">{lane.body}</p>
    </motion.article>
  );
}

export default function ThreeLanes() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ['start start', 'end end'],
  });

  // Rotates the numeral ring as the sequence advances.
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, -120]);

  // Which lane is showing. Derived from scroll rather than animated, so it can
  // never land between two lanes or leave one stuck part-way faded.
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const i = Math.min(LANES.length - 1, Math.max(0, Math.floor(v * LANES.length)));
    setActive(i);
  });

  return (
    <section
      ref={track}
      // Shorter track on mobile: the numeral ring is hidden below md, so the
      // desktop length leaves a phone scrolling ~2500px past a short text
      // block. Fewer viewports of scrub keeps the pacing honest on both.
      className="relative h-[220vh] bg-surface md:h-[300vh]"
    >
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 md:grid-cols-2 md:px-10">
          {/* Numeral ring */}
          <motion.div
            className="relative hidden aspect-square w-full max-w-md md:block"
            style={{ rotate: ringRotate }}
          >
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-[15%] rounded-full border border-white/5" />
            {LANES.map((lane, i) => {
              const angle = (i / LANES.length) * 360;
              return (
                <span
                  key={lane.n}
                  className="absolute top-1/2 left-1/2 font-mono text-2xl text-white/25"
                  style={{
                    transform: `rotate(${angle}deg) translateY(-11rem) rotate(${-angle}deg)`,
                  }}
                >
                  {lane.n}
                </span>
              );
            })}
          </motion.div>

          {/* Lane copy. One at a time, crossfading as the track advances. */}
          <div className="relative min-h-[22rem]">
            <AnimatePresence mode="popLayout" initial={false}>
              <Lane key={LANES[active].n} lane={LANES[active]} />
            </AnimatePresence>
          </div>
        </div>

        {/* Progress rule along the bottom of the pinned frame. Scroll-driven,
            so it takes no transition — the value tracks scroll position
            directly, and handing it one makes framer-motion build keyframes
            for a value that is already being scrubbed. */}
        <motion.div
          className="absolute bottom-0 left-0 h-px w-full origin-left bg-accent"
          style={{ scaleX: scrollYProgress }}
        />
      </div>
    </section>
  );
}
