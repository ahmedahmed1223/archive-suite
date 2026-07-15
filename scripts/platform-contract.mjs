import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CONTRACT_PATH = fileURLToPath(new URL("../infra/platform/compatibility.v1.json", import.meta.url));
export const SCHEMA_PATH = fileURLToPath(new URL("../infra/platform/compatibility.v1.schema.json", import.meta.url));
const COMPOSE_PATH = fileURLToPath(new URL("../infra/docker-compose.yml", import.meta.url));

const PLATFORM_IDS = ["windows-10-11-docker", "linux-docker", "windows-native", "linux-native"];
const MODES = ["docker", "native"];
const STATUSES = ["conditional", "planned"];
const RUNTIME_PROFILE_IDS = ["core", "media", "edge"];
const CAPABILITY_IDS = ["ocr", "ai", "observability"];
const REQUIREMENT_IDS = ["node", "docker", "php", "composer", "postgresql", "redis"];

function parseJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read platform contract JSON at ${path}: ${error.message}`);
  }
}

function assertContract(condition, message) {
  if (!condition) throw new Error(`Invalid platform compatibility contract: ${message}`);
}

function hasExactly(ids, expected) {
  return ids.length === expected.length && expected.every((id) => ids.includes(id)) && new Set(ids).size === ids.length;
}

function optionalRuntimeProfiles(contract) {
  return Object.keys(contract.runtimeProfiles).filter((id) => id !== "core");
}

function composeProfilesFrom(source) {
  return [...source.matchAll(/^\s*profiles:\s*\[([^\]]*)\]/gm)]
    .flatMap(([, values]) => values.split(","))
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

export function resolveComposeProfiles(contract, raw) {
  const optional = optionalRuntimeProfiles(contract);
  const profiles = raw === undefined ? [] : String(raw).split(",").map((id) => id.trim()).filter(Boolean);
  for (const id of profiles) {
    if (CAPABILITY_IDS.includes(id)) {
      throw new Error(`Invalid Docker Compose runtime profile "${id}": capabilities cannot be enabled as Docker Compose profiles.`);
    }
    if (id === "core") {
      throw new Error('Invalid Docker Compose runtime profile "core": core is always enabled and is not passed to Docker Compose.');
    }
    if (!optional.includes(id)) {
      throw new Error(`Invalid Docker Compose runtime profile "${id}". Allowed optional profiles: ${optional.join(", ")}.`);
    }
  }
  return profiles;
}

export function validateRuntimeOptionSources(contract, {
  composeSource = readFileSync(COMPOSE_PATH, "utf8"),
} = {}) {
  const composeProfiles = composeProfilesFrom(composeSource);
  const expectedComposeProfiles = optionalRuntimeProfiles(contract);
  assertContract(
    hasExactly(composeProfiles, expectedComposeProfiles),
    `Docker Compose runtime profiles must be exactly ${expectedComposeProfiles.join(", ")}; capabilities must not be Docker Compose profiles`
  );
}

function validateContract(contract) {
  assertContract(contract && typeof contract === "object", "must be an object");
  assertContract(contract.schemaVersion === "1.0", "schemaVersion must be 1.0");
  assertContract(Array.isArray(contract.platforms), "platforms must be an array");
  assertContract(contract.platforms.length === PLATFORM_IDS.length, "must define exactly four platforms");
  assertContract(contract.runtimeProfiles && typeof contract.runtimeProfiles === "object", "runtimeProfiles must be an object");
  assertContract(contract.capabilities && typeof contract.capabilities === "object", "capabilities must be an object");
  assertContract(hasExactly(Object.keys(contract.runtimeProfiles), RUNTIME_PROFILE_IDS), "must define exactly the legal runtime profiles");
  assertContract(hasExactly(Object.keys(contract.capabilities), CAPABILITY_IDS), "must define exactly the legal capabilities");
  assertContract(Array.isArray(contract.ports) && contract.ports.length > 0, "ports must be a non-empty array");
  assertContract(contract.dataPaths?.windows?.root && contract.dataPaths?.linux?.root, "must include Windows and Linux data paths");
  assertContract(contract.resources?.status === "provisional", "resources must be provisional");

  const ids = contract.platforms.map((platform) => platform.id);
  assertContract(PLATFORM_IDS.every((id) => ids.includes(id)), "must define the required platform ids");
  assertContract(new Set(ids).size === ids.length, "platform ids must be unique");
  for (const platform of contract.platforms) {
    assertContract(MODES.includes(platform.mode), `${platform.id} has an unsupported mode`);
    assertContract(STATUSES.includes(platform.status), `${platform.id} must be conditional or planned`);
    assertContract(platform.requirements && REQUIREMENT_IDS.every((id) => typeof platform.requirements[id] === "string"), `${platform.id} is missing a runtime requirement`);
    assertContract(Array.isArray(platform.profiles) && hasExactly(platform.profiles, RUNTIME_PROFILE_IDS), `${platform.id} must declare exactly the legal runtime profiles`);
    assertContract(Array.isArray(platform.capabilities) && hasExactly(platform.capabilities, CAPABILITY_IDS), `${platform.id} must declare exactly the legal capabilities`);
    assertContract(platform.dataPathFamily === "windows" || platform.dataPathFamily === "linux", `${platform.id} has an unknown data-path family`);
    assertContract(platform.resourceStatus === "provisional", `${platform.id} resources must be provisional`);
  }
  for (const id of RUNTIME_PROFILE_IDS) {
    assertContract(contract.runtimeProfiles[id] && STATUSES.includes(contract.runtimeProfiles[id].status), `runtime profile ${id} must be conditional or planned`);
  }
  for (const id of CAPABILITY_IDS) {
    assertContract(contract.capabilities[id] && STATUSES.includes(contract.capabilities[id].status), `capability ${id} must be conditional or planned`);
  }
  for (const port of contract.ports) {
    assertContract(port.exposure === "public" || port.exposure === "internal", `port ${port.id} must declare its exposure`);
  }
  return contract;
}

/**
 * Free disk the host needs before installing the given selection.
 *
 * The contract states each profile's disk as a whole-host recommendation
 * (core=100GiB, media=250GiB), not an increment on top of core — so the
 * requirement is the largest selected entry, never the sum. `core` is always
 * included because the setup contract keeps it implicitly enabled; without
 * that, an empty selection would resolve to zero and let any disk pass.
 */
export function requiredDiskBytes(contract, { runtimeProfiles = [], capabilities = [] } = {}) {
  const selected = new Set(["core", ...runtimeProfiles, ...capabilities]);
  let required = 0;
  for (const id of selected) {
    const declared = contract.resources?.[id]?.diskBytes;
    // `edge` is a real profile with no resource entry of its own (it adds an
    // ingress container, not storage). Only reject ids the contract knows
    // nothing about, so a typo can never silently lower the requirement.
    if (declared === undefined) {
      const known = id in (contract.runtimeProfiles ?? {}) || id in (contract.capabilities ?? {});
      assertContract(known, `unknown profile or capability "${id}" has no declared resources`);
      continue;
    }
    required = Math.max(required, declared);
  }
  return required;
}

export function loadPlatformContract() {
  // Parse the schema too so a missing or malformed schema is a deterministic
  // operator error even though validation is intentionally dependency-free.
  const schema = parseJson(SCHEMA_PATH);
  assertContract(schema.$schema && schema.type === "object", "JSON schema must describe an object");
  const contract = validateContract(parseJson(CONTRACT_PATH));
  validateRuntimeOptionSources(contract);
  return contract;
}

export function selectPlatforms(contract, { mode, platformId } = {}) {
  if (mode && !MODES.includes(mode)) throw new Error(`Unsupported platform mode "${mode}"; use docker or native.`);
  if (platformId && !PLATFORM_IDS.includes(platformId)) throw new Error(`Unknown platform "${platformId}".`);
  const selected = contract.platforms.filter((platform) => (!mode || platform.mode === mode) && (!platformId || platform.id === platformId));
  if (!selected.length) throw new Error(`Platform "${platformId}" does not match mode "${mode}".`);
  return selected;
}

export function formatPlatformContractReport(contract, platforms) {
  const lines = [
    `Platform compatibility contract v${contract.schemaVersion}`,
    `Policy: ${contract.supportPolicy}`,
    "Read-only report: no installation, service start, configuration, or data-path creation is performed."
  ];
  for (const platform of platforms) {
    const dataPaths = contract.dataPaths[platform.dataPathFamily];
    lines.push("", `${platform.label} (${platform.id}) — ${platform.status}`);
    for (const [name, value] of Object.entries(platform.requirements)) lines.push(`  requirement ${name}: ${value}`);
    lines.push(`  runtime profiles: ${platform.profiles.map((id) => `${id} (${contract.runtimeProfiles[id].status})`).join(", ")}`);
    lines.push(`  capabilities: ${platform.capabilities.map((id) => `${id} (${contract.capabilities[id].status})`).join(", ")}`);
    lines.push(`  data root: ${dataPaths.root}`);
    lines.push(`  resources: ${platform.resourceStatus}`);
    if (platform.mode === "native") lines.push("  Native deployment is planned: no install or start action is available yet.");
  }
  lines.push("", `Ports: ${contract.ports.map((port) => `${port.id}:${port.port}/${port.protocol} (${port.exposure})`).join(", ")}`);
  lines.push(`Provisional resources: ${Object.entries(contract.resources).filter(([id]) => id !== "status").map(([id, value]) => `${id}=${value.cpu}, ${value.memory}, ${value.disk}`).join("; ")}`);
  return lines;
}
