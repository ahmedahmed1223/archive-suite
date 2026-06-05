import {
  DATABASE_ENGINES,
  maskDatabaseUrl,
  isValidDatabaseUrl,
  normalizeDatabaseEngine
} from "../config/secrets.js";
import { classifyDatabaseTarget } from "../config/serverConfig.js";

// Admin DB-config helpers (Phase 3). Pure shaping/validation + an injectable
// Postgres connection test. The HTTP routes (admin-only) live in server.js.

/** Build the safe (password-masked) config view returned to the admin UI. */
export function buildConfigView(resolved = {}) {
  const url = resolved.databaseUrl || "";
  const engine = normalizeDatabaseEngine(resolved.databaseEngine);
  return {
    database: {
      engine,
      url: maskDatabaseUrl(url, engine),
      source: resolved.databaseSource || "none",   // file | env | default | none
      target: resolved.databaseTarget || classifyDatabaseTarget(url, engine), // bundled | external | file | unknown
      supportedEngines: DATABASE_ENGINES
    },
    fileStore: {
      kind: resolved.fileStore || "disk",
      source: resolved.fileStoreSource || "default", // file | env | default
      disk: {
        rootDir: resolved.fileStoreDir || ""
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
  if (!["disk", "dropbox"].includes(kind)) {
    const e = new Error("نوع FileStore غير مدعوم هنا. المدعوم حاليا: disk أو dropbox.");
    e.statusCode = 400;
    throw e;
  }
  if (kind === "disk") {
    return {
      kind,
      disk: {
        rootDir: String(input?.disk?.rootDir || "").trim()
      }
    };
  }
  const accessToken = String(input?.dropbox?.accessToken || "").trim();
  const accessTokenExpiresAt = String(input?.dropbox?.accessTokenExpiresAt || "").trim();
  const refreshToken = String(input?.dropbox?.refreshToken || "").trim();
  const appKey = String(input?.dropbox?.appKey || "").trim();
  const appSecret = String(input?.dropbox?.appSecret || "").trim();
  const rootPath = String(input?.dropbox?.rootPath || "").trim();
  const selectUser = String(input?.dropbox?.selectUser || "").trim();
  const selectAdmin = String(input?.dropbox?.selectAdmin || "").trim();
  return {
    kind,
    dropbox: {
      ...(accessToken ? { accessToken } : {}),
      ...(accessTokenExpiresAt ? { accessTokenExpiresAt } : {}),
      ...(refreshToken ? { refreshToken } : {}),
      ...(appKey ? { appKey } : {}),
      ...(appSecret ? { appSecret } : {}),
      rootPath,
      selectUser,
      selectAdmin
    }
  };
}

/** Merge FileStore config, preserving an existing Dropbox token when omitted. */
export function mergeFileStoreConfig(existing = {}, next = {}) {
  const base = existing && typeof existing === "object" ? existing : {};
  const current = base.fileStore && typeof base.fileStore === "object" ? base.fileStore : {};
  const merged = { ...current, kind: next.kind };
  if (next.kind === "disk") {
    merged.disk = {
      ...(current.disk || {}),
      ...(next.disk?.rootDir ? { rootDir: next.disk.rootDir } : {})
    };
  }
  if (next.kind === "dropbox") {
    merged.dropbox = {
      ...(current.dropbox || {}),
      ...(typeof next.dropbox?.rootPath === "string" ? { rootPath: next.dropbox.rootPath } : {}),
      ...(typeof next.dropbox?.selectUser === "string" ? { selectUser: next.dropbox.selectUser } : {}),
      ...(typeof next.dropbox?.selectAdmin === "string" ? { selectAdmin: next.dropbox.selectAdmin } : {}),
      ...(next.dropbox?.appKey ? { appKey: next.dropbox.appKey } : {}),
      ...(next.dropbox?.appSecret ? { appSecret: next.dropbox.appSecret } : {}),
      ...(next.dropbox?.accessToken ? { accessToken: next.dropbox.accessToken } : {}),
      ...(next.dropbox?.accessTokenExpiresAt ? { accessTokenExpiresAt: next.dropbox.accessTokenExpiresAt } : {}),
      ...(next.dropbox?.refreshToken ? { refreshToken: next.dropbox.refreshToken } : {})
    };
  }
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
