import assert from "node:assert/strict";
import test from "node:test";

import {
  createSmokeScenarioExecutor,
  SMOKE_SCENARIO_IDS,
} from "./scenarios.mjs";

const scenario = (id) => ({ id, title: id, tags: ["smoke"], capabilities: ["docker"] });

function commandResult(payload) {
  return { status: 0, stdout: `${JSON.stringify(payload)}\n`, stderr: "" };
}

test("V1-804 exposes exactly the five stable smoke scenario IDs", () => {
  assert.deepEqual(SMOKE_SCENARIO_IDS, [
    "V1-IA-PLAT-001",
    "V1-IA-ARCH-001",
    "V1-IA-ADMIN-001",
    "V1-IA-ADMIN-002",
    "V1-IA-MULTI-001",
  ]);
});

test("platform boot requires API health plus worker and Reverb readiness", async () => {
  const calls = [];
  const execute = createSmokeScenarioExecutor({
    browserJourney: async () => ({ status: 0 }),
  });
  const result = await execute({
    scenario: scenario("V1-IA-PLAT-001"),
    provider: {
      exec: async (service, args) => {
        calls.push([service, args]);
        if (service === "laravel") return { status: 0, stdout: '{"status":"ok"}', stderr: "" };
        return { status: 0, stdout: "running\nrunning\n", stderr: "" };
      },
    },
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(calls, [
    ["laravel", ["curl", "--fail", "--silent", "--show-error", "http://localhost:8000/api/v1/health"]],
    ["laravel-worker", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[q]ueue:work'"]],
    ["laravel-reverb", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[r]everb:start'"]],
  ]);
});

test("backup smoke verifies only the basename emitted by the real backup command", async () => {
  const calls = [];
  const execute = createSmokeScenarioExecutor({ browserJourney: async () => ({ status: 0 }) });
  const result = await execute({
    scenario: scenario("V1-IA-ADMIN-002"),
    provider: {
      exec: async (service, args) => {
        calls.push([service, args]);
        return calls.length === 1
          ? commandResult({ ok: true, details: { backup: { name: "acceptance.json.gz" } } })
          : commandResult({ ok: true, details: { result: { verified: true } } });
      },
    },
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(calls, [
    ["laravel-fpm", ["php", "artisan", "archive:backup-run", "--json"]],
    ["laravel-fpm", ["php", "artisan", "archive:backup-verify", "acceptance.json.gz", "--json"]],
  ]);
});

test("all browser journeys share one direct authenticated Playwright invocation against the provider stack", async () => {
  const calls = [];
  const execute = createSmokeScenarioExecutor({
    browserJourney: async (input) => { calls.push(input); return { status: 0, stdout: "", stderr: "" }; },
  });
  for (const id of ["V1-IA-ARCH-001", "V1-IA-ADMIN-001", "V1-IA-MULTI-001"]) {
    const result = await execute({ scenario: scenario(id), provider: { endpoints: { next: "http://127.0.0.1:43123", api: "http://127.0.0.1:43123/api/v1" }, credentials: { email: "admin@test", password: "not-in-evidence" } }, evidenceStore: { directory: "C:/temp/evidence" } });
    assert.equal(result.status, "passed");
  }
  assert.equal(calls.length, 1);
  assert.deepEqual(calls.map(({ command, args }) => ({ command, args })), [
    { command: "pnpm", args: ["--filter", "@archive/next", "exec", "playwright", "test", "e2e/acceptance-smoke.authed.spec.ts", "--project", "authenticated"] },
  ]);
  assert.equal(calls[0].env.E2E_BASE_URL, "http://127.0.0.1:43123");
  assert.equal(calls[0].env.ARCHIVE_E2E_EMAIL, "admin@test");
});

test("failed operational or browser checks produce deterministic product evidence", async () => {
  const execute = createSmokeScenarioExecutor({ browserJourney: async () => ({ status: 1, stderr: "failed" }) });
  const result = await execute({ scenario: scenario("V1-IA-ARCH-001"), provider: { endpoints: { next: "http://127.0.0.1:1", api: "http://127.0.0.1:1/api/v1" }, credentials: { email: "a", password: "b" } }, evidenceStore: { directory: "C:/temp/evidence" } });
  assert.deepEqual(result, {
    scenarioId: "V1-IA-ARCH-001",
    status: "failed",
    classification: "product",
    evidence: { kind: "playwright", scenarioId: "V1-IA-ARCH-001", refs: ["playwright/", "playwright-results.json"] },
  });
});
