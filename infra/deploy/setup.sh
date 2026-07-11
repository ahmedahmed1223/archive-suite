#!/usr/bin/env sh
# Zero-config setup for the bundled-PostgreSQL server edition.
#
#   sh deploy/setup.sh            # generate .env with strong random secrets
#   docker compose -f docker-compose.postgres.yml up -d --build
#
# Creates .env from .env.example and fills in strong RANDOM secrets so the
# bundled Postgres "just works" out of the box. It NEVER overwrites an existing
# .env. The generated admin password is printed once — change it from .env or
# later from the program's Settings → Database screen if you wish.
set -eu

cd "$(dirname "$0")/.."   # repo root (archive-server)
ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

if [ -f "$ENV_FILE" ]; then
  echo "ℹ .env موجود مسبقًا — لن يُستبدَل. احذفه يدويًّا إن أردت إعادة التوليد."
  echo "  للتشغيل:  docker compose -f docker-compose.postgres.yml up -d --build"
  exit 0
fi
[ -f "$EXAMPLE_FILE" ] || { echo "✗ لم يُعثر على $EXAMPLE_FILE" >&2; exit 1; }

# --- portable random generators ------------------------------------------------
rand_alnum() { # $1 = length (default 32) — URL-safe, no escaping needed
  len="${1:-32}"
  if [ -r /dev/urandom ]; then
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | dd bs=1 count="$len" 2>/dev/null
  elif command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$((len * 2))" | tr -dc 'A-Za-z0-9' | cut -c1-"$len"
  else
    echo "fallback$(date +%s)$$" | cksum | tr -dc 'A-Za-z0-9' | cut -c1-"$len"
  fi
}
rand_secret() { # base64url, ~48 bytes for JWT
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
  else
    rand_alnum 64
  fi
}

# --- set KEY=VALUE in a file (replace if present, else append) -----------------
set_env() {
  key="$1"; val="$2"; file="$3"
  awk -v k="$key" -v v="$val" '{ if (index($0, k"=") == 1) print k"="v; else print }' "$file" > "$file.tmp"
  mv "$file.tmp" "$file"
}

cp "$EXAMPLE_FILE" "$ENV_FILE"

PG_PASS="$(rand_alnum 32)"
ADMIN_PASS="$(rand_alnum 20)"
JWT="$(rand_secret)"

set_env "BACKEND" "postgres" "$ENV_FILE"
set_env "DOMAIN" "localhost" "$ENV_FILE"
set_env "POSTGRES_USER" "archive" "$ENV_FILE"
set_env "POSTGRES_PASSWORD" "$PG_PASS" "$ENV_FILE"
set_env "POSTGRES_DB" "archive" "$ENV_FILE"
set_env "DATABASE_URL" "postgresql://archive:${PG_PASS}@postgres:5432/archive" "$ENV_FILE"
set_env "JWT_SECRET" "$JWT" "$ENV_FILE"
set_env "ADMIN_USERNAME" "admin" "$ENV_FILE"
set_env "ADMIN_PASSWORD" "$ADMIN_PASS" "$ENV_FILE"
set_env "FILE_STORE" "disk" "$ENV_FILE"

chmod 600 "$ENV_FILE" 2>/dev/null || true

cat <<EOF

✓ أُنشئ .env بإعدادات افتراضية آمنة (Postgres مُجمَّع).

  مستخدم الدخول:   admin
  كلمة مرور الدخول: ${ADMIN_PASS}

  ⚠ احفظ كلمة المرور الآن. يمكنك تغييرها لاحقًا من .env أو من
     «الإعدادات ← قاعدة البيانات/الأمان» داخل البرنامج.

  كلمتا مرور Postgres وJWT وُلِّدتا عشوائيًّا داخل .env.

التشغيل:
  docker compose -f docker-compose.postgres.yml up -d --build

للتحويل إلى خادم SQL خارجي لاحقًا: عدّل DATABASE_URL في .env (أو من إعدادات
البرنامج)، ثم أعد التشغيل.
EOF
