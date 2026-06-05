// SPA client for the admin database-config endpoints (server Phase 3).
//
// Lets an admin view the active DB target, test an external Postgres URL, and
// switch the server to it (applied on the next restart). Admin token is sent as
// Bearer; all network goes through an injectable fetch for unit tests.

export class DbConfigError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "DbConfigError";
    this.status = status;
  }
}

export const DATABASE_ENGINES = Object.freeze(["postgresql", "mysql", "sqlite", "sqlserver"]);
export const DATABASE_ENGINE_LABELS = Object.freeze({
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  sqlserver: "SQL Server"
});

export function normalizeDatabaseEngine(engine = "postgresql") {
  const value = String(engine || "").trim().toLowerCase();
  if (value === "postgres") return "postgresql";
  if (value === "mssql") return "sqlserver";
  return DATABASE_ENGINES.includes(value) ? value : "postgresql";
}

/** Whether the DB settings UI should be available: cloud backend + admin token. */
export function canManageDb({ backend, token, role } = {}) {
  const isAdmin = role === "admin" || role === "owner";
  return backend !== "local" && Boolean(token) && isAdmin;
}

/** Build a DB URL from parts (password percent-encoded). */
export function buildDatabaseUrl({
  engine = "postgresql",
  host = "",
  port,
  database = "",
  user = "archive",
  password = "",
  file = "./archive.sqlite"
} = {}) {
  const normalized = normalizeDatabaseEngine(engine);
  if (normalized === "sqlite") {
    const target = String(file || database || "./archive.sqlite").trim() || "./archive.sqlite";
    return target.startsWith("file:") ? target : `file:${target}`;
  }
  const u = encodeURIComponent(String(user || "archive"));
  const p = password ? `:${encodeURIComponent(String(password))}` : "";
  const fallbackPort = normalized === "mysql" ? 3306 : normalized === "sqlserver" ? 1433 : 5432;
  const prt = port ? `:${Number(port)}` : `:${fallbackPort}`;
  return `${normalized}://${u}${p}@${String(host).trim()}${prt}/${String(database).trim()}`;
}

/** Build a postgres URL from parts (kept for existing tests/imports). */
export function buildPgUrl(parts = {}) {
  return buildDatabaseUrl({ ...parts, engine: "postgresql" });
}

async function call(path, { method = "GET", body, baseUrl = "", getToken, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new DbConfigError("لا يوجد منفّذ fetch.");
  const token = typeof getToken === "function" ? getToken() : "";
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await doFetch(`${base}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (networkError) {
    throw new DbConfigError(`تعذّر الاتصال بالخادم: ${networkError?.message || "خطأ شبكة"}`);
  }
  let payload;
  try { payload = await response.json(); } catch { throw new DbConfigError("استجابة غير صالحة من الخادم.", { status: response.status }); }
  if (!response.ok || !payload?.ok) {
    if (response.status === 403) throw new DbConfigError("هذه الإعدادات للمدير فقط.", { status: 403 });
    throw new DbConfigError(payload?.error || "فشل طلب إعدادات قاعدة البيانات.", { status: response.status });
  }
  return payload.result;
}

/** GET the active DB target (password already masked by the server). */
export function fetchDbConfig(opts = {}) {
  return call("/api/admin/config", { method: "GET", ...opts });
}

/** Test a candidate connection string without saving. Returns { ok, error? }. */
export function testDbConnection({ engine = "postgresql", url, ...opts } = {}) {
  return call("/api/admin/db/test", { method: "POST", body: { engine: normalizeDatabaseEngine(engine), url }, ...opts });
}

/** Persist a new DB url → { saved, restartRequired, database }. */
export function saveDbConfig({ engine = "postgresql", url, ...opts } = {}) {
  return call("/api/admin/config", { method: "POST", body: { database: { engine: normalizeDatabaseEngine(engine), url } }, ...opts });
}
