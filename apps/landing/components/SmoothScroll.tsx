'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

// The reference runs Lenis, and its scroll feel is a real part of why the page
// reads as polished — entrance timing is tuned against this easing, so dropping
// it makes the rest of the motion land differently.
export default function SmoothScroll() {
  useEffect(() => {
    // Honour the OS setting: smooth-scroll hijacking is exactly what
    // reduced-motion users are asking to turn off.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
