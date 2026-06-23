// Backup routes — list, run, preview, restore.
// Extracted from api/server.js. No business logic changed.

import { listBackups, runBackup, restoreBackup, previewBackup } from "../backup/backupScheduler.js";
import { auditLog } from "../api/auditLogger.js";

/**
 * Handles all /api/admin/backups* routes.
 * Returns true if the request was handled.
 */
export async function handleBackupRoute({
  req,
  res,
  url,
  send,
  overLimit,
  readJsonBody,
  requireAdmin,
  resolveStorage,
  clientIp,
}) {
  // GET /api/admin/backups — list all backup files
  if (req.method === "GET" && url.split("?")[0] === "/api/admin/backups") {
    if (!requireAdmin(req, res)) return true;
    return send(res, 200, { ok: true, backups: listBackups() }), true;
  }

  // POST /api/admin/backups/run — trigger an immediate backup
  if (req.method === "POST" && url.split("?")[0] === "/api/admin/backups/run") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;
    try {
      const result = await runBackup(resolveStorage());
      return send(res, 200, { ok: true, message: "تمت النسخة الاحتياطية بنجاح.", result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Backup failed" }), true;
    }
  }

  // POST /api/admin/backups/preview — read a backup file and return record counts
  if (req.method === "POST" && url.split("?")[0] === "/api/admin/backups/preview") {
    if (!requireAdmin(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const result = await previewBackup(String(body?.filename || ""), {
        passphrase: typeof body?.passphrase === "string" ? body.passphrase : "",
      });
      return send(res, 200, { ok: true, ...result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Preview failed" }), true;
    }
  }

  // POST /api/admin/backups/restore — restore a stored backup
  if (req.method === "POST" && url.split("?")[0] === "/api/admin/backups/restore") {
    if (overLimit(res, "rpc", req)) return true;
    const adminUser = requireAdmin(req, res);
    if (!adminUser) return true;
    try {
      const body = await readJsonBody(req);
      const storesParam = Array.isArray(body?.stores)
        ? body.stores.filter((s) => typeof s === "string")
        : null;
      const result = await restoreBackup(resolveStorage(), String(body?.filename || ""), {
        passphrase: typeof body?.passphrase === "string" ? body.passphrase : "",
        stores: storesParam && storesParam.length > 0 ? storesParam : null,
      });
      auditLog({
        method: "backup.restore",
        args: [result.filename, ...(storesParam ? [storesParam.join(",")] : [])],
        claims: adminUser,
        ip: clientIp(req),
      });
      return (
        send(res, 200, { ok: true, message: "تمت استعادة النسخة الاحتياطية بنجاح.", result }),
        true
      );
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Restore failed" }), true;
    }
  }

  return false; // not handled
}
