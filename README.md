# Letterlane v1.1.1

An original two-player word game: a friendly duel or a shared co-op win. Built with Next.js App Router, strict TypeScript, React, Tailwind CSS, Supabase Auth/PostgreSQL/Realtime, Zod, and a small set of accessible native controls. Fonts ship locally; no font CDN, image service, AI service, or paid add-on is required.

## Built on v1.0.1

Fixes rooms that create successfully on Supabase but then show “Let's reconnect.”
Postgres.js was encoding already-stringified JSON a second time. Room snapshots
and guess marks now bind as text before conversion to JSONB, so both database
backends store objects and arrays correctly. Existing affected rooms are readable
and are repaired on their next accepted action or heartbeat. The v1.0.1 fix is retained in this release. Existing deployments only need the
additive bot migration described below; no password or environment-variable
changes are required.

The regression test uses the real Postgres.js driver over a local PGlite socket,
including its parameter-description and serialization behavior. It covers room
creation, refresh, joining, readiness, guesses, privacy, completion, rematches,
and recovery of rooms written by v1.0. The test socket is local only; production
connections still require TLS.

## Start on this Mac

```sh
cd "$HOME/Desktop/LetterLane"
./dev.sh
```

Open **http://127.0.0.1:3000**. Create a room in a normal browser window, and open its invite in a private/incognito window or a different browser. Tabs in the same browser profile intentionally share one guest identity. The launcher can use the Node and pnpm runtime already bundled with Codex on this Mac; it does not install global software.

No credentials are needed for local mode. Data persists in `.letterlane/` across refreshes and server restarts. Local mode uses embedded PostgreSQL (PGlite), opaque HttpOnly guest cookies, and one-second snapshot polling. It is intended for a single local server process bound to loopback, not public hosting. Use the Supabase configuration below for Internet play and immediate Realtime updates. Mobile Playwright coverage emulates mobile screen sizes; local invite links point to the same computer.

## Bot companions and difficulty

When a room has only its creator, choose **I’m ready**, then **Play with bot** to fill the open seat immediately with the selected companion. You can also keep waiting for a friend; a bot never joins automatically. The normal three-second countdown begins when you choose the bot. This works in Words and Phrases, in duel and co-op. The companion is clearly labeled as a bot in the lobby, match header, and results.

Readiness survives refreshes, so a ready solo player can still choose **Play with bot** after reloading. The server requires a ready human and exactly one player in the lobby. Two-human rooms never receive a bot, including when a human disconnects. Once a bot occupies the seat, a later invitation cannot displace it. If a human join obtains the room lock before bot selection, that human gets the seat and the bot request is rejected.

Choose the companion when creating a room:

| Difficulty | Bot       | Time between guesses | Word choice                                                                 |
| ---------- | --------- | -------------------- | --------------------------------------------------------------------------- |
| Easy       | Pipsqueak | 26–34 seconds        | Random among all words consistent with its clues                            |
| Medium     | Pipper    | 16–22 seconds        | Random among the ten most informative consistent words                      |
| Hard       | Pip       | 8–12 seconds         | Original strategy: random among the three most informative consistent words |

New rooms created in the UI default to **Medium**. Difficulty persists through refreshes and rematches and applies in both duel and co-op. Existing rooms and API callers that omit `botDifficulty` keep **Hard** for compatibility. The setting is stored in the existing private room JSON; this feature needs no additional database migration.

All levels use only their own evaluated guesses and the existing answer vocabulary. They never receive the hidden answer or the human's guesses, respect clues including duplicate-letter counts, and avoid repeated words. Guess intervals are thinking time, not guaranteed solve times; random choices and polling affect the finish time. Every bot follows the same scoring, personal clock, six-attempt limit, finish window, and tie-breaks. Bots automatically agree to rematches; the human still decides whether to start another round.

**Upgrading an existing Supabase database:** apply `supabase/migrations/202609110001_bots.sql` before deploying v1.1, or run `pnpm db:migrate` if you used the migration runner originally. This adds `players.is_bot` with a default of false; existing identities, rooms and match history are preserved. Local mode applies this additive migration on startup. No new credentials, services or configuration variables are required.

