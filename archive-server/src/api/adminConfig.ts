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

interface FileStoreProvider {
  id: string;
  label: string;
  configured?: boolean;
  missingEnv?: string[];
  active?: boolean;
}

interface FileStoreProviderInput {
  id: string;
  requiredEnv?: string[];
  requiredAny?: string[][];
}

interface DatabaseConfig {
  engine: string;
  url: string;
}

interface ConfigViewDatabase {
  engine: string;
  url: string;
  source: string;
  target: string;
  supportedEngines: string[];
}

interface ConfigViewFileStore {
  kind: string;
  source: string;
  active: boolean;
  configured: boolean;
  missingEnv: string[];
  restartRequired: boolean;
  providers: FileStoreProvider[];
  config: Record<string, unknown>;
  disk: Record<string, string>;
  dropbox: Record<string, unknown>;
}

interface ConfigView {
  database: ConfigViewDatabase;
  fileStore: ConfigViewFileStore;
}

interface TestConnectionResult {
  ok: boolean;
  error?: string;
  engine?: string;
  mode?: string;
  warning?: string;
}

interface FileStoreConnectionResult {
  ok: boolean;
  latencyMs: number;
  provider: string;
  error?: string;
}

type FileStoreConfigFields = typeof FILE_STORE_CONFIG_FIELDS;
type FileStoreConfigFieldKey = keyof FileStoreConfigFields;

function upperFirst(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

function safeProviderConfig(config?: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config || {})) {
    if (FILE_STORE_SECRET_FIELDS.has(key)) {
      result[`has${upperFirst(key)}`] = Boolean(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function buildConfigView(resolved: Record<string, unknown> = {}): ConfigView {
  const url = resolved.databaseUrl || "";
  const engine = normalizeDatabaseEngine(resolved.databaseEngine as string);
  const kind = resolved.fileStore || "disk";
  const activeStatus = (resolved.fileStoreProviders as FileStoreProvider[] || []).find((provider) => provider.id === kind) || {};
  const providerConfig = safeProviderConfig(resolved.fileStoreOptions as Record<string, unknown> || {});
  return {
    database: {
      engine,
      url: maskDatabaseUrl(String(url), engine),
      source: resolved.databaseSource as string || "none",
      target: resolved.databaseTarget as string || classifyDatabaseTarget(String(url), engine),
      supportedEngines: [...DATABASE_ENGINES]
    },
    fileStore: {
      kind: String(kind),
      source: resolved.fileStoreSource as string || "default",
      active: true,
      configured: (activeStatus as any).configured ?? kind === "disk",
      missingEnv: (activeStatus as any).missingEnv || [],
      restartRequired: false,
      providers: resolved.fileStoreProviders as FileStoreProvider[] || [],
      config: providerConfig,
      disk: {
        rootDir: resolved.fileStoreDir as string || (kind === "disk" ? String(providerConfig.rootDir || "") : "") || ""
      },
      dropbox: {
        rootPath: resolved.dropboxRootPath as string || "",
        appKey: resolved.dropboxAppKey as string || "",
        selectUser: resolved.dropboxSelectUser as string || "",
        selectAdmin: resolved.dropboxSelectAdmin as string || "",
        hasAccessToken: Boolean(resolved.dropboxAccessToken),
        hasRefreshToken: Boolean(resolved.dropboxRefreshToken),
        hasAppSecret: Boolean(resolved.dropboxAppSecret)
      }
    }
  };
}

export function validateDbUrl(url: string | unknown, engine: string = "postgresql"): string {
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
    (e as any).statusCode = 400;
    throw e;
  }
  return clean;
}

export function validateDbConfig(input: Record<string, unknown> = {}): DatabaseConfig {
  const engine = normalizeDatabaseEngine(input?.engine as string || "postgresql");
  const url = validateDbUrl(input?.url as string, engine);
  return { engine, url };
}

export function mergeDbConfig(existing: Record<string, unknown> = {}, next: string | Record<string, unknown> = {}): Record<string, unknown> {
  const candidate = typeof next === "string" ? { engine: "postgresql", url: next } : validateDbConfig(next as Record<string, unknown>);
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    database: { ...(existing?.database || {}), engine: candidate.engine, url: candidate.url }
  };
}

export function validateFileStoreConfig(input: Record<string, unknown> = {}): Record<string, unknown> {
  const kind = String(input?.kind || "").trim().toLowerCase();
  const fields = FILE_STORE_CONFIG_FIELDS[kind as FileStoreConfigFieldKey];
  if (!fields) {
    const e = new Error("نوع FileStore غير مدعوم.");
    (e as any).statusCode = 400;
    throw e;
  }
  const source = input?.[kind] && typeof input[kind] === "object" ? input[kind] : {};
  const clean: Record<string, unknown> = {};
  for (const field of fields) {
    if (!Object.hasOwn(source as object, field)) continue;
    const value = (source as Record<string, unknown>)[field];
    if (typeof value === "boolean") clean[field] = value;
    else if (typeof value === "number" && Number.isFinite(value)) clean[field] = value;
    else {
      const text = String(value ?? "").trim();
      if (text || !FILE_STORE_SECRET_FIELDS.has(field)) clean[field] = text;
    }
  }
  return { kind, [kind]: clean };
}

export function mergeFileStoreConfig(existing: Record<string, unknown> = {}, next: Record<string, unknown> = {}): Record<string, unknown> {
  const base = existing && typeof existing === "object" ? existing : {};
  const current = base.fileStore && typeof base.fileStore === "object" ? base.fileStore : {};
  const merged: Record<string, unknown> = { ...current as Record<string, unknown>, kind: next.kind };
  const provider = String(next.kind);
  (merged)[provider] = { ...(current as Record<string, unknown>)?.[provider] || {}, ...(next[provider] || {}) };
  return { ...base, fileStore: merged };
}

interface PgClientConfig {
  connectionString: string;
  connectionTimeoutMillis: number;
}

interface PgModule {
  Client: new (config: PgClientConfig) => {
    connect(): Promise<void>;
    query(sql: string): Promise<unknown>;
    end(): Promise<void>;
  };
}

interface TestConnectionOptions {
  pgModule?: PgModule;
  connectionTimeoutMillis?: number;
  connectors?: Record<string, (config: DatabaseConfig, options: unknown) => Promise<TestConnectionResult>>;
}

export async function testPostgresConnection(url: string, { pgModule, connectionTimeoutMillis = 5000 } = {} as TestConnectionOptions): Promise<TestConnectionResult> {
  let pg = pgModule;
  if (!pg) {
    const mod = await import("pg");
    pg = (mod.default || mod) as any;
  }
  const client = new (pg as any).Client({ connectionString: url, connectionTimeoutMillis });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as any)?.message || "تعذّر الاتصال بقاعدة البيانات." };
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

