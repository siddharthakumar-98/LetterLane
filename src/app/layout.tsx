import type { Metadata } from 'next';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import './globals.css';
import { AdsScript } from '@/components/ads-script';
export const metadata: Metadata = {
  title: 'LetterLane — A little friendly wordplay',
  description:
    'One hidden word. Two curious minds. A private, real-time word game for friends.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <AdsScript />
      </body>
    </html>
  );
}
