import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'KitarSemula.app — Malaysia Recycling Center Directory',
    template: '%s | KitarSemula.app',
  },
  description:
    'Find recycling centers near you across Malaysia. Community-driven directory of recycling drop-off points for paper, plastic, e-waste, glass, metals, and more.',
  keywords: ['recycling', 'Malaysia', 'recycle center', 'e-waste', 'kitar semula', 'daur ulang'],
  openGraph: {
    title: 'KitarSemula.app — Malaysia Recycling Center Directory',
    description: 'Find recycling centers near you across Malaysia. Community-driven directory.',
    type: 'website',
    locale: 'en_MY',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#2d7a44',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} bg-background`}>
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
