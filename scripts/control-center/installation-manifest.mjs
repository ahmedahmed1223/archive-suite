import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const nodeFs = { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync };

const SCHEMA_VERSION = "1.0";
const SAFE_SOURCES = new Set(["online", "offline", "local"]);
const SAFE_MODES = new Set(["docker", "native"]);
const SENSITIVE_KEY = /(password|secret|token|credential|authorization|cookie|dsn|connection|url|key)/i;
const CREDENTIAL_URL = /^[a-z][a-z\d+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i;
const CREDENTIAL_PAIR = /[^\s:/\\]+:[^\s@]+@/;
const URL = /^[a-z][a-z\d+.-]*:\/\//i;
const SECRET_VALUE = /(?:password|secret|token|credential)/i;
const INSTALLATION_STEPS = ["environment-ready", "services-started"];
const RELEASE_ENVIRONMENT_KEY = /^(ARCHIVE_RELEASE_PULL_POLICY|ARCHIVE_COMPOSE_PROFILES|ARCHIVE_RELEASE_IMAGE_[A-Z0-9_]+)$/;
const IMAGE_REFERENCE = /^[a-z0-9][a-z0-9./_-]*(?::[0-9A-Za-z._-]+)?(?:@sha256:[a-f0-9]{3,})?$/i;

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

function normalizeReleaseEnvironment(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) fail("releaseEnvironment must be a non-empty object when provided.");
  const normalized = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!RELEASE_ENVIRONMENT_KEY.test(key)) fail("releaseEnvironment contains an unsupported or sensitive key.");
    const item = requireString(raw, `releaseEnvironment.${key}`);
    const isImage = key.startsWith("ARCHIVE_RELEASE_IMAGE_");
    if (CREDENTIAL_URL.test(item) || SECRET_VALUE.test(item) || (isImage && !IMAGE_REFERENCE.test(item))) fail(`releaseEnvironment.${key} contains a sensitive value or credential.`);
    normalized[key] = item;
  }
  return normalized;
}

function normalizeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("input must be an object.");
  // Release image variable names intentionally contain `IMAGE_*`; the
  // generic sensitive-key guard treats “key” as sensitive, so validate this
  // tightly-scoped allow-list separately instead of weakening the guard.
  const { releaseEnvironment, ...ordinaryInput } = input;
  rejectSensitive(ordinaryInput);
  const version = requireString(input.version, "version");
  const source = requireString(input.source, "source");
  const mode = requireString(input.mode, "mode");
  if (!SAFE_SOURCES.has(source)) fail("source must be online, offline, or local.");
  if (!SAFE_MODES.has(mode)) fail("mode must be docker or native.");
  const normalized = {
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
  const normalizedEnvironment = normalizeReleaseEnvironment(releaseEnvironment);
  if (normalizedEnvironment) normalized.releaseEnvironment = normalizedEnvironment;
  return normalized;
}

