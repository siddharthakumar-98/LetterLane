import 'server-only';
import { headers } from 'next/headers';

/** The public origin for robots.txt and the sitemap. SITE_URL pins the
 * canonical production domain; otherwise the request's own host is used. */
export async function siteOrigin() {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  if (configured && /^https?:\/\/[^/\s]+$/.test(configured)) return configured;
  const request = await headers();
  const host =
    request.get('x-forwarded-host') ?? request.get('host') ?? 'localhost';
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const protocol =
    request.get('x-forwarded-proto') ?? (local ? 'http' : 'https');
  return `${protocol}://${host}`;
}