Bot selection and moves run during authenticated room requests under the same database row lock as human actions. Only an explicit **Play with bot** request assigns a bot; the existing one-second poll advances its turns after assignment. Pending moves are stored privately in PostgreSQL. Multiple tabs cannot create extra bots or duplicate turns. If every browser is closed or offline, the bot pauses until another request arrives and then takes at most one due move, with the actual server timestamp; it does not replay a burst of missed guesses.

## Standard local development

Install Node.js **24 LTS** (22+ supported) and pnpm **11.19.0**, then:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`GAME_BACKEND=local` selects the local backend. Development defaults to local if the variable is absent. Production defaults to Supabase and fails closed if configuration is missing. Vercel always rejects local mode.

```sh
pnpm typecheck        # Strict TypeScript
pnpm lint             # ESLint, zero warnings
pnpm test             # Pure rules, UI, DB transactions, RLS and HTTP guards
pnpm build            # Optimized production build
pnpm exec playwright install chromium
pnpm test:e2e         # Production server, two browser profiles, desktop + mobile
pnpm format:check
```

The E2E server runs on port 3100 and uses separate data in `.letterlane/e2e/`. Only its explicitly enabled local test mode chooses CRANE, then BLOOM. `E2E_TEST_MODE` is not in `.env.example`, must never be set on a deployment, and cannot enable local mode on Vercel. Ordinary local and Supabase games choose answers using Node's cryptographic random generator. Start E2E tests after a fresh `pnpm build`; stop anything already listening on port 3100.

Dependency versions are pinned by `pnpm-lock.yaml`. TypeScript 6.0 and ESLint 9 are the latest supported compatible lines for the installed Next.js lint plugin peer ranges; newer incompatible majors are deliberately excluded. `pnpm peers check` verifies compatibility. There is no shadcn dependency because native dialogs, radio groups, buttons and fields meet this interface's needs.

## Connect Supabase

1. Create a Supabase project (the free plan is sufficient for development). In **Authentication → Providers**, enable anonymous sign-ins. Set your application URL in Auth URL configuration. Supabase's anonymous-session limits apply; review them before opening the app publicly.
2. Copy the project URL and anon/publishable client key into `.env.local`. Copy the **transaction pooler** PostgreSQL connection string into `DATABASE_URL`. This is a privileged, server-only database credential. URL-encode special characters in its password. Use the pooler from the same region as your app.
3. Set `GAME_BACKEND=supabase`. Do not prefix the database connection string or any secret with `NEXT_PUBLIC_`. The app does not require a service-role API key.
4. Apply all migrations in order, either using the Supabase SQL editor or the migration command:

   ```sh
   pnpm db:migrate
   ```

   The command reads `.env.local` and records applied files in `private.schema_migrations`. `MIGRATION_DATABASE_URL` can point to a direct or session-pooler connection if preferred; otherwise it uses `DATABASE_URL`. Run migrations once before deploying. If you applied them manually, do not also run the migration runner against that same schema without recording the applied files.

5. In **Realtime → Settings**, disable public channel access. The app uses a private `room:<uuid>` channel with participant-only presence authorization. The security migration adds **only `public.room_events`** to the `supabase_realtime` publication. Do not publish `guess_attempts`, private tables, or full room state. Check that PostgreSQL Changes are enabled for `room_events`.
6. Restart `pnpm dev`. Use two browser profiles to create, join and finish a room. Verify live updates in both directions, anonymous session refresh, private channel subscription, and results after a brief disconnect.

Relevant official references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## Deploy to Vercel

1. Push this directory to your Git repository and import it into Vercel. Select **Next.js**, Node 24, install command `pnpm install --frozen-lockfile`, and build command `pnpm build`. The root directory is the repository root. Next.js route handlers use the Node runtime; no custom adapter is needed.
2. Set `GAME_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DATABASE_URL` in the appropriate Vercel environments. Leave `LOCAL_DATA_DIR` and `E2E_TEST_MODE` unset. Configure credentials separately for previews if those should use a different Supabase project.
3. Apply the migrations to the target Supabase project first. Place the Vercel functions near your Supabase region and use the Supabase transaction pooler. The database client disables prepared statements and opens at most three connections per warm function instance.
4. Deploy, update the Supabase application URL, and smoke-test with two real browser profiles using the deployed invitation URL. Client-visible Supabase keys are public by design; database credentials remain server-only.

