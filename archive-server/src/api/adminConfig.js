import {
  DATABASE_ENGINES,
  maskDatabaseUrl,
  isValidDatabaseUrl,
  normalizeDatabaseEngine
} from "../config/secrets.js";
import { classifyDatabaseTarget } from "../config/serverConfig.js";

export const FILE_STORE_CONFIG_FIELDS = Object.freeze({
  disk: ["rootDir"],
  dropbox: ["rootPath", "accessToken", "accessTokenExpiresAt", "refreshToken", "appKey", "appSecret", "selectUser", "selectAdmin"],
  s3: ["bucket", "prefix", "region", "endpoint", "accessKeyId", "secretAccessKey", "forcePathStyle"],
  azure: ["connectionString", "container", "accountName", "accountKey", "accountUrl", "sasToken", "prefix"],
  gdrive: ["folderId", "credentials", "prefix"],
  ftp: ["host", "port", "user", "password", "secure", "root"],
  smb: ["share", "domain", "username", "password", "root"],
  sftp: ["host", "port", "username", "password", "privateKey", "passphrase", "root"],
  webdav: ["url", "username", "password", "bearerToken", "root"]
});

export const FILE_STORE_SECRET_FIELDS = new Set([
  "accessToken", "refreshToken", "appSecret", "secretAccessKey", "connectionString",
  "accountKey", "sasToken", "credentials", "password", "privateKey", "passphrase", "bearerToken"
]);

