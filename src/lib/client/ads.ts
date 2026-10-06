/** Google H5 Games Ads (Ad Placement API) break, resolved with its breakStatus. */
type Placement = { breakStatus: string };
type AdBreakOptions = {
  type: 'start' | 'next' | 'pause' | 'browse';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  adBreakDone?: (placement: Placement) => void;
};
declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (options: AdBreakOptions) => void;
    /** Set by the inline H5 setup once Google's API is ready and preloaded. */
    letterlaneAdsReady?: boolean;
    googlefc?: {
      callbackQueue?: unknown[];
      showRevocationMessage?: () => void;
    };
  }
}
/** Dispatched on window by the inline H5 setup from adConfig's onReady. */
export const ADS_READY_EVENT = 'letterlane-ads-ready';
/** Stop waiting for initialization before submitting any placement. */
export const ADS_READY_TIMEOUT_MS = 5000;
export function adBreak(
  type: AdBreakOptions['type'],
  name: string,
  hooks: { beforeAd?: () => void; afterAd?: () => void } = {},
): Promise<string> {
  if (
    typeof window === 'undefined' ||
    !window.letterlaneAdsReady ||
    typeof window.adBreak !== 'function'
  )
    return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    // A submitted placement cannot be cancelled by a local timeout. Wait for
    // Google's terminal callback, including when it decides not to show an ad.
    window.adBreak!({
      type,
      name,
      beforeAd: () => hooks.beforeAd?.(),
      afterAd: () => hooks.afterAd?.(),
      adBreakDone: (placement) => {
        resolve(placement?.breakStatus ?? 'other');
      },
    });
  });
}
