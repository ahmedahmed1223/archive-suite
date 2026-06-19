#!/bin/sh
set -eu

ensure_writable_dir() {
  dir="$1"
  mkdir -p "$dir"
  chown -R node:node "$dir"
  chmod 750 "$dir"
}

ensure_writable_dir /app/.archive-files
ensure_writable_dir /app/config
ensure_writable_dir "${FILE_STORE_DIR:-/app/files}"

exec su-exec node "$@"
