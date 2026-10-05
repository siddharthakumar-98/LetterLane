// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { contentSecurityPolicy, getAdsConfig } from '../src/lib/ads-config';
import { AD_BREAK_TIMEOUT_MS, adBreak } from '../src/lib/client/ads';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdSlot, LOBBY_LOCK_LIMIT_MS } from '../src/components/ads';
import { AdsScript } from '../src/components/ads-script';
import { RoomGame } from '../src/components/room-game';
import { GET as adsTxt } from '../src/app/ads.txt/route';
import { useRoom } from '../src/lib/client/use-room';
import { projectRoom } from '../src/lib/game/rules';
import type { Room } from '../src/lib/game/types';
import { fixture, p1 } from './fixtures';

vi.mock('../src/lib/client/use-room', () => ({ useRoom: vi.fn() }));
vi.mock('../src/lib/client/api', () => ({ api: vi.fn() }));
vi.mock('../src/components/chrome', () => ({
  Header: () => null,
  Footer: () => null,
}));
const CLIENT = 'ca-pub-1234567890123456';
function enableAds({ slot = '1234567890', h5 = '1' } = {}) {
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', CLIENT);
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_HOME_SLOT', slot);
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_H5', h5);
}
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', '');
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_HOME_SLOT', '');
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_H5', '');
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_TEST', '');
  delete window.adBreak;
  delete window.adsbygoogle;
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it('keeps ads off unless the publisher ID is valid', () => {
  expect(getAdsConfig()).toBeNull();
  expect(
    getAdsConfig({ NEXT_PUBLIC_ADSENSE_CLIENT: 'pub-1234567890123456' }),
  ).toBeNull();
  expect(
    getAdsConfig({
      NEXT_PUBLIC_ADSENSE_CLIENT: CLIENT,
      NEXT_PUBLIC_ADSENSE_HOME_SLOT: 'abc',
    }),
  ).toEqual({ client: CLIENT, homeSlot: null, h5: false, test: false });
  enableAds();
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_TEST', '1');
  expect(getAdsConfig()).toEqual({
    client: CLIENT,
    homeSlot: '1234567890',
    h5: true,
    test: true,
  });
});

it('leaves the security policy unchanged without ads and admits Google with them', () => {
  const original =
    "default-src 'self'; script-src 'self' 'unsafe-inline' __DEV_EVAL__;  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:* ws://127.0.0.1:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
  expect(contentSecurityPolicy(false, false)).toBe(
    original.replace('__DEV_EVAL__', ''),
  );
  expect(contentSecurityPolicy(false, true)).toBe(
    original.replace('__DEV_EVAL__', "'unsafe-eval'"),
  );
  const ads = contentSecurityPolicy(true, false);
  expect(ads).toContain('https://*.googlesyndication.com');
  expect(ads).toMatch(/frame-src 'self' https:\/\/\*\.googlesyndication\.com/);
  expect(ads).toContain("img-src 'self' data: https:;");
  expect(ads).toContain("frame-ancestors 'none'");
  expect(ads).not.toContain('unsafe-eval');
});

it('serves ads.txt only when ads are configured', async () => {
  expect(adsTxt().status).toBe(404);
  enableAds();
  const response = adsTxt();
  expect(response.headers.get('content-type')).toContain('text/plain');
  expect(await response.text()).toBe(
    'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n',
  );
});

it('loads AdSense with plain tags only when configured', () => {
  expect(renderToStaticMarkup(<AdsScript />)).toBe('');
  enableAds({ h5: '' });
  const display = renderToStaticMarkup(<AdsScript />);
  expect(display).toContain(
    `src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}"`,
  );
  expect(display).not.toContain('data-nscript');
  expect(display).not.toContain('adBreak');
  enableAds();
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_TEST', '1');
  const h5 = renderToStaticMarkup(<AdsScript />);
  expect(h5).toContain('window.adBreak=window.adConfig');
  expect(h5).toContain('data-ad-frequency-hint="120s"');
  expect(h5).toContain('data-adbreak-test="on"');
});

it('renders no slot when ads are off, and requests a configured slot once', () => {
  const { container, unmount } = render(<AdSlot />);
  expect(container.innerHTML).toBe('');
  expect(window.adsbygoogle).toBeUndefined();
  unmount();
  enableAds();
  const view = render(
    <StrictMode>
      <AdSlot className="home-support" />
    </StrictMode>,
  );
  view.rerender(
    <StrictMode>
      <AdSlot className="home-support" />
    </StrictMode>,
  );
  const unit = view.container.querySelector('ins.adsbygoogle')!;
  expect(unit.getAttribute('data-ad-client')).toBe(CLIENT);
  expect(unit.getAttribute('data-ad-slot')).toBe('1234567890');
  expect(screen.getByLabelText('Advertisement')).toBeTruthy();
  expect(window.adsbygoogle).toEqual([{}]);
});

