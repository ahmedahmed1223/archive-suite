/**
 * Ingest routes — server-side file ingestion from watch folder, FTP, and SMB.
 *
 * POST /api/ingest/scan      — one-shot scan of the configured watch folder
 * POST /api/ingest/ftp/pull  — pull new files from an FTP source
 * POST /api/ingest/smb/pull  — pull new files from an SMB source
 *
 * All endpoints require authentication. After each file is pulled / detected
 * a new archive item is created via the active StorageProvider (store: "videoItems",
 * method: "add").
 *
 * FTP / SMB credentials come from the request body — never from env.
 */

import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { config } from "../config/env.js";
import { createWatchFolderService, computeChecksum } from "../ingest/watchFolder.js";
import { pullFromFtp } from "../ingest/ftpIngest.js";
import { pullFromSmb } from "../ingest/smbIngest.js";

/**
 * Build a minimal archive item from ingest metadata.
 * The item is added to the "videoItems" store (the primary catch-all store)
 * which the SPA can then display / categorise.
 */
function buildArchiveItem({ filePath, size, mimeType, checksum }) {
  const name = basename(filePath);
  return {
    id: randomUUID(),
    title: name,
    fileName: name,
    filePath,
    size,
    mimeType,
    checksum,
    source: "ingest",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} ctx  - destructured from routeCtx() in server.js
 * @returns {boolean} true when the request was handled
 */
export async function handleIngestRoute({
  req,
  res,
  url,
  send,
  requireAuth,
  readJsonBody,
  resolveStorage,
}) {
  if (!url.startsWith("/api/ingest")) return false;

  // All ingest endpoints require a valid Bearer token.
  if (!requireAuth(req, res)) return true;

  // ── POST /api/ingest/scan ─────────────────────────────────────────────────
  if (req.method === "POST" && url === "/api/ingest/scan") {
    try {
      const watchDir = config.ingestWatchDir;
      const ingested = [];

      const svc = createWatchFolderService({
        rootDir: watchDir,
        onIngest: async (info) => {
          const item = buildArchiveItem(info);
          await resolveStorage().add("videoItems", item);
          ingested.push({ id: item.id, fileName: item.fileName, checksum: item.checksum });
        },
      });

      await svc.scan();
      return send(res, 200, { ok: true, result: { ingested, watchDir } });
    } catch (err) {
      return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "Ingest scan failed" });
    }
  }

  // ── POST /api/ingest/ftp/pull ─────────────────────────────────────────────
  if (req.method === "POST" && url === "/api/ingest/ftp/pull") {
    try {
      const body = await readJsonBody(req);
      const { host, port, user, password, remotePath, localPath, secure } = body || {};

      if (!host || !user) {
        return send(res, 400, { ok: false, error: "host and user are required" });
      }

      // Default localPath to a temp sub-directory under the ingest inbox.
      const resolvedLocal = localPath || `${config.ingestWatchDir}/ftp-staging`;

      const { pulled, skipped } = await pullFromFtp({
        host, port, user, password, remotePath, secure,
        localPath: resolvedLocal,
      });

      // Create an archive item for each newly pulled file.
      const items = await Promise.all(
        pulled.map(async (filePath) => {
          const checksum = await computeChecksum(filePath);
          const { statSync } = await import("node:fs");
          const size = statSync(filePath).size;
          const item = buildArchiveItem({ filePath, size, mimeType: "application/octet-stream", checksum });
          await resolveStorage().add("videoItems", item);
          return { id: item.id, fileName: item.fileName, checksum };
        })
      );

      return send(res, 200, { ok: true, result: { pulled: items, skipped } });
    } catch (err) {
      return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "FTP pull failed" });
    }
  }

  // ── POST /api/ingest/smb/pull ─────────────────────────────────────────────
  if (req.method === "POST" && url === "/api/ingest/smb/pull") {
    try {
      const body = await readJsonBody(req);
      const { share, path: remotePath, user, password, domain, localPath } = body || {};

      if (!share || !user) {
        return send(res, 400, { ok: false, error: "share and user are required" });
      }

      const resolvedLocal = localPath || `${config.ingestWatchDir}/smb-staging`;

      const { pulled, skipped } = await pullFromSmb({
        share, path: remotePath, user, password, domain,
        localPath: resolvedLocal,
      });

      const items = await Promise.all(
        pulled.map(async (filePath) => {
          const checksum = await computeChecksum(filePath);
          const { statSync } = await import("node:fs");
          const size = statSync(filePath).size;
          const item = buildArchiveItem({ filePath, size, mimeType: "application/octet-stream", checksum });
          await resolveStorage().add("videoItems", item);
          return { id: item.id, fileName: item.fileName, checksum };
        })
      );

      return send(res, 200, { ok: true, result: { pulled: items, skipped } });
    } catch (err) {
      return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "SMB pull failed" });
    }
  }

  return false;
}
