import { existsSync, readFileSync } from "node:fs";

const SETUP_SCHEMA_VERSION = "1.0";
const SOURCES = ["online", "offline"];
const INTENTS = ["fresh", "repair", "reconfigure", "update", "rollback", "uninstall", "reconnect-data"];
const ACCESS_MODES = ["local", "intranet", "public"];
const SETUP_KEYS = ["schemaVersion", "mode", "platform", "source", "intent", "access", "runtimeProfiles", "capabilities", "dataServices", "storage"];

class SetupConfigError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const failure = (error) => ({
  ok: false,
  code: error.code || "CONFIG_INVALID",
  message: error.message || "Setup configuration is invalid.",
  details: error.details || {},
  nextActions: ["Correct the configuration and run setup plan again."],
});

const success = (code, message, details, nextActions) => ({ ok: true, code, message, details, nextActions });

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SetupConfigError("CONFIG_INVALID", `${name} must be an object.`);
  return value;
}

function requireEnum(value, name, allowed) {
  if (!allowed.includes(value)) throw new SetupConfigError("CONFIG_INVALID", `${name} must be one of: ${allowed.join(", ")}.`, { field: name, allowed });
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new SetupConfigError("CONFIG_INVALID", `${name} must be a non-empty string.`, { field: name });
  return value.trim();
}

function requireSafeStoragePath(value) {
  const path = requireString(value, "storage.path");
  if (/[a-z][a-z\d+.-]*:\/\//i.test(path) || /[^/\\\s:@]+:[^/\\\s@]+@/.test(path)) {
    throw new SetupConfigError("CONFIG_INVALID", "storage.path must be a local path without a URL or credentials.", { field: "storage.path" });
  }
  return path;
}

function requireUniqueStrings(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim()) || new Set(value).size !== value.length) {
    throw new SetupConfigError("CONFIG_INVALID", `${name} must be an array of unique non-empty strings.`, { field: name });
  }
  return value.map((item) => item.trim());
}

function canonicalAccess(value) {
  return value === "internal" ? "intranet" : value;
}

function platformForCurrentHost() {
  return process.platform === "win32" ? "windows-10-11-docker" : "linux-docker";
}

