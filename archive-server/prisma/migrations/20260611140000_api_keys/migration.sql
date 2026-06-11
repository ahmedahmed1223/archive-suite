-- Migration: api_keys (§20.5)
-- Programmatic API keys for external read access, separate from user JWTs.
-- Only the SHA-256 hash is stored; the plaintext key is shown once at creation.

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "name"         TEXT        NOT NULL,
  "key_hash"     TEXT        NOT NULL,
  "prefix"       TEXT        NOT NULL,
  "scopes"       TEXT[]      NOT NULL DEFAULT ARRAY['read']::TEXT[],
  "owner_id"     TEXT        NOT NULL,
  "active"       BOOLEAN     NOT NULL DEFAULT true,
  "last_used_at" TIMESTAMP(3),
  "expires_at"   TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash")
);

CREATE INDEX IF NOT EXISTS "api_keys_owner_id_idx" ON "api_keys"("owner_id");
