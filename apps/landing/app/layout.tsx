import type { Metadata } from 'next';
import SmoothScroll from '@/components/SmoothScroll';
import './globals.css';

export const metadata: Metadata = {
  title: 'agartha — a Minecraft companion that answers at human speed',
  description:
    'Voice-driven Minecraft companion. Speaks in about the time a person would, acts while it is still talking, and remembers you between sessions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
        {children}
      </body>
    </html>
  );
}
