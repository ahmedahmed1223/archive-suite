-- Typed schema evolution: strongly-typed tables alongside StorageRow
-- These tables are optional/parallel — StorageRow is unchanged.

CREATE TABLE IF NOT EXISTS "typed_users" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "username"      TEXT         NOT NULL,
  "displayName"   TEXT,
  "email"         TEXT,
  "role"          TEXT         NOT NULL DEFAULT 'viewer',
  "isActive"      BOOLEAN      NOT NULL DEFAULT true,
  "passwordHash"  TEXT         NOT NULL DEFAULT '',
  "totpSecret"    TEXT,
  "totpEnabled"   BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "typed_users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "typed_users_username_key" UNIQUE ("username"),
  CONSTRAINT "typed_users_email_key" UNIQUE ("email")
);

CREATE INDEX IF NOT EXISTS "typed_users_role_idx" ON "typed_users" ("role");
CREATE INDEX IF NOT EXISTS "typed_users_isActive_idx" ON "typed_users" ("isActive");

CREATE TABLE IF NOT EXISTS "typed_archive_items" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "store"         TEXT         NOT NULL,
  "title"         TEXT         NOT NULL,
  "description"   TEXT,
  "documentType"  TEXT,
  "mimeType"      TEXT,
  "fileKey"       TEXT,
  "fileSizeBytes" BIGINT,
  "pageCount"     INTEGER,
  "tags"          TEXT[]       NOT NULL DEFAULT '{}',
  "categoryId"    TEXT,
  "ocrText"       TEXT,
  "summary"       TEXT,
  "isDeleted"     BOOLEAN      NOT NULL DEFAULT false,
  "deletedAt"     TIMESTAMPTZ,
  "syncVersion"   INTEGER      NOT NULL DEFAULT 0,
  "ownerId"       TEXT,
  "metadata"      JSONB,
  "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "typed_archive_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "typed_archive_items_store_idx" ON "typed_archive_items" ("store");
CREATE INDEX IF NOT EXISTS "typed_archive_items_isDeleted_idx" ON "typed_archive_items" ("isDeleted");
CREATE INDEX IF NOT EXISTS "typed_archive_items_createdAt_idx" ON "typed_archive_items" ("createdAt");
CREATE INDEX IF NOT EXISTS "typed_archive_items_store_isDeleted_idx" ON "typed_archive_items" ("store", "isDeleted");
CREATE INDEX IF NOT EXISTS "typed_archive_items_categoryId_idx" ON "typed_archive_items" ("categoryId");

-- GIN index for full-text search on typed items
CREATE INDEX IF NOT EXISTS "typed_archive_items_title_gin" ON "typed_archive_items" USING gin(to_tsvector('arabic', "title"));

CREATE TABLE IF NOT EXISTS "typed_content_types" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "name"        TEXT        NOT NULL,
  "label"       TEXT        NOT NULL,
  "icon"        TEXT,
  "color"       TEXT,
  "isBuiltIn"   BOOLEAN     NOT NULL DEFAULT false,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "sortOrder"   INTEGER     NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "typed_content_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "typed_content_types_name_key" UNIQUE ("name")
);

CREATE INDEX IF NOT EXISTS "typed_content_types_isActive_idx" ON "typed_content_types" ("isActive");

-- Seed built-in content types
INSERT INTO "typed_content_types" ("name", "label", "icon", "isBuiltIn", "sortOrder") VALUES
  ('video',     'فيديو',         '🎬', true, 1),
  ('image',     'صورة',          '🖼',  true, 2),
  ('document',  'مستند',         '📄', true, 3),
  ('pdf',       'PDF',           '📑', true, 4),
  ('audio',     'صوت',           '🎵', true, 5),
  ('other',     'أخرى',          '📁', true, 99)
ON CONFLICT ("name") DO NOTHING;
