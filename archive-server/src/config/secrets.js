import { randomBytes } from "node:crypto";

// Connection-string + secret helpers shared by the setup script, the
// server-config layer (Phase 2), and the admin DB API (Phase 3). Pure and
// unit-tested; no I/O.

/** A URL-safe random secret (base64url) of roughly `bytes` entropy. */
export function generateSecret(bytes = 32) {
  const n = Number.isInteger(bytes) && bytes > 0 ? bytes : 32;
  return randomBytes(n).toString("base64url");
}

export const DATABASE_ENGINES = Object.freeze(["postgresql", "mysql", "sqlite", "sqlserver"]);
export const DEFAULT_DATABASE_ENGINE = "postgresql";

const ENGINE_PROTOCOLS = Object.freeze({
  postgresql: "postgresql:",
  mysql: "mysql:",
  sqlite: "file:",
  sqlserver: "sqlserver:"
});

export function normalizeDatabaseEngine(engine = DEFAULT_DATABASE_ENGINE) {
  const value = String(engine || "").trim().toLowerCase();
  if (value === "postgres" || value === "postgresql") return "postgresql";
  if (value === "mssql" || value === "sqlserver") return "sqlserver";
  return DATABASE_ENGINES.includes(value) ? value : DEFAULT_DATABASE_ENGINE;
}

/** Build a database connection URL from parts (password percent-encoded). */
export function buildDatabaseUrl({
  engine = DEFAULT_DATABASE_ENGINE,
  user = "archive",
  password = "",
  host = "localhost",
  port,
  database = "archive",
  file = "./archive.sqlite",
  options = ""
} = {}) {
  const normalized = normalizeDatabaseEngine(engine);
  if (normalized === "sqlite") {
    const target = String(file || database || "./archive.sqlite").trim() || "./archive.sqlite";
    return target.startsWith("file:") ? target : `file:${target}`;
  }
  const u = encodeURIComponent(String(user));
  const p = password ? `:${encodeURIComponent(String(password))}` : "";
  const fallbackPort = normalized === "mysql" ? 3306 : normalized === "sqlserver" ? 1433 : 5432;
  const prt = port === "" || port === null || port === undefined ? `:${fallbackPort}` : `:${Number(port)}`;
  const dbName = encodeURIComponent(String(database || "archive"));
  const hostName = String(host || "localhost").trim();
  if (normalized === "sqlserver") {
    const suffix = options ? `?${String(options).replace(/^\?/, "")}` : "";
    return `sqlserver://${u}${p}@${hostName}${prt}/${dbName}${suffix}`;
  }
  return `${normalized}://${u}${p}@${hostName}${prt}/${dbName}`;
}

/** Parse a supported DB URL into parts (returns null when unparseable). */
export function parseDatabaseUrl(url, expectedEngine) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const engine = expectedEngine ? normalizeDatabaseEngine(expectedEngine) : "";
  try {
    if (raw.startsWith("file:")) {
      if (engine && engine !== "sqlite") return null;
      const file = raw.slice("file:".length);
      return { engine: "sqlite", file, database: file, host: "", port: null, user: "", password: "" };
    }
    const u = new URL(raw);
    const protocolEngine = u.protocol === "postgres:"
      ? "postgresql"
      : Object.entries(ENGINE_PROTOCOLS).find(([, protocol]) => protocol === u.protocol)?.[0] || "";
    if (!protocolEngine) return null;
    const normalized = normalizeDatabaseEngine(protocolEngine);
    if (engine && normalized !== engine) return null;
    return {
      engine: normalized,
      user: decodeURIComponent(u.username || ""),
      password: decodeURIComponent(u.password || ""),
      host: u.hostname || "",
      port: u.port ? Number(u.port) : normalized === "mysql" ? 3306 : normalized === "sqlserver" ? 1433 : 5432,
      database: decodeURIComponent(u.pathname.replace(/^\//, "") || "")
    };
  } catch {
    return null;
  }
}

/** Mask the password in a connection URL for safe display/logging. */
export function maskDatabaseUrl(url, engine) {
  const parts = parseDatabaseUrl(url, engine);
  if (!parts) return "";
  if (parts.engine === "sqlite") return parts.database ? `file:${parts.database}` : "";
  return buildDatabaseUrl({ ...parts, password: parts.password ? "***" : "" });
}

/** Validate a candidate database URL shape. */
export function isValidDatabaseUrl(url, engine) {
  const parts = parseDatabaseUrl(url, engine);
  if (!parts) return false;
  if (parts.engine === "sqlite") return Boolean(parts.database);
  return Boolean(parts.host && parts.database);
}
