'use client';

import RevealText, { RevealLines } from '@/components/RevealText';

// The case for embodiment, argued from the research rather than asserted.
//
// Both findings are stated, including the one that is bad for this category.
// That is deliberate and it is the stronger move: the MIT result is the reason
// this product is built the way it is, so burying it would remove the argument
// while looking like marketing.
//
// Neither study is characterised beyond what it found. No claim is made here
// that agartha treats loneliness, and none should be added later.
const FINDINGS = [
  {
    source: 'Harvard Business School',
    finding:
      'Found AI companions reduced loneliness roughly as much as talking to another person did.',
    tone: 'for',
  },
  {
    source: 'MIT Media Lab with OpenAI',
    finding:
      'Found heavier daily chatbot use correlated with higher loneliness and more emotional dependence.',
    tone: 'against',
  },
] as const;

export default function WhyEmbodied() {
  return (
    <section className="relative bg-paper px-6 py-28 md:px-10 md:py-36">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[12px] tracking-widest text-muted">
          WHY THIS SHAPE
        </p>

        <RevealLines
          as="h2"
          className="mt-5 max-w-3xl text-[42px] leading-[1.18] font-medium tracking-[-0.04em] text-ink md:text-[56px]"
          duration={1}
          lines={['Nobody makes a friend', 'by being asked about', 'their day']}
        />

        {/* Both findings, side by side, unspun. */}
        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-ink/10 md:grid-cols-2">
          {FINDINGS.map((f) => (
            <div key={f.source} className="bg-paper p-8 md:p-10">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block size-2 rounded-full ${
                    f.tone === 'for' ? 'bg-accent' : 'bg-ink/30'
                  }`}
                />
                <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
                  {f.source}
                </p>
              </div>
              <p className="mt-5 max-w-[40ch] text-[17px] leading-[1.55] text-ink">
                {f.finding}
              </p>
            </div>
          ))}
        </div>

        {/* The synthesis. This is the actual argument. */}
        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-[1.1fr_1fr] md:gap-20">
          <div>
            <RevealLines
              className="max-w-[52ch] text-[20px] leading-[1.5] text-ink md:text-[24px]"
              lines={[
                'Both can be true, and the gap',
                'between them is the design.',
                'Passive conversation can deepen',
                'isolation. Doing something',
                'together is how people bond.',
              ]}
            />
          </div>
          <div className="md:pt-2">
            <RevealLines
              className="max-w-[46ch] text-[16px] leading-[1.62] text-muted"
              delay={0.08}
              lines={[
                'So agartha is not built to be talked to,',
                'but to be played with. agartha joins the',
                'world, keeps up, and does the work beside',
                'you, which no text box has ever reached.',
              ]}
            />
            <p className="mt-6 max-w-[46ch] font-mono text-[11px] leading-[1.8] text-faint">
              agartha is a game companion, not therapy, not a mental health
              tool, and not a replacement for people.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