No cloud account or credentials were supplied for this implementation, so hosted Supabase Auth/Realtime and a Vercel deployment must be verified after you connect your project. Automated browser tests exercise the real Next API and embedded PostgreSQL backend, not a mocked game server. RLS migrations are separately executed and tested against embedded PostgreSQL with Supabase auth/realtime schema stubs; that does not substitute for testing a hosted Realtime WebSocket connection.

## Rules and product decisions

- **Personal clocks:** Each player (including bots) starts with **1:30** after the countdown. Each green or yellow tile in an accepted guess adds **20 seconds** to that player's clock. Two matches earn 40 seconds; three earn one minute. Duplicate letters earn time only when scoring marks those occurrences green/yellow. There is no extra time for gray tiles, invalid guesses, repeated words, or retried requests.
- Clocks keep running during disconnects. At zero a player cannot submit more guesses; the other may continue until a solve, timeout, or six attempts. If neither solves, the existing points comparison applies; co-op ends in a team loss when both are finished. Rematches reset clocks and bonuses.
- Deadlines are derived from the shared database start time and saved evaluated guesses, under the existing room lock. Both countdowns are visible beside the opponent lane on wide screens and in a sticky strip above the board on smaller screens. Public clock increases reveal the amount of earned time, but words and individual tile evaluations remain hidden until results. Polls, heartbeats, and actions settle expired rounds; disconnected rooms settle on their next request. No background Vercel timer or new Supabase migration/environment setting is needed. Previously started rooms use the same rule against their saved start time and guesses when first accessed after deployment.

- Both players get the same hidden five-letter word and six guesses each, with a shared three-second countdown.
- **Duel:** first solve opens a **750 ms** synchronization window. Solvers within it are compared by accepted guess count, then server-recorded elapsed milliseconds. Exactly equal results draw. Once a player is solved, out of time, or out of attempts, they cannot submit again. If both are done, the server resolves immediately.
- When neither solves, compare each player's best single guess: (1) most correctly identified letter occurrences, including misplaced ones, (2) earliest attempt that reached that maximum, (3) most exact positions, (4) most misplaced letters. If all values match, draw. Duplicate letter occurrences are counted only up to the occurrences in the answer. This explicitly defines “fewest guesses required to reveal the most correct letters.”
- **Co-op:** either solve ends the match with a team win. If both exhaust six attempts, the team loses. Letters remain private during play in both modes.
- A repeated accepted word is rejected without consuming a turn. Replaying the same request UUID with the same payload returns the saved state; reusing that UUID with different content is rejected. A match UUID prevents late requests from leaking into a rematch.
- In a bot room, the bot automatically supplies its rematch vote; a human vote remains required.
- Two rematch votes immediately schedule a new three-second countdown. The room and guest identities persist, but the answer always changes.
- Rooms expire after 24 hours. Starting a rematch renews the room. A 15-second missing heartbeat marks a player disconnected; it never forfeits or destroys their game. The same browser profile can rejoin until expiration. Clearing cookies/storage or using a different profile creates a different guest and cannot reclaim an occupied seat.
- Disconnecting does not immediately forfeit the match. Personal clocks continue to run, and an absent player can return while time remains. The server settles expired clocks on the next room request.

## Architecture

```text
Browser (Supabase anonymous session or local guest cookie)
   │ validated action + idempotency UUID, never score/time/answer
   ▼
Next.js route handler → verified guest identity → Zod validation
   ▼
PostgreSQL transaction → SELECT ... FOR UPDATE on private.room_states
   │ read database clock after locking; apply pure rules; persist atomically
   ├─ private.room_states  → authoritative game state and secret answer
   ├─ public projections  → participants, match status, own attempts, votes
   └─ public.room_events  → revision-only Realtime invalidation
   ▼
Per-player JSON snapshot → own evaluated guesses + masked opponent counts
```