export async function testDatabaseConnection(config: string | Record<string, unknown> = {}, options: TestConnectionOptions = {}): Promise<TestConnectionResult> {
  const candidate = typeof config === "string" ? validateDbConfig({ engine: "postgresql", url: config }) : validateDbConfig(config as Record<string, unknown>);
  const custom = options.connectors?.[candidate.engine];
  if (typeof custom === "function") {
    return custom(candidate, options);
  }
  if (candidate.engine === "postgresql") {
    return testPostgresConnection(candidate.url, options);
  }
  return {
    ok: true,
    engine: candidate.engine,
    mode: "validated",
    warning: "تم التحقق من شكل الرابط. اختبار الاتصال الحي يتطلب تشغيل الخادم بمحوّل Prisma المناسب لهذا المحرّك."
  };
}

interface FileStore {
  putBlob(key: string, data: Buffer | NodeJS.ReadableStream, options?: { contentType?: string }): Promise<{ key: string; url: string }>;
  getBlob(key: string): Promise<Buffer | null>;
  list(prefix: string): Promise<string[]>;
  remove(key: string): Promise<void>;
  putStream?(key: string, stream: NodeJS.ReadableStream, options?: { contentType?: string }): Promise<{ key: string; url: string }>;
  describe?(): { kind: string };
}

export async function testFileStoreConnection(store: FileStore, { key = `.archive-health/${Date.now()}-probe.txt` } = {}): Promise<FileStoreConnectionResult> {
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
    return { ok: false, latencyMs: Date.now() - startedAt, provider: store?.describe?.().kind || "unknown", error: (error as any)?.message || "فشل اختبار مخزن الملفات." };
  } finally {
    try { await store.remove(key); } catch { /* best-effort probe cleanup */ }
  }
}
