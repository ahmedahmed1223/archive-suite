-- §16.15 — derived_files table for server-side format conversion tracking.
-- Stores one row per conversion output file linked to the source archive item.
-- Status lifecycle: pending → processing → completed | failed.

CREATE TABLE IF NOT EXISTS "derived_files" (
    "id"              TEXT         NOT NULL,
    "source_item_id"  TEXT,
    "source_key"      TEXT         NOT NULL,
    "output_key"      TEXT,
    "conversion_type" TEXT         NOT NULL,
    "label"           TEXT         NOT NULL DEFAULT '',
    "mime_type"       TEXT,
    "file_size_bytes" BIGINT,
    "status"          TEXT         NOT NULL DEFAULT 'pending',
    "job_id"          TEXT,
    "error_message"   TEXT,
    "created_by"      TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"    TIMESTAMP(3),

    CONSTRAINT "derived_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "derived_files_source_item_id_idx" ON "derived_files"("source_item_id");
CREATE INDEX IF NOT EXISTS "derived_files_source_key_idx"      ON "derived_files"("source_key");
CREATE INDEX IF NOT EXISTS "derived_files_status_idx"          ON "derived_files"("status");
CREATE INDEX IF NOT EXISTS "derived_files_job_id_idx"          ON "derived_files"("job_id");
