import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CONTRACT_PATH = fileURLToPath(new URL("../infra/platform/compatibility.v1.json", import.meta.url));
export const SCHEMA_PATH = fileURLToPath(new URL("../infra/platform/compatibility.v1.schema.json", import.meta.url));

const PLATFORM_IDS = ["windows-10-11-docker", "linux-docker", "windows-native", "linux-native"];
const MODES = ["docker", "native"];
const STATUSES = ["conditional", "planned"];
const PROFILE_IDS = ["core", "media", "ocr", "ai", "observability"];
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

function validateContract(contract) {
  assertContract(contract && typeof contract === "object", "must be an object");
  assertContract(contract.schemaVersion === "1.0", "schemaVersion must be 1.0");
  assertContract(Array.isArray(contract.platforms), "platforms must be an array");
  assertContract(contract.platforms.length === PLATFORM_IDS.length, "must define exactly four platforms");
  assertContract(contract.profiles && typeof contract.profiles === "object", "profiles must be an object");
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
    assertContract(Array.isArray(platform.profiles) && platform.profiles.every((id) => PROFILE_IDS.includes(id)), `${platform.id} has an unknown profile`);
    assertContract(platform.dataPathFamily === "windows" || platform.dataPathFamily === "linux", `${platform.id} has an unknown data-path family`);
    assertContract(platform.resourceStatus === "provisional", `${platform.id} resources must be provisional`);
  }
  for (const id of PROFILE_IDS) {
    assertContract(contract.profiles[id] && STATUSES.includes(contract.profiles[id].status), `profile ${id} must be conditional or planned`);
  }
  for (const port of contract.ports) {
    assertContract(port.exposure === "public" || port.exposure === "internal", `port ${port.id} must declare its exposure`);
  }
  return contract;
}

export function loadPlatformContract() {
  // Parse the schema too so a missing or malformed schema is a deterministic
  // operator error even though validation is intentionally dependency-free.
  const schema = parseJson(SCHEMA_PATH);
  assertContract(schema.$schema && schema.type === "object", "JSON schema must describe an object");
  return validateContract(parseJson(CONTRACT_PATH));
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
    lines.push(`  profiles: ${platform.profiles.map((id) => `${id} (${contract.profiles[id].status})`).join(", ")}`);
    lines.push(`  data root: ${dataPaths.root}`);
    lines.push(`  resources: ${platform.resourceStatus}`);
    if (platform.mode === "native") lines.push("  Native deployment is planned: no install or start action is available yet.");
  }
  lines.push("", `Ports: ${contract.ports.map((port) => `${port.id}:${port.port}/${port.protocol} (${port.exposure})`).join(", ")}`);
  lines.push(`Provisional resources: ${Object.entries(contract.resources).filter(([id]) => id !== "status").map(([id, value]) => `${id}=${value.cpu}, ${value.memory}, ${value.disk}`).join("; ")}`);
  return lines;
}
