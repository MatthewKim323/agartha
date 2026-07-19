'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import RevealText, { RevealLines } from '@/components/RevealText';
import CountUp from '@/components/CountUp';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// The market argument, stated as a gap rather than a TAM.
//
// Deliberately no market-size figure. The published estimates for this category
// range from about $49B to $366B for the same year, which means they are
// measuring different things, and a judge who knows the space will discount
// everything else on the page the moment they see a number like that. User
// counts and revenue are consistent across sources, so those are what appear.
//
// Numbers are registered users, which is a softer metric than monthly actives.
// Labelled as such rather than quietly presented as engagement.
const COMPANIONS = [
  { name: 'Character.AI', users: 233, unit: 'M', note: 'registered' },
  { name: 'Xiaoice', users: 660, unit: 'M', note: 'registered' },
  { name: 'Replika', users: 25, unit: 'M+', note: 'registered' },
];

export default function TheGap() {
  const root = useRef<HTMLDivElement>(null);
  const [turned, setTurned] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTurned(true);
      return;
    }
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        once: true,
        onEnter: () => setTurned(true),
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative overflow-hidden bg-surface px-6 py-28 md:px-10 md:py-36">
      <div ref={root} className="mx-auto max-w-6xl">
        <p className="font-mono text-[12px] tracking-widest text-white/40">
          THE GAP
        </p>

        <RevealLines
          as="h2"
          className="mt-5 max-w-4xl text-[42px] leading-[1.15] font-medium tracking-[-0.05em] text-white md:text-[64px]"
          duration={1}
          lines={['AI companions can talk.', 'None of them can play.']}
        />

        <RevealLines
          className="mt-7 max-w-2xl text-[16px] leading-[1.62] text-white/60"
          delay={0.1}
          lines={[
            'Hundreds of millions of people already talk to one. Every single',
            'product is a text box, so the whole relationship is conversation',
            'and it stops there.',
          ]}
        />

        {/* The scale of the existing behaviour. */}
        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
          {COMPANIONS.map((c) => (
            <div key={c.name} className="bg-surface p-8">
              <p className="text-[44px] leading-none font-medium text-white md:text-[56px]">
                <CountUp value={c.users} />
                <span className="text-[24px] text-white/50">{c.unit}</span>
              </p>
              <p className="mt-4 text-[16px] text-white">{c.name}</p>
              <p className="mt-1 font-mono text-[11px] tracking-widest text-white/35 uppercase">
                {c.note} users
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 font-mono text-[11px] leading-[1.8] text-white/30">
          Registered-user figures as publicly reported by the companies and
          industry trackers. Registered accounts are a softer measure than
          monthly actives, and they are labelled that way here on purpose.
        </p>

        {/* The turn. */}
        <div
          className="mt-10 border-t border-white/10 pt-10 transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            opacity: turned ? 1 : 0,
            transform: turned ? 'translateY(0)' : 'translateY(18px)',
          }}
        >
          <p className="max-w-4xl text-[28px] leading-[1.32] font-medium tracking-[-0.03em] text-white md:text-[38px]">
            Not one of them can hand you a pickaxe.
          </p>
          <p className="mt-6 max-w-2xl text-[16px] leading-[1.62] text-white/55">
            agar shows up in the world with you. Not a chat window asking
            how your day went, but a second player standing next to you who
            says &ldquo;on it&rdquo; and goes.
          </p>
        </div>
      </div>
    </section>
  );
}
