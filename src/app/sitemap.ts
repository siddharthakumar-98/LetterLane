import type { MetadataRoute } from 'next';
import { SITE_LINKS } from '@/lib/site-links';
import { siteOrigin } from '@/lib/server/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  return ['/', '/phrases', ...SITE_LINKS.map(({ href }) => href)].map(
    (path) => ({ url: `${origin}${path === '/' ? '' : path}` }),
  );
}
