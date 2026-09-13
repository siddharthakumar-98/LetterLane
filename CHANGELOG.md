# Changelog

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
