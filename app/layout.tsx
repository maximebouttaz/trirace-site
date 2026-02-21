import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'TriRace — Trouve ta prochaine course triathlon',
    template: '%s | TriRace',
  },
  description:
    'Explore 700+ courses triathlon en France et en Europe. Distances, dénivelé, météo, records — toutes les infos pour choisir ta course.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://tri-race.com'),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'TriRace',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-zinc-900`}
      >
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
