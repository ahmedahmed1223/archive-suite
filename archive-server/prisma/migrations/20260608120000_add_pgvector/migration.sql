-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to the storage rows table
-- Using 1536 dimensions (OpenAI text-embedding-3-small default)
-- This is nullable so existing rows don't need immediate backfill
ALTER TABLE "storage_rows"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Index for approximate nearest-neighbor search (IVFFlat)
-- ef_construction and lists tuned for ~100K rows
CREATE INDEX IF NOT EXISTS "storage_rows_embedding_idx"
  ON "storage_rows"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
