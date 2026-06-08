CREATE TABLE IF NOT EXISTS "webhooks" (
  "id"         TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "url"        TEXT        NOT NULL,
  "events"     TEXT[]      NOT NULL DEFAULT '{}',
  "secret"     TEXT        NOT NULL,
  "active"     BOOLEAN     NOT NULL DEFAULT true,
  "owner_id"   TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_webhooks_owner" ON "webhooks" ("owner_id");
