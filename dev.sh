#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Use an installed Node runtime, or Codex's existing bundled runtime on this Mac.
if ! command -v node >/dev/null 2>&1; then
  LETTERLANE_RUNTIME="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
  if [ -x "$LETTERLANE_RUNTIME/node/bin/node" ]; then
    PATH="$LETTERLANE_RUNTIME/node/bin:$LETTERLANE_RUNTIME/bin/fallback:$PATH"
    export PATH
  else
    echo 'Install Node.js 24 LTS and pnpm 11, then run pnpm install and pnpm dev.'
    exit 1
  fi
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo 'Install pnpm 11 (npm install -g pnpm@11.19.0), then run this script again.'
  exit 1
fi
if [ ! -d node_modules ]; then pnpm install --frozen-lockfile; fi
exec pnpm dev "$@"
