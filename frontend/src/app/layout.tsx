import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import '../index.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});
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
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
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
