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
/** The queue never answers when the script is blocked, so give up quietly. */
export const AD_BREAK_TIMEOUT_MS = 5000;
export function adBreak(
  type: AdBreakOptions['type'],
  name: string,
  hooks: { beforeAd?: () => void; afterAd?: () => void } = {},
): Promise<string> {
  if (typeof window === 'undefined' || typeof window.adBreak !== 'function')
    return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    let started = false;
    const timer = setTimeout(() => {
      if (!started) resolve('timeout');
    }, AD_BREAK_TIMEOUT_MS);
    window.adBreak!({
      type,
      name,
      beforeAd: () => {
        started = true;
        hooks.beforeAd?.();
      },
      afterAd: () => hooks.afterAd?.(),
      adBreakDone: (placement) => {
        clearTimeout(timer);
        resolve(placement?.breakStatus ?? 'other');
      },
    });
  });
}
