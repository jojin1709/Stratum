import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/shell';

export const metadata: Metadata = {
  title: 'Stratum — Developed by Jojin John',
  description: 'High-performance Backend-as-a-Service developed by Jojin John.',
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1.5 focus:text-white"
        >
          Skip to content
        </a>
        <Shell>
          <div id="main">{children}</div>
        </Shell>
      </body>
    </html>
  );
}
