// agar mark.
//
// Hand-built from the supplied artwork rather than traced: no vectoriser was
// available on this machine, so this is a geometric reconstruction, not an
// exact conversion. If the original vector exists in whatever it was designed
// in, exporting that and dropping the paths in here will beat this.
//
// Everything is currentColor so the mark takes the colour of whatever it sits
// in, which is what lets one component serve both the dark nav card and the
// light footer without a second asset.
export default function Logo({
  className = '',
  title = 'agar',
}: {
  className?: string;
  /** Pass null for decorative use where adjacent text already names it. */
  title?: string | null;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      {/* Rounded hexagon shell, drawn as a stroke so it stays hollow. */}
      <path
        d="M60 7
           a13 13 0 0 1 6.5 1.75
           l35.5 20.5
           a13 13 0 0 1 6.5 11.25
           v41
           a13 13 0 0 1 -6.5 11.25
           l-35.5 20.5
           a13 13 0 0 1 -13 0
           l-35.5 -20.5
           a13 13 0 0 1 -6.5 -11.25
           v-41
           a13 13 0 0 1 6.5 -11.25
           l35.5 -20.5
           A13 13 0 0 1 60 7 z"
        stroke="currentColor"
        strokeWidth="12"
      />

      {/* Two interlocking panels. Each has a slanted top and bottom edge so the
          pair reads as depth rather than as flat brackets, and the offset
          between them is what makes them lock instead of mirror. */}
      <path
        d="M35 44 L57 36 L57 50 L47 53.5 L47 76 L57 72.5 L57 86 L35 94 z"
        fill="currentColor"
      />
      <path
        d="M85 76 L63 84 L63 70 L73 66.5 L73 44 L63 47.5 L63 34 L85 26 z"
        fill="currentColor"
      />
    </svg>
  );
}
