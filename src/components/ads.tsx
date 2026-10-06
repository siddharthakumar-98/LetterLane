'use client';
import { useEffect, useRef, useState } from 'react';
import { getAdsConfig } from '@/lib/ads-config';
import {
  ADS_READY_EVENT,
  ADS_READY_TIMEOUT_MS,
  adBreak,
} from '@/lib/client/ads';

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
/** Request at most one lobby ad per room/session. Starting play and requesting
 * an ad share a synchronous gate; an issued placement holds it until complete.
 * If initialization takes too long, skip the ad before submitting a placement. */
export function useLobbyAd(code: string, eligible: boolean) {
  const [locked, setLocked] = useState(false);
  const pending = useRef(false);
  const beginPlay = () => {
    if (pending.current) return false;
    // Skip this room's ad before sending Ready/Play with bot, even if the server
    // response is delayed or lost. A later onReady event must not request it.
    claimLobbyAd(code);
    return true;
  };
  useEffect(() => {
    if (!eligible || !getAdsConfig()?.h5) return;
    const request = () => {
      if (pending.current || !claimLobbyAd(code)) return;
      pending.current = true;
      const done = () => {
        pending.current = false;
        setLocked(false);
      };
      setLocked(true);
      void adBreak('start', 'lobby').then(done, done);
    };
    if (window.letterlaneAdsReady) {
      request();
      return;
    }
    const onReady = () => {
      clearTimeout(timeout);
      request();
    };
    const timeout = setTimeout(() => {
      claimLobbyAd(code);
      window.removeEventListener(ADS_READY_EVENT, onReady);
    }, ADS_READY_TIMEOUT_MS);
    window.addEventListener(ADS_READY_EVENT, onReady, { once: true });
    return () => {
      clearTimeout(timeout);
      window.removeEventListener(ADS_READY_EVENT, onReady);
    };
  }, [code, eligible]);
  return { locked, beginPlay };
}
