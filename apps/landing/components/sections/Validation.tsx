'use client';

import { RevealLines } from '@/components/RevealText';
import TweetEmbed from '@/components/TweetEmbed';

// The demand side, quoted rather than asserted.
//
// This is a public statement from an a16z partner describing a product he
// wants to exist. It is quoted briefly and attributed, and that is the whole
// claim being made here: someone who funds companies described this shape
// out loud, before we built it.
//
// What this section must never imply: that a16z has seen agar, endorsed it,
// invested, or is aware it exists. The wording below is deliberate on that
// point, because the difference between "they asked for this" and "they backed
// us" is exactly the kind of thing that gets caught in a room full of
// investors, and being caught inflating one line would cost every other claim
// on the page.
const QUOTE =
  'one of the products that i would love to exist is what i call a contextual companion for my son who plays minecraft.';

export default function Validation() {
  return (
    <section className="relative overflow-hidden bg-paper px-6 py-28 md:px-10 md:py-36">
      <div className="mx-auto max-w-6xl">
        <RevealLines
          as="h2"
          className="max-w-5xl text-[42px] leading-[1.12] font-medium tracking-[-0.045em] text-ink md:text-[64px]"
          duration={1}
          lines={[
            'a16z partners think gaming',
            'companions are what comes',
            'next. So we built agar.',
          ]}
        />

        {/* The quote. Set large, because it is the section. */}
        <figure className="mt-14 max-w-4xl border-l-2 border-accent pl-7 md:pl-10">
          <blockquote className="text-[24px] leading-[1.45] font-medium tracking-[-0.02em] text-ink md:text-[34px]">
            &ldquo;{QUOTE}&rdquo;
          </blockquote>
          <figcaption className="mt-8">
            <span className="block text-[18px] font-medium text-ink md:text-[20px]">
              Anish Acharya
            </span>
            <span className="mt-1 block font-mono text-[12px] tracking-widest text-muted uppercase">
              General Partner, a16z
            </span>
            <span className="mt-3 block max-w-[46ch] text-[14px] leading-[1.55] text-faint">
              Describing a product he wants someone to build, publicly, before
              agar existed.
            </span>
          </figcaption>
        </figure>

        <div className="mt-12 max-w-[550px]">
          <p className="mb-4 font-mono text-[11px] tracking-widest text-faint uppercase">
            Source
          </p>
          <TweetEmbed url="https://x.com/a16z/status/2022014770682245610" />
        </div>

        <p className="mt-10 font-mono text-[11px] tracking-widest text-faint uppercase">
          Public statement. No affiliation with a16z.
        </p>

      </div>
    </section>
  );
}
