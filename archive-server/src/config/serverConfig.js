import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

import {
  DEFAULT_DATABASE_ENGINE,
  buildDatabaseUrl,
  parseDatabaseUrl,
  isValidDatabaseUrl,
  normalizeDatabaseEngine
} from "./secrets.js";
import { createLogger } from "../logger.js";

const log = createLogger("serverConfig");

// Server-config layer (Phase 2) — the single source of truth for the runtime
// database target, with precedence: persisted file > env > built-from-POSTGRES_*.
//
// A persisted config file (mounted on a Docker volume) lets an admin switch the
// DB target from the in-app settings (Phase 3/4); the change is applied on the
// next boot. resolveServerConfig() is pure given { file, env } so it's fully
// unit-tested; the file I/O helpers are thin and separate.

export const DEFAULT_CONFIG_PATH = process.env.SERVER_CONFIG_PATH || "config/server-config.json";

/** Read the persisted config JSON (returns {} when missing/invalid). */
export function loadServerConfigFile(file = DEFAULT_CONFIG_PATH) {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    if (err.code !== "ENOENT") {
      // Log parse/read errors explicitly so operators know the file is corrupt.
      log.error({ err, file }, "Failed to read config file");
    }
    return {};
  }
}

/**
 * Persist the config JSON atomically (write to sibling temp file, then rename).
 * Rename is atomic on POSIX filesystems, so a crash mid-write never leaves a
 * partially-written config. On Windows, rename over an existing file succeeds
 * via writeFileSync fall-through if renameSync throws EXDEV.
 */
export function saveServerConfigFile(config, file = DEFAULT_CONFIG_PATH) {
  const target = path.resolve(file);
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp.${randomBytes(4).toString("hex")}`;
  writeFileSync(tmp, JSON.stringify(config ?? {}, null, 2));
  try {
    renameSync(tmp, target);
  } catch {
    // Fallback for cross-device rename (EXDEV) — not atomic but still correct.
    writeFileSync(target, JSON.stringify(config ?? {}, null, 2));
    try { renameSync(tmp, tmp + ".del"); } catch { /* ignore */ }
  }
  return true;
}

/** Resolve the effective database engine + DATABASE_URL + where they came from. Pure. */
export function resolveDatabaseUrl({ file = {}, env = process.env } = {}) {
  const fileEngine = file?.database?.engine ? normalizeDatabaseEngine(file.database.engine) : "";
  const envEngine = env.DATABASE_PROVIDER ? normalizeDatabaseEngine(env.DATABASE_PROVIDER) : "";
  const defaultEngine = env.POSTGRES_PASSWORD || env.POSTGRES_USER ? DEFAULT_DATABASE_ENGINE : "";
  const fromFile = file?.database?.url;
  if (isValidDatabaseUrl(fromFile, fileEngine || undefined)) {
    const parsed = parseDatabaseUrl(fromFile, fileEngine || undefined);
    return { url: fromFile, engine: parsed?.engine || fileEngine || DEFAULT_DATABASE_ENGINE, source: "file" };
  }
  if (isValidDatabaseUrl(env.DATABASE_URL, envEngine || undefined)) {
    const parsed = parseDatabaseUrl(env.DATABASE_URL, envEngine || undefined);
    return { url: env.DATABASE_URL, engine: parsed?.engine || envEngine || DEFAULT_DATABASE_ENGINE, source: "env" };
  }
  if (env.POSTGRES_PASSWORD || env.POSTGRES_USER) {
    const url = buildDatabaseUrl({
      engine: DEFAULT_DATABASE_ENGINE,
      user: env.POSTGRES_USER || "archive",
      password: env.POSTGRES_PASSWORD || "",
      host: env.POSTGRES_HOST || "postgres",
      port: env.POSTGRES_PORT || 5432,
      database: env.POSTGRES_DB || "archive"
    });
    if (isValidDatabaseUrl(url, DEFAULT_DATABASE_ENGINE)) return { url, engine: DEFAULT_DATABASE_ENGINE, source: "default" };
  }
  return { url: "", engine: fileEngine || envEngine || defaultEngine || DEFAULT_DATABASE_ENGINE, source: "none" };
}

/** Is this connection the bundled (in-stack) Postgres, or an external server? */
export function classifyDatabaseTarget(url, engine) {
  const parts = parseDatabaseUrl(url, engine);
  if (!parts) return "unknown";
  if (parts.engine === "sqlite") return "file";
  const local = new Set(["postgres", "localhost", "127.0.0.1", "::1"]);
  return local.has(parts.host) ? "bundled" : "external";
}

const VALID_FILE_STORES = new Set(["disk", "dropbox", "s3", "azure", "gdrive", "ftp", "smb", "sftp", "webdav"]);

function normalizeFileStoreKind(value) {
  const kind = String(value || "").trim().toLowerCase();
  return VALID_FILE_STORES.has(kind) ? kind : "";
}

/** Resolve the effective FileStore + where it came from. Pure. */
export function resolveFileStoreConfig({ file = {}, env = process.env } = {}) {
  const fileKind = normalizeFileStoreKind(file?.fileStore?.kind);
  const envKind = normalizeFileStoreKind(env.FILE_STORE);
  const fileStore = fileKind || envKind || "disk";
  const source = fileKind ? "file" : envKind ? "env" : "default";
  const disk = file?.fileStore?.disk || {};
  const dropbox = file?.fileStore?.dropbox || {};
  return {
    fileStore,
    fileStoreSource: source, // file | env | default
    fileStoreDir: disk.rootDir || env.FILE_STORE_DIR,
    dropboxAccessToken: dropbox.accessToken || env.DROPBOX_ACCESS_TOKEN,
    dropboxAccessTokenExpiresAt: dropbox.accessTokenExpiresAt || env.DROPBOX_ACCESS_TOKEN_EXPIRES_AT,
    dropboxRefreshToken: dropbox.refreshToken || env.DROPBOX_REFRESH_TOKEN,
    dropboxAppKey: dropbox.appKey || env.DROPBOX_APP_KEY,
    dropboxAppSecret: dropbox.appSecret || env.DROPBOX_APP_SECRET,
    dropboxRootPath: dropbox.rootPath || env.DROPBOX_ROOT_PATH,
    dropboxSelectUser: dropbox.selectUser || env.DROPBOX_SELECT_USER,
    dropboxSelectAdmin: dropbox.selectAdmin || env.DROPBOX_SELECT_ADMIN
  };
}

/** The resolved runtime config. Pure given file+env. */
export function resolveServerConfig({ file = loadServerConfigFile(), env = process.env } = {}) {
  const db = resolveDatabaseUrl({ file, env });
  const fileStore = resolveFileStoreConfig({ file, env });
  return {
    databaseUrl: db.url,
    databaseEngine: db.engine,
    databaseSource: db.source,        // file | env | default | none
    databaseTarget: classifyDatabaseTarget(db.url, db.engine), // bundled | external | file | unknown
    ...fileStore
  };
}
