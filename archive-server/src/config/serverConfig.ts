import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

import {
  DEFAULT_DATABASE_ENGINE,
  buildDatabaseUrl,
  parseDatabaseUrl,
  isValidDatabaseUrl,
  normalizeDatabaseEngine,
} from "./secrets.js";
import { createLogger } from "../logger.js";
import { config as envConfig } from "./env.js";

const log = createLogger("serverConfig");

// Server-config layer (Phase 2) — the single source of truth for the runtime
// database target, with precedence: persisted file > env > built-from-POSTGRES_*.
//
// A persisted config file (mounted on a Docker volume) lets an admin switch the
// DB target from the in-app settings (Phase 3/4); the change is applied on the
// next boot. resolveServerConfig() is pure given { file, env } so it's fully
// unit-tested; the file I/O helpers are thin and separate.

export const DEFAULT_CONFIG_PATH = envConfig.serverConfigPath;

/** Read the persisted config JSON (returns {} when missing/invalid). */
export function loadServerConfigFile(file: string = DEFAULT_CONFIG_PATH): unknown {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err: unknown) {
    const fsErr = err as NodeJS.ErrnoException;
    if (fsErr?.code !== "ENOENT") {
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
export function saveServerConfigFile(
  config: unknown,
  file: string = DEFAULT_CONFIG_PATH
): boolean {
  const target = path.resolve(file);
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp.${randomBytes(4).toString("hex")}`;
  writeFileSync(tmp, JSON.stringify(config ?? {}, null, 2));
  try {
    renameSync(tmp, target);
  } catch {
    // Fallback for cross-device rename (EXDEV) — not atomic but still correct.
    writeFileSync(target, JSON.stringify(config ?? {}, null, 2));
    try {
      renameSync(tmp, tmp + ".del");
    } catch {
      /* ignore */
    }
  }
  return true;
}

interface DatabaseResolution {
  url: string;
  engine: string;
  source: "file" | "env" | "default" | "none";
}

/** Resolve the effective database engine + DATABASE_URL + where they came from. Pure. */
export function resolveDatabaseUrl({
  file = {},
  env = process.env,
}: {
  file?: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
} = {}): DatabaseResolution {
  const fileEngine = (file as any)?.database?.engine
    ? normalizeDatabaseEngine((file as any).database.engine)
    : "";
  const envEngine = env.DATABASE_PROVIDER
    ? normalizeDatabaseEngine(env.DATABASE_PROVIDER)
    : String(env.BACKEND || "").toLowerCase() === "sqlserver"
      ? "sqlserver"
      : "";
  const defaultEngine =
    env.POSTGRES_PASSWORD || env.POSTGRES_USER
      ? DEFAULT_DATABASE_ENGINE
      : "";
  const fromFile = (file as any)?.database?.url;
  if (isValidDatabaseUrl(fromFile, fileEngine || undefined)) {
    const parsed = parseDatabaseUrl(fromFile, fileEngine || undefined);
    return {
      url: fromFile,
      engine: parsed?.engine || fileEngine || DEFAULT_DATABASE_ENGINE,
      source: "file",
    };
  }
  const envDatabaseUrl = envEngine === "sqlserver" && env.SQLSERVER_URL
    ? env.SQLSERVER_URL
    : env.DATABASE_URL;
  if (envDatabaseUrl && isValidDatabaseUrl(envDatabaseUrl, envEngine || undefined)) {
    const parsed = parseDatabaseUrl(envDatabaseUrl, envEngine || undefined);
    return {
      url: envDatabaseUrl || "",
      engine: parsed?.engine || envEngine || DEFAULT_DATABASE_ENGINE,
      source: "env",
    };
  }
  if (env.POSTGRES_PASSWORD || env.POSTGRES_USER) {
    const url = buildDatabaseUrl({
      engine: DEFAULT_DATABASE_ENGINE,
      user: env.POSTGRES_USER || "archive",
      password: env.POSTGRES_PASSWORD || "",
      host: env.POSTGRES_HOST || "postgres",
      port: env.POSTGRES_PORT || 5432,
      database: env.POSTGRES_DB || "archive",
    });
    if (isValidDatabaseUrl(url, DEFAULT_DATABASE_ENGINE))
      return { url, engine: DEFAULT_DATABASE_ENGINE, source: "default" };
  }
  return {
    url: "",
    engine: fileEngine || envEngine || defaultEngine || DEFAULT_DATABASE_ENGINE,
    source: "none",
  };
}

/** Is this connection the bundled (in-stack) Postgres, or an external server? */
export function classifyDatabaseTarget(
  url: string,
  engine?: string
): "file" | "bundled" | "external" | "unknown" {
  const parts = parseDatabaseUrl(url, engine);
  if (!parts) return "unknown";
  if (parts.engine === "sqlite") return "file";
  const local = new Set(["postgres", "localhost", "127.0.0.1", "::1"]);
  return local.has(parts.host) ? "bundled" : "external";
}

const VALID_FILE_STORES = new Set([
  "disk",
  "dropbox",
  "s3",
  "azure",
  "gdrive",
  "ftp",
  "smb",
  "sftp",
  "webdav",
]);

interface FileStoreEnvFields {
  [key: string]: { [field: string]: string };
}

const FILE_STORE_ENV_FIELDS: FileStoreEnvFields = Object.freeze({
  disk: { rootDir: "FILE_STORE_DIR" },
  dropbox: {
    accessToken: "DROPBOX_ACCESS_TOKEN",
    accessTokenExpiresAt: "DROPBOX_ACCESS_TOKEN_EXPIRES_AT",
    refreshToken: "DROPBOX_REFRESH_TOKEN",
    appKey: "DROPBOX_APP_KEY",
    appSecret: "DROPBOX_APP_SECRET",
    rootPath: "DROPBOX_ROOT_PATH",
    selectUser: "DROPBOX_SELECT_USER",
    selectAdmin: "DROPBOX_SELECT_ADMIN",
  },
  s3: {
    bucket: "S3_BUCKET",
    prefix: "S3_PREFIX",
    region: "S3_REGION",
    endpoint: "S3_ENDPOINT",
    accessKeyId: "S3_ACCESS_KEY_ID",
    secretAccessKey: "S3_SECRET_ACCESS_KEY",
    forcePathStyle: "S3_FORCE_PATH_STYLE",
  },
  azure: {
    connectionString: "AZURE_STORAGE_CONNECTION_STRING",
    container: "AZURE_STORAGE_CONTAINER",
    accountName: "AZURE_STORAGE_ACCOUNT",
    accountKey: "AZURE_STORAGE_KEY",
    accountUrl: "AZURE_STORAGE_ACCOUNT_URL",
    sasToken: "AZURE_STORAGE_SAS",
    prefix: "AZURE_STORAGE_PREFIX",
  },
  gdrive: {
    folderId: "GDRIVE_FOLDER_ID",
    credentials: "GDRIVE_CREDENTIALS",
    prefix: "GDRIVE_PREFIX",
  },
  ftp: {
    host: "FTP_HOST",
    port: "FTP_PORT",
    user: "FTP_USER",
    password: "FTP_PASSWORD",
    secure: "FTP_SECURE",
    root: "FTP_ROOT",
  },
  smb: {
    share: "SMB_SHARE",
    domain: "SMB_DOMAIN",
    username: "SMB_USERNAME",
    password: "SMB_PASSWORD",
    root: "SMB_ROOT",
  },
  sftp: {
    host: "SFTP_HOST",
    port: "SFTP_PORT",
    username: "SFTP_USERNAME",
    password: "SFTP_PASSWORD",
    privateKey: "SFTP_PRIVATE_KEY",
    passphrase: "SFTP_PASSPHRASE",
    root: "SFTP_ROOT",
  },
  webdav: {
    url: "WEBDAV_URL",
    username: "WEBDAV_USERNAME",
    password: "WEBDAV_PASSWORD",
    bearerToken: "WEBDAV_BEARER_TOKEN",
    root: "WEBDAV_ROOT",
  },
});

function normalizeOptionValue(
  field: string,
  value: unknown
): unknown {
  if (value === undefined || value === null) return undefined;
  if (["forcePathStyle", "secure"].includes(field))
    return value === true || String(value).toLowerCase() === "true";
  if (field === "port") return Number(value) || undefined;
  return value;
}

export function resolveFileStoreOptions(
  kind: string,
  fileStore?: Record<string, unknown>,
  env?: NodeJS.ProcessEnv
): Record<string, unknown> {
  const fields = FILE_STORE_ENV_FIELDS[kind] || {};
  const saved =
    fileStore?.[kind] && typeof fileStore[kind] === "object"
      ? (fileStore[kind] as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = {};
  const envToUse = env ?? process.env;
  for (const [field, envName] of Object.entries(fields)) {
    const value = Object.hasOwn(saved, field) ? saved[field] : envToUse[envName];
    const normalized = normalizeOptionValue(field, value);
    if (normalized !== undefined && normalized !== "") result[field] = normalized;
  }
  return result;
}

function providerConfigured(kind: string, options: Record<string, unknown>): boolean {
  const has = (...fields: string[]) =>
    fields.every((field) => Boolean(options[field]));
  if (kind === "disk") return true;
  if (kind === "dropbox")
    return Boolean(options.accessToken) || has("refreshToken", "appKey", "appSecret");
  if (kind === "s3") return has("bucket", "accessKeyId", "secretAccessKey");
  if (kind === "azure")
    return (
      has("connectionString", "container") ||
      has("accountName", "accountKey", "container") ||
      has("accountUrl", "sasToken", "container")
    );
  if (kind === "gdrive") return has("folderId", "credentials");
  if (kind === "ftp") return has("host", "user");
  if (kind === "smb") return has("share", "username");
  if (kind === "sftp")
    return has("host", "username") && Boolean(options.password || options.privateKey);
  if (kind === "webdav") return has("url");
  return false;
}

function normalizeFileStoreKind(value: unknown): string {
  const kind = String(value || "").trim().toLowerCase();
  return VALID_FILE_STORES.has(kind) ? kind : "";
}

interface FileStoreProvider {
  id: string;
  configured: boolean;
  active: boolean;
  missingEnv: string[];
}

interface FileStoreResolution {
  fileStore: string;
  fileStoreSource: "file" | "env" | "default";
  fileStoreOptions: Record<string, unknown>;
  fileStoreProviders: FileStoreProvider[];
  fileStoreDir: string;
  dropboxAccessToken: unknown;
  dropboxAccessTokenExpiresAt: unknown;
  dropboxRefreshToken: unknown;
  dropboxAppKey: unknown;
  dropboxAppSecret: unknown;
  dropboxRootPath: unknown;
  dropboxSelectUser: unknown;
  dropboxSelectAdmin: unknown;
}

/** Resolve the effective FileStore + where it came from. Pure. */
export function resolveFileStoreConfig({
  file = {},
  env = process.env,
}: {
  file?: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
} = {}): FileStoreResolution {
  const fileKind = normalizeFileStoreKind((file as any)?.fileStore?.kind);
  const envKind = normalizeFileStoreKind(env.FILE_STORE);
  const fileStore = fileKind || envKind || "disk";
  const source = fileKind ? "file" : envKind ? "env" : "default";
  const saved = (file as any)?.fileStore || {};
  const options = resolveFileStoreOptions(fileStore, saved, env);
  const providers: FileStoreProvider[] = [...VALID_FILE_STORES].map((id) => {
    const providerOptions = resolveFileStoreOptions(id, saved, env);
    return { id, configured: providerConfigured(id, providerOptions), active: id === fileStore, missingEnv: [] };
  });
  return {
    fileStore,
    fileStoreSource: source, // file | env | default
    fileStoreOptions: options,
    fileStoreProviders: providers,
    fileStoreDir:
      fileStore === "disk"
        ? (options.rootDir as string) || ""
        : ((resolveFileStoreOptions("disk", saved, env).rootDir as string) || ""),
    dropboxAccessToken: resolveFileStoreOptions("dropbox", saved, env)
      .accessToken,
    dropboxAccessTokenExpiresAt: resolveFileStoreOptions("dropbox", saved, env)
      .accessTokenExpiresAt,
    dropboxRefreshToken: resolveFileStoreOptions("dropbox", saved, env)
      .refreshToken,
    dropboxAppKey: resolveFileStoreOptions("dropbox", saved, env).appKey,
    dropboxAppSecret: resolveFileStoreOptions("dropbox", saved, env)
      .appSecret,
    dropboxRootPath: resolveFileStoreOptions("dropbox", saved, env).rootPath,
    dropboxSelectUser: resolveFileStoreOptions("dropbox", saved, env)
      .selectUser,
    dropboxSelectAdmin: resolveFileStoreOptions("dropbox", saved, env)
      .selectAdmin,
  };
}

interface ResolvedServerConfig {
  databaseUrl: string;
  databaseEngine: string;
  databaseSource: "file" | "env" | "default" | "none";
  databaseTarget: "file" | "bundled" | "external" | "unknown";
  fileStore: string;
  fileStoreSource: "file" | "env" | "default";
  fileStoreOptions: Record<string, unknown>;
  fileStoreProviders: FileStoreProvider[];
  fileStoreDir: string;
  dropboxAccessToken: unknown;
  dropboxAccessTokenExpiresAt: unknown;
  dropboxRefreshToken: unknown;
  dropboxAppKey: unknown;
  dropboxAppSecret: unknown;
  dropboxRootPath: unknown;
  dropboxSelectUser: unknown;
  dropboxSelectAdmin: unknown;
}

/** The resolved runtime config. Pure given file+env. */
export function resolveServerConfig({
  file,
  env = process.env,
}: {
  file?: unknown;
  env?: NodeJS.ProcessEnv;
} = {}): ResolvedServerConfig {
  const loadedFile = file ?? loadServerConfigFile();
  const db = resolveDatabaseUrl({ file: loadedFile as any, env });
  const fileStore = resolveFileStoreConfig({ file: loadedFile as any, env });
  return {
    databaseUrl: db.url,
    databaseEngine: db.engine,
    databaseSource: db.source, // file | env | default | none
    databaseTarget: classifyDatabaseTarget(db.url, db.engine), // bundled | external | file | unknown
    ...fileStore,
  };
}