function releaseReference(input) {
  const { version, source, mode, platform, runtimeProfiles, capabilities, artifacts, services, dataPaths, releaseEnvironment } = input || {};
  return normalizeInput({ version, source, mode, platform, runtimeProfiles, capabilities, artifacts, services, dataPaths, releaseEnvironment });
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("must be a JSON object.");
  const keys = ["schemaVersion", "version", "source", "mode", "platform", "runtimeProfiles", "capabilities", "artifacts", "services", "dataPaths", "lastSuccessfulStep", "previousVersion", "operation"];
  const optionalKeys = ["releaseEnvironment", "previousRelease"];
  if (keys.some((key) => !(key in manifest)) || Object.keys(manifest).some((key) => !keys.includes(key) && !optionalKeys.includes(key))) {
    fail("has an invalid field set.");
  }
  if (manifest.schemaVersion !== SCHEMA_VERSION) fail("has an unsupported schema version.");
  // Validate nested release references separately; their image environment
  // keys are allow-listed by normalizeInput, but the generic recursive
  // guard must not inspect them as arbitrary manifest keys first.
  const { previousRelease, operation, ...activeRelease } = manifest;
  const input = normalizeInput(activeRelease);
  if (!(typeof manifest.lastSuccessfulStep === "string" && manifest.lastSuccessfulStep.trim() || manifest.lastSuccessfulStep === null)) fail("lastSuccessfulStep must be a non-empty string or null.");
  if (!(typeof manifest.previousVersion === "string" && manifest.previousVersion.trim() || manifest.previousVersion === null)) fail("previousVersion must be a non-empty string or null.");
  if (!operation || typeof operation !== "object" || Array.isArray(operation) || ![4, 5].includes(Object.keys(operation).length) || Object.keys(operation).some((key) => !["type", "status", "failedStep", "nextActions", "target"].includes(key))) fail("operation is invalid.");
  const { target, ...operationMetadata } = operation;
  rejectSensitive(operationMetadata, "operation");
  if (!["install", "repair", "update", "rollback"].includes(operation.type) || !["in-progress", "failed", "succeeded"].includes(operation.status)) fail("operation has invalid values.");
  if (!(typeof operation.failedStep === "string" && operation.failedStep.trim() || operation.failedStep === null)) fail("operation.failedStep must be a non-empty string or null.");
  const nextActions = requireStrings(operation.nextActions, "operation.nextActions");
  const result = {
    schemaVersion: SCHEMA_VERSION,
    ...input,
    lastSuccessfulStep: manifest.lastSuccessfulStep,
    previousVersion: manifest.previousVersion,
    operation: { type: operation.type, status: operation.status, failedStep: operation.failedStep, nextActions },
  };
  if (input.releaseEnvironment) result.releaseEnvironment = input.releaseEnvironment;
  if (previousRelease !== undefined) result.previousRelease = releaseReference(previousRelease);
  if (target !== undefined) result.operation.target = releaseReference(target);
  return result;
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

// updateDataPaths (V1-208K reconnect-data): atomically re-points the
// recorded data directories at an existing data set. normalizeDataPaths
// keeps rejecting URLs and credential-bearing values.
export function updateDataPaths({ path, dataPaths, fs = nodeFs }) {
  const manifest = readInstallationManifest(path, { fs });
  if (!manifest) fail("does not exist.");
  const next = { ...manifest, dataPaths: normalizeDataPaths(dataPaths) };
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
    // A step name outside INSTALLATION_STEPS (e.g. left behind by a failed
    // "update" operation, which uses its own step vocabulary) must never be
    // silently treated as "no step yet" and resumed from the top of the
    // install sequence — fall back to a full repair instead.
    if (stepIndex === -1 && manifest.lastSuccessfulStep !== null) return { action: "repair", reason: "unknown-successful-step" };
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

// beginOperation covers update/rollback: unlike install/repair these never
// create a fresh manifest (an update requires one to already exist) and have
// no INSTALLATION_STEPS-based resume decision — re-running the whole
// operation after a failure is the supported recovery path, since every step
// (backup, pull, migrate-safe, switch, health) is independently safe to repeat.
export function beginOperation({ path, type, target, fs = nodeFs }) {
  if (!["update", "rollback"].includes(type)) fail("operation must be update or rollback.");
  const manifest = readInstallationManifest(path, { fs });
  if (!manifest) fail("does not exist.");
  const normalizedTarget = target === undefined ? undefined : releaseReference(target);
  const operation = { type, status: "in-progress", failedStep: null, nextActions: [] };
  if (normalizedTarget) operation.target = normalizedTarget;
  const next = { ...manifest, operation };
  atomicWrite(path, next, fs);
  return next;
}

// completeUpdateOperation is the one atomic write that lands a successful
// update: it swaps in the new version/artifacts/services, records the
// version being replaced in previousVersion (never overwritten with null
// again), and marks the operation succeeded. It never removes or rewrites
// anything about how the previous version's images were referenced — there
// is nothing here for a future rollback (V1-208J) to conflict with.
// completeRollbackOperation (V1-208J) is the one atomic write that lands a
// successful rollback: the recorded previousRelease becomes the active
// release again, previousVersion records the version rolled back FROM, and
// the reference is consumed — there is no roll-forward from a rollback.
export function completeRollbackOperation({ path, step, fs = nodeFs }) {
  const existing = readInstallationManifest(path, { fs });
  if (!existing) fail("does not exist.");
  if (!existing.previousRelease) fail("has no previous release reference to roll back to.");
  const next = {
    schemaVersion: SCHEMA_VERSION,
    ...existing.previousRelease,
    lastSuccessfulStep: requireString(step, "step"),
    previousVersion: existing.version,
    operation: { type: "rollback", status: "succeeded", failedStep: null, nextActions: [] },
  };
  atomicWrite(path, next, fs);
  return next;
}

export function completeUpdateOperation({ path, input, previousVersion, step, fs = nodeFs }) {
  const existing = readInstallationManifest(path, { fs });
  if (!existing) fail("does not exist.");
  const normalized = normalizeInput(input);
  const next = {
    schemaVersion: SCHEMA_VERSION,
    ...normalized,
    lastSuccessfulStep: requireString(step, "step"),
    previousVersion: requireString(previousVersion, "previousVersion"),
    operation: { type: "update", status: "succeeded", failedStep: null, nextActions: [] },
  };
  next.previousRelease = releaseReference(existing);
  atomicWrite(path, next, fs);
  return next;
}
