'use client';

import GridLines from '@/components/GridLines';
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
      'A voice companion for Minecraft. It sits in your Discord',
      'call, listens, talks back, and drives a Mineflayer bot in',
      'your world. One persistent session holds the conversation',
      'and the controls, so speaking and acting are one act.',
    ],
  },
  {
    heading: 'Why It Matters',
    lines: [
      'The version before this spawned a fresh process every turn',
      'and took six to thirteen seconds to say a word. Removing',
      'that spawn is the entire rewrite. Once the model emits a',
      'call, the bot moves in about three milliseconds.',
    ],
  },
] as const;

export default function About() {
  return (
    <section className="relative bg-paper py-24 md:py-32">
      <GridLines />

      <div className="relative mx-auto grid max-w-[80%] grid-cols-1 gap-12 md:grid-cols-[0.8fr_1.1fr_1.1fr] md:gap-16">
        <RevealText
          as="h2"
          className="text-[42px] leading-[1.1] font-medium tracking-[-0.03em] text-ink md:text-[48px]"
        >
          About
        </RevealText>

        {COLUMNS.map((col, i) => (
          <div key={col.heading}>
            <RevealText
              as="h3"
              className="text-[16px] font-semibold text-ink"
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
