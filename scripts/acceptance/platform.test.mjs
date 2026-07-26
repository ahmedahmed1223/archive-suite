import assert from "node:assert/strict";
import test from "node:test";

import {
  LIFECYCLE_SCENARIOS,
  assertProviderContract,
  isDestructiveScenario,
  snapshotForScenario,
} from "./platform.mjs";

test("destructive lifecycle scenarios require a provider snapshot with immutable evidence", async () => {
  const scenario = LIFECYCLE_SCENARIOS.find((item) => item.id === "V1-IA-LIFE-005");
  assert.equal(isDestructiveScenario(scenario), true);
  await assert.rejects(
    () => snapshotForScenario({ name: "docker", target: { kind: "docker" }, capabilities: ["docker"], snapshot: async () => ({}) }, scenario),
    /snapshot.*id/i,
  );
  const evidence = await snapshotForScenario({ name: "docker", target: { kind: "docker" }, capabilities: ["docker"], snapshot: async () => ({ id: "before-update", createdAt: "2026-07-26T00:00:00.000Z" }) }, scenario);
  assert.deepEqual(evidence, { id: "before-update", createdAt: "2026-07-26T00:00:00.000Z" });
});

test("provider contracts declare their target and discoverable capabilities", () => {
  assert.throws(() => assertProviderContract({ name: "windows-native", capabilities: [] }), /target/i);
  const provider = assertProviderContract({
    name: "windows-native",
    target: { kind: "windows-native", cleanHost: true, operatingSystem: "Windows 11" },
    capabilities: ["windows-native", "reboot", "offline-install"],
    snapshot: async () => ({ id: "snap" }),
  });
  assert.equal(provider.target.cleanHost, true);
});
