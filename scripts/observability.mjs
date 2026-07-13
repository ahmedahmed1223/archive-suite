import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SECRET_ASSIGNMENT = /\b(password|passwd|secret|token|api[_-]?key|app_key|private_key|dsn)\b\s*[:=]\s*[^\s,;]+/gi;

export function redactText(value) {
  return String(value ?? "")
    .replace(SECRET_ASSIGNMENT, "$1=[REDACTED]")
    .replace(/\bAuthorization\s*:\s*(?:Bearer|Basic)\s+[^\s]+/gi, "Authorization: [REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/(?:[A-Za-z]:\\|\/)(?:[^\s"']+[\\/])+[^\s"']*/g, "[REDACTED_PATH]");
}

function sanitize(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      /password|secret|token|key|dsn/i.test(key) ? [key, "[REDACTED]"] : [key, sanitize(item)]));
  }
  return value;
}

function boundedTail(text, lines) {
  return redactText(text).split(/\r?\n/).slice(-lines).join("\n");
}

export function createSupportBundle({ outputDir, now = new Date(), versions = {}, config = "", health = {}, manifests = {}, logs = {}, maxLogLines = 200, maxBytes = 1_000_000 }) {
  const safeLogs = Object.fromEntries(Object.entries(logs).map(([name, content]) => [name, boundedTail(content, maxLogLines)]));
  const bundle = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    versions: sanitize(versions),
    config: redactText(config),
    health: sanitize(health),
    logs: safeLogs,
    manifests: sanitize(manifests),
  };
  let encoded = JSON.stringify(bundle, null, 2);
  if (Buffer.byteLength(encoded) > maxBytes) {
    bundle.logs = Object.fromEntries(Object.keys(safeLogs).map((name) => [name, "[OMITTED: bundle size limit]"]));
    encoded = JSON.stringify(bundle, null, 2);
  }
  if (Buffer.byteLength(encoded) > maxBytes) throw new Error("Support bundle metadata exceeds the configured size limit");
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, `archive-support-${now.toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(path, encoded, { encoding: "utf8", mode: 0o600 });
  return { path, bytes: Buffer.byteLength(encoded) };
}

export function buildOperatorReport(input, thresholds = {}) {
  const limits = { queueDepth: 100, diskUsedPercent: 85, backupAgeHours: 24, repeatedErrors: 5, ...thresholds };
  const alerts = [];
  const down = Object.entries(input.services ?? {}).filter(([, state]) => state !== "running").map(([name]) => name);
  if (down.length) alerts.push({ code: "service_down", severity: "critical", value: down });
  if ((input.queueDepth ?? 0) >= limits.queueDepth) alerts.push({ code: "queue_backlog", severity: "warning", value: input.queueDepth });
  if ((input.diskUsedPercent ?? 0) >= limits.diskUsedPercent) alerts.push({ code: "disk_pressure", severity: "critical", value: input.diskUsedPercent });
  if (input.backupAgeHours == null || input.backupAgeHours >= limits.backupAgeHours) alerts.push({ code: "backup_stale", severity: "critical", value: input.backupAgeHours });
  if ((input.repeatedErrors ?? 0) >= limits.repeatedErrors) alerts.push({ code: "repeated_errors", severity: "warning", value: input.repeatedErrors });
  return { ok: alerts.length === 0, checkedAt: new Date().toISOString(), alerts };
}
