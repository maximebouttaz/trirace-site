import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Toutes les courses triathlon — TriRace',
  description: 'Découvre et compare 700+ courses triathlon en France et en Europe. Filtre par distance, prix, météo, région et date.',
  openGraph: {
    title: 'Toutes les courses triathlon | TriRace',
    description: 'Découvre et compare 700+ courses triathlon en France et en Europe.',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TriRace — Toutes les courses',
      },
    ],
  },
};

export default function CoursesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
