# Changelog

## 1.1.1 — 2026-09-13

- Expand accepted guesses from 1,049 to 14,856 by merging the official Wordle client word list with the existing dictionary.
- Accept IRATE, PLOWS, LOOPS, and 13,804 other newly available guesses while retaining every original entry.
- Keep the 825 possible answers, bot behavior, scoring, and multiplayer rules unchanged.
- Record the source asset and checksum and add validation and multiplayer browser coverage for the reported words.
- No database migration or new configuration is required.

## 1.1.0 — 2026-09-13

- Build on v1.0.1, retaining the hosted JSON persistence fix, recovery of affected rooms, and production-driver regression tests.
- Automatically fill a room's empty second seat with Pip after 45 seconds.
- Add a server-based lobby countdown and visible bot labels in the lobby, game, and results.
- Give bots independent, feedback-based guesses at 8–12 second intervals, using the existing scoring and match rules.
- Persist bot identity and move scheduling so refreshes, reconnects, and simultaneous requests cannot restart timers or duplicate turns.
- Automatically ready bots and accept rematches while preserving the human player's readiness and rematch choice.
- Preserve human-vs-human matches, private invitations, capacity, co-op, result privacy, and human reconnection behavior.
- Add the backwards-compatible `players.is_bot` database migration, regression tests, and real 45-second browser-flow tests.

Existing Supabase deployments must apply `202609110001_bots.sql` before this version. Local databases upgrade automatically on startup.
