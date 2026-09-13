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

## New in v1.1: a bot when the room is still waiting

If a room has only its creator after **45 seconds**, **Pip** fills the second seat. The lobby shows a countdown and clearly labels Pip as a bot in the lobby, match header, and results. The creator still chooses **I'm ready**; if already ready, the normal three-second countdown starts when Pip joins. This works in duel and co-op. Invite friends before the seat fills to play the original two-human game.

The timer starts at room creation, uses the database clock, and survives refreshes. Two-human rooms never receive a bot, including when a human disconnects. Once Pip occupies the seat, it counts toward the existing two-player capacity; a later invitation cannot displace it. If a human join obtains the lock before bot assignment, that human gets the seat.

Pip makes one guess every **8–12 seconds**, using only its own evaluated guesses and the existing answer vocabulary. Its strategy is never given the actual answer or the human's guesses. It follows the same scoring, six-attempt limit, finish window, and tie-breaks. Pip automatically agrees to rematches; the human still decides whether to start another round.

**Upgrading an existing Supabase database:** apply `supabase/migrations/202609110001_bots.sql` before deploying v1.1, or run `pnpm db:migrate` if you used the migration runner originally. This adds `players.is_bot` with a default of false; existing identities, rooms and match history are preserved. Local mode applies this additive migration on startup. No new credentials, services or configuration variables are required.

Bot assignment and moves run during authenticated room requests under the same database row lock as human actions. The existing one-second poll wakes them, so a visible room gains a bot on the first request at or after 45 seconds. Pending moves are stored privately in PostgreSQL. Multiple tabs cannot create extra bots or duplicate turns. If every browser is closed or offline, the bot pauses until another request arrives and then takes at most one due move, with the actual server timestamp; it does not replay a burst of missed guesses.

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

- Both players get the same hidden five-letter word and six guesses each, with a shared three-second countdown.
- **Duel:** first solve opens a **750 ms** synchronization window. Solvers within it are compared by accepted guess count, then server-recorded elapsed milliseconds. Exactly equal results draw. Once a player is solved or out of attempts, they cannot submit again. If both are done, the server resolves immediately.
- When neither solves, compare each player's best single guess: (1) most correctly identified letter occurrences, including misplaced ones, (2) earliest attempt that reached that maximum, (3) most exact positions, (4) most misplaced letters. If all values match, draw. Duplicate letter occurrences are counted only up to the occurrences in the answer. This explicitly defines “fewest guesses required to reveal the most correct letters.”
- **Co-op:** either solve ends the match with a team win. If both exhaust six attempts, the team loses. Letters remain private during play in both modes.
- A repeated accepted word is rejected without consuming a turn. Replaying the same request UUID with the same payload returns the saved state; reusing that UUID with different content is rejected. A match UUID prevents late requests from leaking into a rematch.
- In a bot room, Pip automatically supplies its rematch vote; a human vote remains required.
- Two rematch votes immediately schedule a new three-second countdown. The room and guest identities persist, but the answer always changes.
- Rooms expire after 24 hours. Starting a rematch renews the room. A 15-second missing heartbeat marks a player disconnected; it never forfeits or destroys their game. The same browser profile can rejoin until expiration. Clearing cookies/storage or using a different profile creates a different guest and cannot reclaim an occupied seat.
- There is no inactivity-forfeit timer. An absent opponent can return, or you can start another room. An unresolved room eventually expires.

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
