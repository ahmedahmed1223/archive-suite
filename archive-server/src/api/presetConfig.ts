import { ONBOARDING_CONFIG, ONBOARDING_FILE_STORE_PROVIDERS } from "../../config/onboarding.config.js";
import { createLogger } from "../logger.js";

const log = createLogger("presetConfig");

async function testPocketBaseReachability(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${url.replace(/\/$/, "")}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

async function testPostgresReachability(databaseUrl: string): Promise<boolean> {
  if (!databaseUrl) return false;
  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

function firstConfigured(env: Record<string, string | undefined>, names: string[] = []): string {
  for (const name of names) {
    const value = String(env?.[name] || "").trim();
    if (value) return value;
  }
  return "";
}

interface ProviderReadiness {
  id: string;
  label: string;
  configured: boolean;
  missingEnv: string[];
}

interface Provider {
  id: string;
  label: string;
  requiredEnv?: string[];
  requiredAny?: string[][];
}

function resolveProviderReadiness(provider: Provider, env: Record<string, string | undefined>): ProviderReadiness {
  const missing = (provider.requiredEnv || []).filter((name) => !String(env?.[name] || "").trim());
  const alternatives = provider.requiredAny || [];
  const anyReady = alternatives.length === 0 || alternatives.some((group) => group.every((name) => String(env?.[name] || "").trim()));
  if (!anyReady) {
    const shortest = [...alternatives].sort((a, b) => a.length - b.length)[0] || [];
    for (const name of shortest) {
      if (!String(env?.[name] || "").trim() && !missing.includes(name)) missing.push(name);
    }
  }
  return {
    id: provider.id,
    label: provider.label,
    configured: missing.length === 0,
    missingEnv: missing
  };
}

interface PresetConfigOptions {
  env?: Record<string, string | undefined>;
  testDatabase?: (url: string, env?: Record<string, string | undefined>) => Promise<boolean>;
  testPocketBase?: (url: string) => Promise<boolean>;
}

interface PresetConfigResult {
  backend: string;
  serverUrl: string;
  sameOrigin: boolean;
  adminUsername: string;
  adminPassword: string;
  mustChangePassword: boolean;
  authConfigured: boolean;
  database: { configured: boolean; reachable: boolean };
  fileStore: { active: string; providers: ProviderReadiness[] };
  pocketbaseUrl: string;
  hasDatabaseUrl: boolean;
  adminEmail: string;
  hasAdminEmail: boolean;
  hasAdminPassword: boolean;
  hasJwtSecret: boolean;
  hasMasterKey: boolean;
  dbReachable: boolean;
  isFullyConfigured: boolean;
}

export async function getPresetConfig({
  env = process.env,
  testDatabase = testPostgresReachability,
  testPocketBase = testPocketBaseReachability
}: PresetConfigOptions = {}): Promise<PresetConfigResult> {
  const backend = String(env[ONBOARDING_CONFIG.backend] || "pocketbase").toLowerCase();
  const serverUrl = String(env[ONBOARDING_CONFIG.serverUrl] || "").replace(/\/+$/, "");
  const pocketbaseUrl = String(env.POCKETBASE_URL || "");
  const databaseUrl = String(env.DATABASE_URL || "");
  const adminUsername = String(env[ONBOARDING_CONFIG.adminUsername] || env.ADMIN_EMAIL || "admin");
  const adminPassword = String(env[ONBOARDING_CONFIG.adminPassword] || "");
  const adminEmail = String(env.ADMIN_EMAIL || "");
  const authSecret = firstConfigured(env as Record<string, string | undefined>, ONBOARDING_CONFIG.authSecrets);

  const hasAdminEmail = Boolean(adminEmail || adminUsername);
  const hasAdminPassword = Boolean(adminPassword);
  const hasJwtSecret = Boolean(authSecret);
  const hasMasterKey = Boolean(env.MASTER_KEY || env.BACKUP_ENCRYPTION_KEY);
  const databaseConfigured = backend === "postgres" && Boolean(
    databaseUrl || env.POSTGRES_USER || env.POSTGRES_PASSWORD || testDatabase
  );

  let dbReachable = false;
  try {
    if (backend === "pocketbase" && pocketbaseUrl) {
      dbReachable = await testPocketBase(pocketbaseUrl);
    } else if (backend === "postgres" && databaseConfigured) {
      dbReachable = await testDatabase(databaseUrl, env as Record<string, string | undefined>);
    }
  } catch (err) {
    log.warn({ err }, "DB reachability test failed");
  }

  const isFullyConfigured =
    hasAdminEmail &&
    hasAdminPassword &&
    hasJwtSecret &&
    (backend === "pocketbase" ? Boolean(pocketbaseUrl) : databaseConfigured);

  const activeFileStore = String(env[ONBOARDING_CONFIG.fileStore] || "disk").toLowerCase();
  const providers = (ONBOARDING_FILE_STORE_PROVIDERS as Provider[]).map((provider) => ({
    ...resolveProviderReadiness(provider, env as Record<string, string | undefined>),
    active: provider.id === activeFileStore
  }));

  return {
    backend,
    serverUrl,
    sameOrigin: !serverUrl,
    adminUsername,
    adminPassword,
    mustChangePassword: hasAdminPassword,
    authConfigured: hasJwtSecret,
    database: {
      configured: backend === "pocketbase" ? Boolean(pocketbaseUrl) : databaseConfigured,
      reachable: dbReachable
    },
    fileStore: {
      active: activeFileStore,
      providers
    },
    pocketbaseUrl: backend === "pocketbase" ? pocketbaseUrl : "",
    hasDatabaseUrl: backend === "postgres" && !!databaseUrl,
    adminEmail: adminEmail || adminUsername,
    hasAdminEmail,
    hasAdminPassword,
    hasJwtSecret,
    hasMasterKey,
    dbReachable,
    isFullyConfigured,
  };
}
