'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { DUR, EASE, DIST } from '@/lib/motion';
import Logo from '@/components/Logo';

// Rebuilt against the capture rather than the screenshot.
//
// What changed from the first pass, and why:
//   · display type is 192px fixed (tokens/typography.json, x15), not 15vw,
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
  { label: 'REFLEXES', value: '15 HZ' },
  { label: 'HANDS', value: '3 MS' },
  { label: 'MEMORY', value: '345 MS' },
] as const;
// Scroll parallax on the display words, recovered via motion-probe against the
// live site. The two words drift apart horizontally as the page scrolls: the
// upper moves right at +0.2225px per px of scroll, the lower left at the same
// rate, both capping at ±200px, reached exactly one viewport height in.
// The first build had none of this, and it is the hero's defining scroll move.
const PARALLAX_RATE = 0.2225;
const PARALLAX_CAP = 200;
// Clip-masked word. translateY(110%) is the captured value, the extra 10%
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
    // Drift lives OUTSIDE the clip. The mask exists to hide the vertical rise
    // on entry, but it clips on every axis, so applying the scroll parallax to
    // the same element sent the leading letter into the mask edge and sheared
    // it off. Splitting them lets the whole masked block travel while the mask
    // still only ever hides the rise.
    <motion.span data-word className="block" style={{ x: drift }}>
      <span
        className="block overflow-hidden pb-[0.26em]"
        // Perspective on the clipping parent, so the rise below can tip in 3D
        // without the mask itself tilting.
        style={{ perspective: 700 }}
      >
        <motion.span
          className="block origin-bottom"
          // The mask alone was a flat slide. Tipping the word forward and
          // resolving a small blur as it lands gives it somewhere to arrive
          // from: the difference between text appearing and text being placed.
          initial={{ y: '110%', rotateX: -34, filter: 'blur(10px)', opacity: 0.001 }}
          animate={{ y: '0%', rotateX: 0, filter: 'blur(0px)', opacity: 1 }}
          transition={{ duration: DUR.slow, ease: EASE.expo, delay }}
        >
          {children}
        </motion.span>
      </span>
    </motion.span>
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
      {/* Real gameplay, recorded in-world.
          Two sources: VP9 is smaller and served first where supported, h264
          covers everything else. The poster paints immediately so the hero is
          never empty while the video decodes, and playsInline stops iOS
          taking it fullscreen. muted is what makes autoplay legal at all. */}
      <video
        ref={(el) => {
          if (el) el.playbackRate = 0.5;
        }}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/hero-poster.jpg"
      >
        <source src="/hero.webm" type="video/webm" />
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      {/* Scrim: the display type is white and the field has bright faces. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
      <div className="relative flex h-full flex-col justify-between px-6 pt-6 pb-10 md:px-10 md:pt-8 md:pb-14">
        {/* Nav card: 64px rise with blur, matching the captured entrance. */}
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
          <div className="mt-2 flex items-center gap-2.5">
            <Logo className="h-[18px] w-[18px] text-white" title={null} />
            <p className="text-[15px] text-white">agar</p>
          </div>
        </motion.header>
        {/* Split display type. Fixed 192px as captured, stepped down at narrow
            widths where 192px would simply not fit. */}
        <div className="pointer-events-none flex-1 select-none">
          <h1 className="flex h-full flex-col justify-center text-[clamp(3.25rem,13.34vw,192px)] leading-[0.8] font-medium tracking-[-0.07em] text-white lowercase">
            <DisplayWord delay={0.08} drift={driftRight}>Meet</DisplayWord>

            <motion.span
              className="pointer-events-none my-[0.04em] flex justify-center"
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: DUR.slow, ease: EASE.expo, delay: 0.42 }}
            >
              <Logo
                className="h-[0.34em] w-[0.34em] text-white/85"
                title={null}
              />
            </motion.span>

            <span className="self-end text-right">
              <DisplayWord delay={0.2} drift={driftLeft}>agar</DisplayWord>
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
