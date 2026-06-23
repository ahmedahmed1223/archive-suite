/**
 * mosRoutes.js — REST endpoints for MOS/NRCS integration (slice 1).
 *
 * POST /api/mos/search
 *   Body: { query: string }
 *   Auth: Bearer JWT required
 *   Returns: { ok: true, results: MosRow[], xml: string }
 *
 * GET  /api/mos/envelope-sample?type=roReq
 *   Auth: Bearer JWT required
 *   Returns: application/xml sample envelope for the requested type
 *
 * No sockets opened here — slice 2 wires real MOS-over-TCP.
 */

import { searchArchiveForMos } from "./searchBridge.js";
import { objList, roReq, roCreate, roStorySend, roElementAction, objCreate } from "./messages.js";
import { createMosSession } from "./session.js";

// Stores searched for items (mirrors the pattern in routes/export.js)
const ITEM_STORES = [
  "video_items", "document_items", "audio_items", "image_items", "media_items",
  "videoItems", "documentItems", "audioItems", "imageItems", "mediaItems",
  "archive_items",
];

const SAMPLE_MOS_ID = "ARCHIVE.MOS.1";
const SAMPLE_NCS_ID = "NRCS.1";

/** Shared sample session (messageID resets per process restart — fine for samples). */
const sampleSession = createMosSession({ mosID: SAMPLE_MOS_ID, ncsID: SAMPLE_NCS_ID });

/** Map type query param → sample XML generator. */
function buildSample(type) {
  const env = sampleSession.wrap();
  switch (type) {
    case "roCreate":
      return roCreate({ ...env, roID: "RO.SAMPLE.1", roSlug: "Sample Running Order", roEdStart: new Date().toISOString() });
    case "roStorySend":
      return roStorySend({ ...env, roID: "RO.SAMPLE.1", storyID: "STY.1", storySlug: "Lead Story",
        items: [{ itemID: "ITM.1", objID: "OBJ.1", objSlug: "Archive Clip 1", objDur: 90 }] });
    case "roElementAction":
      return roElementAction({ ...env, roID: "RO.SAMPLE.1", operation: "INSERT", storyID: "STY.1", itemID: "ITM.1" });
    case "objList":
      return objList({ ...env, objListID: "SRCH.1",
        objects: [{ objID: "OBJ.1", objSlug: "Sample Archive Clip", objDur: 120, mosAbstract: "A sample clip from the archive." }] });
    case "objCreate":
      return objCreate({ ...env, objID: "OBJ.NEW.1", objSlug: "New Archive Object", objDur: 60, mosAbstract: "Newly created MOS object." });
    case "roReq":
    default:
      return roReq({ ...env, roID: "RO.SAMPLE.1" });
  }
}

/**
 * Fetch all items from the known archive stores via storage provider.
 *
 * @param {object} storage - StorageProvider
 * @returns {Promise<object[]>}
 */
async function fetchAllItems(storage) {
  const results = [];
  for (const store of ITEM_STORES) {
    try {
      const rows = await storage.getAll(store);
      if (Array.isArray(rows)) results.push(...rows);
    } catch {
      // store may not exist — skip
    }
  }
  return results;
}

/**
 * Handle /api/mos/* routes.
 *
 * @param {object} ctx
 * @param {object} ctx.req
 * @param {object} ctx.res
 * @param {string} ctx.url             - normalised pathname
 * @param {URLSearchParams} ctx.params - query params
 * @param {Function} ctx.sendJson      - (res, code, payload) => void
 * @param {Function} ctx.requireAuth   - returns claims or null (sends 401)
 * @param {Function} ctx.overLimit     - (res, bucket, req) => boolean
 * @param {Function} ctx.readJsonBody  - () => Promise<object>
 * @param {Function} ctx.resolveStorage - () => StorageProvider
 * @param {object|null} ctx.prisma
 * @returns {Promise<boolean>} true if handled
 */
export async function handleMosRoute({
  req, res, url, params, sendJson,
  requireAuth, overLimit, readJsonBody, resolveStorage,
}) {
  if (!url.startsWith("/api/mos")) return false;

  const send = (code, payload) => { sendJson(res, code, payload); return true; };

  // ── POST /api/mos/search ─────────────────────────────────────────────────
  if (req.method === "POST" && url.split("?")[0] === "/api/mos/search") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuth(req, res);
    if (!claims) return true;

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return send(400, { ok: false, error: err?.message || "Invalid request body." });
    }

    const query = String(body?.query ?? "").trim();
    if (!query || query.length < 2) {
      return send(400, { ok: false, error: "query must be at least 2 characters." });
    }
    const limit = Math.min(Math.max(1, Number(body?.limit ?? 50)), 200);

    try {
      const storage = resolveStorage();
      const allItems = await fetchAllItems(storage);
      const results = searchArchiveForMos({ query, limit, items: allItems });

      // Also build an objList XML envelope for direct MOS consumption
      const session = createMosSession({ mosID: SAMPLE_MOS_ID, ncsID: SAMPLE_NCS_ID });
      const xml = objList({
        ...session.wrap(),
        objListID: `SRCH.${Date.now()}`,
        objects: results,
      });

      return send(200, { ok: true, query, total: results.length, results, xml });
    } catch (err) {
      return send(err?.statusCode || 500, { ok: false, error: err?.message || "MOS search failed." });
    }
  }

  // ── GET /api/mos/envelope-sample?type=roReq ──────────────────────────────
  if (req.method === "GET" && url.split("?")[0] === "/api/mos/envelope-sample") {
    const claims = requireAuth(req, res);
    if (!claims) return true;

    const type = String(params?.get("type") ?? "roReq");
    const xml = buildSample(type);
    const buf = Buffer.from(xml, "utf-8");
    res.writeHead(200, {
      "Content-Type": "application/xml; charset=UTF-8",
      "Content-Length": buf.length,
    });
    res.end(buf);
    return true;
  }

  return false;
}
