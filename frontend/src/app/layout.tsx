import type { Metadata, Viewport } from 'next';
import '../index.css';
import { Providers } from '@/providers/Providers';
import { DevelopmentAgentation } from '@/components/DevelopmentAgentation';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0b2447',
};

export const metadata: Metadata = {
  title: 'JsgSmile Portal | Jharsuguda Synergy for MSME and Industry Linkage Ecosystem',
  description: 'Official MSME & Industry Linkage Procurement Portal for Jharsuguda District',
  icons: {
    icon: '/favicon.png',
    apple: '/logoo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Inter:wght@300;400;500;600;700;800&display=swap"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[99999] focus:px-4 focus:py-2.5 focus:bg-[#0b2447] focus:text-white focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#c8a45c] font-black text-xs uppercase tracking-wider transition-all"
        >
          Skip to Main Content
        </a>
        <Providers>
          {children}
          <DevelopmentAgentation />
        </Providers>
      </body>
    </html>
  );
}
