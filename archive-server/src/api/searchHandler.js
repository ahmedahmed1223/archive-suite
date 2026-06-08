/**
 * Server-side search with Arabic text normalization.
 * GET /api/v1/search?q=query&store=archive_items&cursor=&limit=20&semantic=true
 *
 * Arabic normalization:
 *  - Remove tashkeel (diacritics): [ً-ٰٟ]
 *  - Normalize alef variants (أإآ) → ا
 *  - Normalize ya variants (ى) → ي
 *  - Normalize ta marbuta (ة) → ه
 *  - Trim and lowercase
 *
 * Semantic search (opt-in, Postgres only):
 *  - Add ?semantic=true to request vector similarity search via pgvector.
 *  - Falls back to full-text search if embeddings are unavailable.
 */

import { createLogger } from "../logger.js";
import { cacheGet, cacheSet, TTL } from "../cache/redisCache.js";
import { semanticSearch } from "../ai/embeddingService.js";

const log = createLogger("search");

/**
 * Normalize Arabic text for search matching.
 * Applied to both the query and (in SQL) the stored data.
 */
export function normalizeArabic(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[ً-ٰٟ]/g, "")  // remove tashkeel
    .replace(/[أإآ]/g, "ا")                  // normalize alef
    .replace(/ى/g, "ي")                      // normalize ya
    .replace(/ة/g, "ه")                      // normalize ta marbuta
    .trim()
    .toLowerCase();
}

/**
 * Handle GET /api/v1/search
 * Query params: q (required), store (optional, default archive_items), cursor, limit (max 100)
 */
/**
 * Decode the `sub` claim from a Bearer JWT without verifying the signature.
 * Auth is already verified upstream by requireAuth(); this is only used to
 * scope cache keys so different users cannot see each other's cached results.
 */
function extractUserSub(req) {
  try {
    const header = req.headers?.authorization || req.headers?.Authorization || "";
    const match = /^Bearer\s+(.+)$/i.exec(String(header));
    if (!match) return "anon";
    const [, payload] = match[1].split(".");
    if (!payload) return "anon";
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return String(claims?.sub || "anon");
  } catch {
    return "anon";
  }
}

export async function handleSearch(req, res, { provider, prisma } = {}) {
  const url = new URL(req.url, "http://localhost");
  const q = (url.searchParams.get("q") || "").trim();
  const store = url.searchParams.get("store") || "archive_items";
  const cursor = url.searchParams.get("cursor") || null;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
  const isSemantic = url.searchParams.get("semantic") === "true";

  if (!q || q.length < 2) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "يجب أن يكون طول الاستعلام حرفين على الأقل." }));
    return;
  }

  const normalized = normalizeArabic(q);

  // ── Semantic search path (Postgres + pgvector, opt-in via ?semantic=true) ──
  // Bypasses the cache because semantic results depend on embeddings which
  // may be backfilled asynchronously; stale cache would hide new embeddings.
  if (isSemantic && prisma) {
    try {
      const semanticResults = await semanticSearch(prisma, q, { store, limit });
      if (semanticResults.length > 0) {
        // Fetch full records for the found UIDs
        const uids = semanticResults.map(r => r.uid);
        const records = await prisma.storageRow.findMany({
          where: { uid: { in: uids }, store },
        });
        // Preserve similarity ordering from pgvector
        const byUid = Object.fromEntries(records.map(r => [r.uid, r]));
        const ordered = uids.map(uid => byUid[uid]).filter(Boolean)
          .map(r => ({ uid: r.uid, ...r.data }));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ q, store, data: ordered, semantic: true, total: ordered.length, hasMore: false, nextCursor: null }));
        return;
      }
      // No semantic results (embeddings unavailable or no matches) — fall through
      // to regular full-text search so the user still gets useful results.
    } catch (semErr) {
      log.warn({ err: semErr.message }, "Semantic search failed — falling back to full-text.");
    }
  }

  // Cache-aside: check Redis before hitting the DB. The key includes the userId
  // so different users never share cached results (privacy + correctness).
  const userId = extractUserSub(req);
  const cacheKey = `search:${userId}:${normalized}:${store}:${cursor ?? ""}:${limit}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cached));
    return;
  }

  try {
    let results;

    if (prisma) {
      // Postgres path: use GIN index + ILIKE on normalized text
      // We search in common text fields: title, description, summary, transcription
      const searchPattern = `%${normalized}%`;

      // Use raw query to search within JSONB fields with Arabic normalization
      const rows = await prisma.$queryRaw`
        SELECT uid, data, "createdAt"
        FROM storage_rows
        WHERE store = ${store}
          AND (
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(data->>'title'), '[أإآ]', 'ا', 'g'),
              'ى', 'ي', 'g'),
            'ة', 'ه', 'g')
            ILIKE ${searchPattern}
            OR regexp_replace(
              regexp_replace(
                regexp_replace(lower(data->>'description'), '[أإآ]', 'ا', 'g'),
              'ى', 'ي', 'g'),
            'ة', 'ه', 'g')
            ILIKE ${searchPattern}
            OR regexp_replace(
              regexp_replace(
                regexp_replace(lower(data->>'summary'), '[أإآ]', 'ا', 'g'),
              'ى', 'ي', 'g'),
            'ة', 'ه', 'g')
            ILIKE ${searchPattern}
          )
          AND (${cursor}::text IS NULL OR uid > ${cursor})
        ORDER BY "createdAt" DESC
        LIMIT ${limit + 1}
      `;

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map(r => ({ uid: r.uid, ...r.data }));
      results = {
        data,
        nextCursor: hasMore ? data[data.length - 1]?.uid : null,
        hasMore,
        total: null
      };

    } else {
      // PocketBase / fallback path: fetch all and filter in JS
      const allRows = await provider.getAll(store);
      const filtered = allRows.filter(row => {
        const fields = [row.title, row.description, row.summary, row.transcription, row.name]
          .filter(Boolean).join(" ");
        return normalizeArabic(fields).includes(normalized);
      });
      const startIdx = cursor ? filtered.findIndex(r => r.uid === cursor) + 1 : 0;
      const page = filtered.slice(startIdx, startIdx + limit);
      results = {
        data: page,
        nextCursor: page.length === limit && startIdx + limit < filtered.length ? page[page.length - 1]?.uid : null,
        hasMore: startIdx + limit < filtered.length,
        total: filtered.length
      };
    }

    const responsePayload = { q, store, ...results };
    // Populate cache for subsequent identical queries (best-effort; never throws).
    await cacheSet(cacheKey, responsePayload, TTL.SEARCH);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responsePayload));
  } catch (err) {
    log.error({ err }, "Search handler error");
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "خطأ في تنفيذ البحث." }));
  }
}
