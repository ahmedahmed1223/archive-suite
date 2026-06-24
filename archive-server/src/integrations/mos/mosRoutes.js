/**
 * mosRoutes.js — REST endpoints for MOS/NRCS integration (slices 1 + 2).
 *
 * ── Slice 1 (search / samples) ──────────────────────────────────────────────
 * POST /api/mos/search
 *   Body: { query: string }
 *   Auth: Bearer JWT required
 *   Returns: { ok: true, results: MosRow[], xml: string }
 *
 * GET  /api/mos/envelope-sample?type=roReq
 *   Auth: Bearer JWT required
 *   Returns: application/xml sample envelope for the requested type
 *
 * ── Slice 2 (TCP management, admin-only) ────────────────────────────────────
 * POST /api/mos/connect
 *   Body: { host, port?, mosID?, ncsID? }
 *   Auth: admin role required
 *   Starts the singleton MOS TCP client and connects to the NCS.
 *
 * POST /api/mos/disconnect
 *   Auth: admin role required
 *   Stops the singleton TCP client.
 *
 * GET  /api/mos/status
 *   Auth: admin role required
 *   Returns the current TCP client status from getStatus().
 *
 * POST /api/mos/send
 *   Body: { type, payload }
 *   Auth: admin role required
 *   Sends a MOS message via the active TCP connection.
 */

import { searchArchiveForMos } from "./searchBridge.js";
import { objList, roReq, roCreate, roStorySend, roElementAction, objCreate } from "./messages.js";
import { createMosSession } from "./session.js";
import { createMosTcpClient } from "./tcpClient.js";

// ── TCP singleton ─────────────────────────────────────────────────────────────

/** @type {ReturnType<typeof createMosTcpClient> | null} */
let tcpClient = null;

const DEFAULT_MOS_ID = "ARCHIVE.MOS.1";
const DEFAULT_NCS_ID = "NRCS.1";

// ── Stores ────────────────────────────────────────────────────────────────────

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

  // ── POST /api/mos/connect ────────────────────────────────────────────────
  if (req.method === "POST" && url.split("?")[0] === "/api/mos/connect") {
    const claims = requireAuth(req, res);
    if (!claims) return true;
    if (!["admin", "owner"].includes(claims.role)) {
      return send(403, { ok: false, error: "Admin role required." });
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return send(400, { ok: false, error: err?.message || "Invalid request body." });
    }

    const host = String(body?.host ?? "").trim();
    if (!host) return send(400, { ok: false, error: "host is required." });

    const port = Number(body?.port ?? 10540);
    const mosID = String(body?.mosID ?? DEFAULT_MOS_ID).trim();
    const ncsID = String(body?.ncsID ?? DEFAULT_NCS_ID).trim();

    // Disconnect existing client if any
    if (tcpClient) {
      try { tcpClient.disconnect(); } catch { /* ignore */ }
      tcpClient = null;
    }

    tcpClient = createMosTcpClient({
      host, port, mosID, ncsID,
      onMessage: (msg) => {
        // Messages received from NCS are logged; callers can extend via WebSocket
        console.error(`[mos-tcp] received message type=${msg.type} id=${msg.messageID}`);
      },
      onConnected: () => {
        console.error(`[mos-tcp] connected to ${host}:${port}`);
      },
      onDisconnected: (err) => {
        console.error(`[mos-tcp] disconnected from ${host}:${port}${err ? " — " + err.message : ""}`);
      },
    });

    tcpClient.connect();
    return send(200, { ok: true, status: tcpClient.getStatus() });
  }

  // ── POST /api/mos/disconnect ─────────────────────────────────────────────
  if (req.method === "POST" && url.split("?")[0] === "/api/mos/disconnect") {
    const claims = requireAuth(req, res);
    if (!claims) return true;
    if (!["admin", "owner"].includes(claims.role)) {
      return send(403, { ok: false, error: "Admin role required." });
    }

    if (!tcpClient) {
      return send(200, { ok: true, message: "No active TCP connection." });
    }
    tcpClient.disconnect();
    tcpClient = null;
    return send(200, { ok: true, message: "TCP client disconnected." });
  }

  // ── GET /api/mos/status ──────────────────────────────────────────────────
  if (req.method === "GET" && url.split("?")[0] === "/api/mos/status") {
    const claims = requireAuth(req, res);
    if (!claims) return true;
    if (!["admin", "owner"].includes(claims.role)) {
      return send(403, { ok: false, error: "Admin role required." });
    }

    const status = tcpClient ? tcpClient.getStatus() : { connected: false, host: null, port: null, reconnectAttempts: 0, queueSize: 0 };
    return send(200, { ok: true, status });
  }

  // ── POST /api/mos/send ───────────────────────────────────────────────────
  if (req.method === "POST" && url.split("?")[0] === "/api/mos/send") {
    const claims = requireAuth(req, res);
    if (!claims) return true;
    if (!["admin", "owner"].includes(claims.role)) {
      return send(403, { ok: false, error: "Admin role required." });
    }

    if (!tcpClient) {
      return send(409, { ok: false, error: "No active TCP connection. Call POST /api/mos/connect first." });
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return send(400, { ok: false, error: err?.message || "Invalid request body." });
    }

    const type = String(body?.type ?? "").trim();
    if (!type) return send(400, { ok: false, error: "type is required." });

    const status = tcpClient.getStatus();
    const session = createMosSession({
      mosID: status.host ? (body?.mosID ?? DEFAULT_MOS_ID) : DEFAULT_MOS_ID,
      ncsID: status.host ? (body?.ncsID ?? DEFAULT_NCS_ID) : DEFAULT_NCS_ID,
    });
    const env = session.wrap();
    const payload = body?.payload ?? {};

    let xml;
    try {
      switch (type) {
        case "roReq":         xml = roReq({ ...env, ...payload }); break;
        case "roCreate":      xml = roCreate({ ...env, ...payload }); break;
        case "roStorySend":   xml = roStorySend({ ...env, ...payload }); break;
        case "roElementAction": xml = roElementAction({ ...env, ...payload }); break;
        case "objList":       xml = objList({ ...env, ...payload }); break;
        case "objCreate":     xml = objCreate({ ...env, ...payload }); break;
        default:
          return send(400, { ok: false, error: `Unknown MOS message type: ${type}` });
      }
    } catch (err) {
      return send(400, { ok: false, error: `Failed to build message: ${err?.message}` });
    }

    tcpClient.send(xml);
    return send(200, { ok: true, type, queued: !tcpClient.getStatus().connected, messageID: env.messageID });
  }

  return false;
}
