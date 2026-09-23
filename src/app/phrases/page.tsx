import type { Metadata } from 'next';
import Home from '@/components/home';
export const metadata: Metadata = {
  title: 'Letterlane Phrases — A little friendly wordplay',
};
export default function Page() {
  return <Home game="phrases" />;
}
