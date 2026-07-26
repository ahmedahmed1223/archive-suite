import { selectScenarios } from "./registry.mjs";

export const ACCEPTANCE_GATES = Object.freeze({
  daily: Object.freeze({ tag: "daily", requiredCapabilities: ["docker"], allowBlockedCapability: true }),
  nightly: Object.freeze({ tag: "nightly", requiredCapabilities: ["docker", "media-worker", "ffmpeg", "load-baseline", "automation"], allowBlockedCapability: true }),
  rc: Object.freeze({ tag: "rc", requiredCapabilities: ["docker", "media-worker", "ffmpeg", "load-baseline", "automation", "clean-host", "native-windows", "native-linux"], allowBlockedCapability: false }),
  ga: Object.freeze({ tag: "ga", requiredCapabilities: ["docker", "media-worker", "ffmpeg", "load-baseline", "automation", "clean-host", "native-windows", "native-linux", "signed-artifacts"], allowBlockedCapability: false }),
});

export function resolveGate(name) {
  const gate = ACCEPTANCE_GATES[name];
  if (!gate) throw new Error(`unknown acceptance gate: ${name}`);
  return Object.freeze({ name, ...gate, scenarios: selectScenarios({ tag: gate.tag }) });
}

export function evaluateGate({ name, results, availableCapabilities = [] }) {
  const gate = resolveGate(name);
  const expected = new Set(gate.scenarios.map(({ id }) => id));
  const supplied = new Map((results ?? []).map((result) => [result.scenarioId, result]));
  const missingCapabilities = gate.requiredCapabilities.filter((capability) => !availableCapabilities.includes(capability));
  const missingScenarios = [...expected].filter((id) => !supplied.has(id));
  const blocked = [...supplied.values()].filter((result) => result.status === "blocked-capability").map(({ scenarioId }) => scenarioId);
  const failed = [...supplied.values()].filter((result) => result.status === "failed").map(({ scenarioId }) => scenarioId);
  return Object.freeze({ name, passed: missingCapabilities.length === 0 && missingScenarios.length === 0 && failed.length === 0 && (gate.allowBlockedCapability || blocked.length === 0), missingCapabilities, missingScenarios, blocked, failed, scenarioCount: expected.size });
}

export function gatePlan() { return Object.freeze(Object.keys(ACCEPTANCE_GATES).map((name) => { const gate = resolveGate(name); return Object.freeze({ name, tag: gate.tag, scenarioIds: gate.scenarios.map(({ id }) => id), requiredCapabilities: gate.requiredCapabilities, allowBlockedCapability: gate.allowBlockedCapability }); })); }
