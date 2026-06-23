/**
 * Enterprise backup replication REST endpoints.
 *
 * POST /api/backups/replicate/:backupId  — replicate a local backup to S3 (admin)
 * GET  /api/backups/replicas             — list the replication manifest (auth)
 * POST /api/backups/restore-smoke/:id    — run DR smoke test on a replica (admin)
 *
 * Mounted by archive-server/src/routes/backupRoutes.js via delegation.
 */

import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { config } from "../../config/env.js";
import { replicateBackupToS3 } from "./replicate.js";
import { appendBackupManifestEntry, findRestorableEntry } from "./manifest.js";
import { runRestoreSmoke } from "./restoreSmoke.js";
import { createLogger } from "../../logger.js";

const log = createLogger("backup-enterprise-routes");

// In-memory manifest storage (persisted to a JSON file on disk)
const MANIFEST_FILE = join(config.backupDir, "replication-manifest.json");

function loadManifest() {
  if (!existsSync(MANIFEST_FILE)) return [];
  try {
    return JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveManifest(entries) {
  writeFileSync(MANIFEST_FILE, JSON.stringify(entries, null, 2), "utf8");
}

/**
 * Handle enterprise replication routes.
 * Returns true if the request was handled, false to fall through.
 */
export async function handleReplicationRoute({
  req,
  res,
  url,
  send,
  overLimit,
  requireAuth,
  requireAdmin,
}) {
  // GET /api/backups/replicas
  if (req.method === "GET" && url.split("?")[0] === "/api/backups/replicas") {
    if (!requireAuth(req, res)) return true;
    const entries = loadManifest();
    return send(res, 200, { ok: true, replicas: entries }), true;
  }

  // POST /api/backups/replicate/:backupId
  const replicateMatch = /^\/api\/backups\/replicate\/([^/?]+)$/.exec(url.split("?")[0]);
  if (req.method === "POST" && replicateMatch) {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;

    const backupId = decodeURIComponent(replicateMatch[1]);

    const replicationCfg = config.backup?.replication;
    if (!replicationCfg?.enabled) {
      return send(res, 503, { ok: false, error: "Backup replication is not enabled (BACKUP_REPLICATION_ENABLED)." }), true;
    }

    const { bucket, region, prefix, encryptionKey } = replicationCfg;
    if (!bucket || !region) {
      return send(res, 503, { ok: false, error: "BACKUP_REPLICATION_BUCKET and BACKUP_REPLICATION_REGION must be set." }), true;
    }

    // Resolve the local backup file
    const localPath = resolveBackupPath(backupId);
    if (!localPath) {
      return send(res, 404, { ok: false, error: `Backup "${backupId}" not found in ${config.backupDir}.` }), true;
    }

    try {
      const result = await replicateBackupToS3({
        localBackupPath: localPath,
        bucket,
        region,
        prefix: prefix || "backups",
        encryptionKey: encryptionKey || "",
      });

      const sha256 = sha256OfFile(localPath);
      const entry = {
        backupId,
        createdAt: new Date().toISOString(),
        sizeBytes: result.sizeBytes,
        sha256,
        region,
        bucket,
        key: result.key,
        encryption: encryptionKey ? "aes-256-gcm" : "none",
      };

      const entries = appendBackupManifestEntry(loadManifest(), entry);
      saveManifest(entries);

      log.info({ backupId, key: result.key }, "Replication complete.");
      return send(res, 200, { ok: true, replica: entry, etag: result.etag, durationMs: result.durationMs }), true;
    } catch (err) {
      log.error({ err, backupId }, "Replication failed.");
      return send(res, err?.statusCode || 500, { ok: false, error: err.message || "Replication failed" }), true;
    }
  }

  // POST /api/backups/restore-smoke/:replicaId  (matched by S3 key suffix or backupId)
  const smokeMatch = /^\/api\/backups\/restore-smoke\/([^/?]+)$/.exec(url.split("?")[0]);
  if (req.method === "POST" && smokeMatch) {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;

    const replicaId = decodeURIComponent(smokeMatch[1]);
    const entries = loadManifest();
    const entry = entries.find((e) => e.backupId === replicaId || e.key === replicaId);
    if (!entry) {
      return send(res, 404, { ok: false, error: `Replica "${replicaId}" not found in manifest.` }), true;
    }

    const encryptionKey = entry.encryption === "aes-256-gcm"
      ? (config.backup?.replication?.encryptionKey || "")
      : "";

    try {
      const result = await runRestoreSmoke({ entry, encryptionKey });
      return send(res, result.ok ? 200 : 422, { ok: result.ok, ...result }), true;
    } catch (err) {
      log.error({ err, replicaId }, "Restore smoke failed.");
      return send(res, 500, { ok: false, error: err.message || "Smoke test failed" }), true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveBackupPath(backupId) {
  const dir = config.backupDir;
  // Accept bare filename or full path
  const candidate = join(dir, backupId);
  if (existsSync(candidate)) return candidate;
  return null;
}

function sha256OfFile(filePath) {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}
