'use client';

import RevealText, { RevealLines } from '@/components/RevealText';

// Copy is drawn from the repo's own docs. The latency figures come from
// docs/MEASUREMENTS.md and are stated as measured, because they are.
//
// Lines are authored rather than wrapped so each one gets its own mask and the
// stagger reads as intended — see RevealLines.
const COLUMNS = [
  {
    heading: 'What It Is',
    lines: [
      'A voice companion for Minecraft.',
      'It sits in your Discord call, listens,',
      'talks back, and drives a Mineflayer',
      'bot in your world. One session holds',
      'both, so speaking and acting are',
      'the same act.',
    ],
  },
  {
    heading: 'Why It Matters',
    lines: [
      'The version before this spawned a',
      'fresh process every turn, and took',
      'six to thirteen seconds to speak.',
      'Removing that spawn is the rewrite.',
      'Once the model emits a call, the bot',
      'moves in about three milliseconds.',
    ],
  },
] as const;

export default function About() {
  return (
    <section className="relative overflow-hidden bg-paper py-24 md:py-32">
      {/* A pixel field instead of ruled lines: same job — signalling that the
          page is built rather than drawn — but in the product's own idiom, and
          quiet enough to sit behind body copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(23,23,23,0.13) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
          WebkitMaskImage:
            'radial-gradient(120% 90% at 50% 45%, black 20%, transparent 78%)',
          maskImage:
            'radial-gradient(120% 90% at 50% 45%, black 20%, transparent 78%)',
        }}
      />
      <div className="relative mx-auto grid max-w-[80%] grid-cols-1 gap-12 md:grid-cols-[0.8fr_1.1fr_1.1fr] md:gap-16">
        <RevealText
          as="h2"
          className="text-[42px] leading-[1.2] font-medium tracking-[-0.04em] text-ink md:text-[48px]"
        >
          About
        </RevealText>

        {COLUMNS.map((col, i) => (
          <div key={col.heading}>
            <RevealText
              as="h3"
              className="text-[16px] font-semibold tracking-[-0.04em] text-ink"
              delay={0.06 + i * 0.06}
              duration={0.7}
            >
              {col.heading}
            </RevealText>
            <RevealLines
              className="mt-4 text-[15px] leading-[1.62] text-muted"
              lines={col.lines}
              delay={0.12 + i * 0.06}
            />
          </div>
        ))}

        <div className="md:col-start-2">
          <a
            href="https://github.com/MatthewKim323/agartha/blob/main/docs/ARCHITECTURE.md"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] text-white transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06]"
          >
            Read The Architecture
            <span className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1">
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
