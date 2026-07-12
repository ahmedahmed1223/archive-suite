#!/usr/bin/env sh
# Compatibility launcher for operators following older infra/deploy links.
# All installation and deployment now go through the canonical Control Center
# and infra/docker-compose.yml at the repository root.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
exec bash "$ROOT/setup.sh" "$@"
