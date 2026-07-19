import type { Metadata } from 'next';
import localFont from 'next/font/local';
import SmoothScroll from '@/components/SmoothScroll';
import Grain from '@/components/Grain';
import './globals.css';

// Canela, carried over from Quad for the footer wordmark. Licensed font, the
// .otf files are gitignored rather than committed, same as the placeholder media.
const canela = localFont({
  src: [
    { path: './fonts/Canela-Regular.otf', weight: '400', style: 'normal' },
    { path: './fonts/Canela-Medium.otf', weight: '500', style: 'normal' },
  ],
  variable: '--font-canela',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'agartha · a Minecraft companion that keeps up',
  description:
    'Voice-driven Minecraft companion. Answers about as fast as a person would, gets moving before it has finished talking, and remembers what you were doing last time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={canela.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-paper text-ink font-sans antialiased">
        <SmoothScroll />
        <Grain />
        {children}
      </body>
    </html>
  );
}
