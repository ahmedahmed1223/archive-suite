import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const nodeFs = { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync };

const SCHEMA_VERSION = "1.0";
const SAFE_SOURCES = new Set(["online", "offline"]);
const SAFE_MODES = new Set(["docker", "native"]);
const SENSITIVE_KEY = /(password|secret|token|credential|authorization|cookie|dsn|connection|url|key)/i;
const CREDENTIAL_URL = /^[a-z][a-z\d+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i;
const CREDENTIAL_PAIR = /[^\s:/\\]+:[^\s@]+@/;
const URL = /^[a-z][a-z\d+.-]*:\/\//i;
const SECRET_VALUE = /(?:password|secret|token|credential)/i;
const INSTALLATION_STEPS = ["environment-ready", "services-started"];

function fail(message) { throw new Error(`Installation manifest: ${message}`); }

function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be a non-empty string.`);
  return value.trim();
}

function requireStrings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim()) || new Set(value).size !== value.length) {
    fail(`${field} must be an array of unique non-empty strings.`);
  }
  return value.map((item) => item.trim());
}

function rejectSensitive(value, field = "manifest") {
  if (typeof value === "string") {
    if (CREDENTIAL_URL.test(value) || CREDENTIAL_PAIR.test(value) || SECRET_VALUE.test(value)) fail(`${field} contains a sensitive value or credential.`);
    return;
  }
  if (Array.isArray(value)) return value.forEach((item, index) => rejectSensitive(item, `${field}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) fail(`${field}.${key} is a sensitive field.`);
    rejectSensitive(child, `${field}.${key}`);
  }
}

function normalizeArtifacts(value) {
  if (!Array.isArray(value)) fail("artifacts must be an array.");
  return value.map((artifact, index) => {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) fail(`artifacts[${index}] must be an object.`);
    const allowed = ["id", "digest", "checksum"];
    if (Object.keys(artifact).some((key) => !allowed.includes(key))) fail(`artifacts[${index}] contains unsupported or sensitive fields.`);
    const normalized = { id: requireString(artifact.id, `artifacts[${index}].id`) };
    if (artifact.digest !== undefined) normalized.digest = requireString(artifact.digest, `artifacts[${index}].digest`);
    if (artifact.checksum !== undefined) normalized.checksum = requireString(artifact.checksum, `artifacts[${index}].checksum`);
    if (!normalized.digest && !normalized.checksum) fail(`artifacts[${index}] must provide a digest or checksum.`);
    return normalized;
  });
}

function normalizeDataPaths(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) fail("dataPaths must be a non-empty object.");
  const normalized = {};
  for (const [name, path] of Object.entries(value)) {
    requireString(name, "dataPaths key");
    if (SENSITIVE_KEY.test(name)) fail(`dataPaths.${name} is a sensitive field.`);
    const safePath = requireString(path, `dataPaths.${name}`);
    if (URL.test(safePath) || CREDENTIAL_URL.test(safePath) || CREDENTIAL_PAIR.test(safePath)) fail(`dataPaths.${name} must be a local path without credentials.`);
    normalized[name] = safePath;
  }
  return normalized;
}

function normalizeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("input must be an object.");
  rejectSensitive(input);
  const version = requireString(input.version, "version");
  const source = requireString(input.source, "source");
  const mode = requireString(input.mode, "mode");
  if (!SAFE_SOURCES.has(source)) fail("source must be online or offline.");
  if (!SAFE_MODES.has(mode)) fail("mode must be docker or native.");
  return {
    version,
    source,
    mode,
    platform: requireString(input.platform, "platform"),
    runtimeProfiles: requireStrings(input.runtimeProfiles, "runtimeProfiles"),
    capabilities: requireStrings(input.capabilities, "capabilities"),
    artifacts: normalizeArtifacts(input.artifacts),
    services: requireStrings(input.services, "services"),
    dataPaths: normalizeDataPaths(input.dataPaths),
  };
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("must be a JSON object.");
  const keys = ["schemaVersion", "version", "source", "mode", "platform", "runtimeProfiles", "capabilities", "artifacts", "services", "dataPaths", "lastSuccessfulStep", "previousVersion", "operation"];
  if (Object.keys(manifest).length !== keys.length || keys.some((key) => !(key in manifest)) || Object.keys(manifest).some((key) => !keys.includes(key))) {
    fail("has an invalid field set.");
  }
  if (manifest.schemaVersion !== SCHEMA_VERSION) fail("has an unsupported schema version.");
  const input = normalizeInput(manifest);
  if (!(typeof manifest.lastSuccessfulStep === "string" && manifest.lastSuccessfulStep.trim() || manifest.lastSuccessfulStep === null)) fail("lastSuccessfulStep must be a non-empty string or null.");
  if (!(typeof manifest.previousVersion === "string" && manifest.previousVersion.trim() || manifest.previousVersion === null)) fail("previousVersion must be a non-empty string or null.");
  const operation = manifest.operation;
  if (!operation || typeof operation !== "object" || Array.isArray(operation) || Object.keys(operation).length !== 4) fail("operation is invalid.");
  if (!["install", "repair"].includes(operation.type) || !["in-progress", "failed", "succeeded"].includes(operation.status)) fail("operation has invalid values.");
  if (!(typeof operation.failedStep === "string" && operation.failedStep.trim() || operation.failedStep === null)) fail("operation.failedStep must be a non-empty string or null.");
  const nextActions = requireStrings(operation.nextActions, "operation.nextActions");
  return {
    schemaVersion: SCHEMA_VERSION,
    ...input,
    lastSuccessfulStep: manifest.lastSuccessfulStep,
    previousVersion: manifest.previousVersion,
    operation: { type: operation.type, status: operation.status, failedStep: operation.failedStep, nextActions },
  };
}

