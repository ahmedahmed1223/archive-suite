#!/bin/sh
set -eu

CONFIG_DB=/var/lib/pgadmin/pgadmin4.db
EMAIL=${PGADMIN_DEFAULT_EMAIL:?PGADMIN_DEFAULT_EMAIL is required}
PASSWORD=${PGADMIN_DEFAULT_PASSWORD:?PGADMIN_DEFAULT_PASSWORD is required}

mkdir -p /var/lib/pgadmin

# A fresh volume is initialized by the image's official entrypoint. An existing
# volume needs an explicit password reconciliation because PGADMIN_DEFAULT_*
# values are only applied on first launch.
if [ -f "$CONFIG_DB" ]; then
  /venv/bin/python /opt/archive/pgadmin-sync-user.py "$EMAIL" "$PASSWORD" "$CONFIG_DB"
else
  echo "Fresh pgAdmin volume detected; the main entrypoint will create the user."
fi

# pgAdmin uses this libpq passfile for the bundled Archive Postgres server.
printf '%s:%s:*:%s:%s\n' \
  "${POSTGRES_HOST:-postgres}" \
  "${POSTGRES_PORT:-5432}" \
  "${POSTGRES_USER:-archive}" \
  "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}" \
  > /var/lib/pgadmin/pgpass
chmod 600 /var/lib/pgadmin/pgpass

USER_CONFIG_DIR=$(printf '%s' "$EMAIL" | sed 's/@/_/g')
mkdir -p "/var/lib/pgadmin/storage/$USER_CONFIG_DIR"
cp /var/lib/pgadmin/pgpass "/var/lib/pgadmin/storage/$USER_CONFIG_DIR/.pgpass"
chmod 600 "/var/lib/pgadmin/storage/$USER_CONFIG_DIR/.pgpass"
