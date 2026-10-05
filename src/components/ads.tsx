'use client';
import { useEffect, useRef, useState } from 'react';
import { getAdsConfig } from '@/lib/ads-config';
import { ADS_READY_EVENT, adBreak } from '@/lib/client/ads';

/** A responsive display unit with a reserved, labelled space. */
export function AdSlot({ className = '' }: { className?: string }) {
  const config = getAdsConfig();
  const requested = useRef(false);
  useEffect(() => {
    if (!config?.homeSlot || requested.current) return;
    requested.current = true;
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {
      // A blocked or failed ad leaves the reserved space empty.
    }
  }, [config?.homeSlot]);
  if (!config?.homeSlot) return null;
  return (
    <aside className={`ad-slot ${className}`} aria-label="Advertisement">
      <span className="ad-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={config.client}
        data-ad-slot={config.homeSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
        {...(config.test ? { 'data-adtest': 'on' } : {})}
      />
    </aside>
  );
}

const shownLobbies = new Set<string>();
function claimLobbyAd(code: string) {
  const key = `letterlane-ad-lobby:${code}`;
  if (shownLobbies.has(code)) return false;
  shownLobbies.add(code);
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    // Storage can be unavailable; the in-memory set still limits repeats.
  }
  return true;
}
/** Google's closable interstitial when the lobby opens, at most once per room
 * per browser session. Only an unready player is eligible, and readiness is
 * locked from the request until Google reports the break done, so the
 * countdown (which needs their own Ready or Play with bot) cannot start beneath
 * it. The break is requested only once Google's API is ready and has preloaded,
 * so a queued request cannot surface after the player has moved on; if the API
 * is not ready while the player is still eligible, the lobby has no ad. */
export function useLobbyAd(code: string, eligible: boolean) {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!eligible || !getAdsConfig()?.h5) return;
    const request = () => {
      if (!claimLobbyAd(code)) return;
      // Never leave the lobby locked if Google misses its callbacks.
      const release = setTimeout(() => setLocked(false), LOBBY_LOCK_LIMIT_MS);
      const done = () => {
        clearTimeout(release);
        setLocked(false);
      };
      setLocked(true);
      void adBreak('start', 'lobby', {
        beforeAd: () => setLocked(true),
        afterAd: done,
      }).then(done);
    };
    if (window.letterlaneAdsReady) {
      request();
      return;
    }
    window.addEventListener(ADS_READY_EVENT, request, { once: true });
    return () => window.removeEventListener(ADS_READY_EVENT, request);
  }, [code, eligible]);
  return locked;
}
export const LOBBY_LOCK_LIMIT_MS = 60000;
