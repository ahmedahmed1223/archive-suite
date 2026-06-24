/**
 * DR Drill scheduler — runs automated Disaster Recovery drills on a schedule.
 *
 * All I/O is injectable for testability:
 *   - restoreSmokeRunner: replaces the real runRestoreSmoke
 *   - manifest: object with findRestorableEntry (and a getEntries() helper)
 *   - logger: pino-compatible child logger
 *
 * Usage:
 *   const scheduler = createDrDrillScheduler({ manifest, config, logger });
 *   scheduler.start();
 *   const result = await scheduler.runDrillNow();
 *   scheduler.stop();
 */

import { runRestoreSmoke } from "./restoreSmoke.js";
import { findRestorableEntry } from "./manifest.js";
import { createLogger } from "../../logger.js";

const AUDIT_PASS = "BACKUP_DRILL_PASS";
const AUDIT_FAIL = "BACKUP_DRILL_FAIL";

const MAX_HISTORY = 100;

/**
 * @param {object} options
 * @param {Function} [options.restoreSmokeRunner]  Injectable restore smoke runner
 * @param {object}   [options.manifest]            Object with getEntries() → entry[]
 * @param {object}   [options.config]              Server config (backup.replication.*)
 * @param {object}   [options.logger]              Pino-compatible logger
 * @returns {{ start: Function, stop: Function, runDrillNow: Function, getHistory: Function }}
 */
export function createDrDrillScheduler({
  restoreSmokeRunner = null,
  manifest = null,
  config = null,
  logger = null,
}) {
  const _smokeRunner = restoreSmokeRunner || runRestoreSmoke;
  const _log = logger || createLogger("backup-dr-drill");

  // History — bounded in-memory array, no DB
  const _history = [];

  let _intervalHandle = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _getEntries() {
    if (manifest && typeof manifest.getEntries === "function") {
      return manifest.getEntries();
    }
    return [];
  }

  function _getEncryptionKey() {
    return config?.backup?.replication?.encryptionKey || "";
  }

  function _getDrillIntervalMs() {
    const hours = config?.backup?.replication?.drillIntervalHours ?? 24;
    return hours * 60 * 60 * 1000;
  }

  function _pushHistory(entry) {
    _history.push(entry);
    if (_history.length > MAX_HISTORY) {
      _history.splice(0, _history.length - MAX_HISTORY);
    }
  }

  // ── Core drill logic ──────────────────────────────────────────────────────

  async function runDrillNow() {
    const t0 = Date.now();
    const entries = _getEntries();
    const latest = findRestorableEntry(entries);

    if (!latest) {
      const result = {
        passed: false,
        replicaId: null,
        durationMs: Date.now() - t0,
        error: "No restorable replica found in manifest",
      };
      _log.warn({ audit: AUDIT_FAIL, result }, "DR drill skipped — no replica.");
      _pushHistory({ ...result, ranAt: new Date().toISOString() });
      return result;
    }

    const encryptionKey = _getEncryptionKey();

    let smokeResult;
    try {
      smokeResult = await _smokeRunner({ entry: latest, encryptionKey });
    } catch (err) {
      const result = {
        passed: false,
        replicaId: latest.backupId,
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      };
      _log.warn({ audit: AUDIT_FAIL, result }, "DR drill FAILED (exception).");
      _pushHistory({ ...result, ranAt: new Date().toISOString() });
      return result;
    }

    const durationMs = Date.now() - t0;
    const passed = smokeResult.ok === true;

    const result = {
      passed,
      replicaId: latest.backupId,
      durationMs,
      ...(passed ? {} : { error: (smokeResult.errors || []).join("; ") }),
    };

    if (passed) {
      _log.info({ audit: AUDIT_PASS, result }, "DR drill PASSED.");
    } else {
      _log.warn({ audit: AUDIT_FAIL, result }, "DR drill FAILED.");
    }

    _pushHistory({ ...result, ranAt: new Date().toISOString() });
    return result;
  }

  // ── Scheduler ──────────────────────────────────────────────────────────────

  function start() {
    if (_intervalHandle !== null) return scheduler;
    const intervalMs = _getDrillIntervalMs();
    _intervalHandle = setInterval(() => {
      runDrillNow().catch((err) => {
        _log.error({ err }, "Unexpected error in scheduled DR drill.");
      });
    }, intervalMs);
    return scheduler;
  }

  function stop() {
    if (_intervalHandle !== null) {
      clearInterval(_intervalHandle);
      _intervalHandle = null;
    }
  }

  function getHistory() {
    return [..._history];
  }

  const scheduler = { start, stop, runDrillNow, getHistory };
  return scheduler;
}
