'use client';
import { useEffect, useRef, useState } from 'react';
import { getAdsConfig } from '@/lib/ads-config';
import { adBreak } from '@/lib/client/ads';

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
 * per browser session. Only an unready player is eligible, so the countdown
 * (which needs their own Ready or Play with bot) cannot start beneath it. */
export function useLobbyAd(code: string, eligible: boolean) {
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    if (!eligible || !getAdsConfig()?.h5 || !claimLobbyAd(code)) return;
    let release: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(release);
      setShowing(false);
    };
    void adBreak('start', 'lobby', {
      beforeAd: () => {
        setShowing(true);
        // Never leave the lobby locked if Google misses its close callback.
        release = setTimeout(done, LOBBY_LOCK_LIMIT_MS);
      },
      afterAd: done,
    }).then(done);
  }, [code, eligible]);
  return showing;
}
export const LOBBY_LOCK_LIMIT_MS = 60000;