- `src/lib/game/`: scoring, validation, types, state transitions and winner comparison. Scoring and rule decisions are independently tested.
- `src/lib/server/`: authentication, transactional storage, room operations, secure HTTP responses, vocabulary, bot strategy and persisted bot scheduling. `server-only` prevents bundling the implementation or vocabulary into client modules.
- `src/lib/client/`: authenticated API calls and focused room synchronization hook. Supabase Realtime invalidates snapshots immediately; polling repairs missed events and advances countdown/finish deadlines. Online/offline events and five-second heartbeats support reconnection. Realtime payloads and presence are never treated as authoritative scores or identities.
- `src/components/`: start screen, lobby, board, keyboard, results, and shared accessible controls. Local input stays in React; accepted history lives in the database. Native `<dialog>` provides focus trapping, Escape handling and focus restoration. Screen readers get evaluated letter states and result announcements; motion respects `prefers-reduced-motion`.
- `supabase/migrations/`: normalized room/player/match/attempt/rematch tables, private state, constraints, RLS, and Realtime membership policies.

All transitions for one room serialize on its database row. Different rooms remain independent. The normalized projections and revision event commit in the same transaction as private state. The database provides timestamps after acquiring the lock; client latency/time cannot manufacture a faster finish. Reads also advance deadlines, so there is no dependency on a long-lived timer in a Vercel function. If no client is connected, a pending result is committed on the next request with the same logical winner.

## Security model

- The server verifies Supabase access tokens with `auth.getUser`, or looks up a cryptographically random local HttpOnly cookie by SHA-256 hash. The request body never chooses its player ID.
- The `private` schema is not exposed to Supabase's Data API. `anon` and `authenticated` have no privileges there. RLS is enabled on all tables, including private tables; the trusted server DB role performs transitions.
- Client roles have read-only access to public projections, conditioned on membership in an unexpired room. Direct reads of attempts expose only the caller's attempts, even after completion. End-of-match opponent history and answers are revealed by the authenticated Next API after server-side completion checks. There are no client write policies.
- Bots are server-created player identities with no Auth account or guest cookie. The API rejects attempts to act as a bot; bot flags and scheduling cannot be supplied in client action bodies. The scheduler timestamp stays in private state and is excluded from snapshots.
- Seat constraints limit each room to two players. Match/attempt keys cap six attempts and prevent duplicate request IDs and duplicate words. Application checks also enforce membership, phase, match ID, allowed vocabulary, and solved-player restrictions.
- Only an answer-free revision counter is published to Realtime. Opponent guesses and the answer do not appear in active JSON responses, page props, browser bundles, or log messages. Database errors are never returned or logged verbatim.
- Mutations require same-origin requests, limit the JSON body to 2 KiB while reading, validate a strict action schema, and enforce per-identity database-backed limits (12 room creations/hour; 180 room requests/minute). Invalid actions also count toward the limit. Supabase Auth handles initial guest-signup abuse limits; consider its CAPTCHA option if abuse becomes a problem.
- API responses disable caching and vary on cookie/authorization. Browser security headers prevent framing and MIME sniffing. CSP permits Next's inline scripts/styles; `unsafe-eval` is restricted to development. For a tighter public deployment, use per-request CSP nonces and remove inline allowances as a separate hardening step.

## Vocabulary

`src/lib/server/dictionary/answers.json` contains **825** hand-curated possible answers. `allowed-guesses.json` contains **14,856** allowed guesses: the **14,855** entries extracted from the official NYT Wordle client on September 13, 2026, combined with every existing LetterLane entry. This includes IRATE, PLOWS, LOOPS, and the original LetterLane-only entry FOOEY. The answer pool and bot strategy are unchanged; expanding accepted guesses does not add obscure words to the answer pool.

See [dictionary source notes](src/lib/server/dictionary/SOURCES.md) for the exact source asset, checksum, extraction method, and preservation checks. The list is a pinned snapshot, not a runtime dependency or an automatic sync with NYT. Updating the dictionary requires a new application build, with no Supabase migration or environment-variable changes.

To expand them, use a suitably licensed word list, keep only unique uppercase A–Z strings of length five, ensure all answers appear in the allowed list, and review possible answers for familiarity and appropriateness. Preserve the upstream license/attribution if importing a third-party list. Run `pnpm test` after editing; dictionary tests enforce the format and subset relationship. Vocabulary is server-only and requires a rebuild when changed. No seed API or AI service is involved.

## Operations and scaling

This design targets small private matches. Per-room locks and the transaction pooler make horizontal app instances consistent. PGlite local mode is deliberately single-process and is not a deployment backend.

