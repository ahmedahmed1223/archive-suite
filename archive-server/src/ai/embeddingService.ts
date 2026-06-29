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
import { config } from "../config/env.js";

const log = createLogger("embeddings");

// Embedding model to use (1536 dimensions)
const EMBEDDING_MODEL = config.embeddingModel;
const EMBEDDING_API_KEY = config.openaiApiKey;

interface StorageRecord {
  title?: string;
  description?: string;
  data?: {
    title?: string;
    name?: string;
    description?: string;
    summary?: string;
    ocrText?: string;
    transcription?: string;
    tags?: string[];
  };
}

interface SimilarityResult {
  uid: string;
  similarity: number;
}

/**
 * Generate an embedding vector for a text string.
 * Returns null if embedding is unavailable (no key, model error, etc.).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!EMBEDDING_API_KEY || !text) return null;
  try {
    const aiModule = await import("ai") as Record<string, unknown>;
    const gen = aiModule.generateEmbedding as (opts: {
      model: unknown;
      value: string;
    }) => Promise<{ embedding: number[] }>;
    const { createOpenAI } = await import("@ai-sdk/openai");
    const openai = createOpenAI({ apiKey: EMBEDDING_API_KEY });
    const { embedding } = await gen({
      model: openai.embedding(EMBEDDING_MODEL),
      value: String(text).slice(0, 8000), // limit tokens
    });
    return embedding;
  } catch (err) {
    const error = err as Error | null;
    log.warn({ err: error?.message }, "Embedding generation failed — skipping.");
    return null;
  }
}

/**
 * Build searchable text from a StorageRow record.
 * Concatenates title, description, summary, ocrText and tags
 * from both the top-level record and its nested `data` field.
 */
export function buildEmbeddingText(record: StorageRecord): string {
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
 */
export async function semanticSearch(
  prisma: typeof Prisma,
  query: string,
  { store, limit = 20 }: { store?: string; limit?: number } = {}
): Promise<SimilarityResult[]> {
  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  try {
    if (!Array.isArray(embedding) || !embedding.every(n => typeof n === "number" && isFinite(n))) {
      throw new Error("Invalid embedding: expected finite number array");
    }
    const vectorStr = `[${embedding.join(",")}]`;
    const prismaClient = prisma as any;
    const rows = store
      ? await prismaClient.$queryRaw<Array<{ uid: string; similarity: string | number }>>`
          SELECT uid, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM "storage_rows"
          WHERE embedding IS NOT NULL
            AND store = ${store}
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${limit}
        `
      : await prismaClient.$queryRaw<Array<{ uid: string; similarity: string | number }>>`
          SELECT uid, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM "storage_rows"
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${limit}
        `;
    return rows.map((r: { uid: string; similarity: string | number }) => ({ uid: r.uid, similarity: Number(r.similarity) }));
  } catch (err) {
    const error = err as Error | null;
    log.warn({ err: error?.message }, "Semantic search query failed.");
    return [];
  }
}
