import { SCENARIO_TAGS, validateScenario } from "./contracts.mjs";
import { LIFECYCLE_SCENARIOS } from "./platform.mjs";
import { JOURNEY_SCENARIOS, SMOKE_SCENARIOS } from "./scenarios.mjs";

export const ACCEPTANCE_REGISTRY_VERSION = "1.0.0";

const tags = ["smoke", "daily", "nightly", "rc", "ga"];
const timeoutById = new Map([...SMOKE_SCENARIOS, ...JOURNEY_SCENARIOS].map(({ id, timeoutMs }) => [id, timeoutMs]));
const scenario = (id, title, loginSessions, scenarioTags = tags) => validateScenario({
  id,
  title,
  tags: scenarioTags,
  capabilities: ["docker"],
  loginSessions,
  refreshSessions: loginSessions,
  timeoutMs: timeoutById.get(id),
});
const capabilityScenario = (input) => validateScenario(input);

export const ACCEPTANCE_SCENARIOS = Object.freeze([
  scenario("V1-IA-PLAT-001", "Docker platform boot and readiness", 0),
  // One authenticated Playwright invocation provisions three roles (4 login
  // calls including bootstrap) then opens four fresh role contexts. It runs
  // all browser journeys once and is charged here, not three times.
  scenario("V1-IA-ARCH-001", "Archivist login, search, and record open", 8),
  scenario("V1-IA-ADMIN-001", "Administrator system health", 0),
  scenario("V1-IA-ADMIN-002", "Administrator backup and verification", 0),
  scenario("V1-IA-MULTI-001", "Concurrent isolated role sessions", 0),
  scenario("V1-IA-ADMIN-003", "System administrator complete local journey", 3, ["daily", "nightly", "rc", "ga"]),
  scenario("V1-IA-ARCH-002", "Archivist complete local journey", 6, ["daily", "nightly", "rc", "ga"]),
  scenario("V1-IA-MULTI-002", "Concurrent users and permissions local journey", 9, ["daily", "nightly", "rc", "ga"]),
  capabilityScenario({ id: "V1-IA-MEDIA-001", title: "Media montage, review, export, and failure recovery", tags: ["nightly", "rc", "ga"], capabilities: ["docker", "media-worker", "ffmpeg"], loginSessions: 4, refreshSessions: 4, timeoutMs: 20 * 60_000, evidence: ["media-journey.json", "media-job-log.json", "export-checksum.json"], blockedCapability: "media-worker-and-ffmpeg" }),
  capabilityScenario({ id: "V1-IA-LOAD-001", title: "Reproducible benchmark dataset and concurrent load", tags: ["nightly", "rc", "ga"], capabilities: ["docker", "load-baseline"], loginSessions: 0, refreshSessions: 0, timeoutMs: 90 * 60_000, evidence: ["dataset-manifest.json", "load-metrics.json", "queue-metrics.json", "integrity.json"], dataset: "docs/acceptance/datasets/v1-812.dataset.json", blockedCapability: "rc-load-baseline" }),
  capabilityScenario({ id: "V1-IA-GATE-001", title: "Daily, nightly, RC, and GA gate provenance", tags: ["daily", "nightly", "rc", "ga"], capabilities: ["automation"], loginSessions: 0, refreshSessions: 0, timeoutMs: 5 * 60_000, evidence: ["gate-plan.json", "artifact-provenance.json"], blockedCapability: "automation-provider" }),
  ...LIFECYCLE_SCENARIOS.map((item) => validateScenario({ ...item, loginSessions: 0, refreshSessions: 0, timeoutMs: 300_000 })),
]);

export function selectScenarios({ tag, ids } = {}) {
  if (tag && !SCENARIO_TAGS.includes(tag)) {
    throw new Error(`unknown scenario tag: ${tag}`);
  }
  const requested = ids ? new Set(ids) : null;
  if (requested) {
    const known = new Set(ACCEPTANCE_SCENARIOS.map(({ id }) => id));
    const unknown = [...requested].filter((id) => !known.has(id));
    if (unknown.length > 0) throw new Error(`unknown scenario: ${unknown.join(", ")}`);
  }
  return ACCEPTANCE_SCENARIOS.filter((item) => (!tag || item.tags.includes(tag)) && (!requested || requested.has(item.id)));
}