The one-second fallback polling and five-second heartbeats prioritize predictable recovery and advance bot actions. Bot scheduling adds no background worker or cron service. At larger concurrency, increase the polling interval when Realtime is healthy, use broadcast invalidations, narrow persistence to changed projections, tune Supabase Realtime connection limits, and monitor pool saturation. Each heartbeat currently rewrites the small room snapshot and upserts projections. Rate-limit buckets should be moved to a purpose-built scalable store only if necessary; no additional service is required at this scale.

Schedule database maintenance appropriate to your retention policy (SQL examples in `supabase/maintenance.sql`). Expired rooms are inaccessible immediately but retained until cleanup; deleting them cascades to match/attempt/private state rows. Preserve data you need before running cleanup. Guest rows are kept while referenced by room history. Database backups and service uptime depend on your Supabase plan. No external scheduled service is required for game correctness.

## Letterlane Phrases

Choose **Phrases** in the shared Words/Phrases navigation, or open **/phrases**. This is the same private two-player game with whole sayings instead of five-letter words: duel/co-op, six guesses, optional bots and difficulty choices, private opponent guesses, saved rooms, and rematches all use the shared engine. Words remains at `/`, and both types retain their existing `/room/<code>` invitation URLs.

The initial collection has **51 phrases, at most seven words each**, derived from [Wikipedia's List of proverbial phrases](https://en.wikipedia.org/wiki/List_of_proverbial_phrases). It lives in `src/lib/server/phrases/proverbs.json`; see the adjacent `SOURCES.md` for the pinned source, adaptations, dictionary provenance, and how to add a collection. Wikipedia is never contacted during play. The eight-word “Beauty is in the eye of the beholder” and the eleven-word journey example are excluded by the limit.

Letters fill the displayed word lengths automatically. Spaces, apostrophes, commas, hyphens, and periods are shown but never consume tiles. Type directly into the phrase tiles using the shared on-screen keyboard or your physical keyboard. Use Backspace to correct letters and Enter to submit. Words wrap as whole groups across lines. Accepted guesses remain visible; only the current empty attempt is expanded. The help dialog explains:

- **Green:** correct letter and position.
- **Orange:** correct letter in the same word, wrong position.
- **Blue:** a remaining occurrence in another word.
- **Grey:** no remaining occurrence in the phrase.

Matching consumes occurrences once: all greens first, then all same-word oranges, then cross-word blues, left to right. Extra duplicate letters turn grey. The keyboard displays the strongest hint seen for each letter; exact word-specific hints remain on the board.

Every guessed word is validated before any scoring. The original dictionary is reused and supplemented by a frozen variable-length word list. Rejections identify one-based positions: `Word 2 is not in word list`, `Words 1 and 3 are not in word list`, or `Words 1, 2, and 5 are not in word list`. Invalid guesses consume no attempt or bonus. Phrases start at **3:00** and each green/orange/blue tile adds **five seconds**. Words retains its original 1:30 clock and 20-second green/yellow bonuses.

Puzzle selection remains **random per room and rematch**, excluding the immediately previous answer; there are no daily puzzles. The stored room's `game` discriminator isolates Words and Phrases, and old rooms default to Words. Each room and round has its own IDs, answer, attempts, completion and rematch state. Accepted phrase progress survives reloads through the existing PostgreSQL/PGlite persistence. The optional saved display name uses `letterlane-phrases-name`, separate from `letterlane-name`. Unsubmitted draft letters are not persisted, matching Words. The app has per-round result statistics, which are reused with phrase boards; it has no global streak or lifetime-statistics system to migrate.

**Database upgrade:** apply `supabase/migrations/202609220001_phrases.sql` before deploying this build (`pnpm db:migrate` with the existing database configuration). It adds the guess type and permits compact phrase letters plus one mark per letter while preserving the five-letter Words constraint. Existing rows default to Words. Local mode applies it automatically. No hosted database has been modified by this implementation.

Run `./dev.sh`, open `http://127.0.0.1:3000/phrases`, create a room and invite a second browser profile (or ready up and choose **Play with bot**). Run `pnpm test` for rules, validation, duplicate scoring, datasets, mode isolation and database tests; run `pnpm build && pnpm test:e2e` for the Words and Phrases browser flows. Browser tests use the existing local-only deterministic test selection, never production puzzles. Phrase bots use public word lengths and their own feedback to choose valid words; their guesses can be grammatical nonsense because they do not receive or search the answer collection.
