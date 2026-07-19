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
import { MARK_HEX, MARK_LEFT, MARK_RIGHT, MARK_STROKE } from '@/lib/mark';

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
      {/* Shell and interlock come from lib/mark.ts so this and the canvas
          diagrams cannot drift apart. */}
      <path d={MARK_HEX} stroke="currentColor" strokeWidth={MARK_STROKE} />
      <path d={MARK_LEFT} fill="currentColor" />
      <path d={MARK_RIGHT} fill="currentColor" />
    </svg>
  );
}
