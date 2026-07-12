# Semantic search (pgvector)

`GET /api/v1/search?semantic=true` runs a pgvector nearest-neighbor query over
record embeddings instead of a keyword `LIKE` scan. It **always degrades to
keyword search** when semantic search can't actually run — the response's
`facets.mode` tells you which path executed:

- `semantic` — a real pgvector query ran.
- `keyword-fallback` — `semantic=true` was requested but semantic search was
  unavailable, so keyword search ran instead.
- `keyword` — `semantic` wasn't requested.

## Requirements

Semantic search is **off by default** and only ever activates when *all* of
these hold:

1. The database driver is `pgsql` (never on sqlite — including CI/tests).
2. The `vector` extension is installed (`CREATE EXTENSION IF NOT EXISTS vector`,
   done automatically by the `record_embeddings` migration on Postgres).
3. `EMBEDDINGS_ENABLED=true`.
4. `OPENAI_API_KEY` (or your configured embeddings key) is set.

If any of these is missing, `EmbeddingService::isEnabled()` returns `false`
and every embedding/search call becomes a safe no-op.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `EMBEDDINGS_ENABLED` | `false` | Master switch. |
| `EMBEDDINGS_PROVIDER` | `openai` | Informational; requests always use the OpenAI-compatible embeddings endpoint shape. |
| `EMBEDDINGS_MODEL` | `text-embedding-3-small` | Passed to the embeddings API. |
| `EMBEDDINGS_DIMENSIONS` | `1536` | Must match the model's output size and the `vector(N)` column created by the migration. |
| `EMBEDDINGS_BASE_URL` | `https://api.openai.com/v1` | Override for OpenAI-compatible endpoints (OpenRouter, local proxies). |
| `OPENAI_API_KEY` | _(unset)_ | Reused from the OpenAI key — no separate embeddings key. |

## Backfilling embeddings

```bash
php artisan embeddings:sync --store=records
```

Iterates `storage_rows` for the given store, extracts `title` / `description`
/ `body` / `summary` / `notes` text from each record's `data` JSON, and
upserts an embedding when the content has changed (a `content_hash` skips
unchanged rows on repeat runs). Prints a `processed / embedded /
skipped-unchanged` summary and exits `0` even when embeddings are disabled,
so it's safe to run in any environment/cron.

## Known ceiling

Semantic search runs a single ANN pass (cosine distance via HNSW) with no
hybrid/re-ranking against keyword relevance. Pagination beyond the top
ranked pool (`limit * 5`, minimum 100) falls off — acceptable for a search
UI; revisit if deep pagination through semantic results becomes a real need.
