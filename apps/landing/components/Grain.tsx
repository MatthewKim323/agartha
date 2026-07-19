// Fixed dither overlay.
//
// Carried from Quad, with the frequency pushed up: at baseFrequency 0.8 the
// turbulence reads as film grain, which is the wrong reference here. At 1.4 the
// cells get small and hard enough to read as pixel dither, which is the right
// one for a product that lives in a block game.
//
// No client directive and no hooks — it is a static element, so it renders on
// the server and costs nothing after paint.
const NOISE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
     <filter id="n">
       <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" stitchTiles="stitch"/>
     </filter>
     <rect width="160" height="160" filter="url(#n)"/>
   </svg>`,
)}`;

export default function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: `url("${NOISE}")`, backgroundSize: '160px 160px' }}
    />
  );
}
