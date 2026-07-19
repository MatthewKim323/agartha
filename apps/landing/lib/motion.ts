// Motion primitives.
//
// Measured off the live reference capture (research/reference/precept-home/).
// Nothing here is invented. Sections import from this file rather than
// hand-rolling transitions, which is what keeps the page moving as one system.
//
// Revised after reading motion/appear-effects.json properly. The first pass
// used a 24px fade-up with no blur; the capture's actual dominant entrance is
// 64px with opacity starting at 0.001, and roughly a third of those also carry
// a 2px blur. That difference is most of why the first build read as "close but
// not it".

import type { Variants, Transition } from 'motion/react';

// Easings by observed frequency. `ease` tops the raw count but almost all of
// those sit on 0s-duration declarations (i.e. not animating); expo is the
// dominant curve on things that actually move.
export const EASE = {
  expo: [0.16, 1, 0.3, 1],
  smooth: [0.08, 0.78, 0.56, 1],
  overshoot: [0.31, 1.01, 0.55, 0.97],
} as const;

// Durations in seconds, from the capture's duration histogram.
export const DUR = {
  fast: 0.45,
  hero: 0.55, // per-section.json: hero enters at ~550ms
  base: 0.6, // 72 occurrences, the page-wide default
  mid: 0.7,
  slow: 0.76,
  ambient: 1.5,
} as const;

// Distances lifted from appear-effects.json initial states.
export const DIST = {
  far: 64, // x18 (+x11 with blur), the dominant entrance
  near: 24, // x5, used on smaller//secondary elements
} as const;

export const STAGGER = 0.08;

export const baseTransition: Transition = {
  duration: DUR.base,
  ease: EASE.expo,
};

// The page's primary entrance: 64px rise from near-zero opacity.
// opacity starts at 0.001 rather than 0 exactly as captured, Framer does this
// so the compositor keeps the layer promoted instead of dropping and re-raising
// it, which is what stops the first frame from flashing.
export const fadeUp: Variants = {
  hidden: { opacity: 0.001, y: DIST.far },
  visible: { opacity: 1, y: 0, transition: baseTransition },
};

// Same, plus the 2px blur that lands on about a third of captured entrances.
// Reserved for headline moments; using it everywhere makes the page feel soft.
export const fadeUpBlur: Variants = {
  hidden: { opacity: 0.001, y: DIST.far, filter: 'blur(2px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: baseTransition,
  },
};

// Shorter rise for secondary content, cards, list items, stat tiles.
export const riseIn: Variants = {
  hidden: { opacity: 0, y: DIST.near },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.slow, ease: EASE.expo },
  },
};

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER } },
};

// Masked line reveal for display type. translateY(110%) is exactly what the
// capture recorded (x12), the extra 10% keeps descenders hidden behind the clip.
export const lineReveal: Variants = {
  hidden: { y: '110%' },
  visible: {
    y: '0%',
    transition: { duration: DUR.slow, ease: EASE.expo },
  },
};

// Shared viewport config so every section triggers at the same scroll position.
export const inView = { once: true, amount: 0.25 } as const;
