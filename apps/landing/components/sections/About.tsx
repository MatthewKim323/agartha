'use client';

import ProcessCompare from '@/components/ProcessCompare';
import RevealText, { RevealLines } from '@/components/RevealText';

// Rebuilt as a comparison.
//
// This was three columns of prose and it was the weakest thing on the page: it
// explained the architecture in sentences, on a page whose whole argument is
// that the architecture is visible. Every other section reads top-down or along
// a rail, so a left/right comparison is also the one movement the page did not
// already have.
//
// The diagram carries the claim and the copy annotates it, rather than the
// other way round. Both halves run on one clock, so the asymmetry is watched
// rather than asserted — by the time the old shape finishes a single turn, the
// new one has finished dozens.
export default function About() {
  return (
    <section className="relative overflow-hidden bg-paper py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl px-6 md:px-10">
        <p className="font-mono text-[12px] tracking-widest text-muted">
          WHAT CHANGED
        </p>

        <div className="mt-5 grid grid-cols-1 gap-8 md:grid-cols-[1.15fr_1fr] md:items-end md:gap-16">
          <RevealText
            as="h2"
            className="text-[42px] leading-[1.2] font-medium tracking-[-0.04em] text-ink md:text-[48px]"
          >
            One session, held open
          </RevealText>
          <RevealLines
            className="text-[16px] leading-[1.62] text-muted"
            delay={0.08}
            lines={[
              'A voice companion for Minecraft. It sits in your',
              'Discord call, listens, talks back, and drives a',
              'Mineflayer bot in your world.',
            ]}
          />
        </div>

        {/* The comparison itself. */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-ink/10 bg-ink/[0.02]">
          {/* Half labels sit above the diagram, aligned to its two columns. */}
          <div className="grid grid-cols-2 border-b border-ink/10">
            <div className="px-5 py-5 md:px-10">
              <p className="font-mono text-[11px] tracking-widest text-faint uppercase">
                Before
              </p>
              <p className="mt-2 max-w-[34ch] text-[14px] leading-[1.5] text-muted md:text-[15px]">
                A fresh process every turn. Six to thirteen seconds to speak.
              </p>
            </div>
            <div className="border-l border-ink/10 px-5 py-5 md:px-10">
              <p className="font-mono text-[11px] tracking-widest text-ink uppercase">
                Now
              </p>
              <p className="mt-2 max-w-[34ch] text-[14px] leading-[1.5] text-muted md:text-[15px]">
                One session, already open. Three milliseconds to the body.
              </p>
            </div>
          </div>

          <div className="h-[300px] w-full md:h-[360px]">
            <ProcessCompare />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <a
            href="https://github.com/MatthewKim323/agartha/blob/main/docs/ARCHITECTURE.md"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] text-white transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06]"
          >
            Read The Architecture
            <span className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1">
              →
            </span>
          </a>
          <p className="max-w-[46ch] font-mono text-[11px] leading-[1.8] text-faint">
            Removing the per-turn spawn is the entire rewrite. Everything else on
            this page follows from it.
          </p>
        </div>
      </div>
    </section>
  );
}
