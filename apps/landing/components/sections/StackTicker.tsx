'use client';

import { useReducedMotion } from 'motion/react';
import {
  siDiscord,
  siBun,
  siTypescript,
  siGooglegemini,
  siNodedotjs,
  siPostgresql,
  siGithub,
} from 'simple-icons';

// "Built on" marquee. Every entry is a real dependency you can find in the
// lockfile, and every mark is the actual brand SVG rather than the name set in
// type — that was the previous version and it read as a list, not a rail.
//
// Treatment carried from Modal's ticker: inline SVG at `currentColor` so one
// token retints the whole row, per-mark optical sizing rather than a uniform
// scale, edge-fade mask, and a deliberately slow loop. 80s is ambient; anything
// faster starts competing with the page for attention.
//
// Marks come from simple-icons (CC0). Two dependencies have no brand mark —
// Mineflayer and the Model Context Protocol — so they carry a drawn glyph plus
// their name rather than a fabricated logo.
const DURATION_S = 80;

type Entry = { name: string; path?: string; height: number };

const STACK: Entry[] = [
  { name: 'Google Gemini', path: siGooglegemini.path, height: 22 },
  { name: 'Mineflayer', height: 20 },
  { name: 'Model Context Protocol', height: 20 },
  { name: 'Discord', path: siDiscord.path, height: 20 },
  { name: 'Bun', path: siBun.path, height: 22 },
  { name: 'TypeScript', path: siTypescript.path, height: 19 },
  { name: 'Node.js', path: siNodedotjs.path, height: 22 },
  { name: 'PostgreSQL', path: siPostgresql.path, height: 21 },
  { name: 'GitHub', path: siGithub.path, height: 20 },
];

// Stand-in glyph for dependencies with no official mark: a cube for Mineflayer
// (it is a block game), a plug for MCP (it is a connector protocol).
function FallbackGlyph({ name }: { name: string }) {
  const isCube = name === 'Mineflayer';
  return (
    <svg
      viewBox="0 0 24 24"
      className="block h-full w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      {isCube ? (
        <>
          <path d="M12 2.6 21 7.3v9.4L12 21.4 3 16.7V7.3z" />
          <path d="M3 7.3 12 12l9-4.7M12 12v9.4" />
        </>
      ) : (
        <>
          <path d="M9 2.8v6.4M15 2.8v6.4" />
          <path d="M6.4 9.2h11.2v3.2a5.6 5.6 0 0 1-11.2 0z" />
          <path d="M12 18v3.2" />
        </>
      )}
    </svg>
  );
}

function Mark({ entry }: { entry: Entry }) {
  return (
    <li
      role="img"
      aria-label={entry.name}
      className="flex shrink-0 items-center gap-3 text-faint"
      // Per-mark pixel height: brand marks have wildly different optical
      // weights, and a uniform scale makes some look twice the size of others.
      style={{ height: entry.height }}
    >
      {entry.path ? (
        <svg viewBox="0 0 24 24" className="block h-full w-auto" fill="currentColor" aria-hidden>
          <path d={entry.path} />
        </svg>
      ) : (
        <>
          <FallbackGlyph name={entry.name} />
          <span className="font-mono text-[12px] tracking-widest whitespace-nowrap uppercase">
            {entry.name}
          </span>
        </>
      )}
    </li>
  );
}

export default function StackTicker() {
  const reduced = useReducedMotion();
  // Two identical tracks: the second is entering as the first leaves, and the
  // -50% translate lands exactly on the seam.
  const track = (key: string, hidden: boolean) => (
    <ul
      key={key}
      aria-hidden={hidden}
      className="flex shrink-0 items-center gap-16 pr-16"
    >
      {STACK.map((e) => (
        <Mark key={`${key}-${e.name}`} entry={e} />
      ))}
    </ul>
  );

  return (
    <section
      className="relative overflow-hidden border-y border-line bg-paper py-12"
      aria-label="Built on"
    >
      <p className="mb-8 px-6 font-mono text-[11px] tracking-widest text-faint uppercase md:px-10">
        Built on
      </p>

      {/* Edge fade so marks dissolve rather than clipping at the viewport. */}
      <div
        className="relative"
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
          maskImage:
            'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        }}
      >
        <div
          className="flex w-max will-change-transform"
          style={
            reduced
              ? undefined
              : { animation: `ticker ${DURATION_S}s linear infinite` }
          }
        >
          {track('a', false)}
          {track('b', true)}
        </div>
      </div>
    </section>
  );
}
