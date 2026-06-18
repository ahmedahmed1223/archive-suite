// Pure view-model for the system control center (§1110 safe monitoring slice).
//
// SAFETY: This module is read-only. It normalizes a raw server health/status
// payload (the existing `/api/health` shape, optionally enriched with resource
// metrics and a services list) into a view model the SystemControlPage renders.
// It performs NO network calls, NO DOM access, and NO OS-level control. The
// dangerous start/stop/restart of OS services is deliberately out of scope.

/** Severity levels for a single metric, ordered from healthy to critical. */
export const METRIC_LEVELS = Object.freeze({
  OK: "ok",
  WARN: "warn",
  CRIT: "crit",
  UNKNOWN: "unknown"
});

/** Overall control-center state, derived from services + metrics. */
export const OVERALL_STATES = Object.freeze({
  OK: "ok",
  DEGRADED: "degraded",
  DOWN: "down",
  UNKNOWN: "unknown"
});

/** Percent thresholds (inclusive lower bound) → severity for resource gauges. */
export const METRIC_THRESHOLDS = Object.freeze({
  cpu: Object.freeze({ warn: 75, crit: 90 }),
  memory: Object.freeze({ warn: 80, crit: 92 }),
  disk: Object.freeze({ warn: 80, crit: 90 })
});

const BYTES_PER_UNIT = 1024;
const BYTE_UNITS = Object.freeze(["B", "KB", "MB", "GB", "TB", "PB"]);

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Classify a percentage (0–100) into a severity level using thresholds.
 * @param {number|null|undefined} percent
 * @param {{ warn: number, crit: number }} [thresholds]
 * @returns {"ok"|"warn"|"crit"|"unknown"}
 */
export function classifyMetric(percent, thresholds = METRIC_THRESHOLDS.cpu) {
  const value = toFiniteNumber(percent);
  if (value === null) return METRIC_LEVELS.UNKNOWN;
  const warn = toFiniteNumber(thresholds?.warn) ?? 75;
  const crit = toFiniteNumber(thresholds?.crit) ?? 90;
  if (value >= crit) return METRIC_LEVELS.CRIT;
  if (value >= warn) return METRIC_LEVELS.WARN;
  return METRIC_LEVELS.OK;
}

/**
 * Format a percentage for display, clamped to 0–100 with one decimal max.
 * @param {number|null|undefined} percent
 * @returns {string}
 */
export function formatPercent(percent) {
  const value = toFiniteNumber(percent);
  if (value === null) return "—";
  const clamped = Math.min(100, Math.max(0, value));
  return `${Math.round(clamped * 10) / 10}%`;
}

/**
 * Format a byte count into a human-readable string.
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  const value = toFiniteNumber(bytes);
  if (value === null || value < 0) return "—";
  if (value === 0) return "0 B";
  const exponent = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(value) / Math.log(BYTES_PER_UNIT))
  );
  const scaled = value / BYTES_PER_UNIT ** exponent;
  const rounded = Math.round(scaled * 10) / 10;
  return `${rounded} ${BYTE_UNITS[exponent]}`;
}

/**
 * Build a normalized metric entry from a raw `{ percent, used, total }` shape.
 * @param {string} id
 * @param {object|null|undefined} raw
 * @param {{ warn: number, crit: number }} thresholds
 */
function buildMetric(id, raw, thresholds) {
  const source = raw && typeof raw === "object" ? raw : {};
  let percent = toFiniteNumber(source.percent);
  const used = toFiniteNumber(source.used);
  const total = toFiniteNumber(source.total);
  if (percent === null && used !== null && total !== null && total > 0) {
    percent = (used / total) * 100;
  }
  return {
    id,
    percent,
    used,
    total,
    level: classifyMetric(percent, thresholds),
    label: formatPercent(percent),
    detail: used !== null && total !== null ? `${formatBytes(used)} / ${formatBytes(total)}` : ""
  };
}

/**
 * Normalize an arbitrary services list into a stable, sorted view list.
 * Each entry: { id, name, status: "up"|"down"|"unknown", detail }.
 * @param {Array|undefined} rawServices
 * @returns {Array<{id:string,name:string,status:string,detail:string}>}
 */
