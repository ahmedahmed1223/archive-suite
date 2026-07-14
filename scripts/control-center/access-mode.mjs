import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createSetupConfiguration } from "./setup-config.mjs";
import { loadPlatformContract } from "../platform-contract.mjs";

const setupConfiguration = createSetupConfiguration({ loadPlatformContract });

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
  const snapshots = new WeakMap();
  const snapshot = () => {
    const raw = readRaw();
    const token = Object.freeze({});
    snapshots.set(token, {
      raw,
      summary: accessSummary({
        access: envValue(raw, "ACCESS_MODE") || "local",
        runtimeProfiles: ["core", ...envValue(raw, "ARCHIVE_COMPOSE_PROFILES").split(",").map((value) => value.trim()).filter(Boolean)],
      }),
    });
    return token;
  };
  const saved = (token) => {
    const value = snapshots.get(token);
    if (!value) throw new Error("Unknown access configuration snapshot.");
    return value;
  };
  return {
    snapshot,
    describe: (token) => ({ ...saved(token).summary, runtimeProfiles: [...saved(token).summary.runtimeProfiles] }),
    apply: async (configuration) => {
      let next = setEnvValue(readRaw(), "ACCESS_MODE", configuration.access);
      next = setEnvValue(next, "ARCHIVE_COMPOSE_PROFILES", configuration.runtimeProfiles.filter((profile) => profile !== "core").join(","));
      atomicWrite(envPath, next);
    },
    restore: async (token) => atomicWrite(envPath, saved(token).raw),
  };
}

// This manager deliberately has no Docker dependency.  Preflight must finish
// before any configuration write, and lifecycle orchestration can compose it
// only after this safe, testable boundary reports success.
export function createAccessModeManager({ store, portProbe, dnsProbe, certificateProbe, healthProbe }) {
  if (!store || !portProbe || !dnsProbe || !certificateProbe || !healthProbe) throw new Error("Access mode manager requires a store and all probes.");
  return {
    async switchAccess(configuration) {
      const { port, publicDomain, ...setupInput } = configuration || {};
      const canonical = setupConfiguration.planInput(setupInput);
      if (!canonical.ok) return canonical;
      const candidate = { ...canonical.details.configuration, port, publicDomain };
      if (candidate.access === "public" && (typeof candidate.publicDomain !== "string" || !candidate.publicDomain.trim())) {
        return result(false, "PUBLIC_DOMAIN_REQUIRED", "Public access requires a domain for DNS and certificate preflight.", { field: "publicDomain" }, ["Provide a public domain and retry the access change."]);
      }

      const portFailure = await runProbe("port", portProbe, { port: candidate.port, access: candidate.access });
      if (portFailure) return portFailure;
      if (candidate.access === "public") {
        const dnsFailure = await runProbe("dns", dnsProbe, { domain: candidate.publicDomain });
        if (dnsFailure) return dnsFailure;
        const certificateFailure = await runProbe("certificate", certificateProbe, { domain: candidate.publicDomain });
        if (certificateFailure) return certificateFailure;
      }

      const snapshot = store.snapshot();
      try {
        await store.apply(candidate);
      } catch {
        return result(false, "ACCESS_SWITCH_WRITE_FAILED", "Access configuration could not be applied atomically.", {}, ["Check write permissions and retry."]);
      }

      let healthy = false;
      try { healthy = Boolean((await healthProbe({ access: candidate.access })).ok); } catch { /* restore below */ }
      if (healthy) return result(true, "ACCESS_SWITCHED", "Access configuration was applied and passed health verification.", { configuration: accessSummary(candidate) }, ["Use setup health to monitor the service."]);

      try {
        await store.restore(snapshot);
        return result(false, "ACCESS_SWITCH_ROLLED_BACK", "Health verification failed; the previous access configuration was restored.", { restored: true, previous: store.describe ? store.describe(snapshot) : {} }, ["Resolve the health issue before retrying the access change."]);
      } catch {
        return result(false, "ACCESS_SWITCH_RESTORE_FAILED", "Health verification failed and the previous access configuration could not be restored automatically.", { restored: false }, ["Restore the previous non-secret access configuration from a secure backup."]);
      }
    },
  };
}
