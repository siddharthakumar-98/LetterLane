# UI optimization

This pass stays on `optimization` and builds on the earlier code optimization.

## Layout

- Words and Phrases now pair a compact introduction and feedback example with the setup form on desktop. Game difficulty and bot difficulty share a row. At 960px and below the introduction stacks above setup; at 640px and below the form becomes a single column.
- Shorter headers, restrained typography, consistent control heights and tighter spacing bring the create-room action above the fold at the tested laptop and desktop sizes. Mobile controls retain generous touch targets.
- Removed the competition tagline, “I got it!” caption, sparkles, redundant sample decoration and their unused styles. Feedback examples, color explanations, help dialogs, game choices and all gameplay features remain available.
- Lobbies and results use less ornamental space. Results cards stack on phones so long player names and seven-letter boards remain readable. Countdown overlays and keyboards stay within their lane boundaries.
- Lobby instructions now display the selected word length and phrase difficulty.

The home grid has named `intro`, `setup` and `support` areas. A future optional ad or support module can occupy the full-width `support` row, below the current content, without restructuring the form. The unpopulated row reserves no height. No advertising, tracking, dependencies or game-rule changes were added.

## Validation

- `pnpm check`: type checking, zero-warning linting, all 252 unit/component/API/database tests, and the production build.
- Final `pnpm test:e2e` run: **42 passed** in 6.4 minutes, with 12 intentionally skipped duplicate mobile matrix cases (the matrix itself already runs mobile widths). Four timeouts during long execution pauses in the initial run did not recur in the complete rerun with idle sleep prevented.
- `pnpm format:check` and `git diff --check` passed.
- The existing browser suite exercises real local API/database gameplay on desktop and mobile: joining, human and bot play, all difficulties, keyboard input, validation, reconnection, scoring, results and rematches.
- `tests/e2e/responsive.spec.ts` adds 12 browser tests. Home pages and help dialogs are checked at 320, 390, 640, 768, 960, 1024, 1280, 1440 and 1920px. Each word length and both phrase difficulties are checked in duel and co-op across lobby, countdown, active and complete phases at six representative widths. These layout tests use stable public room snapshots; they supplement the real gameplay suite.
- Responsive assertions cover document/component overflow, desktop columns, mobile stacking, above-the-fold desktop creation, dialog containment and keyboard target height. Screenshots are saved under the ignored `test-results/` directory for visual review.
- Manual browser checks cover desktop/laptop and narrow mobile layouts, Words seven-letter co-op and Easy Phrases duel, room creation, readiness, bot selection, physical/touch input, validation, help, results and rematch. Browser warning/error diagnostics were empty.

Browser testing uses Chromium and the local PGlite backend. It does not establish Safari/Firefox or live hosted Supabase coverage.
