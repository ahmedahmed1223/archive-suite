import { chmodSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const SECRET_KEY = /(?:password|passwd|secret|token|access_token|client_secret|api[_-]?key|app_key|private_key|dsn)/i;

export function redactText(value) {
  let text = String(value ?? "");
  try { text = decodeURIComponent(text); } catch { /* retain malformed diagnostic text */ }
  return text
    .replace(/(["']?)(password|passwd|secret|token|access_token|client_secret|api[_-]?key|app_key|private_key|dsn)\1\s*[:=]\s*(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,;&]+)/gis, "$2=[REDACTED]")
    .replace(/([?&](?:access_token|client_secret|api[_-]?key|password|token)=)[^&#\s]+/gi, "$1[REDACTED]")
    .replace(/(--(?:password|secret|token|access-token|client-secret|api-key)(?:=|\s+))(?:"[^"]*"|'[^']*'|[^\s]+)/gi, "$1[REDACTED]")
    .replace(/\bAuthorization\s*:\s*(?:Bearer|Basic)\s+[^\s]+/gi, "Authorization: [REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/(?:[A-Za-z]:\\|\/)(?:[^\s"']+[\\/])+[^\s"']*/g, "[REDACTED_PATH]");
}

export function sanitize(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      SECRET_KEY.test(key) ? [key, "[REDACTED]"] : [key, sanitize(item)]));
  }
  return value;
}

export function sanitizeLogLines(text) {
  return String(text ?? "").split(/\r?\n/).map((line) => {
    try { return JSON.stringify(sanitize(JSON.parse(line))); } catch { return redactText(line); }
  }).join("\n");
}

function boundedTail(text, lines) {
  return sanitizeLogLines(text).split(/\r?\n/).slice(-lines).join("\n");
}

export function secureBundleFile(path, platform = process.platform, run = spawnSync) {
  if (platform !== "win32") {
    chmodSync(path, 0o600);
    if ((statSync(path).mode & 0o777) !== 0o600) throw new Error("Support bundle permissions are not 0600");
    return;
  }
  const owner = process.env.USERDOMAIN && process.env.USERNAME ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : process.env.USERNAME;
  if (!owner) throw new Error("Cannot determine Windows bundle owner");
  const applied = run("icacls", [path, "/inheritance:r", "/grant:r", `${owner}:(R,W)`], { encoding: "utf8", windowsHide: true });
  if (applied.status !== 0) throw new Error("Failed to apply owner-only Windows ACL");
  const verified = run("icacls", [path], { encoding: "utf8", windowsHide: true });
  const acl = String(verified.stdout || "");
  if (verified.status !== 0 || !acl.toLowerCase().includes(owner.toLowerCase()) || /everyone|authenticated users|builtin\\users/i.test(acl)) {
    throw new Error("Failed to verify owner-only Windows ACL");
  }
}

export function createSupportBundle({ outputDir, now = new Date(), versions = {}, config = "", health = {}, manifests = {}, logs = {}, maxLogLines = 200, maxBytes = 1_000_000, secure = secureBundleFile }) {
  const safeLogs = Object.fromEntries(Object.entries(logs).map(([name, content]) => [name, boundedTail(content, maxLogLines)]));
  const bundle = { schemaVersion: 1, generatedAt: now.toISOString(), versions: sanitize(versions), config: sanitizeLogLines(config), health: sanitize(health), logs: safeLogs, manifests: sanitize(manifests) };
  let encoded = JSON.stringify(bundle, null, 2);
  if (Buffer.byteLength(encoded) > maxBytes) {
    bundle.logs = Object.fromEntries(Object.keys(safeLogs).map((name) => [name, "[OMITTED: bundle size limit]"]));
    encoded = JSON.stringify(bundle, null, 2);
  }
  if (Buffer.byteLength(encoded) > maxBytes) throw new Error("Support bundle metadata exceeds the configured size limit");
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, `archive-support-${now.toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(path, encoded, { encoding: "utf8", mode: 0o600, flag: "wx" });
  try { secure(path); } catch (error) { try { unlinkSync(path); } catch {} throw error; }
  return { path, bytes: Buffer.byteLength(encoded) };
}

function parseComposeRecords(result, expected) {
  if (!result || result.status !== 0) return { services: Object.fromEntries(expected.map((x) => [x, "unknown"])), unknown: ["docker"] };
  const services = {};
  let invalid = false;
  const raw = String(result.stdout || "").trim();
  let records;
  try { const parsed = JSON.parse(raw); records = Array.isArray(parsed) ? parsed : [parsed]; }
  catch { records = raw.split(/\r?\n/).filter(Boolean); }
  for (const record of records) {
    try {
      const row = typeof record === "string" ? JSON.parse(record) : record;
      if (typeof row.Service !== "string" || typeof row.State !== "string") { invalid = true; continue; }
      services[row.Service] = row.State.toLowerCase() === "running" && (!row.Health || row.Health.toLowerCase() === "healthy") ? "running" : (row.Health || row.State).toLowerCase();
    } catch { invalid = true; }
  }
  for (const name of expected) if (!services[name]) services[name] = "missing";
  return { services, unknown: invalid ? ["docker"] : [] };
}

function countErrorEvents(text, now, windowMinutes) {
  const cutoff = now.getTime() - windowMinutes * 60_000;
  let count = 0;
  let malformed = false;
  for (const line of String(text || "").split(/\r?\n/).filter(Boolean)) {
    const payload = line.replace(/^\s*[^|\r\n]+\|\s*/, "");
    if (!payload.trimStart().startsWith("{")) continue;
    try {
      const event = JSON.parse(payload);
      const level = String(event.level || event.level_name || "").toLowerCase();
      const timestamp = Date.parse(event.timestamp || event.datetime || event.time || "");
      if (["error", "critical", "alert", "emergency"].includes(level) && Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now.getTime()) count++;
    } catch { malformed = true; }
  }
  return { count, malformed };
}

export function collectOperatorSnapshot({ expectedServices, composePs, redis, logs, diskUsedPercent, backupAgeHours, now = new Date(), errorWindowMinutes = 60 }) {
  const parsed = parseComposeRecords(composePs, expectedServices);
  const unknown = [...parsed.unknown];
  const queueRaw = String(redis?.stdout ?? "").trim();
  const queueDepth = redis?.status === 0 && /^\d+$/.test(queueRaw) ? Number(queueRaw) : null;
  if (queueDepth === null) unknown.push("redis");
  let repeatedErrors = null;
  if (logs?.status === 0) {
    const errors = countErrorEvents(logs.stdout, now, errorWindowMinutes);
    if (errors.malformed) unknown.push("logs"); else repeatedErrors = errors.count;
  } else unknown.push("logs");
  return { services: parsed.services, queueDepth, diskUsedPercent, backupAgeHours, repeatedErrors, unknown: [...new Set(unknown)], errorWindowMinutes };
}

export function buildReadinessContract({ deepHealth, services, unknown = [] }) {
  const processChecks = { worker: services?.["laravel-worker"] === "running", reverb: services?.["laravel-reverb"] === "running" };
  return { ok: deepHealth?.ok === true && Object.values(processChecks).every(Boolean) && unknown.length === 0, deep: deepHealth ?? { ok: false }, processes: processChecks, unknown };
}

export function buildOperatorReport(input, thresholds = {}) {
  const limits = { queueDepth: 100, diskUsedPercent: 85, backupAgeHours: 24, repeatedErrors: 5, ...thresholds };
  const alerts = [];
  if ((input.unknown ?? []).length) alerts.push({ code: "probe_unknown", severity: "critical", value: input.unknown });
  const down = Object.entries(input.services ?? {}).filter(([, state]) => state !== "running").map(([name]) => name);
  if (down.length) alerts.push({ code: "service_down", severity: "critical", value: down });
  if (input.queueDepth !== null && input.queueDepth >= limits.queueDepth) alerts.push({ code: "queue_backlog", severity: "warning", value: input.queueDepth });
  if (input.diskUsedPercent >= limits.diskUsedPercent) alerts.push({ code: "disk_pressure", severity: "critical", value: input.diskUsedPercent });
  if (input.backupAgeHours == null || input.backupAgeHours >= limits.backupAgeHours) alerts.push({ code: "backup_stale", severity: "critical", value: input.backupAgeHours });
  if (input.repeatedErrors !== null && input.repeatedErrors >= limits.repeatedErrors) alerts.push({ code: "repeated_errors", severity: "warning", value: input.repeatedErrors, windowMinutes: input.errorWindowMinutes });
  return { ok: alerts.length === 0, checkedAt: new Date().toISOString(), thresholds: limits, alerts };
}
