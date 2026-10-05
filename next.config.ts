import type { NextConfig } from 'next';
import { contentSecurityPolicy, getAdsConfig } from './src/lib/ads-config';
const config: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy(getAdsConfig() !== null),
          },
        ],
      },
    ];
  },
};
export default config;
