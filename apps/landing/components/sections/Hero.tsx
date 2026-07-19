'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { DUR, EASE, DIST } from '@/lib/motion';

// Rebuilt against the capture rather than the screenshot.
//
// What changed from the first pass, and why:
//   · display type is 192px fixed (tokens/typography.json, x15), not 15vw —
//     the viewport-relative version drifted badly at wide widths
//   · entrance rises 64px from opacity 0.001, not 24px from 0
//     (motion/appear-effects.json dominant initial state)
//   · headline carries the captured 2px blur; body copy does not
//   · hero timing is 550ms (per-section.json), not the page-wide 600ms
//   · mono labels are 12px Space Mono, the single most-used style on the page

// All three are measured. The earlier build carried a "< 600ms target" here
// because the voice path had never run; it has now, and first tool call was
// observed at 345ms over a live session. See docs/MEASUREMENTS.md.
const META = [
  { label: 'REFLEX LOOP', value: '15 HZ' },
  { label: 'TOOL DISPATCH', value: '3 MS' },
  { label: 'FIRST TOOL CALL', value: '345 MS' },
] as const;

// Scroll parallax on the display words, recovered via motion-probe against the
// live site. The two words drift apart horizontally as the page scrolls: the
// upper moves right at +0.2225px per px of scroll, the lower left at the same
// rate, both capping at ±200px — reached exactly one viewport height in.
// The first build had none of this, and it is the hero's defining scroll move.
const PARALLAX_RATE = 0.2225;
const PARALLAX_CAP = 200;

// Clip-masked word. translateY(110%) is the captured value — the extra 10%
// keeps descenders hidden behind the mask edge.
function DisplayWord({
  children,
  delay,
  drift,
}: {
  children: string;
  delay: number;
  drift: MotionValue<number>;
}) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span
        className="block"
        style={{ x: drift }}
        initial={{ y: '110%' }}
        animate={{ y: '0%' }}
        transition={{ duration: DUR.slow, ease: EASE.expo, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export default function Hero() {
  const { scrollY } = useScroll();
  // Cap distance / rate = the scroll position where the drift maxes out.
  const capAt = PARALLAX_CAP / PARALLAX_RATE;
  const driftRight = useTransform(scrollY, [0, capAt], [0, PARALLAX_CAP], {
    clamp: true,
  });
  const driftLeft = useTransform(scrollY, [0, capAt], [0, -PARALLAX_CAP], {
    clamp: true,
  });

  return (
    <section className="relative h-svh w-full overflow-hidden bg-surface">
      {/* PLACEHOLDER: precept's factory footage. Needs agartha capture —
          ideally the bot pathing to a tree while audio is already playing. */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative flex h-full flex-col justify-between px-6 pt-6 pb-10 md:px-10 md:pt-8 md:pb-14">
        {/* Nav card — 64px rise with blur, matching the captured entrance. */}
        <motion.header
          className="w-fit rounded-xl bg-surface/85 px-5 py-4 backdrop-blur-sm"
          initial={{ opacity: 0.001, y: -20, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: DUR.hero, ease: EASE.expo }}
        >
          <div className="flex items-center gap-8">
            <span className="font-mono text-[12px] tracking-widest text-white/50">
              /HOME
            </span>
            <span className="font-mono text-[12px] tracking-widest text-white/90">
              MENU
            </span>
          </div>
          <p className="mt-2 text-[15px] text-white">agartha</p>
        </motion.header>

        {/* Split display type. Fixed 192px as captured, stepped down at narrow
            widths where 192px would simply not fit. */}
        <div className="pointer-events-none flex-1 select-none">
          <h1 className="flex h-full flex-col justify-center text-[clamp(3.25rem,13vw,192px)] leading-[0.8] font-medium tracking-[-0.07em] text-white uppercase">
            <DisplayWord delay={0.08} drift={driftRight}>Human</DisplayWord>
            <span className="self-end text-right">
              <DisplayWord delay={0.2} drift={driftLeft}>Speed</DisplayWord>
            </span>
          </h1>
        </div>

        <div>
          <motion.div
            className="h-px w-full origin-left bg-white/25"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: DUR.ambient, ease: EASE.expo, delay: 0.28 }}
          />
          <motion.dl
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3"
            initial={{ opacity: 0.001, y: DIST.near }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.hero, ease: EASE.expo, delay: 0.45 }}
          >
            {META.map((m) => (
              <div key={m.label}>
                <dt className="font-mono text-[12px] tracking-widest text-white/50">
                  {m.label}:
                </dt>
                <dd className="mt-1 font-mono text-[12px] tracking-widest text-white">
                  {m.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </div>
    </section>
  );
}
