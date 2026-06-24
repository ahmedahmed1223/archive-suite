/**
 * DR Drill + Health-probe REST endpoints.
 *
 * GET  /api/backups/health-probe  — current probe status
 * POST /api/backups/drill-now     — admin only, run a DR drill immediately
 * GET  /api/backups/drill-history — last N drill results (in-memory)
 *
 * Mounted by archive-server/src/routes/backupRoutes.js via delegation.
 * Singletons are created lazily on first import; pass the manifest loader
 * so the drill scheduler has access to live manifest data.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../../config/env.js";
import { createHealthProbe } from "./healthProbe.js";
import { createDrDrillScheduler } from "./drDrill.js";
import { createLogger } from "../../logger.js";

const log = createLogger("backup-dr-routes");

// ---------------------------------------------------------------------------
// Singletons — created once and shared across requests
// ---------------------------------------------------------------------------

const MANIFEST_FILE = join(config.backupDir, "replication-manifest.json");

function loadManifest() {
  if (!existsSync(MANIFEST_FILE)) return [];
  try {
    return JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
  } catch {
    return [];
  }
}

const _manifest = {
  getEntries: loadManifest,
};

/**
 * Health probe — singleton.
 * probeUrl falls back to localhost self-check when not configured.
 */
const _probeUrl = config.backup?.replication?.probeUrl
  || `http://127.0.0.1:${config.port}/api/health`;

export const healthProbe = createHealthProbe({
  probeUrl: _probeUrl,
  intervalMs: 30_000,
  failThreshold: 3,
  onFailoverNeeded: (status) => {
    log.warn({ status }, "Health probe: failover threshold reached.");
  },
  onRecovered: (status) => {
    log.info({ status }, "Health probe: primary recovered.");
  },
});

/**
 * DR Drill scheduler — singleton.
 */
export const drDrillScheduler = createDrDrillScheduler({
  manifest: _manifest,
  config,
  logger: log,
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Handle DR drill + health-probe routes.
 * Returns true if handled, false to fall through.
 */
export async function handleDrRoute({
  req,
  res,
  url,
  send,
  overLimit,
  requireAuth,
  requireAdmin,
}) {
  const path = url.split("?")[0];

  // GET /api/backups/health-probe
  if (req.method === "GET" && path === "/api/backups/health-probe") {
    if (!requireAuth(req, res)) return true;
    const status = healthProbe.getStatus();
    return send(res, 200, { ok: true, probe: status }), true;
  }

  // POST /api/backups/drill-now
  if (req.method === "POST" && path === "/api/backups/drill-now") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;

    try {
      const result = await drDrillScheduler.runDrillNow();
      const statusCode = result.passed ? 200 : 422;
      return send(res, statusCode, { ok: result.passed, drill: result }), true;
    } catch (err) {
      log.error({ err }, "DR drill-now failed.");
      return send(res, 500, { ok: false, error: err?.message || "Drill failed" }), true;
    }
  }

  // GET /api/backups/drill-history
  if (req.method === "GET" && path === "/api/backups/drill-history") {
    if (!requireAuth(req, res)) return true;
    const history = drDrillScheduler.getHistory().slice(-10).reverse();
    return send(res, 200, { ok: true, history }), true;
  }

  return false;
}
