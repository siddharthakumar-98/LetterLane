@AGENTS.md

# LetterLane

Private two-player guessing game (README calls the current state **v3.0, ad-ready**). Two puzzle types share one engine:

- **Words** (`/`): a hidden 5-, 6- or 7-letter word (Easy/Medium/Hard).
- **Phrases** (`/phrases`): a saying of up to 5 (Easy) or 7 (Normal) words, with a fourth color, **blue**, for a letter that belongs to another word.

Modes are **duel** and **co-op**, against a friend or a bot (Pipsqueak / Pipper / Pip). Each player gets six guesses and a personal clock: Words 1:30 plus 20 s per green/yellow tile; Phrases 3:00 plus 5 s per green/orange/blue tile. Opponent letters stay hidden until results. Rooms live at `/room/<CODE>` for 24 hours. Production runs at https://letterlane.vercel.app.

`README.md` is the authoritative product and rules document. `docs/` holds the optimization, UI, advertising and ads-readiness notes.

## Commands

`pnpm` and `node` may not be on PATH in agent shells. Use the runtime that `dev.sh` falls back to:

```sh
R=~/.cache/codex-runtimes/codex-primary-runtime/dependencies; export PATH="$R/node/bin:$R/bin/fallback:$PATH"
```

- `./dev.sh` or `pnpm dev`: local server at http://127.0.0.1:3000 (local PGlite backend, no credentials needed).
- `pnpm check`: typecheck, lint (`--max-warnings 0`), Vitest and production build. Run it before handing work back.
- `pnpm test:e2e`: Playwright on port 3100 against the **existing** production build, so run `pnpm build` first. Desktop and mobile projects; about 9 minutes. 21 skips are expected (duplicate mobile matrix cases and the desktop-only site-pages spec).
- `pnpm exec prettier --check <files>`: whole-repo `format:check` fails only because of the untracked `LetterLane_app/`.
- `pnpm build` rewrites `next-env.d.ts`. Restore it with `git checkout next-env.d.ts` before committing.
- In zsh, never name a loop variable `path`: it overwrites `PATH`.

## Architecture

- `src/lib/game/`: pure rules, scoring, validation, types and clock logic; unit-tested. `rules.ts` holds `applyAction`, `advance`, `winner` and `projectRoom`.
- `src/lib/server/`: auth (anonymous Supabase or a local HttpOnly cookie), transactions in `db.ts`, `rooms.ts` (`createRoom` and `roomOperation`), `room-persistence.ts` (diffed writes), bots, rate limits and dictionaries. These modules import `server-only`.
- `src/lib/client/`: the API client, `use-room.ts` (1 s polling, 5 s heartbeat, revision ordering) and `room-snapshot.ts` (keeps references stable across polls).
- `src/components/`:
  - `room-game.tsx`: lobby, player bar and the two lanes.
  - `board.tsx`: the `Board` and `MaskedBoard` components.
  - `home.tsx`, `chrome.tsx` (header and footer), `ads.tsx`, `ads-script.tsx` and `content-page.tsx`.
- **Invariants:**
  - All room transitions happen in a Postgres transaction under `SELECT … FOR UPDATE`, using database time.
  - The answer and opponent letters are never sent to the browser during play.
  - Realtime publishes only a revision counter.
- **Migrations:** `supabase/migrations/`. Apply them in Supabase before deploying; local PGlite migrates on startup.

## UI conventions (recent work)

- The player bar is mirrored: names at the outer edges, the two clocks beside the centre divider, on desktop and mobile. Clocks reserve the bonus line so the digits stay aligned.
- **Words:** your lane shows played rows plus one active row (`Board` `rows` prop). Phrases manages its own rows in `PhraseBoard`; don't change Phrases when changing Words.
- **Opponent lane** (`MaskedBoard`): played rows plus one dashed pending row (`finished` prop).
- Styling lives in `src/app/globals.css` with tokens on `:root` (`--ink`, `--muted`, `--accent`, and so on). The `.phrase-mode` class switches the shared `present` colour to orange.
- **Constants:** a `'use client'` module can't export plain values to server components. Shared values go in plain modules, such as `src/lib/site-links.ts`.

## Ads (Google AdSense)

