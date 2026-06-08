-- Migration: saved_filters table for Smart Collections (Task 69)
CREATE TABLE IF NOT EXISTS "saved_filters" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "name"       TEXT        NOT NULL,
  "query"      JSONB       NOT NULL DEFAULT '{}',
  "is_live"    BOOLEAN     NOT NULL DEFAULT false,
  "owner_id"   TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_saved_filters_owner" ON "saved_filters" ("owner_id");
