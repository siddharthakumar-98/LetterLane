import { RoomGame } from '@/components/room-game';
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomGame code={code.toUpperCase()} />;
}
