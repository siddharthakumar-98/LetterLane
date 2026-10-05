/** Google AdSense settings. Public build-time values; ads stay off unless valid. */
export type AdsConfig = {
  client: string;
  homeSlot: string | null;
  h5: boolean;
  test: boolean;
};
type AdsEnv = Partial<
  Record<
    | 'NEXT_PUBLIC_ADSENSE_CLIENT'
    | 'NEXT_PUBLIC_ADSENSE_HOME_SLOT'
    | 'NEXT_PUBLIC_ADSENSE_H5'
    | 'NEXT_PUBLIC_ADSENSE_TEST',
    string
  >
>;
// NEXT_PUBLIC_ values are inlined only when referenced literally.
const env = (): AdsEnv => ({
  NEXT_PUBLIC_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
  NEXT_PUBLIC_ADSENSE_HOME_SLOT: process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT,
  NEXT_PUBLIC_ADSENSE_H5: process.env.NEXT_PUBLIC_ADSENSE_H5,
  NEXT_PUBLIC_ADSENSE_TEST: process.env.NEXT_PUBLIC_ADSENSE_TEST,
});
/** LetterLane's AdSense publisher ID: a public identifier, not a secret. */
export const ADSENSE_CLIENT = 'ca-pub-6747177342720865';
/** Production builds use LetterLane's publisher ID unless the variable overrides
 * it; `off` (or any invalid value) disables ads. Development stays ad-free. */
export function getAdsConfig(
  values: AdsEnv = env(),
  production = process.env.NODE_ENV === 'production',
): AdsConfig | null {
  const client =
    values.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ||
    (production ? ADSENSE_CLIENT : '');
  if (!/^ca-pub-\d{10,20}$/.test(client)) return null;
  const slot = values.NEXT_PUBLIC_ADSENSE_HOME_SLOT?.trim() ?? '';
  return {
    client,
    homeSlot: /^\d{5,20}$/.test(slot) ? slot : null,
    h5: values.NEXT_PUBLIC_ADSENSE_H5 === '1',
    test: values.NEXT_PUBLIC_ADSENSE_TEST === '1',
  };
}

// Google's AdSense, consent-message and H5 Games Ads hosts.
const googleAds = [
  'https://*.googlesyndication.com',
  'https://*.googleadservices.com',
  'https://*.googletagservices.com',
  'https://*.doubleclick.net',
  'https://*.google.com',
  'https://*.gstatic.com',
  'https://*.adtrafficquality.google',
].join(' ');
/** The site CSP. Without ads it is unchanged; with ads it admits Google's hosts. */
export function contentSecurityPolicy(
  ads: boolean,
  development = process.env.NODE_ENV === 'development',
) {
  const eval_ = development ? "'unsafe-eval'" : '';
  if (!ads)
    return `default-src 'self'; script-src 'self' 'unsafe-inline' ${eval_};  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:* ws://127.0.0.1:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
  return `default-src 'self'; script-src 'self' 'unsafe-inline' ${eval_} ${googleAds}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:* ws://127.0.0.1:* ${googleAds}; frame-src 'self' ${googleAds}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
}
