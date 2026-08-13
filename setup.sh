#!/usr/bin/env bash
# Archive Suite - Linux/macOS Control Center launcher.
# Operates the canonical Laravel + Next.js stack (infra/docker-compose.yml).
# Usage: bash setup.sh                  # open the management console (Quick start is option 1)
#        bash setup.sh status|start|stop|restart|logs|health|deploy|diagnostics|config|backup
#        bash setup.sh generate-password
#        bash setup.sh change-admin-password --generate
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "  [X] Node.js not found. Install Node from https://nodejs.org then re-run." >&2
  exit 1
fi

# infra/platform/toolchain.v1.json is the single source of truth for the
# minimum Node version (mirrored by scripts/node-version.mjs); read it
# through that module instead of hardcoding a number here.
if ! node -e '
  import("./scripts/node-version.mjs").then(({ isSupportedNodeVersion, MIN_NODE_VERSION }) => {
    if (!isSupportedNodeVersion()) {
      console.error("  [X] Node " + MIN_NODE_VERSION.split(".")[0] + "+ required (found " + process.version + ").");
      process.exit(1);
    }
  });
'; then
  exit 1
fi

exec node scripts/control-center.mjs "$@"
