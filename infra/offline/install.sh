#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
sha256sum --check SHA256SUMS
for archive in images/*.tar; do docker image load --input "$archive" >/dev/null; done
[ -f .env ] || ARCHIVE_VERSION="$(cat VERSION)" node generate-env.mjs .env
docker compose --env-file .env -f compose.v1.yml config --quiet
echo "تم التحميل والتحقق. شغّل: docker compose --env-file .env -f compose.v1.yml up -d"
