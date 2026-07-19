'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

// A crossing grid: an inner box whose four rules all overshoot the corners,
// with dots marking the intersections. Measured off the live reference at a
// 1440px viewport:
//
//   verticals    x = 146.6 / 1298.7  (10% / 90%), spanning y 184.6 → 862.3
//   horizontals  y = 314.9 / 732.0,  spanning x -213 → 1658 (bleeds off-screen)
//   dots         7px, rgba(0,0,0,0.3), centred on the four intersections
//   all rules    1px — captured at rgba(0,0,0,0.1), raised to 0.16 here
//                 because at 0.1 the rules were effectively invisible on our
//                 paper ground. This is a deliberate divergence from measured.
//
// So the box is 1152 x 417, the verticals overshoot it by 130px top and bottom
// (symmetric), and the horizontals run past the viewport on both sides. Earlier
// builds drew only the two verticals across the full section height, which is
// why it read as a couple of stray hairlines instead of a frame.
// Tightened from the measured 130px: the reference's box sits in a taller
// section, so the same overshoot here left the frame floating well clear of the
// content instead of holding it.
const OVERSHOOT = 100;
const TRACK_RATE = 0.0194; // horizontal drift per px of pointer offset

export default function GridLines({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  // Spring rather than the raw pointer value: pointermove arrives in coarse
  // jumps, and easing them is what makes the drift read as weight, not jitter.
  const drift = useSpring(x, { stiffness: 90, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      x.set(-(e.clientX - window.innerWidth / 2) * TRACK_RATE);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduced, x]);

  const RULE = 'absolute bg-[rgba(0,0,0,0.16)]';

  return (
    <motion.div
      aria-hidden
      style={{ x: reduced ? 0 : drift }}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Verticals — full height of the section, so they overshoot the box. */}
      <div className={`${RULE} top-0 bottom-0 left-[10%] w-px`} />
      <div className={`${RULE} top-0 bottom-0 left-[90%] w-px`} />

      {/* Horizontals — inset by the overshoot, and run past the viewport. */}
      <div
        className={`${RULE} left-1/2 h-px w-[160vw] -translate-x-1/2`}
        style={{ top: OVERSHOOT }}
      />
      <div
        className={`${RULE} left-1/2 h-px w-[160vw] -translate-x-1/2`}
        style={{ bottom: OVERSHOOT }}
      />

      {/* Dots at the four intersections. */}
      {(
        [
          ['left-[10%]', 'top'],
          ['left-[90%]', 'top'],
          ['left-[10%]', 'bottom'],
          ['left-[90%]', 'bottom'],
        ] as const
      ).map(([lx, edge]) => (
        <span
          key={`${lx}-${edge}`}
          className={`absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(0,0,0,0.3)] ${lx}`}
          style={
            edge === 'top'
              ? { top: OVERSHOOT }
              : { bottom: OVERSHOOT, transform: 'translate(-50%, 50%)' }
          }
        />
      ))}
    </motion.div>
  );
}
