import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { sanitize } from "../observability.mjs";

/**
 * V1-X01..X04 preflight. This is intentionally discovery, not validation:
 * it never connects to a provider and a configured secret never becomes proof
 * that a capability passed. Operators attach the resulting redacted document
 * to a separately executed live acceptance run.
 */
export const EXTENDED_CAPABILITIES = Object.freeze([
  Object.freeze({ id: "V1-X01", capability: "external-storage", env: ["FILESYSTEM_DISK", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_BUCKET", "DROPBOX_ACCESS_TOKEN", "DROPBOX_CLIENT_ID", "DROPBOX_CLIENT_SECRET"], evidence: ["provider-identity", "read-write-delete", "large-object", "retry-interruption", "secret-scan"] }),
  Object.freeze({ id: "V1-X02", capability: "windows-odbc", env: ["ODBC_ENABLED", "ODBC_DSN", "ODBC_USERNAME", "ODBC_PASSWORD"], evidence: ["windows-host", "driver-and-dsn", "allowlisted-read-write", "denied-table-and-role", "secret-scan"] }),
  Object.freeze({ id: "V1-X03", capability: "arabic-gpu-transcription", env: ["MEDIA_PROCESSOR", "WHISPER_BINARY", "WHISPER_MODEL", "WHISPER_LANGUAGE", "WHISPER_DEVICE", "WHISPER_COMPUTE_TYPE"], evidence: ["gpu-identity", "approved-arabic-sample", "accuracy-and-latency", "resource-metrics", "media-profile"] }),
  Object.freeze({ id: "V1-X04", capability: "ai-vision-embeddings", env: ["EMBEDDINGS_ENABLED", "EMBEDDINGS_PROVIDER", "EMBEDDINGS_MODEL", "EMBEDDINGS_BASE_URL", "OPENAI_API_KEY"], evidence: ["provider-identity", "live-index-and-query", "timeout-rate-cost-limits", "data-isolation", "safe-failure", "secret-scan"] }),
]);

const configured = (name, env) => String(env[name] ?? "").trim() !== "" && !["false", "0", "fake", "local"].includes(String(env[name]).trim().toLowerCase());

export function discoverExtendedCapabilities(env = process.env, { platform = process.platform, commandExists = () => false } = {}) {
  return EXTENDED_CAPABILITIES.map((item) => {
    const missing = item.env.filter((name) => !configured(name, env));
    const blockers = [];
    if (item.id === "V1-X01" && missing.length) blockers.push("live external-storage provider credentials and target are required");
    if (item.id === "V1-X02") {
      if (platform !== "win32") blockers.push("a clean Windows host is required");
      if (!commandExists("odbcinst") && !commandExists("Get-OdbcDriver")) blockers.push("a discoverable ODBC driver is required");
      if (missing.length) blockers.push("ODBC DSN and dedicated test credentials are required");
    }
    if (item.id === "V1-X03") {
      if (!commandExists("nvidia-smi")) blockers.push("target NVIDIA GPU with nvidia-smi is required");
      if (String(env.WHISPER_DEVICE ?? "").toLowerCase() !== "cuda") blockers.push("WHISPER_DEVICE=cuda is required");
      if (String(env.WHISPER_LANGUAGE ?? "").toLowerCase() !== "ar") blockers.push("WHISPER_LANGUAGE=ar is required");
    }
    if (item.id === "V1-X04" && missing.length) blockers.push("live AI/vision provider credential, Postgres pgvector index, and isolated test tenant are required");
    return sanitize({ id: item.id, capability: item.capability, status: blockers.length ? "blocked-capability" : "ready-for-live-validation", blockers, requiredEvidence: item.evidence, configuredVariables: Object.fromEntries(item.env.map((name) => [name, configured(name, env)])) });
  });
}

export function evidenceTemplate(discovery, metadata = {}) {
  return sanitize({
    schemaVersion: 1,
    kind: "extended-capability-live-evidence",
    generatedAt: metadata.generatedAt ?? new Date().toISOString(),
    sourceCommit: metadata.sourceCommit ?? "REQUIRED",
    appVersion: metadata.appVersion ?? "REQUIRED",
    status: "not-executed",
    discovery,
    runs: EXTENDED_CAPABILITIES.map(({ id, capability, evidence }) => ({ id, capability, status: "not-executed", requiredEvidence: evidence, artifacts: [], operator: "REQUIRED", executedAt: "REQUIRED" })),
  });
}

export function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, "")]] : [];
  }));
}

export function preflight({ env = process.env, envFile, platform, commandExists, metadata } = {}) {
  const merged = { ...loadEnvFile(envFile ? resolve(envFile) : ""), ...env };
  const discovery = discoverExtendedCapabilities(merged, { platform, commandExists });
  return evidenceTemplate(discovery, metadata);
}
