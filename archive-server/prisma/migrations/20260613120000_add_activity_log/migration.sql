-- Migration: activity_log (§18.1)
-- Server-side mirror of the client IndexedDB `activity_log` store so cloud
-- deployments can sync the unified activity timeline. before/after are full
-- JSONB snapshots; diff is a field-level { key: { before, after } } map.

CREATE TABLE IF NOT EXISTS "activity_log" (
  "id"          TEXT         NOT NULL,
  "timestamp"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user_id"     TEXT         NOT NULL,
  "user_name"   TEXT         NOT NULL,
  "user_role"   TEXT,
  "session_id"  TEXT,
  "action"      TEXT         NOT NULL,
  "target_type" TEXT         NOT NULL,
  "target_id"   TEXT,
  "target_name" TEXT         NOT NULL DEFAULT '',
  "before"      JSONB,
  "after"       JSONB,
  "diff"        JSONB,
  "related_ids" JSONB,
  "undoable"    BOOLEAN      NOT NULL DEFAULT false,
  "undone"      BOOLEAN      NOT NULL DEFAULT false,
  "undone_by"   TEXT,
  "undone_at"   TIMESTAMP(3),
  "context"     JSONB,

  CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "activity_log_timestamp_idx"   ON "activity_log"("timestamp");
CREATE INDEX IF NOT EXISTS "activity_log_user_id_idx"     ON "activity_log"("user_id");
CREATE INDEX IF NOT EXISTS "activity_log_target_type_idx" ON "activity_log"("target_type");
CREATE INDEX IF NOT EXISTS "activity_log_action_idx"      ON "activity_log"("action");
CREATE INDEX IF NOT EXISTS "activity_log_target_id_idx"   ON "activity_log"("target_id");
