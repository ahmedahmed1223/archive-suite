-- Migration: item_relations (§18.5)
-- Manual semantic links between archive items, used by the item detail panel
-- and the global cytoscape graph view.

CREATE TABLE IF NOT EXISTS "item_relations" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "source_id"  TEXT         NOT NULL,
  "target_id"  TEXT         NOT NULL,
  "type"       TEXT         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "note"       TEXT,

  CONSTRAINT "item_relations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "item_relations_source_id_target_id_type_key" UNIQUE ("source_id", "target_id", "type")
);

CREATE INDEX IF NOT EXISTS "item_relations_source_id_idx" ON "item_relations"("source_id");
CREATE INDEX IF NOT EXISTS "item_relations_target_id_idx" ON "item_relations"("target_id");
