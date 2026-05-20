import '../index.css';
import { Providers } from '@/providers/Providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" />
        <title>MSME Portal | JsgSmile Procurement Network</title>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
