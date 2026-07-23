import { SCENARIO_TAGS, validateScenario } from "./contracts.mjs";

export const ACCEPTANCE_REGISTRY_VERSION = "1.0.0";

const tags = ["smoke", "daily", "nightly", "rc", "ga"];
const scenario = (id, title, loginSessions) => validateScenario({
  id,
  title,
  tags,
  capabilities: ["docker"],
  loginSessions,
  refreshSessions: loginSessions,
});

export const ACCEPTANCE_SCENARIOS = Object.freeze([
  scenario("V1-IA-PLAT-001", "Docker platform boot and readiness", 0),
  // One authenticated Playwright invocation provisions three roles (4 login
  // calls including bootstrap) then opens four fresh role contexts. It runs
  // all browser journeys once and is charged here, not three times.
  scenario("V1-IA-ARCH-001", "Archivist login, search, and record open", 8),
  scenario("V1-IA-ADMIN-001", "Administrator system health", 0),
  scenario("V1-IA-ADMIN-002", "Administrator backup and verification", 0),
  scenario("V1-IA-MULTI-001", "Concurrent isolated role sessions", 0),
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
