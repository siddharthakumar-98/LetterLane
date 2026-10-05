import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/server/site-url';

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: [
      // Private invitations and the API stay out of search results.
      { userAgent: '*', allow: '/', disallow: ['/room/', '/api/'] },
      // AdSense must be able to crawl every page that can show ads.
      { userAgent: 'Mediapartners-Google', allow: '/' },
    ],
    sitemap: `${await siteOrigin()}/sitemap.xml`,
  };
}
