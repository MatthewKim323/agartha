'use client';

import RevealText, { RevealLines } from '@/components/RevealText';

// A plain about.
//
// This went through a diagram phase and came back out. A before/after framed
// the product as a rewrite of something else, which is the wrong posture for
// something that works, and the page already carries four diagrams, so a fifth
// here was load without payoff. What this section owes the reader is simply
// what the thing is.
//
// Structure instead of illustration: a stated measure on the prose, and a
// hairline spec rail beside it. The rail is the device that keeps a text
// section from reading as a wall, and every value in it is real.

const SPEC = [
  { k: 'Runs in', v: 'Discord voice' },
  { k: 'Drives', v: 'Mineflayer, MC 1.20.6' },
  { k: 'Speech', v: 'Gemini Live, native VAD' },
  { k: 'Control', v: 'MCP over localhost' },
  { k: 'Memory', v: 'Shared with jabby' },
  { k: 'Status', v: 'Early, working' },
] as const;

export default function About() {
  return (
    <section className="relative bg-paper py-24 md:py-36">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <p className="font-mono text-[12px] tracking-widest text-muted">ABOUT</p>

        <div className="mt-6 grid grid-cols-1 gap-14 md:grid-cols-[1.35fr_1fr] md:gap-24">
          {/* Prose. Measure held near 62ch, long enough to read as editorial,
              short enough that the eye finds the next line without hunting. */}
          <div>
            {/* Break authored rather than wrapped: a heading that wraps inside
                one mask slides as a single block instead of staggering. */}
            <RevealLines
              as="h2"
              className="text-[42px] leading-[1.2] font-medium tracking-[-0.04em] text-ink md:text-[56px]"
              lines={['A second player', 'who talks back']}
            />

            <RevealLines
              className="mt-8 max-w-[62ch] text-[17px] leading-[1.62] text-muted"
              delay={0.08}
              lines={[
                'agartha joins your Discord call and your world at the same',
                'time. You talk to it the way you would talk to anyone else',
                'you play with, and it answers in about the time a person',
                'would, then goes and does the thing.',
              ]}
            />

            <RevealLines
              className="mt-6 max-w-[62ch] text-[17px] leading-[1.62] text-muted"
              delay={0.16}
              lines={[
                'One session holds the conversation and the controls, so',
                'speaking and acting are the same act. It starts moving',
                'while the sentence is still landing, and tells you when',
                'the work is actually done rather than when it began.',
              ]}
            />

            <div className="mt-10">
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

          {/* Spec rail. Hairlines at low alpha, mono labels in a fixed column:
              the device that makes a text section skimmable without a graphic. */}
          <dl className="md:pt-4">
            {SPEC.map((row) => (
              <div
                key={row.k}
                className="flex items-baseline justify-between gap-6 border-t border-ink/[0.10] py-4"
              >
                <dt className="font-mono text-[11px] tracking-widest text-faint uppercase">
                  {row.k}
                </dt>
                <dd className="text-right text-[15px] text-ink">{row.v}</dd>
              </div>
            ))}
            <p className="mt-6 max-w-[40ch] font-mono text-[11px] leading-[1.8] text-faint">
              Not affiliated with Mojang. Runs against your own server.
            </p>
          </dl>
        </div>
      </div>
    </section>
  );
}
