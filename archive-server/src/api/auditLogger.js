/**
 * Audit logger for destructive operations.
 * Uses Pino child logger for structured JSON output.
 * In production, add a log shipper (e.g., Loki, Splunk) to capture the "audit" stream.
 */
import { createLogger } from "../logger.js";

const log = createLogger("audit");

// The operations that require audit logging
const DESTRUCTIVE_OPS = new Set([
  "replaceAll",      // wipes + replaces an entire store
  "backup.restore",  // restores a stored backup over the live data (replaceAll)
  "delete",          // single record delete
  "deleteBatch",     // batch delete
  "emptyTrash",   // permanent delete of all trashed items
  "put",          // upsert — log role/permission changes only
  "putBatch",     // bulk upsert
]);

const ROLE_FIELDS = new Set(["role", "isActive", "passwordHash"]);

/**
 * Log a destructive RPC call.
 * @param {object} event
 * @param {string} event.method - RPC method name
 * @param {unknown[]} event.args - method arguments (store name, uid, etc.)
 * @param {object} event.claims - JWT claims { sub, username, role }
 * @param {string} event.ip - client IP address
 * @param {object} [event.result] - optional result summary
 */
export function auditLog({ method, args = [], claims = {}, ip, result }) {
  if (!DESTRUCTIVE_OPS.has(method)) return;

  // For put/putBatch: only log if role-sensitive fields are being changed
  if (method === "put" || method === "putBatch") {
    const records = method === "put" ? [args[1]] : (args[1] || []);
    const touchesRoleField = records.some(r =>
      r && Object.keys(r).some(k => ROLE_FIELDS.has(k))
    );
    if (!touchesRoleField) return;
  }

  const [store, ...rest] = args;
  const recordIds = extractIds(rest);

  log.info({
    event: "destructive_op",
    method,
    store: store || "unknown",
    recordIds: recordIds.slice(0, 20), // cap at 20 to avoid huge log entries
    recordCount: recordIds.length,
    actor: { id: claims.sub, username: claims.username, role: claims.role },
    ip,
    result: summarizeResult(result),
  }, `AUDIT: ${claims.username || "unknown"} called ${method} on ${store || "unknown"}`);
}

function extractIds(args) {
  if (!args.length) return [];
  const first = args[0];
  if (typeof first === "string") return [first]; // single uid
  if (Array.isArray(first)) return first.map(r => r?.uid || r?.id || String(r)).filter(Boolean);
  if (first && typeof first === "object") return [first.uid || first.id].filter(Boolean);
  return [];
}

function summarizeResult(result) {
  if (!result) return null;
  if (typeof result === "object") return { ...result }; // shallow copy
  return result;
}
