// presetConfig.js — reads non-secret environment variables and returns a
// structured summary for the onboarding wizard's "Use existing config" screen.
// Passwords and cryptographic keys are deliberately excluded.

import { createLogger } from "../logger.js";

const log = createLogger("presetConfig");

async function testPocketBaseReachability(url) {
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

async function testPostgresReachability(databaseUrl) {
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

/**
 * Returns a non-secret summary of the server's current .env configuration.
 * Used by the onboarding wizard to pre-fill setup steps.
 *
 * @returns {Promise<object>}
 */
export async function getPresetConfig() {
  const backend = (process.env.BACKEND || "pocketbase").toLowerCase();
  const pocketbaseUrl = process.env.POCKETBASE_URL || "";
  const databaseUrl = process.env.DATABASE_URL || "";
  const adminEmail = process.env.ADMIN_EMAIL || "";

  const hasAdminEmail = !!adminEmail;
  const hasAdminPassword = !!process.env.ADMIN_PASSWORD;
  const hasJwtSecret = !!process.env.JWT_SECRET;
  const hasMasterKey = !!(process.env.MASTER_KEY || process.env.BACKUP_ENCRYPTION_KEY);

  let dbReachable = false;
  try {
    if (backend === "pocketbase" && pocketbaseUrl) {
      dbReachable = await testPocketBaseReachability(pocketbaseUrl);
    } else if (backend === "postgres" && databaseUrl) {
      dbReachable = await testPostgresReachability(databaseUrl);
    }
  } catch (err) {
    log.warn({ err }, "DB reachability test failed");
  }

  const isFullyConfigured =
    hasAdminEmail &&
    hasAdminPassword &&
    hasJwtSecret &&
    (backend === "pocketbase" ? !!pocketbaseUrl : !!databaseUrl);

  return {
    backend,
    pocketbaseUrl: backend === "pocketbase" ? pocketbaseUrl : "",
    hasDatabaseUrl: backend === "postgres" && !!databaseUrl,
    adminEmail,
    hasAdminEmail,
    hasAdminPassword,
    hasJwtSecret,
    hasMasterKey,
    dbReachable,
    isFullyConfigured,
  };
}
