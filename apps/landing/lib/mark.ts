// The agar mark, in one place.
//
// These paths are authored on a 120x120 viewBox and are the single source for
// every rendering of the logo: the React component, and the canvas diagrams
// that draw it with Path2D. Keeping one copy is what stops the SVG and the
// canvas versions quietly diverging.
//
// app/icon.svg carries a copy because a static favicon cannot import from here.
// If these change, change that too.
export const MARK_HEX =
  'M60 7a13 13 0 0 1 6.5 1.75l35.5 20.5a13 13 0 0 1 6.5 11.25v41a13 13 0 0 1-6.5 11.25l-35.5 20.5a13 13 0 0 1-13 0l-35.5-20.5a13 13 0 0 1-6.5-11.25v-41a13 13 0 0 1 6.5-11.25l35.5-20.5A13 13 0 0 1 60 7z';

export const MARK_LEFT =
  'M35 44 L57 36 L57 50 L47 53.5 L47 76 L57 72.5 L57 86 L35 94 z';

export const MARK_RIGHT =
  'M85 76 L63 84 L63 70 L73 66.5 L73 44 L63 47.5 L63 34 L85 26 z';

/** Stroke weight of the hexagon shell, in viewBox units. */
export const MARK_STROKE = 12;
