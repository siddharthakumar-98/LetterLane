import type { Metadata } from 'next';
import { RoomGame } from '@/components/room-game';
// Private invitations stay out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomGame code={code.toUpperCase()} />;
}
