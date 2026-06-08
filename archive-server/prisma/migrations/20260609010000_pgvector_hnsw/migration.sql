-- Migrate pgvector index from IVFFlat to HNSW.
-- IVFFlat requires at least ~100 rows before index creation;
-- HNSW works on empty tables and has better recall at query time.

DROP INDEX IF EXISTS "storage_rows_embedding_idx";

CREATE INDEX IF NOT EXISTS "storage_rows_embedding_hnsw_idx"
  ON "storage_rows"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
