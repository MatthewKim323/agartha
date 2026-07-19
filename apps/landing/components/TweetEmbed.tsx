'use client';

import { useEffect, useRef, useState } from 'react';

// Real X embed, not a lookalike.
//
// This loads X's own widget script, which fetches and renders the actual post.
// Building a styled div that resembles a tweet would be fabricating a record of
// something someone said, which is a different thing entirely even when the
// words are accurate.
//
// Consequences of doing it properly, worth knowing: it is a third-party script
// with their tracking attached, it needs network at render time, and it will
// not appear at all if the post is deleted or X is unreachable. The fallback
// below covers that case with a plain link, so the section never shows an
// empty hole.
const SCRIPT = 'https://platform.twitter.com/widgets.js';

export default function TweetEmbed({
  url,
  className = '',
}: {
  url: string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const render = () => {
      const w = window as unknown as {
        twttr?: { widgets?: { load?: (el?: HTMLElement) => void } };
      };
      w.twttr?.widgets?.load?.(host.current ?? undefined);
    };

    // If the script is already on the page from a previous mount, reuse it.
    if (document.querySelector(`script[src="${SCRIPT}"]`)) {
      render();
    } else {
      const el = document.createElement('script');
      el.src = SCRIPT;
      el.async = true;
      el.onload = render;
      el.onerror = () => !cancelled && setFailed(true);
      document.body.appendChild(el);
    }

    // If nothing has rendered after a few seconds, assume it will not.
    const timer = setTimeout(() => {
      if (cancelled) return;
      const rendered = host.current?.querySelector('iframe');
      if (!rendered) setFailed(true);
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group inline-flex items-center gap-2 rounded-xl border border-ink/15 px-5 py-4 text-[15px] text-ink transition-colors duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ink/40 ${className}`}
      >
        Read the post on X
        <span className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1">
          →
        </span>
      </a>
    );
  }

  return (
    <div ref={host} className={className}>
      <blockquote
        className="twitter-tweet"
        data-theme="light"
        data-dnt="true"
        data-conversation="none"
      >
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}
