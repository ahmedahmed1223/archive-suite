import { createLogger } from "../logger.js";

const log = createLogger("audit");

const DESTRUCTIVE_OPS = new Set([
  "replaceAll",
  "backup.restore",
  "delete",
  "deleteBatch",
  "emptyTrash",
  "put",
  "putBatch",
  "secure-delete",
]);

const ROLE_FIELDS = new Set(["role", "isActive", "passwordHash"]);

interface AuditClaims {
  sub?: string;
  username?: string;
  role?: string;
}

interface AuditEvent {
  method: string;
  args?: unknown[];
  claims?: AuditClaims;
  ip?: string;
  result?: Record<string, unknown>;
}

export function auditLog({ method, args = [], claims = {}, ip, result }: AuditEvent): void {
  if (!DESTRUCTIVE_OPS.has(method)) return;

  if (method === "put" || method === "putBatch") {
    const records = method === "put" ? [args[1]] : (args[1] || []);
    const touchesRoleField = (records as unknown[]).some(r =>
      r && Object.keys(r as object).some(k => ROLE_FIELDS.has(k))
    );
    if (!touchesRoleField) return;
  }

  const [store, ...rest] = args;
  const recordIds = extractIds(rest);

  log.info({
    event: "destructive_op",
    method,
    store: store || "unknown",
    recordIds: recordIds.slice(0, 20),
    recordCount: recordIds.length,
    actor: { id: claims.sub, username: claims.username, role: claims.role },
    ip,
    result: summarizeResult(result),
  }, `AUDIT: ${claims.username || "unknown"} called ${method} on ${store || "unknown"}`);
}

function extractIds(args: unknown[]): string[] {
  if (!args.length) return [];
  const first = args[0];
  if (typeof first === "string") return [first];
  if (Array.isArray(first)) return first.map(r => (r as any)?.uid || (r as any)?.id || String(r)).filter(Boolean);
  if (first && typeof first === "object") return [(first as any).uid || (first as any).id].filter(Boolean);
  return [];
}

function summarizeResult(result: unknown): unknown {
  if (!result) return null;
  if (typeof result === "object") return { ...(result as Record<string, unknown>) };
  return result;
}
