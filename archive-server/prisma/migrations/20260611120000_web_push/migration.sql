-- Migration: web_push (§20.2)
-- 1) Per-type Web Push preferences on notification_preferences (default on).
-- 2) push_subscriptions table — one row per browser/device endpoint.

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "push_on_share"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "push_on_upload"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "push_on_mention" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "push_on_system"  BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"    TEXT        NOT NULL,
  "endpoint"   TEXT        NOT NULL,
  "p256dh"     TEXT        NOT NULL,
  "auth"       TEXT        NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint")
);

CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