export function createSetupConfiguration({ loadPlatformContract }) {
  const normalize = (input) => {
    const config = requireObject(input, "Setup configuration");
    const unknown = Object.keys(config).filter((key) => !SETUP_KEYS.includes(key));
    if (unknown.length) throw new SetupConfigError("CONFIG_INVALID", `Setup configuration contains unsupported fields: ${unknown.join(", ")}.`, { fields: unknown });
    if (config.schemaVersion !== SETUP_SCHEMA_VERSION) throw new SetupConfigError("CONFIG_INVALID", `schemaVersion must be ${SETUP_SCHEMA_VERSION}.`, { field: "schemaVersion" });

    const contract = loadPlatformContract();
    const mode = requireEnum(config.mode, "mode", ["docker", "native"]);
    const platformId = requireString(config.platform, "platform");
    const platform = contract.platforms.find((candidate) => candidate.id === platformId);
    if (!platform) throw new SetupConfigError("CONFIG_INVALID", `Unknown platform "${platformId}".`, { field: "platform" });
    if (platform.mode !== mode) throw new SetupConfigError("CONFIG_INVALID", `Platform "${platformId}" does not match mode "${mode}".`, { field: "platform", mode });

    const runtimeProfiles = requireUniqueStrings(config.runtimeProfiles, "runtimeProfiles");
    const capabilities = requireUniqueStrings(config.capabilities, "capabilities");
    if (!runtimeProfiles.includes("core")) throw new SetupConfigError("CONFIG_INVALID", "runtimeProfiles must include the required core profile.", { field: "runtimeProfiles" });
    const profileIds = Object.keys(contract.runtimeProfiles);
    const capabilityIds = Object.keys(contract.capabilities);
    for (const id of runtimeProfiles) {
      if (capabilityIds.includes(id)) throw new SetupConfigError("CONFIG_INVALID", `Capability "${id}" cannot be used as a runtime profile.`, { field: "runtimeProfiles", value: id });
      if (!profileIds.includes(id) || !platform.profiles.includes(id)) throw new SetupConfigError("CONFIG_INVALID", `Illegal runtime profile "${id}" for platform "${platformId}".`, { field: "runtimeProfiles", value: id });
    }
    for (const id of capabilities) {
      if (!capabilityIds.includes(id) || !platform.capabilities.includes(id)) throw new SetupConfigError("CONFIG_INVALID", `Illegal capability "${id}" for platform "${platformId}".`, { field: "capabilities", value: id });
    }

    const dataServices = requireObject(config.dataServices, "dataServices");
    const dataServiceKeys = Object.keys(dataServices);
    if (dataServiceKeys.length !== 2 || !dataServiceKeys.includes("postgres") || !dataServiceKeys.includes("redis")) {
      throw new SetupConfigError("CONFIG_INVALID", "dataServices must declare postgres and redis only.", { field: "dataServices" });
    }
    for (const id of ["postgres", "redis"]) {
      const service = requireObject(dataServices[id], `dataServices.${id}`);
      if (Object.keys(service).length !== 1 || typeof service.enabled !== "boolean") {
        throw new SetupConfigError("CONFIG_INVALID", `dataServices.${id} must contain only a boolean enabled value.`, { field: `dataServices.${id}` });
      }
      if (!service.enabled) throw new SetupConfigError("CONFIG_INVALID", `dataServices.${id} must remain enabled for the canonical stack.`, { field: `dataServices.${id}` });
    }

    const storage = requireObject(config.storage, "storage");
    if (Object.keys(storage).length !== 2 || storage.driver !== "local") throw new SetupConfigError("CONFIG_INVALID", "storage must use the supported local driver.", { field: "storage" });
    const storagePath = requireSafeStoragePath(storage.path);
    const source = requireEnum(config.source, "source", SOURCES);
    const access = requireEnum(config.access, "access", ACCESS_MODES);
    const edgeEnabled = runtimeProfiles.includes("edge");
    // `edge` owns the public TLS ingress. Keep local/intranet deployments
    // private by default and refuse an accidental public exposure without it.
    if (access === "public" && !edgeEnabled) {
      throw new SetupConfigError("PUBLIC_ACCESS_REQUIRES_EDGE", "Public access requires the edge runtime profile for TLS ingress.", { field: "access", requiredProfile: "edge" });
    }
    if (access !== "public" && edgeEnabled) {
      throw new SetupConfigError("EDGE_REQUIRES_PUBLIC_ACCESS", "The edge runtime profile is reserved for public TLS access; remove edge or choose public access.", { field: "runtimeProfiles", profile: "edge", access });
    }

    return {
      schemaVersion: SETUP_SCHEMA_VERSION,
      mode,
      platform: platformId,
      source,
      intent: requireEnum(config.intent, "intent", INTENTS),
      access,
      runtimeProfiles: profileIds.filter((id) => runtimeProfiles.includes(id)),
      capabilities: capabilityIds.filter((id) => capabilities.includes(id)),
      dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
      storage: { driver: "local", path: storagePath },
    };
  };

  const readConfig = (path) => {
    if (!path) throw new SetupConfigError("CONFIG_PATH_REQUIRED", "--config=<file> is required.");
    if (!existsSync(path)) throw new SetupConfigError("CONFIG_NOT_FOUND", `Configuration file was not found: ${path}.`, { path });
    try { return JSON.parse(readFileSync(path, "utf8")); }
    catch (error) { throw new SetupConfigError("CONFIG_INVALID", `Configuration file is not valid JSON: ${error.message}.`, { path }); }
  };

  const importInput = (input) => {
    try {
      const configuration = normalize(input);
      return success("CONFIG_IMPORTED", "Configuration is valid and normalized; no files or services were changed.", configuration, ["Review the normalized configuration.", "Run setup plan --config=<file> to create a read-only plan."]);
    } catch (error) { return failure(error); }
  };

  const planInput = (input) => {
    try {
      const configuration = normalize(input);
      const plan = [
        "Validate the declarative setup configuration.",
        `Prepare ${configuration.mode} deployment for ${configuration.platform} from ${configuration.source} source.`,
        `Keep core enabled; optional runtime profiles: ${configuration.runtimeProfiles.filter((id) => id !== "core").join(", ") || "none"}.`,
        "Do not create .env, data paths, services, or run Docker in plan mode.",
      ];
      return success("PLAN_READY", "Deterministic setup plan created; no files, services, or data paths were changed.", { configuration, plan }, ["Review the plan.", "Installation is intentionally not implemented in V1-208C."]);
    } catch (error) { return failure(error); }
  };

  // Both the wizard and a JSON file use this exact resolver.  Keeping the
  // path-reading wrapper outside the resolver prevents choice drift between
  // interactive and non-interactive Setup.
  const importConfig = (path) => {
    try { return importInput(readConfig(path)); }
    catch (error) { return failure(error); }
  };

  const plan = (path) => {
    try { return planInput(readConfig(path)); }
    catch (error) { return failure(error); }
  };

  const exportConfig = ({ envPath, env }) => {
    if (!existsSync(envPath)) return failure(new SetupConfigError("CONFIG_NOT_FOUND", "No current configuration is available to export.", { envPath }));
    const contract = loadPlatformContract();
    const platformId = env.ARCHIVE_PLATFORM || platformForCurrentHost();
    const platform = contract.platforms.find((candidate) => candidate.id === platformId);
    const pathFamily = platform?.dataPathFamily || (process.platform === "win32" ? "windows" : "linux");
    const rawProfiles = String(env.ARCHIVE_COMPOSE_PROFILES || "").split(",").map((value) => value.trim()).filter(Boolean);
    const candidate = {
      schemaVersion: SETUP_SCHEMA_VERSION,
      mode: env.ARCHIVE_MODE || "docker",
      platform: platformId,
      source: env.ARCHIVE_SETUP_SOURCE || "online",
      intent: env.ARCHIVE_SETUP_INTENT || "reconfigure",
      access: canonicalAccess(env.ACCESS_MODE || "local"),
      runtimeProfiles: ["core", ...rawProfiles],
      capabilities: String(env.ARCHIVE_CAPABILITIES || "").split(",").map((value) => value.trim()).filter(Boolean),
      dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
      storage: { driver: "local", path: env.ARCHIVE_STORAGE_PATH || contract.dataPaths[pathFamily].storage },
    };
    try {
      const configuration = normalize(candidate);
      return success("CONFIG_EXPORTED", "Current configuration exported without secrets or credentials.", configuration, ["Save this JSON output to reuse the non-secret setup choices."]);
    } catch (error) { return failure(error); }
  };

  const errorResult = (code, message, details = {}) => failure(new SetupConfigError(code, message, details));

  return { importConfig, importInput, plan, planInput, exportConfig, errorResult };
}
