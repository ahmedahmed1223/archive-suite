/**
 * Server-side search with Arabic text normalization.
 * GET /api/v1/search?q=query&store=archive_items&cursor=&limit=20
 *
 * Arabic normalization:
 *  - Remove tashkeel (diacritics): [ً-ٰٟ]
 *  - Normalize alef variants (أإآ) → ا
 *  - Normalize ya variants (ى) → ي
 *  - Normalize ta marbuta (ة) → ه
 *  - Trim and lowercase
 */

import { createLogger } from "../logger.js";

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
export async function handleSearch(req, res, { provider, prisma } = {}) {
  const url = new URL(req.url, "http://localhost");
  const q = (url.searchParams.get("q") || "").trim();
  const store = url.searchParams.get("store") || "archive_items";
  const cursor = url.searchParams.get("cursor") || null;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

  if (!q || q.length < 2) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "يجب أن يكون طول الاستعلام حرفين على الأقل." }));
    return;
  }

  const normalized = normalizeArabic(q);

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

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ q, store, ...results }));
  } catch (err) {
    log.error({ err }, "Search handler error");
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "خطأ في تنفيذ البحث." }));
  }
}
