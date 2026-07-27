import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  createSmokeScenarioExecutor,
  JOURNEY_SCENARIO_IDS,
  JOURNEY_SCENARIOS,
  SMOKE_SCENARIO_IDS,
  SMOKE_SCENARIOS,
} from "./scenarios.mjs";

const scenario = (id) => ({ id, title: id, tags: ["smoke"], capabilities: ["docker"] });

test("acceptance Playwright configuration disables trace and video artifacts", () => {
  const config = readFileSync(new URL("../../archive-next/playwright.config.ts", import.meta.url), "utf8");
  assert.match(config, /ARCHIVE_ACCEPTANCE_SCENARIO_IDS/);
  assert.match(config, /screenshot:\s*isAcceptanceRun\s*\?\s*['"]off['"]\s*:/);
  assert.match(config, /video:\s*isAcceptanceRun\s*\?\s*['"]off['"]\s*:/);
  assert.match(config, /trace:\s*isAcceptanceRun\s*\?\s*['"]off['"]\s*:/);
  for (const scenario of SMOKE_SCENARIOS) {
    assert.ok(!scenario.evidence.includes("trace.zip"), `${scenario.id} must not declare trace evidence`);
  }
});

test("acceptance role contexts keep the provider origin and verify their session cookie", () => {
  const fixture = readFileSync(new URL("../../archive-next/e2e/fixtures/auth.ts", import.meta.url), "utf8");

  assert.match(fixture, /const baseURL = process\.env\.E2E_BASE_URL/);
  assert.match(fixture, /browser\.newContext\(\{ baseURL, storageState: storageStatePath\(role\) \}\)/);
  assert.match(fixture, /context\.cookies\(baseURL\)/);
  assert.match(fixture, /cookie\.name === 'va_session'/);
  assert.match(fixture, /const loginPayload = await login\.json\(\)/);
  assert.match(fixture, /account: sessionAccount/);
});

function commandResult(payload) {
  return { status: 0, stdout: `${JSON.stringify(payload)}\n`, stderr: "" };
}

function reportFor(outcomes) {
  return {
    suites: [{
      specs: Object.entries(outcomes).map(([id, status]) => ({
        title: `${id} journey`,
        tests: [{ status: status === "passed" ? "expected" : "unexpected", results: [{ status }] }],
      })),
    }],
  };
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

test("V1-808, V1-809, and V1-811 declare local Docker journeys with durable evidence hooks", () => {
  assert.deepEqual(JOURNEY_SCENARIO_IDS, [
    "V1-IA-ADMIN-003",
    "V1-IA-ARCH-002",
    "V1-IA-MULTI-002",
  ]);
  for (const journey of JOURNEY_SCENARIOS) {
    assert.equal(journey.timeoutMs, 600_000);
    assert.deepEqual(journey.evidence, ["playwright.json", "screenshots", "journey-checklist.json"]);
    assert.ok(journey.checks.length >= 4, `${journey.id} needs an executable journey checklist`);
  }
});

test("platform boot requires non-degraded API health plus worker, scheduler, and Reverb readiness", async () => {
  const calls = [];
  const controller = new AbortController();
  const execute = createSmokeScenarioExecutor({
    browserJourney: async () => ({ status: 0 }),
  });
  const result = await execute({
    scenario: scenario("V1-IA-PLAT-001"),
    provider: {
      exec: async (service, args, options) => {
        calls.push([service, args, options]);
        if (service === "laravel") return { status: 0, stdout: '{"ok":true,"degraded":false,"scheduledUploads":{"schedulerFresh":true}}', stderr: "" };
        return { status: 0, stdout: "running\nrunning\n", stderr: "" };
      },
    },
    signal: controller.signal,
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(calls, [
    ["laravel", ["curl", "--fail", "--silent", "--show-error", "http://localhost:8000/api/v1/health"], { signal: controller.signal }],
    ["laravel-worker", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[q]ueue:work'"], { signal: controller.signal }],
    ["laravel-scheduler", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[s]chedule:work'"], { signal: controller.signal }],
    ["laravel-reverb", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[r]everb:start'"], { signal: controller.signal }],
  ]);
});

test("platform boot rejects a degraded health payload even when curl exits zero", async () => {
  const execute = createSmokeScenarioExecutor({ browserJourney: async () => ({ status: 0 }) });
  const result = await execute({
    scenario: scenario("V1-IA-PLAT-001"),
    provider: {
      exec: async (service) => service === "laravel"
        ? { status: 0, stdout: '{"ok":true,"degraded":true,"scheduledUploads":{"schedulerFresh":false}}', stderr: "" }
        : { status: 0, stdout: "", stderr: "" },
    },
  });
  assert.equal(result.status, "failed");
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
    browserJourney: async (input) => {
      calls.push(input);
      return { status: 0, stdout: "", stderr: "", report: reportFor({
        "V1-IA-ARCH-001": "passed",
        "V1-IA-ADMIN-001": "passed",
        "V1-IA-MULTI-001": "passed",
      }) };
    },
  });
  for (const id of ["V1-IA-ARCH-001", "V1-IA-ADMIN-001", "V1-IA-MULTI-001"]) {
    const result = await execute({ scenario: scenario(id), selectedScenarioIds: ["V1-IA-ARCH-001", "V1-IA-ADMIN-001", "V1-IA-MULTI-001"], attempt: 1, provider: { endpoints: { next: "http://127.0.0.1:43123", api: "http://127.0.0.1:43123/api/v1" }, credentials: { email: "admin@test", password: "not-in-evidence" } }, evidenceStore: { directory: "C:/temp/evidence" } });
    assert.equal(result.status, "passed");
  }
  assert.equal(calls.length, 1);
  assert.deepEqual(calls.map(({ command, args }) => ({ command, args })), [
    process.platform === "win32"
      ? { command: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", "pnpm", "--filter", "@archive/next", "exec", "playwright", "test", "e2e/acceptance-smoke.authed.spec.ts", "--project", "authenticated"] }
      : { command: "pnpm", args: ["--filter", "@archive/next", "exec", "playwright", "test", "e2e/acceptance-smoke.authed.spec.ts", "--project", "authenticated"] },
  ]);
  assert.equal(calls[0].env.E2E_BASE_URL, "http://127.0.0.1:43123");
  assert.equal(calls[0].env.ARCHIVE_E2E_EMAIL, "admin@test");
  assert.equal(calls[0].env.ARCHIVE_ACCEPTANCE_SCENARIO_IDS, "V1-IA-ARCH-001,V1-IA-ADMIN-001,V1-IA-MULTI-001");
});

test("batched browser JSON maps mixed outcomes independently per scenario", async () => {
  const execute = createSmokeScenarioExecutor({
    browserJourney: async () => ({
      status: 1,
      stdout: "",
      stderr: "one test failed",
      report: reportFor({
        "V1-IA-ARCH-001": "passed",
        "V1-IA-ADMIN-001": "failed",
      }),
    }),
  });
  const context = {
    selectedScenarioIds: ["V1-IA-ARCH-001", "V1-IA-ADMIN-001"],
    attempt: 1,
    provider: { endpoints: { next: "http://127.0.0.1:1", api: "http://127.0.0.1:1/api/v1" }, credentials: { email: "a", password: "b" } },
    evidenceStore: { directory: join(tmpdir(), "acceptance-mixed") },
  };
  const passed = await execute({ ...context, scenario: scenario("V1-IA-ARCH-001") });
  const failed = await execute({ ...context, scenario: scenario("V1-IA-ADMIN-001") });
  assert.equal(passed.status, "passed");
  assert.equal(failed.status, "failed");
});

test("one-id selection targets only that browser journey", async () => {
  const calls = [];
  const execute = createSmokeScenarioExecutor({
    browserJourney: async (input) => {
      calls.push(input);
      return { status: 0, report: reportFor({ "V1-IA-ADMIN-001": "passed" }) };
    },
  });
  const result = await execute({
    scenario: scenario("V1-IA-ADMIN-001"),
    selectedScenarioIds: ["V1-IA-ADMIN-001"],
    attempt: 1,
    provider: { endpoints: { next: "http://127.0.0.1:1", api: "http://127.0.0.1:1/api/v1" }, credentials: { email: "a", password: "b" } },
    evidenceStore: { directory: join(tmpdir(), "acceptance-single") },
  });
  assert.equal(result.status, "passed");
  assert.equal(calls[0].env.ARCHIVE_ACCEPTANCE_SCENARIO_IDS, "V1-IA-ADMIN-001");
});

test("flake retry starts a new child targeted only to the flaky scenario", async () => {
  const calls = [];
  const execute = createSmokeScenarioExecutor({
    browserJourney: async (input) => {
      calls.push(input);
      return calls.length === 1
        ? { status: 1, stderr: "socket hang up", report: reportFor({ "V1-IA-ARCH-001": "failed" }) }
        : { status: 0, report: reportFor({ "V1-IA-ARCH-001": "passed" }) };
    },
  });
  const base = {
    scenario: scenario("V1-IA-ARCH-001"),
    selectedScenarioIds: ["V1-IA-ARCH-001", "V1-IA-ADMIN-001"],
    provider: { endpoints: { next: "http://127.0.0.1:1", api: "http://127.0.0.1:1/api/v1" }, credentials: { email: "a", password: "b" } },
    evidenceStore: { directory: join(tmpdir(), "acceptance-retry") },
  };
  const first = await execute({ ...base, attempt: 1 });
  const second = await execute({ ...base, attempt: 2 });
  assert.equal(first.classification, "flake");
  assert.equal(second.status, "passed");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].env.ARCHIVE_ACCEPTANCE_SCENARIO_IDS, "V1-IA-ARCH-001");
});

test("acceptance auth state is run-scoped and removed after Playwright completes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "acceptance-auth-cleanup-"));
  const sharedAuthPath = join(process.cwd(), "archive-next", "e2e", ".auth");
  const sharedAuthExistedBefore = existsSync(sharedAuthPath);
  let authDirectory;
  const execute = createSmokeScenarioExecutor({
    browserJourney: async (input) => {
      authDirectory = input.env.ARCHIVE_E2E_AUTH_DIR;
      mkdirSync(authDirectory, { recursive: true });
      writeFileSync(join(authDirectory, "editor.json"), "va_refresh=live-cookie");
      return { status: 0, report: reportFor({ "V1-IA-ARCH-001": "passed" }) };
    },
  });
  await execute({
    scenario: scenario("V1-IA-ARCH-001"),
    selectedScenarioIds: ["V1-IA-ARCH-001"],
    attempt: 1,
    provider: { endpoints: { next: "http://127.0.0.1:1", api: "http://127.0.0.1:1/api/v1" }, credentials: { email: "a", password: "b" } },
    evidenceStore: { directory },
  });
  assert.ok(authDirectory.startsWith(directory));
  assert.equal(existsSync(authDirectory), false);
  // The repo-local .auth path belongs to the ORDINARY Playwright suite
  // (auth.setup.ts writes admin/editor state there, and .gitignore covers it),
  // so it may legitimately exist before this test runs. Asserting it is absent
  // made the suite fail after any normal `pnpm verify:laravel-next:live`.
  // What actually matters is that the acceptance executor never touches it:
  // compare before/after instead of pinning absolute emptiness.
  assert.equal(
    existsSync(sharedAuthPath),
    sharedAuthExistedBefore,
    "acceptance executor must not create or delete the shared e2e .auth directory",
  );
});

test("failed operational or browser checks produce deterministic product evidence", async () => {
  const execute = createSmokeScenarioExecutor({ browserJourney: async () => ({ status: 1, stderr: "failed" }) });
  const result = await execute({ scenario: scenario("V1-IA-ARCH-001"), provider: { endpoints: { next: "http://127.0.0.1:1", api: "http://127.0.0.1:1/api/v1" }, credentials: { email: "a", password: "b" } }, evidenceStore: { directory: "C:/temp/evidence" } });
  assert.equal(result.scenarioId, "V1-IA-ARCH-001");
  assert.equal(result.status, "failed");
  assert.equal(result.classification, "product");
  assert.equal(result.reason, "browser-exit");
  assert.equal(result.detail, "failed");
  assert.ok(result.evidence.refs.some((ref) => ref.includes("playwright-results-arch-001-attempt-1.json")));
});

test("browser execution receives the runner signal and classifies concrete exit failures", async () => {
  const controller = new AbortController();
  const seen = [];
  const execute = createSmokeScenarioExecutor({
    browserJourney: async (input) => {
      seen.push(input.signal);
      return { status: 1, stderr: "fixture record not found" };
    },
  });
  const result = await execute({
    scenario: scenario("V1-IA-ARCH-001"),
    provider: { endpoints: { next: "http://127.0.0.1:1", api: "http://127.0.0.1:1/api/v1" }, credentials: { email: "a", password: "b" } },
    evidenceStore: { directory: "C:/temp/evidence" },
    signal: controller.signal,
  });
  assert.equal(seen[0], controller.signal);
  assert.equal(result.classification, "data");
  assert.equal(result.reason, "browser-exit");
});

test("default browser execution terminates its child when the runner aborts", async () => {
  const controller = new AbortController();
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const killed = [];
  child.kill = (signal) => {
    killed.push(signal);
    queueMicrotask(() => child.emit("close", null, signal));
    return true;
  };
  const execute = createSmokeScenarioExecutor({ spawnProcess: () => child });
  const execution = execute({
    scenario: scenario("V1-IA-ARCH-001"),
    provider: { endpoints: { next: "http://127.0.0.1:1", api: "http://127.0.0.1:1/api/v1" }, credentials: { email: "a", password: "b" } },
    evidenceStore: { directory: "C:/temp/evidence" },
    signal: controller.signal,
  });
  controller.abort();
  const result = await execution;
  assert.deepEqual(killed, ["SIGTERM"]);
  assert.equal(result.classification, "platform");
  assert.equal(result.reason, "browser-signal");
});