function atomicWrite(path, manifest, fs = nodeFs) {
  const serialized = `${JSON.stringify(validateManifest(manifest), null, 2)}\n`;
  const directory = dirname(path);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, serialized, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporary, path);
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch { /* preserve prior manifest */ }
    throw error;
  }
}

export function readInstallationManifest(path, { fs = nodeFs } = {}) {
  if (!fs.existsSync(path)) return null;
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(path, "utf8")); }
  catch { fail("must contain valid JSON."); }
  return validateManifest(parsed);
}

export function createInstallationManifest({ path, input, fs = nodeFs }) {
  const existing = readInstallationManifest(path, { fs });
  if (existing) return { created: false, manifest: existing };
  const normalized = normalizeInput(input);
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    ...normalized,
    lastSuccessfulStep: null,
    previousVersion: null,
    operation: { type: "install", status: "in-progress", failedStep: null, nextActions: [] },
  };
  atomicWrite(path, manifest, fs);
  return { created: true, manifest };
}

export function updateLastSuccessfulStep({ path, step, fs = nodeFs }) {
  const manifest = readInstallationManifest(path, { fs });
  if (!manifest) fail("does not exist.");
  const next = { ...manifest, lastSuccessfulStep: requireString(step, "step"), operation: { ...manifest.operation, status: "succeeded", failedStep: null, nextActions: [] } };
  atomicWrite(path, next, fs);
  return next;
}

export function markInstallationFailed({ path, failedStep, nextActions, fs = nodeFs }) {
  const manifest = readInstallationManifest(path, { fs });
  if (!manifest) fail("does not exist.");
  const next = { ...manifest, operation: { ...manifest.operation, status: "failed", failedStep: requireString(failedStep, "failedStep"), nextActions: requireStrings(nextActions, "nextActions") } };
  rejectSensitive(next.operation.nextActions, "nextActions");
  atomicWrite(path, next, fs);
  return next;
}

export function decideInstallationResume({ path, input, fs = nodeFs }) {
  const manifest = readInstallationManifest(path, { fs });
  if (!manifest) return { action: "install" };
  const requested = normalizeInput(input);
  for (const field of ["version", "source", "mode", "platform"]) if (manifest[field] !== requested[field]) return { action: "repair", reason: "configuration-changed" };
  if (manifest.operation.status === "failed") {
    const stepIndex = manifest.lastSuccessfulStep === null ? -1 : INSTALLATION_STEPS.indexOf(manifest.lastSuccessfulStep);
    if (stepIndex < -1) return { action: "repair", reason: "unknown-successful-step" };
    return { action: "resume", after: manifest.lastSuccessfulStep, nextStep: INSTALLATION_STEPS[stepIndex + 1] ?? null };
  }
  return { action: "repair", reason: "existing-installation" };
}

export function beginInstallationOperation({ path, input, operation, fs = nodeFs }) {
  if (!["install", "repair"].includes(operation)) fail("operation must be install or repair.");
  const decision = decideInstallationResume({ path, input, fs });
  const created = createInstallationManifest({ path, input, fs });
  const manifest = created.manifest;
  const next = { ...manifest, operation: { type: operation, status: "in-progress", failedStep: null, nextActions: [] } };
  atomicWrite(path, next, fs);
  return { created: created.created, manifest: next, decision };
}
