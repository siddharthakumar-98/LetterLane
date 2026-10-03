# Optimization pass

Branch: `optimization`, created from a clean `phrases-difficulty` checkout.

## Changes

- **Database writes:** room persistence compares the locked, previous snapshot with the accepted state. It updates only changed identity, presence, match, expiry and rematch projections, and inserts only newly accepted attempts. Saved state and the revision event still commit in the same transaction. Creation and legacy string-state recovery retain full projection writes.
- **Rendering and data flow:** unchanged attempts, public marks and match data retain their references across snapshots. Memoized boards, phrase rows, keyboard and static chrome avoid work on clock ticks. Phrase metadata and keyboard feedback are computed only when their inputs change. Older responses cannot replace newer revisions or move the synchronized clock backward.
- **Phrase scoring:** replace repeated answer scans and array allocations with per-word and total occurrence counts. Three linear passes preserve green-first, same-word orange, then cross-word blue allocation, including duplicate letters.
- **Startup and bots:** load the Supabase browser SDK only when hosted authentication requires it. Bot ranking computes each candidate's unique letters once, preserving ordering, randomness and difficulty behavior.
- **Maintenance:** share radio-option markup across Words, Phrases and bot difficulty settings; precompute the static phrase example; remove redundant icon and bot-timing aliases and unused test imports.

No dependencies, migrations, dictionaries, CSS, game rules, difficulty settings, scoring weights, polling intervals or bot timing ranges were changed.

## Evidence

A two-player heartbeat previously issued **10 + the number of saved guesses** persistence statements. It now issues **3** when only the sender's presence changes: participant presence, private state, and the public revision event. Authentication, rate limiting, locking and clock reads remain separate and unchanged.

The phrase scorer is now linear in the number of letters instead of repeatedly searching the answer. An ad hoc local benchmark, using 2,000 warm-up calls and 20,000 measured calls per implementation, compared the original branch with this implementation:

| Input                                                                           |   Before |  After |
| ------------------------------------------------------------------------------- | -------: | -----: |
| 27 letters: ACTIONS SPEAK LOUDER THAN WORDS / CAPTION BREAK MOTHER THEN WORLD   |   162 ms |  80 ms |
| 105 letters: seven ABABABABABABABA words / BACBACBACBACBAC repeated seven times | 1,797 ms | 176 ms |

These are illustrative single-machine timings, not an end-to-end latency guarantee. Regression tests compare the optimized scorer with an independent positional reference across 2,000 deterministic, duplicate-heavy inputs.

## Validation

- Baseline: **225 tests passed**.
- Final unit, component, API and database suite: **252 tests passed** across 24 files.
- `pnpm typecheck`, `pnpm lint` (zero warnings), `pnpm build`, and `pnpm format:check` passed.
- Additional TypeScript checks with `--noUnusedLocals --noUnusedParameters` and `git diff --check` passed.
- New coverage verifies persistence statement reduction, append numbering, rematch projections, full legacy writes, stale snapshots, opponent privacy, same-revision timeouts, polling coalescence, heartbeat cleanup, reconnection, authentication initialization, keyboard guards, input limits, disabled game phases and idempotent submission retries.
- `pnpm test:e2e`: **30 browser tests passed** across desktop and mobile (6.0 minutes), including accessibility, both game types, all difficulty modes, human/bot play, reconnects, validation, completion and rematches.
- Existing database coverage exercises real PGlite transactions, concurrency, duplicate requests, bots, timeouts, difficulty persistence, RLS and the Postgres.js socket driver.
- Manual production-server checks verified six-letter Words duel and Easy Phrases co-op with bots: room creation, readiness, countdown, physical/on-screen input, invalid entries, feedback colors, bonuses, saved progress after reload, results and rematches. Browser diagnostics were empty. Screenshots were inspected for desktop and narrow-screen layout.

Hosted Supabase Auth/Realtime was not exercised against a live remote project. Authentication behavior is covered with client tests, and PostgreSQL persistence with the existing real-driver integration tests; browser gameplay runs against the real local API and PGlite backend.
