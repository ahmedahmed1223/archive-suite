#!/usr/bin/env bash
# Archive Suite — Linux/macOS guided deployment launcher.
# Usage: bash setup.sh                       # interactive wizard
#        bash setup.sh --public --domain=... # see scripts/deploy-wizard.mjs for flags
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "  [X] Node.js not found. Install Node 22+ from https://nodejs.org then re-run." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "  [X] Node 22+ required (found $(node -v))." >&2
  exit 1
fi

exec node scripts/deploy-wizard.mjs "$@"