- Publisher `ca-pub-6747177342720865` (`ADSENSE_CLIENT` in `src/lib/ads-config.ts`). Production builds include the tag in every `<head>`; dev is ad-free. `NEXT_PUBLIC_ADSENSE_CLIENT=off` disables ads.
- Opt-in settings:
  - `NEXT_PUBLIC_ADSENSE_HOME_SLOT`: the home display unit, placed in the `support` grid area.
  - `NEXT_PUBLIC_ADSENSE_H5=1`: the lobby interstitial, after H5 Games Ads approval.
  - `NEXT_PUBLIC_ADSENSE_TEST=1`: test ads.

  `NEXT_PUBLIC_` values are inlined at build time.

- The script is rendered as plain tags in `ads-script.tsx`, not `next/script`: AdSense rejects the `data-nscript` attribute that `next/script` adds.
- **Policy:** never put AdSense units in our own popups or modals; only Google's H5 interstitial is allowed. Rooms get no display units.
- **Lobby ad fairness** (`useLobbyAd` in `ads.tsx`, `adBreak` in `src/lib/client/ads.ts`):
  - It is requested only for an unready player, after Google's `adConfig` `onReady`.
  - If Google isn't ready within `ADS_READY_TIMEOUT_MS`, the ad is skipped.
  - `beginPlay()` closes eligibility synchronously before Ready or Play with bot is sent.
  - Readiness stays locked until Google's `adBreakDone`.
  - It shows at most once per room per session (sessionStorage key `letterlane-ad-lobby:<code>`).
  - It must never cost game time.
- The CSP comes from `contentSecurityPolicy()` in `ads-config.ts`. It must stay identical to the original when ads are off; a test enforces this.
- **Crawler and SEO files:**
  - `/ads.txt` returns `google.com, pub-6747177342720865, DIRECT, f08c47fec0942fa0`.
  - `robots.ts` disallows `/room/` and `/api/` and allows `Mediapartners-Google`.
  - `sitemap.ts`; set `SITE_URL` to the canonical origin.
  - Room pages are `noindex`.
- **Content pages** for AdSense review: `/how-to-play`, `/about`, `/faq` and `/privacy`, linked from every footer through `SITE_LINKS`. Rule numbers come from the game constants, and the example tiles are scored by the real scorer. Keep text factual. The privacy contact is `siddukumar321@gmail.com`.
- **Status and open items:** `docs/ads-readiness-review.md` and `docs/advertising.md`. The European consent message is published. The US state message still needs publishing in AdSense (it needs a logo). The display unit and H5 are not enabled yet.

## Dictionaries and licensing

- **Five-letter guesses:** `src/lib/server/dictionary/allowed-guesses.json`, 6,829 words built only from SCOWL rel-2026.02.25 at size 70 (`scripts/build-words-dictionary.py`; the license sits in `DICTIONARY-LICENSE.txt` next to it).
  - The earlier NYT Wordle-derived list was removed for lack of a license. Never reintroduce extracted or unlicensed word lists.
  - Answers (`answers.json`, 825 words) must stay a subset of the guess list.
- **6/7-letter Words and Phrases:** use SCOWL size 35 (`src/lib/server/phrases/allowed-words.json`, built by `scripts/build-phrase-dictionary.py`).
- **Phrase answers:** adapted from Wikipedia's List of proverbial phrases (CC BY-SA 4.0); keep the attribution on `/about`.
- Source notes: `src/lib/server/dictionary/SOURCES.md` and `src/lib/server/phrases/SOURCES.md`.

## Testing notes

- Vitest lives in `tests/` (jsdom via a `// @vitest-environment jsdom` header). `RoomGame` tests mock `useRoom` and `chrome`; see `tests/room-game-input.test.tsx` and `tests/ads.test.tsx`.
- Playwright lives in `tests/e2e/`:
  - `E2E_TEST_MODE` picks fixed answers (CRANE/BLOOM, GARDEN/BRIDGE, JOURNEY/PICTURE, fixed phrases).
  - `responsive.spec.ts` checks layouts.
  - `site-pages.spec.ts` checks public pages, links, accessibility, the AdSense tag and the crawler files.
- When UI row counts change, update the tile/row counts in `components.test.tsx`, `word-lengths.spec.ts`, `multiplayer.spec.ts` and `responsive.spec.ts`.

## Repository workflow

- `main` is the base branch. Features land through PRs from branches such as `optimization` and `init-ads`. Local `main` can be stale, so compare against `origin/main`.
- `LetterLane_app/` is an **untracked** native SwiftUI iOS client that uses the same API. Never stage or commit it unless asked.
- Commit or stage only when asked. Stage just the files related to the task.
- `gh` may not be authenticated on this machine. If it isn't, push the branch and give the compare URL.
