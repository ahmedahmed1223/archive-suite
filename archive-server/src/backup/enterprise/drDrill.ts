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

interface ManifestEntry {
  backupId: string;
  createdAt: string;
  sizeBytes: number;
  sha256: string;
  region: string;
  bucket: string;
  key: string;
  encryption: "aes-256-gcm" | "none";
}

interface Manifest {
  getEntries(): ManifestEntry[];
}

interface ServerConfig {
  backup?: {
    replication?: {
      enabled?: boolean;
      encryptionKey?: string;
      drillIntervalHours?: number;
    };
  };
}

interface SmokeResult {
  ok: boolean;
  errors?: string[];
  durationMs: number;
}

interface DrillResult {
  passed: boolean;
  replicaId: string | null;
  durationMs: number;
  error?: string;
  ranAt?: string;
}

interface ScheduleStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  intervalHours: number;
  startedAt: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  historyCount: number;
  lastResult: DrillResult | null;
}

interface DrDrillScheduler {
  start(): DrDrillScheduler;
  stop(): void;
  runDrillNow(): Promise<DrillResult>;
  getHistory(): DrillResult[];
  getScheduleStatus(): ScheduleStatus;
}

interface DrillSchedulerOptions {
  restoreSmokeRunner?: ((opts: { entry: ManifestEntry; encryptionKey: string }) => Promise<SmokeResult>) | null;
  manifest?: Manifest | null;
  config?: ServerConfig | null;
  logger?: any;
}

export function createDrDrillScheduler({
  restoreSmokeRunner = null,
  manifest = null,
  config = null,
  logger = null,
}: DrillSchedulerOptions): DrDrillScheduler {
  const _smokeRunner = restoreSmokeRunner || runRestoreSmoke;
  const _log = logger || createLogger("backup-dr-drill");

  // History — bounded in-memory array, no DB
  const _history: DrillResult[] = [];

  let _intervalHandle: NodeJS.Timeout | null = null;
  let _startedAt: string | null = null;
  let _nextRunAt: string | null = null;
  let _lastRunAt: string | null = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _getEntries(): ManifestEntry[] {
    if (manifest && typeof manifest.getEntries === "function") {
      return manifest.getEntries();
    }
    return [];
  }

  function _getEncryptionKey(): string {
    return config?.backup?.replication?.encryptionKey || "";
  }

  function _getDrillIntervalMs(): number {
    const hours = config?.backup?.replication?.drillIntervalHours ?? 24;
    return Math.max(1, Number(hours) || 24) * 60 * 60 * 1000;
  }

  function _pushHistory(entry: DrillResult): void {
    _history.push(entry);
    if (_history.length > MAX_HISTORY) {
      _history.splice(0, _history.length - MAX_HISTORY);
    }
  }

  // ── Core drill logic ──────────────────────────────────────────────────────

  async function runDrillNow(): Promise<DrillResult> {
    const t0 = Date.now();
    const ranAt = new Date().toISOString();
    _lastRunAt = ranAt;
    const entries = _getEntries();
    const latest = findRestorableEntry(entries);

    if (!latest) {
      const result: DrillResult = {
        passed: false,
        replicaId: null,
        durationMs: Date.now() - t0,
        error: "No restorable replica found in manifest",
      };
      _log.warn({ audit: AUDIT_FAIL, result }, "DR drill skipped — no replica.");
      _pushHistory({ ...result, ranAt });
      return result;
    }

    const encryptionKey = _getEncryptionKey();

    let smokeResult: SmokeResult;
    try {
      smokeResult = await _smokeRunner({ entry: latest, encryptionKey });
    } catch (err) {
      const result: DrillResult = {
        passed: false,
        replicaId: latest.backupId,
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      };
      _log.warn({ audit: AUDIT_FAIL, result }, "DR drill FAILED (exception).");
      _pushHistory({ ...result, ranAt });
      return result;
    }

    const durationMs = Date.now() - t0;
    const passed = smokeResult.ok === true;

    const result: DrillResult = {
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

    _pushHistory({ ...result, ranAt });
    return result;
  }

  // ── Scheduler ──────────────────────────────────────────────────────────────

  function start(): DrDrillScheduler {
    if (_intervalHandle !== null) return scheduler;
    const intervalMs = _getDrillIntervalMs();
    _startedAt = _startedAt || new Date().toISOString();
    _nextRunAt = new Date(Date.now() + intervalMs).toISOString();
    _intervalHandle = setInterval(() => {
      runDrillNow().catch((err) => {
        _log.error({ err }, "Unexpected error in scheduled DR drill.");
      }).finally(() => {
        _nextRunAt = new Date(Date.now() + intervalMs).toISOString();
      });
    }, intervalMs);
    if (typeof _intervalHandle.unref === "function") _intervalHandle.unref();
    return scheduler;
  }

  function stop(): void {
    if (_intervalHandle !== null) {
      clearInterval(_intervalHandle);
      _intervalHandle = null;
    }
    _nextRunAt = null;
  }

  function getHistory(): DrillResult[] {
    return [..._history];
  }

  function getScheduleStatus(): ScheduleStatus {
    const intervalMs = _getDrillIntervalMs();
    const history = getHistory();
    return {
      enabled: config?.backup?.replication?.enabled === true,
      running: _intervalHandle !== null,
      intervalMs,
      intervalHours: intervalMs / 60 / 60 / 1000,
      startedAt: _startedAt,
      nextRunAt: _nextRunAt,
      lastRunAt: _lastRunAt,
      historyCount: history.length,
      lastResult: history.length ? history[history.length - 1] : null,
    };
  }

  const scheduler: DrDrillScheduler = { start, stop, runDrillNow, getHistory, getScheduleStatus };
  return scheduler;
}