function upperFirst(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

function safeProviderConfig(config = {}) {
  const result = {};
  for (const [key, value] of Object.entries(config || {})) {
    if (FILE_STORE_SECRET_FIELDS.has(key)) {
      result[`has${upperFirst(key)}`] = Boolean(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Admin DB-config helpers (Phase 3). Pure shaping/validation + an injectable
// Postgres connection test. The HTTP routes (admin-only) live in server.js.

/** Build the safe (password-masked) config view returned to the admin UI. */
export function buildConfigView(resolved = {}) {
  const url = resolved.databaseUrl || "";
  const engine = normalizeDatabaseEngine(resolved.databaseEngine);
  const kind = resolved.fileStore || "disk";
  const activeStatus = (resolved.fileStoreProviders || []).find((provider) => provider.id === kind) || {};
  const providerConfig = safeProviderConfig(resolved.fileStoreOptions || {});
  return {
    database: {
      engine,
      url: maskDatabaseUrl(url, engine),
      source: resolved.databaseSource || "none",   // file | env | default | none
      target: resolved.databaseTarget || classifyDatabaseTarget(url, engine), // bundled | external | file | unknown
      supportedEngines: DATABASE_ENGINES
    },
    fileStore: {
      kind,
      source: resolved.fileStoreSource || "default", // file | env | default
      active: true,
      configured: activeStatus.configured ?? kind === "disk",
      missingEnv: activeStatus.missingEnv || [],
      restartRequired: false,
      providers: resolved.fileStoreProviders || [],
      config: providerConfig,
      disk: {
        rootDir: resolved.fileStoreDir || (kind === "disk" ? providerConfig.rootDir : "") || ""
      },
      dropbox: {
        rootPath: resolved.dropboxRootPath || "",
        appKey: resolved.dropboxAppKey || "",
        selectUser: resolved.dropboxSelectUser || "",
        selectAdmin: resolved.dropboxSelectAdmin || "",
        hasAccessToken: Boolean(resolved.dropboxAccessToken),
        hasRefreshToken: Boolean(resolved.dropboxRefreshToken),
        hasAppSecret: Boolean(resolved.dropboxAppSecret)
      }
    }
  };
}

/** Validate a candidate database URL (throws a 400 on bad shape). */
export function validateDbUrl(url, engine = "postgresql") {
  const normalizedEngine = normalizeDatabaseEngine(engine);
  const clean = String(url || "").trim();
  if (!isValidDatabaseUrl(clean, normalizedEngine)) {
    const example = normalizedEngine === "sqlite"
      ? "file:./archive.sqlite"
      : normalizedEngine === "mysql"
        ? "mysql://user:pass@host:3306/db"
        : normalizedEngine === "sqlserver"
          ? "sqlserver://user:pass@host:1433/db"
          : "postgresql://user:pass@host:5432/db";
    const e = new Error(`سلسلة اتصال قاعدة البيانات غير صالحة للمحرّك ${normalizedEngine} (مثال: ${example}).`);
    e.statusCode = 400;
    throw e;
  }
  return clean;
}

export function validateDbConfig(input = {}) {
  const engine = normalizeDatabaseEngine(input?.engine || "postgresql");
  const url = validateDbUrl(input?.url, engine);
  return { engine, url };
}

/** Merge a new DB url into the persisted config object (immutably). */
export function mergeDbConfig(existing = {}, next = {}) {
  const candidate = typeof next === "string" ? { engine: "postgresql", url: next } : validateDbConfig(next);
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    database: { ...(existing?.database || {}), engine: candidate.engine, url: candidate.url }
  };
}

/** Validate FileStore config shape accepted by the admin UI. */
export function validateFileStoreConfig(input = {}) {
  const kind = String(input?.kind || "").trim().toLowerCase();
  const fields = FILE_STORE_CONFIG_FIELDS[kind];
  if (!fields) {
    const e = new Error("نوع FileStore غير مدعوم.");
    e.statusCode = 400;
    throw e;
  }
  const source = input?.[kind] && typeof input[kind] === "object" ? input[kind] : {};
  const clean = {};
  for (const field of fields) {
    if (!Object.hasOwn(source, field)) continue;
    const value = source[field];
    if (typeof value === "boolean") clean[field] = value;
    else if (typeof value === "number" && Number.isFinite(value)) clean[field] = value;
    else {
      const text = String(value ?? "").trim();
      if (text || !FILE_STORE_SECRET_FIELDS.has(field)) clean[field] = text;
    }
  }
  return { kind, [kind]: clean };
}

/** Merge FileStore config, preserving an existing Dropbox token when omitted. */
export function mergeFileStoreConfig(existing = {}, next = {}) {
  const base = existing && typeof existing === "object" ? existing : {};
  const current = base.fileStore && typeof base.fileStore === "object" ? base.fileStore : {};
  const merged = { ...current, kind: next.kind };
  const provider = next.kind;
  merged[provider] = { ...(current[provider] || {}), ...(next[provider] || {}) };
  return { ...base, fileStore: merged };
}

/**
 * Test a Postgres connection. Returns { ok, error? } (never throws). The pg
 * module is injectable so unit tests don't open real sockets.
 */
export async function testPostgresConnection(url, { pgModule, connectionTimeoutMillis = 5000 } = {}) {
  let pg = pgModule;
  if (!pg) {
    const mod = await import("pg");
    pg = mod.default || mod;
  }
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "تعذّر الاتصال بقاعدة البيانات." };
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

export async function testDatabaseConnection(config = {}, options = {}) {
  const candidate = typeof config === "string" ? validateDbConfig({ engine: "postgresql", url: config }) : validateDbConfig(config);
  const custom = options.connectors?.[candidate.engine];
  if (typeof custom === "function") {
    return custom(candidate, options);
  }
  if (candidate.engine === "postgresql") {
    return testPostgresConnection(candidate.url, options);
  }
  // The server can persist non-Postgres Prisma targets, but live socket checks
  // need the matching driver adapter in the deployment image. Until configured,
  // this endpoint validates shape and reports that the active restart/migration
  // step owns the actual connection attempt.
  return {
    ok: true,
    engine: candidate.engine,
    mode: "validated",
    warning: "تم التحقق من شكل الرابط. اختبار الاتصال الحي يتطلب تشغيل الخادم بمحوّل Prisma المناسب لهذا المحرّك."
  };
}

export async function testFileStoreConnection(store, { key = `.archive-health/${Date.now()}-probe.txt` } = {}) {
  const startedAt = Date.now();
  try {
    await store.putBlob(key, Buffer.from("archive-health"));
    const value = await store.getBlob(key);
    if (!value || Buffer.from(value).toString() !== "archive-health") {
      throw new Error("فشل التحقق من الملف بعد رفعه.");
    }
    const listed = await store.list(".archive-health");
    if (!Array.isArray(listed)) throw new Error("المزوّد لم يعد قائمة ملفات صالحة.");
    return { ok: true, latencyMs: Date.now() - startedAt, provider: store.describe?.().kind || "unknown" };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - startedAt, provider: store?.describe?.().kind || "unknown", error: error?.message || "فشل اختبار مخزن الملفات." };
  } finally {
    try { await store.remove(key); } catch { /* best-effort probe cleanup */ }
  }
}
