/**
 * Broadcast routes — MXF/XDCAM metadata lookup and broadcast format export.
 *
 * GET  /api/media/:id/broadcast-metadata  — retrieve extracted broadcast metadata for an item
 * POST /api/export/broadcast              — transcode item to ProRes or DNxHR
 *
 * Requires auth on both endpoints; the export endpoint requires admin auth.
 */

import { renderProRes422, renderDnxhrHq } from "../export/broadcast.js";
import { spawn } from "node:child_process";

// ── In-memory broadcast metadata store ───────────────────────────────────────
// Keyed by item ID. Populated by the ingest pipeline via storeBroadcastMeta().
// In a production deployment this could be backed by a DB row; the in-memory
// map is sufficient for the current architecture and keeps the ingest path fast.

const broadcastMetaStore = new Map<string, any>();

/**
 * Store broadcast metadata for an item. Called by ingest handlers.
 */
export function storeBroadcastMeta(itemId: string, meta: any): void {
  if (!itemId || !meta) return;
  broadcastMetaStore.set(String(itemId), meta);
}

/**
 * Retrieve stored broadcast metadata for an item (or null).
 */
export function getBroadcastMeta(itemId: string): any | null {
  return broadcastMetaStore.get(String(itemId)) ?? null;
}

// ── Real spawn-based ffmpeg runner (used at runtime only) ────────────────────

function realRunFfmpeg(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 4096) stderr = stderr.slice(-4096);
    });
    proc.on("error", (err: Error) =>
      reject(Object.assign(new Error(`Failed to start ${cmd}: ${err.message}`), { code: "SPAWN" }))
    );
    proc.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(Object.assign(new Error(`${cmd} exited ${code}: ${stderr.slice(-300)}`), { code: "FFMPEG_FAILED" }));
    });
  });
}

/**
 * Handle broadcast-related routes.
 * Returns true if the request was handled, false to fall through.
 */
export async function handleBroadcastRoute({
  req,
  res,
  url,
  send,
  requireAuth,
  requireAdmin,
  readJsonBody,
  resolveStorage,
}: any): Promise<boolean> {
  // ── GET /api/media/:id/broadcast-metadata ─────────────────────────────────
  const metaMatch = /^\/api\/media\/([^/]+)\/broadcast-metadata$/.exec(url);
  if (metaMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return true;
    const id = decodeURIComponent(metaMatch[1]);
    const broadcastMeta = getBroadcastMeta(id);
    return send(res, 200, { ok: true, broadcastMeta }), true;
  }

  // ── POST /api/export/broadcast ────────────────────────────────────────────
  if (req.method === "POST" && url === "/api/export/broadcast") {
    // Require admin for production broadcast transcoding.
    if (typeof requireAdmin === "function") {
      if (!requireAdmin(req, res)) return true;
    } else {
      if (!requireAuth(req, res)) return true;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return send(res, 400, { ok: false, error: "Invalid JSON body." }), true;
    }

    const { itemId, format, profile, outputPath } = body || {};

    if (!itemId) return send(res, 400, { ok: false, error: "itemId is required." }), true;
    if (!format || !["prores", "dnxhr"].includes(format)) {
      return send(res, 400, { ok: false, error: 'format must be "prores" or "dnxhr".' }), true;
    }

    // Look up source file path from storage.
    let sourcePath: string | undefined;
    try {
      const storage = typeof resolveStorage === "function" ? resolveStorage() : null;
      if (storage) {
        const ITEM_STORES = [
          "video_items", "videoItems", "media_items", "mediaItems",
        ];
        for (const store of ITEM_STORES) {
          try {
            const item = await storage.get(store, itemId);
            if (item?.filePath) { sourcePath = item.filePath; break; }
          } catch { /* store not available on this backend */ }
        }
      }
    } catch { /* storage lookup best-effort */ }

    if (!sourcePath) {
      return send(res, 404, { ok: false, error: "Source file path not found for item." }), true;
    }

    // In test mode, accept an injected runner from the request body.
    // In production NODE_ENV, always use the real spawn runner.
    let runFfmpeg = realRunFfmpeg;
    if (process.env.NODE_ENV === "test" && typeof body?.runnerFn === "function") {
      runFfmpeg = body.runnerFn;
    }

    const resolvedOutput = outputPath || `${sourcePath}.broadcast_export_${Date.now()}.${format === "prores" ? "mov" : "mxf"}`;

    try {
      if (format === "prores") {
        await renderProRes422({
          inputPath: sourcePath,
          outputPath: resolvedOutput,
          ...(profile !== undefined ? { profile } : {}),
          runFfmpeg,
        });
      } else {
        await renderDnxhrHq({
          inputPath: sourcePath,
          outputPath: resolvedOutput,
          ...(profile !== undefined ? { profile } : {}),
          runFfmpeg,
        });
      }
      return send(res, 200, { ok: true, outputPath: resolvedOutput }), true;
    } catch (err: any) {
      return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "Broadcast export failed." }), true;
    }
  }

  return false;
}
