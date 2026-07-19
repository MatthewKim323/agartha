'use client';

// The page's closer. This replaced both the old footer and the CTA block above
// it, that block restated what the rest of the page already proves, and a
// launch page for a repo does not need two calls to action pointing at the same
// repo. Now: links, then the wordmark, then out.
//
// The wordmark treatment is carried from Quad: Canela at a viewport-scaled
// size, tight leading, and a second absolutely-positioned copy painted with a
// halftone gradient through background-clip:text, masked so the dots only bleed
// into the lower half. Deliberately unanimated, it is the last thing on the
// page and should feel set, not arriving.

const LINKS = {
  Project: [
    { label: 'Repository', href: 'https://github.com/MatthewKim323/agartha' },
    {
      label: 'Architecture',
      href: 'https://github.com/MatthewKim323/agartha/blob/main/docs/ARCHITECTURE.md',
    },
    {
      label: 'Decisions',
      href: 'https://github.com/MatthewKim323/agartha/blob/main/docs/DECISIONS.md',
    },
    {
      label: 'Measurements',
      href: 'https://github.com/MatthewKim323/agartha/blob/main/docs/MEASUREMENTS.md',
    },
  ],
  Lineage: [
    { label: 'itto, the body', href: 'https://github.com/silaswu4/itto' },
    {
      label: 'Skill library',
      href: 'https://github.com/MatthewKim323/agartha/tree/main/apps/mc-bot/src/skills',
    },
    {
      label: 'MCP surface',
      href: 'https://github.com/MatthewKim323/agartha/tree/main/packages/mcp-server',
    },
  ],
} as const;

const HALFTONE =
  'radial-gradient(circle, rgba(20,20,20,0.85) 1px, transparent 1.4px)';

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-paper">
      {/* Links */}
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_auto_auto]">
          <div>
            <p className="max-w-sm text-[16px] leading-[1.62] text-muted">
              A Minecraft companion that answers at about the speed a person
              would, and acts while it is still talking.
            </p>
          </div>

          {Object.entries(LINKS).map(([group, links]) => (
            <nav key={group} className="min-w-[190px]">
              <p className="font-mono text-[11px] tracking-widest text-faint uppercase">
                {group}
              </p>
              <ul className="mt-4">
                {links.map((l) => (
                  <li key={l.label} className="border-b border-ink/[0.08]">
                    <a
                      href={l.href}
                      className="group flex items-center justify-between py-3 text-[15px] text-muted transition-colors duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-ink"
                    >
                      {l.label}
                      <span className="translate-x-0 opacity-0 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 group-hover:opacity-100">
                        →
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {/* Wordmark */}
      <div className="relative overflow-hidden px-6 pb-[0.16em] md:px-10">
        <div className="relative mx-auto max-w-[1600px]">
          <h2
            className="font-canela relative block leading-[0.82] tracking-[-0.03em] text-ink select-none"
            // pb reserves the descender so the 'g' clears the rule below.
            style={{ fontSize: 'clamp(96px, 23vw, 360px)', paddingBottom: '0.1em' }}
          >
            agartha
            {/* Halftone twin, masked to the lower half. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: HALFTONE,
                backgroundSize: '7px 7px',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitMaskImage:
                  'linear-gradient(to bottom, transparent 46%, black 92%)',
                maskImage:
                  'linear-gradient(to bottom, transparent 46%, black 92%)',
              }}
            >
              agartha
            </span>
          </h2>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl border-t border-ink/15 px-6 py-6 md:px-10">
        <p className="font-mono text-[11px] tracking-widest text-faint uppercase">
          Early build · Not affiliated with Mojang
        </p>
      </div>
    </footer>
  );
}