export function buildServiceList(rawServices) {
  if (!Array.isArray(rawServices)) return [];
  return rawServices
    .filter((svc) => svc && typeof svc === "object")
    .map((svc, index) => {
      const id = String(svc.id ?? svc.name ?? `service-${index}`);
      const rawStatus = String(svc.status ?? "").toLowerCase();
      let status = "unknown";
      if (["up", "ok", "running", "healthy", "online"].includes(rawStatus)) status = "up";
      else if (["down", "stopped", "error", "failed", "offline"].includes(rawStatus)) status = "down";
      return {
        id,
        name: String(svc.name ?? svc.id ?? id),
        status,
        detail: svc.detail ? String(svc.detail) : "",
        actions: Array.isArray(svc.actions) ? svc.actions.map(String) : []
      };
    });
}

/**
 * Derive the synthetic "database" service entry from the health payload's db.
 * @param {object} health
 */
function databaseService(health) {
  const db = health?.db && typeof health.db === "object" ? health.db : null;
  if (!db) return null;
  const ok = db.ok !== false;
  const latency = toFiniteNumber(db.latencyMs);
  return {
    id: "database",
    name: "قاعدة البيانات",
    status: ok ? "up" : "down",
    detail: latency !== null ? `${latency} ms` : db.error ? String(db.error) : ""
  };
}

/**
 * Compute the overall control-center state from services and metrics.
 * @param {{services:Array, metrics:Array, serverOk:boolean|null}} input
 * @returns {"ok"|"degraded"|"down"|"unknown"}
 */
export function deriveOverallState({ services = [], metrics = [], serverOk = null } = {}) {
  if (serverOk === false) return OVERALL_STATES.DOWN;
  const anyDown = services.some((svc) => svc.status === "down");
  if (anyDown) return OVERALL_STATES.DOWN;
  const anyCrit = metrics.some((m) => m.level === METRIC_LEVELS.CRIT);
  if (anyCrit) return OVERALL_STATES.DOWN;
  const anyWarn = metrics.some((m) => m.level === METRIC_LEVELS.WARN);
  const anyUnknownService = services.some((svc) => svc.status === "unknown");
  if (anyWarn || anyUnknownService) return OVERALL_STATES.DEGRADED;
  if (services.length === 0 && metrics.length === 0 && serverOk === null) {
    return OVERALL_STATES.UNKNOWN;
  }
  return OVERALL_STATES.OK;
}

/**
 * Build the full system-control view model from a raw health/status payload.
 * Pure: no network, no DOM, no mutation of the input.
 *
 * @param {object} [payload] - the `/api/health` payload, optionally enriched
 *   with `metrics: { cpu, memory, disk }` and `services: [...]`.
 * @param {{ checkedAt?: string }} [options]
 * @returns {object} view model
 */
export function buildSystemControlModel(payload = {}, options = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const rawMetrics = source.metrics && typeof source.metrics === "object" ? source.metrics : {};

  const metrics = [
    buildMetric("cpu", rawMetrics.cpu, METRIC_THRESHOLDS.cpu),
    buildMetric("memory", rawMetrics.memory, METRIC_THRESHOLDS.memory),
    buildMetric("disk", rawMetrics.disk, METRIC_THRESHOLDS.disk)
  ].filter((m) => m.percent !== null || m.used !== null);

  const explicitServices = buildServiceList(source.services);
  const dbService = databaseService(source);
  const services = dbService ? [dbService, ...explicitServices] : explicitServices;

  const serverOk = source.ok === undefined ? null : source.ok !== false;
  const overall = deriveOverallState({ services, metrics, serverOk });

  const uptimeSec = toFiniteNumber(source.uptimeSec);

  return {
    overall,
    serverOk,
    backend: source.backend ? String(source.backend) : "محلي",
    engine: source.engine ? String(source.engine) : source.backend ? String(source.backend) : "",
    version: source.version ? String(source.version) : "",
    uptimeSec: uptimeSec !== null && uptimeSec >= 0 ? uptimeSec : null,
    metrics,
    services,
    actionsEnabled: source.actionsEnabled === true,
    checkedAt: options.checkedAt || source.checkedAt || null
  };
}