it('resolves ad breaks when unavailable, answered or silently blocked', async () => {
  await expect(adBreak('start', 'lobby')).resolves.toBe('unavailable');
  window.adBreak = (options) =>
    options.adBreakDone?.({ breakStatus: 'viewed' });
  await expect(adBreak('start', 'lobby')).resolves.toBe('viewed');
  vi.useFakeTimers();
  window.adBreak = () => {}; // Queued by the inline stub, never answered.
  const blocked = adBreak('start', 'lobby');
  vi.advanceTimersByTime(AD_BREAK_TIMEOUT_MS);
  await expect(blocked).resolves.toBe('timeout');
  let done: ((p: { breakStatus: string }) => void) | undefined;
  window.adBreak = (options) => {
    options.beforeAd?.();
    done = options.adBreakDone;
  };
  let settled = '';
  void adBreak('start', 'lobby').then((status) => (settled = status));
  vi.advanceTimersByTime(AD_BREAK_TIMEOUT_MS * 4);
  await Promise.resolve();
  expect(settled).toBe(''); // A showing ad is never cut short.
  done!({ breakStatus: 'dismissed' });
  await vi.waitFor(() => expect(settled).toBe('dismissed'));
});

function lobby(ready = false) {
  const room: Room = fixture();
  room.match.phase = 'lobby';
  room.match.startsAt = null;
  room.players[0].ready = ready;
  return room;
}
function show(room: Room) {
  vi.mocked(useRoom).mockReturnValue({
    room: projectRoom(room, p1, 2000),
    error: '',
    fatal: null,
    connected: true,
    loading: false,
    busy: false,
    now: 2000,
    act: vi.fn(),
    refresh: vi.fn(),
    setError: vi.fn(),
  });
}
it('shows the lobby interstitial once per room and locks readiness while it is up', async () => {
  enableAds();
  const calls: Parameters<NonNullable<Window['adBreak']>>[0][] = [];
  window.adBreak = (options) => calls.push(options);
  show(lobby());
  const { rerender, unmount } = render(<RoomGame code="LOBBY1" />);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ type: 'start', name: 'lobby' });
  const ready = () =>
    screen.getByRole('button', { name: /I’m ready/ }) as HTMLButtonElement;
  expect(ready().disabled).toBe(false);
  act(() => calls[0].beforeAd!());
  expect(ready().disabled).toBe(true);
  act(() => calls[0].afterAd!());
  expect(ready().disabled).toBe(false);
  await act(async () => calls[0].adBreakDone!({ breakStatus: 'viewed' }));
  rerender(<RoomGame code="LOBBY1" />);
  unmount();
  render(<RoomGame code="LOBBY1" />);
  expect(calls).toHaveLength(1);
  expect(sessionStorage.getItem('letterlane-ad-lobby:LOBBY1')).toBe('1');
});
it('releases the lobby lock if the close callback never arrives', () => {
  vi.useFakeTimers();
  enableAds();
  const calls: Parameters<NonNullable<Window['adBreak']>>[0][] = [];
  window.adBreak = (options) => calls.push(options);
  show(lobby());
  render(<RoomGame code="LOBBY4" />);
  act(() => calls[0].beforeAd!());
  const ready = () =>
    screen.getByRole('button', { name: /I’m ready/ }) as HTMLButtonElement;
  expect(ready().disabled).toBe(true);
  act(() => vi.advanceTimersByTime(LOBBY_LOCK_LIMIT_MS));
  expect(ready().disabled).toBe(false);
});
it('never interrupts a ready player, a started match or a site without H5 ads', () => {
  const calls: unknown[] = [];
  window.adBreak = (options) => calls.push(options);
  enableAds({ h5: '' });
  show(lobby());
  render(<RoomGame code="LOBBY2" />);
  cleanup();
  enableAds();
  show(lobby(true));
  render(<RoomGame code="LOBBY3" />);
  cleanup();
  for (const phase of ['countdown', 'active', 'complete'] as const) {
    const room = lobby();
    room.match.phase = phase;
    room.match.startsAt = 1000;
    show(room);
    render(<RoomGame code={`LOBBY${phase.length}`} />);
    cleanup();
  }
  expect(calls).toHaveLength(0);
});
