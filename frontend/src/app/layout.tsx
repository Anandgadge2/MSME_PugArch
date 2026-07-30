import '../index.css';
import { Providers } from '@/providers/Providers';
import { DevelopmentAgentation } from '@/components/DevelopmentAgentation';

export default function RootLayout({ children }: { children: React.ReactNode }) {

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/logoo.png" />
        <meta name="theme-color" content="#0b2447" />
        <title>JsgSmile Portal | Jharsuguda Synergy for MSME and Industry Linkage Ecosystem</title>
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <DevelopmentAgentation />
        </Providers>
      </body>
    </html>
  );
}
