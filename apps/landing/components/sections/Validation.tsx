'use client';

import { RevealLines } from '@/components/RevealText';

// The demand side, quoted rather than asserted.
//
// This is a public statement from an a16z partner describing a product he
// wants to exist. It is quoted briefly and attributed, and that is the whole
// claim being made here: someone who funds companies described this shape
// out loud, before we built it.
//
// What this section must never imply: that a16z has seen agartha, endorsed it,
// invested, or is aware it exists. The wording below is deliberate on that
// point, because the difference between "they asked for this" and "they backed
// us" is exactly the kind of thing that gets caught in a room full of
// investors, and being caught inflating one line would cost every other claim
// on the page.
const QUOTE =
  'one of the products that i would love to exist is what i call a contextual companion for my son who plays minecraft.';

const BEATS = [
  {
    k: 'The ask',
    v: 'A companion that sits inside the game a kid already plays, rather than another app beside it.',
  },
  {
    k: 'The thesis',
    v: 'a16z has written publicly that AI will open a new category of games. This is the companion-shaped corner of it.',
  },
  {
    k: 'What we built',
    v: 'A duo partner that joins the world, keeps up in voice, and remembers you between sessions.',
  },
] as const;

export default function Validation() {
  return (
    <section className="relative overflow-hidden bg-surface px-6 py-28 md:px-10 md:py-36">
      <div className="mx-auto max-w-6xl">
        <RevealLines
          as="h2"
          className="max-w-5xl text-[42px] leading-[1.12] font-medium tracking-[-0.045em] text-white md:text-[64px]"
          duration={1}
          lines={[
            'a16z partners are looking',
            'for a gaming companion.',
            'We already built one.',
          ]}
        />

        {/* The quote. Set large, because it is the section. */}
        <figure className="mt-14 max-w-4xl border-l-2 border-accent pl-7 md:pl-10">
          <blockquote className="text-[24px] leading-[1.45] font-medium tracking-[-0.02em] text-white md:text-[34px]">
            &ldquo;{QUOTE}&rdquo;
          </blockquote>
          <figcaption className="mt-8">
            <span className="block text-[18px] font-medium text-white md:text-[20px]">
              Anish Acharya
            </span>
            <span className="mt-1 block font-mono text-[12px] tracking-widest text-white/50 uppercase">
              General Partner, a16z
            </span>
            <span className="mt-3 block max-w-[46ch] text-[14px] leading-[1.55] text-white/40">
              Describing a product he wants someone to build, publicly, before
              agartha existed.
            </span>
          </figcaption>
        </figure>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/10 md:grid-cols-3">
          {BEATS.map((b) => (
            <div key={b.k} className="bg-surface p-8">
              <p className="font-mono text-[11px] tracking-widest text-white/40 uppercase">
                {b.k}
              </p>
              <p className="mt-4 max-w-[34ch] text-[16px] leading-[1.55] text-white/85">
                {b.v}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-[62ch] font-mono text-[11px] leading-[1.8] text-white/35">
          Quoted from a public statement. a16z has not seen agartha, has no
          involvement in it, and none of this implies otherwise. The point is
          only that the shape was described out loud by someone who funds
          companies, and we went and built it.
        </p>
      </div>
    </section>
  );
}
