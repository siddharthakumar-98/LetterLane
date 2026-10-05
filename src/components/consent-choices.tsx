'use client';
import { getAdsConfig } from '@/lib/ads-config';

/** Reopens Google's consent message, as its certified CMP requires. */
export function ConsentChoices() {
  if (!getAdsConfig())
    return <p className="muted">Ads are not enabled on this site.</p>;
  return (
    <button
      type="button"
      className="button secondary"
      onClick={() => {
        (window.googlefc ??= {}).callbackQueue ??= [];
        window.googlefc.callbackQueue.push(() =>
          window.googlefc?.showRevocationMessage?.(),
        );
      }}
    >
      Privacy and cookie settings
    </button>
  );
}
