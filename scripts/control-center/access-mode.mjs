import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";

const ACCESS_MODES = new Set(["local", "intranet", "public"]);
const SECRET_KEY = /(password|secret|token|credential|(^|_)key$|_url$|dsn$)/i;

function result(ok, code, message, details = {}, nextActions = []) {
  return { ok, code, message, details, nextActions };
}

function envValue(raw, key) {
  const line = raw.split(/\r?\n/).find((item) => item.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

function setEnvValue(raw, key, value) {
  const expression = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=.*$`, "m");
  return expression.test(raw)
    ? raw.replace(expression, `${key}=${value}`)
    : `${raw.replace(/\n?$/, "\n")}${key}=${value}\n`;
}

function atomicWrite(path, content) {
  const temporary = `${path}.access-mode-${process.pid}-${Date.now()}.tmp`;
  try {
    writeFileSync(temporary, content, { mode: 0o600 });
    renameSync(temporary, path);
  } catch (error) {
    try { if (existsSync(temporary)) unlinkSync(temporary); } catch { /* preserve original write failure */ }
    throw error;
  }
}

function accessSummary(config = {}) {
  return {
    access: config.access,
    runtimeProfiles: Array.isArray(config.runtimeProfiles) ? [...config.runtimeProfiles] : [],
  };
}

function profilePolicy(configuration) {
  const { access, runtimeProfiles } = configuration || {};
  if (!ACCESS_MODES.has(access)) return result(false, "ACCESS_MODE_INVALID", "Access mode must be local, intranet, or public.", { field: "access" });
  if (!Array.isArray(runtimeProfiles) || !runtimeProfiles.includes("core")) return result(false, "CORE_PROFILE_REQUIRED", "The core runtime profile must remain enabled.", { field: "runtimeProfiles" });
  const edge = runtimeProfiles.includes("edge");
  if (access === "public" && !edge) return result(false, "PUBLIC_ACCESS_REQUIRES_EDGE", "Public access requires the edge runtime profile for TLS ingress.", { field: "access", requiredProfile: "edge" });
  if (access !== "public" && edge) return result(false, "EDGE_REQUIRES_PUBLIC_ACCESS", "The edge runtime profile is reserved for public TLS access.", { field: "runtimeProfiles", profile: "edge", access });
  return null;
}

async function runProbe(name, probe, input) {
  try {
    const answer = await probe(input);
    if (answer?.ok) return null;
    const supported = answer?.supported !== false;
    const code = name === "port" && answer?.reason === "in_use" ? "PORT_CONFLICT" : `${name.toUpperCase()}_PROBE_FAILED`;
    return result(false, code, `${name === "port" ? "Port" : name[0].toUpperCase() + name.slice(1)} preflight did not pass.`, { probe: name, supported }, ["Resolve the preflight issue and try the access change again."]);
  } catch {
    return result(false, `${name.toUpperCase()}_PROBE_FAILED`, `${name === "port" ? "Port" : name[0].toUpperCase() + name.slice(1)} preflight could not be completed.`, { probe: name, supported: false }, ["Verify the host prerequisite and try the access change again."]);
  }
}

// File-backed storage is optional integration plumbing for Setup.  It writes
// only the non-secret access selectors and retains the complete old file only
// in-memory until health confirms the change or a restore is required.
export function createEnvAccessStore({ envPath }) {
  const readRaw = () => existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  return {
    snapshot: () => ({ raw: readRaw(), ...accessSummary({
      access: envValue(readRaw(), "ACCESS_MODE") || "local",
      runtimeProfiles: ["core", ...envValue(readRaw(), "ARCHIVE_COMPOSE_PROFILES").split(",").map((value) => value.trim()).filter(Boolean)],
    }) }),
    describe: (snapshot) => accessSummary(snapshot),
    apply: async (configuration) => {
      let next = setEnvValue(readRaw(), "ACCESS_MODE", configuration.access);
      next = setEnvValue(next, "ARCHIVE_COMPOSE_PROFILES", configuration.runtimeProfiles.filter((profile) => profile !== "core").join(","));
      atomicWrite(envPath, next);
    },
    restore: async (snapshot) => atomicWrite(envPath, snapshot.raw),
  };
}

// This manager deliberately has no Docker dependency.  Preflight must finish
// before any configuration write, and lifecycle orchestration can compose it
// only after this safe, testable boundary reports success.
export function createAccessModeManager({ store, portProbe, dnsProbe, certificateProbe, healthProbe }) {
  if (!store || !portProbe || !dnsProbe || !certificateProbe || !healthProbe) throw new Error("Access mode manager requires a store and all probes.");
  return {
    async switchAccess(configuration) {
      const policyFailure = profilePolicy(configuration);
      if (policyFailure) return policyFailure;

      const portFailure = await runProbe("port", portProbe, { port: configuration.port, access: configuration.access });
      if (portFailure) return portFailure;
      if (configuration.access === "public") {
        const dnsFailure = await runProbe("dns", dnsProbe, { domain: configuration.publicDomain });
        if (dnsFailure) return dnsFailure;
        const certificateFailure = await runProbe("certificate", certificateProbe, { domain: configuration.publicDomain });
        if (certificateFailure) return certificateFailure;
      }

      const snapshot = store.snapshot();
      try {
        await store.apply(configuration);
      } catch {
        return result(false, "ACCESS_SWITCH_WRITE_FAILED", "Access configuration could not be applied atomically.", {}, ["Check write permissions and retry."]);
      }

      let healthy = false;
      try { healthy = Boolean((await healthProbe({ access: configuration.access })).ok); } catch { /* restore below */ }
      if (healthy) return result(true, "ACCESS_SWITCHED", "Access configuration was applied and passed health verification.", { configuration: accessSummary(configuration) }, ["Use setup health to monitor the service."]);

      try {
        await store.restore(snapshot);
        return result(false, "ACCESS_SWITCH_ROLLED_BACK", "Health verification failed; the previous access configuration was restored.", { restored: true, previous: store.describe ? store.describe(snapshot) : accessSummary(snapshot) }, ["Resolve the health issue before retrying the access change."]);
      } catch {
        return result(false, "ACCESS_SWITCH_RESTORE_FAILED", "Health verification failed and the previous access configuration could not be restored automatically.", { restored: false }, ["Restore the previous non-secret access configuration from a secure backup."]);
      }
    },
  };
}

// Kept exported for callers that need to redact operation context before
// displaying it. The manager itself never includes raw snapshots in results.
export function redactAccessDetails(details) {
  return Object.fromEntries(Object.entries(details || {}).filter(([key]) => !SECRET_KEY.test(key)));
}
