import { randomBytes } from "node:crypto";

// Connection-string + secret helpers shared by the setup script, the
// server-config layer (Phase 2), and the admin DB API (Phase 3). Pure and
// unit-tested; no I/O.

/** A URL-safe random secret (base64url) of roughly `bytes` entropy. */
export function generateSecret(bytes = 32): string {
  const n = Number.isInteger(bytes) && bytes > 0 ? bytes : 32;
  return randomBytes(n).toString("base64url");
}

export const DATABASE_ENGINES = Object.freeze([
  "postgresql",
  "mysql",
  "sqlite",
  "sqlserver",
]);
export const DEFAULT_DATABASE_ENGINE = "postgresql";

const ENGINE_PROTOCOLS = Object.freeze({
  postgresql: "postgresql:",
  mysql: "mysql:",
  sqlite: "file:",
  sqlserver: "sqlserver:",
});

export function normalizeDatabaseEngine(
  engine: string = DEFAULT_DATABASE_ENGINE
): string {
  const value = String(engine || "").trim().toLowerCase();
  if (value === "postgres" || value === "postgresql") return "postgresql";
  if (value === "mssql" || value === "sqlserver") return "sqlserver";
  return (DATABASE_ENGINES as readonly string[]).includes(value)
    ? value
    : DEFAULT_DATABASE_ENGINE;
}

interface DatabaseUrlParts {
  engine: string;
  user: string;
  password: string;
  host: string;
  port: number | null;
  database: string;
  file?: string;
  options?: string;
}

function formatSqlServerValue(value: unknown): string {
  const text = String(value ?? "").trim();
  return text.includes(";") ? `{${text.replace(/[{}]/g, "")}}` : text;
}

function splitSqlServerParts(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let braceDepth = 0;
  for (const char of value) {
    if (char === "{" && braceDepth === 0) braceDepth = 1;
    else if (char === "}" && braceDepth === 1) braceDepth = 0;
    if (char === ";" && braceDepth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function unformatSqlServerValue(value: string): string {
  const trimmed = String(value || "").trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}")
    ? trimmed.slice(1, -1)
    : trimmed;
}

function parseSqlServerConnectionString(raw: string): DatabaseUrlParts | null {
  if (!raw.startsWith("sqlserver://") || !raw.includes(";")) return null;
  const body = raw.replace(/^sqlserver:\/\//, "");
  const [hostPart, ...paramParts] = splitSqlServerParts(body);
  const [host, portText] = String(hostPart || "").split(":");
  const params = new Map<string, { key: string; value: string }>();
  for (const part of paramParts) {
    const [key, ...valueParts] = part.split("=");
    if (!key) continue;
    params.set(key.trim().toLowerCase(), {
      key: key.trim(),
      value: unformatSqlServerValue(valueParts.join("=")),
    });
  }
  const first = (...names: string[]) => {
    for (const name of names) {
      const found = params.get(name.toLowerCase());
      if (found) return found.value;
    }
    return "";
  };
  const database = first("database", "initial catalog");
  const user = first("user", "username", "uid", "userid", "user id");
  const password = first("password", "pwd");
  const optionParts = [...params.entries()]
    .filter(([key]) => !["database", "initial catalog", "user", "username", "uid", "userid", "user id", "password", "pwd"].includes(key))
    .map(([, entry]) => `${entry.key}=${formatSqlServerValue(entry.value)}`);
  return {
    engine: "sqlserver",
    user,
    password,
    host: String(host || "").trim(),
    port: portText ? Number(portText) : 1433,
    database,
    options: optionParts.join(";"),
  };
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
  options = "",
}: {
  engine?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: string | number | null;
  database?: string;
  file?: string;
  options?: string;
} = {}): string {
  const normalized = normalizeDatabaseEngine(engine);
  if (normalized === "sqlite") {
    const target =
      String(file || database || "./archive.sqlite").trim() ||
      "./archive.sqlite";
    return target.startsWith("file:") ? target : `file:${target}`;
  }
  const u = encodeURIComponent(String(user));
  const p = password ? `:${encodeURIComponent(String(password))}` : "";
  const fallbackPort =
    normalized === "mysql" ? 3306 : normalized === "sqlserver" ? 1433 : 5432;
  const prt =
    port === "" || port === null || port === undefined
      ? `:${fallbackPort}`
      : `:${Number(port)}`;
  const dbName = encodeURIComponent(String(database || "archive"));
  const hostName = String(host || "localhost").trim();
  if (normalized === "sqlserver") {
    const sqlServerParts = [
      `sqlserver://${hostName}${prt}`,
      `database=${formatSqlServerValue(database || "archive")}`,
      `user=${formatSqlServerValue(user || "archive")}`,
    ];
    if (password) sqlServerParts.push(`password=${formatSqlServerValue(password)}`);
    const optionText = String(options || "").replace(/^[?;]/, "").trim();
    if (optionText) {
      sqlServerParts.push(...optionText.split(/[;&]/).filter(Boolean));
    }
    return sqlServerParts.join(";");
  }
  return `${normalized}://${u}${p}@${hostName}${prt}/${dbName}`;
}

/** Parse a supported DB URL into parts (returns null when unparseable). */
export function parseDatabaseUrl(
  url: string,
  expectedEngine?: string
): DatabaseUrlParts | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const engine = expectedEngine
    ? normalizeDatabaseEngine(expectedEngine)
    : "";
  try {
    if ((!engine || engine === "sqlserver") && raw.startsWith("sqlserver://") && raw.includes(";")) {
      const parsed = parseSqlServerConnectionString(raw);
      if (!parsed) return null;
      if (engine && parsed.engine !== engine) return null;
      return parsed;
    }
    if (raw.startsWith("file:")) {
      if (engine && engine !== "sqlite") return null;
      const file = raw.slice("file:".length);
      return {
        engine: "sqlite",
        file,
        database: file,
        host: "",
        port: null,
        user: "",
        password: "",
      };
    }
    const u = new URL(raw);
    const protocolEngine =
      u.protocol === "postgres:"
        ? "postgresql"
        : Object.entries(ENGINE_PROTOCOLS).find(
            ([, protocol]) => protocol === u.protocol
          )?.[0] || "";
    if (!protocolEngine) return null;
    const normalized = normalizeDatabaseEngine(protocolEngine);
    if (engine && normalized !== engine) return null;
    return {
      engine: normalized,
      user: decodeURIComponent(u.username || ""),
      password: decodeURIComponent(u.password || ""),
      host: u.hostname || "",
      port: u.port
        ? Number(u.port)
        : normalized === "mysql"
          ? 3306
          : normalized === "sqlserver"
            ? 1433
            : 5432,
      database: decodeURIComponent(u.pathname.replace(/^\//, "") || ""),
    };
  } catch {
    return null;
  }
}

/** Mask the password in a connection URL for safe display/logging. */
export function maskDatabaseUrl(url: string, engine?: string): string {
  const parts = parseDatabaseUrl(url, engine);
  if (!parts) return "";
  if (parts.engine === "sqlite") return parts.database ? `file:${parts.database}` : "";
  return buildDatabaseUrl({ ...parts, password: parts.password ? "***" : "" });
}

/** Validate a candidate database URL shape. */
export function isValidDatabaseUrl(url: string, engine?: string): boolean {
  const parts = parseDatabaseUrl(url, engine);
  if (!parts) return false;
  if (parts.engine === "sqlite") return Boolean(parts.database);
  return Boolean(parts.host && parts.database);
}
