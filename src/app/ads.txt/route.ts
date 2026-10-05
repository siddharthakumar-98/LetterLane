import { getAdsConfig } from '@/lib/ads-config';
// Authorizes Google as the only seller of this site's ad inventory.
export function GET() {
  const config = getAdsConfig();
  if (!config) return new Response('Not found', { status: 404 });
  return new Response(
    `google.com, ${config.client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}
