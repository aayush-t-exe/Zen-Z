import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zen-Z — Every table has a story before anyone sits down',
  description:
    'A campus-first social app. You take a quiz, pick a slot, and get placed into a hand-picked group of strangers for a Café, Dinner, or Movie. No swiping, no browsing, no choosing who to meet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
