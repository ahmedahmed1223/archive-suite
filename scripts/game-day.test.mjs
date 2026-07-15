import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCENARIOS, createGameDayPlan, redactEvidence, runGameDay } from "./game-day.mjs";

test("registry declares every required Docker game-day scenario and marks native/certificate checks external", () => {
  assert.deepEqual(SCENARIOS.map((scenario) => scenario.id), [
    "GD-DB-01", "GD-REDIS-02", "GD-WORKER-03", "GD-REVERB-04", "GD-NET-05", "GD-DISK-06", "GD-CERT-07",
  ]);
  assert.ok(SCENARIOS.every((scenario) => scenario.detection && scenario.recovery && scenario.dataSafety));
  assert.equal(SCENARIOS.find((scenario) => scenario.id === "GD-CERT-07").execution, "external-manual");
  assert.ok(SCENARIOS.every((scenario) => /Native/i.test(scenario.externalRequirements)));
});

test("a plan is dry-run by default, Docker-only, project-isolated, and includes scoped cleanup verification", () => {
  const plan = createGameDayPlan({ scenarioIds: ["GD-DB-01", "GD-WORKER-03"] });
  assert.equal(plan.dryRun, true);
  assert.match(plan.projectName, /^archive-gameday-[a-z0-9-]+$/);
  assert.equal(plan.runtime, "docker-compose");
  assert.equal(plan.scenarios.length, 2);
  assert.ok(plan.commands.every((command) => command.command === "docker"));
  assert.ok(plan.commands.some((command) => command.args.includes("down") && command.args.includes("--volumes")));
  assert.ok(plan.commands.some((command) => command.purpose === "verify-scoped-cleanup"));
  assert.ok(plan.commands.some((command) => command.purpose === "detect-GD-DB-01" && command.expect === "service-down"));
  assert.ok(plan.commands.some((command) => command.purpose === "recover-GD-DB-01" && command.expect === "service-running"));
  assert.ok(plan.commands.some((command) => command.purpose === "data-integrity-GD-DB-01"));
  assert.ok(plan.generatedCompose.contents.includes("container_name:"), "plan records why generated compose removes fixed container names");
});

test("game-day execution writes redacted evidence and never claims external manual checks passed", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "archive-game-day-"));
  const result = runGameDay({ scenarioIds: ["GD-DB-01", "GD-CERT-07"], outputDir, now: new Date("2026-07-15T12:00:00Z") });
  assert.equal(result.dryRun, true);
  const evidence = JSON.parse(readFileSync(result.evidencePath, "utf8"));
  assert.equal(evidence.status, "planned");
  assert.equal(evidence.scenarios.find((scenario) => scenario.id === "GD-CERT-07").status, "external-manual-required");
  assert.ok(evidence.cleanup.proofRequired);
  assert.doesNotMatch(JSON.stringify(evidence), /super-secret|actual-password/i);
});

test("evidence redaction removes secrets, credentials, tokens, and local paths", () => {
  const redacted = redactEvidence("PASSWORD=super-secret Authorization: Bearer abc.def postgres://user:actual-password@db/archive D:\\archiveaq\\private");
  assert.doesNotMatch(redacted, /super-secret|abc\.def|user:actual-password|archiveaq/i);
  assert.match(redacted, /\[REDACTED\]/);
});
