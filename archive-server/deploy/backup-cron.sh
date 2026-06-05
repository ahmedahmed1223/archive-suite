#!/bin/sh
# Daily backup script for archive-server.
#
# Backs up:
#   - PocketBase: the pb_data volume (entire SQLite db + uploaded files)
#   - Postgres:   a pg_dump of the archive database
# Whichever backend is running gets backed up; missing services are skipped.
#
# Output: ${BACKUP_DIR}/YYYY-MM-DD/{pocketbase.tar.gz,postgres.sql.gz}
# Retains the last RETAIN_DAYS days (default 14).

set -eu

BACKUP_ROOT="${BACKUP_DIR:-/home/archive/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
TODAY="$(date -u +%Y-%m-%d)"
DEST="${BACKUP_ROOT}/${TODAY}"
mkdir -p "${DEST}"

# --- PocketBase backup ---
if docker ps --format '{{.Names}}' | grep -q '^archive-pocketbase$'; then
  echo "[$(date -u)] Backing up PocketBase volume..."
  docker run --rm \
    --volumes-from archive-pocketbase \
    -v "${DEST}:/backup" \
    alpine \
    tar czf "/backup/pocketbase.tar.gz" -C /pb_data .
  echo "  ✓ pocketbase.tar.gz ($(du -h "${DEST}/pocketbase.tar.gz" | cut -f1))"
fi

# --- Postgres backup ---
if docker ps --format '{{.Names}}' | grep -q '^archive-postgres$'; then
  echo "[$(date -u)] Backing up Postgres database..."
  # Source env to get POSTGRES_USER/DB. Falls back to defaults if .env missing.
  if [ -f "/home/archive/archive-server/.env" ]; then
    # shellcheck disable=SC1091
    . "/home/archive/archive-server/.env"
  fi
  PG_USER="${POSTGRES_USER:-archive}"
  PG_DB="${POSTGRES_DB:-archive}"
  docker exec archive-postgres \
    pg_dump -U "${PG_USER}" -d "${PG_DB}" --no-owner --no-privileges \
    | gzip > "${DEST}/postgres.sql.gz"
  echo "  ✓ postgres.sql.gz ($(du -h "${DEST}/postgres.sql.gz" | cut -f1))"
fi

# --- Rotation: drop backups older than RETAIN_DAYS ---
find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "20*-*-*" -mtime "+${RETAIN_DAYS}" -exec rm -rf {} +

echo "[$(date -u)] Backup complete. Retained last ${RETAIN_DAYS} days under ${BACKUP_ROOT}."
