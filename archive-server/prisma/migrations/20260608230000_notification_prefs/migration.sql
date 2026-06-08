-- Migration: notification_preferences
-- Adds per-user email notification preferences table.
-- Defaults: emailOnShare=true, emailOnUpload=false, emailOnMention=true

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"               TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"          TEXT    NOT NULL,
  "email_on_share"   BOOLEAN NOT NULL DEFAULT true,
  "email_on_upload"  BOOLEAN NOT NULL DEFAULT false,
  "email_on_mention" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id")
);
