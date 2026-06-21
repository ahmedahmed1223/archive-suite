#!/usr/bin/env bash
# Archive Suite — Linux/macOS Control Center launcher.
# Usage: bash setup.sh                  # open the management console (Deploy is option 1)
#        bash setup.sh status|start|stop|restart|logs|health|deploy|diagnostics|config|backup
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

exec node scripts/control-center.mjs "$@"
