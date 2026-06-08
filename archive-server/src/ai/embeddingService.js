/**
 * Embedding service — generates vector embeddings for archive records.
 * Uses the configured AI provider's embedding model, or falls back to null.
 *
 * pgvector requires float arrays; we call the OpenAI embeddings endpoint
 * directly since the Vercel AI SDK's generateEmbedding is the clean path.
 *
 * Everything here is optional / best-effort: if the API key is missing,
 * the model is unavailable, or pgvector isn't installed, the app continues
 * to work — only semantic search is degraded (returns empty results).
 */
import { createLogger } from "../logger.js";
import { Prisma } from "../generated/prisma/client.js";

const log = createLogger("embeddings");

// Embedding model to use (1536 dimensions)
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_API_KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";

/**
 * Generate an embedding vector for a text string.
 * Returns null if embedding is unavailable (no key, model error, etc.).
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
export async function generateEmbedding(text) {
  if (!EMBEDDING_API_KEY || !text) return null;
  try {
    const { generateEmbedding: gen } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const openai = createOpenAI({ apiKey: EMBEDDING_API_KEY });
    const { embedding } = await gen({
      model: openai.embedding(EMBEDDING_MODEL),
      value: String(text).slice(0, 8000), // limit tokens
    });
    return embedding;
  } catch (err) {
    log.warn({ err: err.message }, "Embedding generation failed — skipping.");
    return null;
  }
}

/**
 * Build searchable text from a StorageRow record.
 * Concatenates title, description, summary, ocrText and tags
 * from both the top-level record and its nested `data` field.
 * @param {object} record
 * @returns {string}
 */
export function buildEmbeddingText(record) {
  if (!record || typeof record !== "object") return "";
  const data = record.data && typeof record.data === "object" ? record.data : {};
  const parts = [
    record.title || data.title || data.name || "",
    record.description || data.description || data.summary || "",
    data.ocrText || data.transcription || "",
    (Array.isArray(data.tags) ? data.tags.join(" ") : ""),
  ];
  return parts.filter(Boolean).join(" ").trim().slice(0, 8000);
}

/**
 * Semantic search using cosine similarity via pgvector.
 * Generates an embedding for `query`, then finds the closest rows.
 * Returns [] gracefully if embeddings are unavailable or pgvector isn't installed.
 *
 * @param {object} prisma - Prisma client
 * @param {string} query - Search query text
 * @param {{ store?: string, limit?: number }} opts
 * @returns {Promise<Array<{uid: string, similarity: number}>>}
 */
export async function semanticSearch(prisma, query, { store, limit = 20 } = {}) {
  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  try {
    if (!Array.isArray(embedding) || !embedding.every(n => typeof n === "number" && isFinite(n))) {
      throw new Error("Invalid embedding: expected finite number array");
    }
    const vectorStr = `[${embedding.join(",")}]`;
    const rows = store
      ? await prisma.$queryRaw`
          SELECT uid, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM "storage_rows"
          WHERE embedding IS NOT NULL
            AND store = ${store}
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${limit}
        `
      : await prisma.$queryRaw`
          SELECT uid, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM "storage_rows"
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${limit}
        `;
    return rows.map(r => ({ uid: r.uid, similarity: Number(r.similarity) }));
  } catch (err) {
    log.warn({ err: err.message }, "Semantic search query failed.");
    return [];
  }
}
