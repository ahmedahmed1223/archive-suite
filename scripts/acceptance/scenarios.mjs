import { spawn } from "node:child_process";
import { join } from "node:path";

export const SMOKE_SCENARIO_IDS = Object.freeze([
  "V1-IA-PLAT-001",
  "V1-IA-ARCH-001",
  "V1-IA-ADMIN-001",
  "V1-IA-ADMIN-002",
  "V1-IA-MULTI-001",
]);

const BROWSER_SCENARIOS = new Set([
  "V1-IA-ARCH-001",
  "V1-IA-ADMIN-001",
  "V1-IA-MULTI-001",
]);

/**
 * V1-804 scenario metadata deliberately stays executable-data only: the
 * registry owns selection and budget, while this module owns checks, evidence
 * declarations and cleanup expectations for the smoke slice.
 */
export const SMOKE_SCENARIOS = Object.freeze([
  Object.freeze({ id: "V1-IA-PLAT-001", timeoutMs: 90_000, evidence: ["health.json", "compose-status.json"], cleanup: "provider-destroy" }),
  Object.freeze({ id: "V1-IA-ARCH-001", timeoutMs: 240_000, evidence: ["playwright.json", "trace.zip", "screenshot.png"], cleanup: "close-fresh-contexts" }),
  Object.freeze({ id: "V1-IA-ADMIN-001", timeoutMs: 240_000, evidence: ["playwright.json", "trace.zip", "screenshot.png"], cleanup: "close-fresh-contexts" }),
  Object.freeze({ id: "V1-IA-ADMIN-002", timeoutMs: 180_000, evidence: ["backup.json", "backup-verify.json"], cleanup: "provider-destroy" }),
  Object.freeze({ id: "V1-IA-MULTI-001", timeoutMs: 240_000, evidence: ["playwright.json", "trace.zip", "screenshot.png"], cleanup: "close-fresh-contexts" }),
]);

function defaultBrowserJourney({ command, args, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function result(scenarioId, status, classification, evidence) {
  return { scenarioId, status, classification, evidence };
}

async function saveEvidence(store, name, value) {
  if (!store?.writeArtifact) return [];
  await store.writeArtifact(name, value);
  return [name];
}

function commandSucceeded(commandResult) {
  return commandResult?.status === 0;
}

function parseCommandJson(commandResult) {
  const line = String(commandResult?.stdout ?? "").trim().split("\n").filter(Boolean).pop();
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function isSafeBackupName(name) {
  return typeof name === "string" && name.length > 0 && !/[\\/]/.test(name) && name === name.split(/[\\/]/).pop();
}

async function platformBoot({ scenario, provider, evidenceStore, attempt = 1 }) {
  const health = await provider.exec("laravel", ["curl", "--fail", "--silent", "--show-error", "http://localhost:8000/api/v1/health"]);
  const worker = await provider.exec("laravel-worker", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[q]ueue:work'"]);
  const reverb = await provider.exec("laravel-reverb", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[r]everb:start'"]);
  const refs = await saveEvidence(evidenceStore, `${scenario.id}-attempt-${attempt}-readiness.json`, { health, worker, reverb });
  const evidence = { kind: "readiness", scenarioId: scenario.id, checks: ["api-health", "worker", "reverb"], refs };
  return commandSucceeded(health) && commandSucceeded(worker) && commandSucceeded(reverb)
    ? result(scenario.id, "passed", "product", evidence)
    : result(scenario.id, "failed", "product", evidence);
}

async function backupAndVerify({ scenario, provider, evidenceStore, attempt = 1 }) {
  const backup = await provider.exec("laravel-fpm", ["php", "artisan", "archive:backup-run", "--json"]);
  const created = parseCommandJson(backup);
  const name = created?.ok === true ? created?.details?.backup?.name : null;
  const refs = await saveEvidence(evidenceStore, `${scenario.id}-attempt-${attempt}-backup.json`, { backup: created });
  const evidence = { kind: "backup", scenarioId: scenario.id, checks: ["backup-created", "backup-verified"], refs };
  if (!commandSucceeded(backup) || !isSafeBackupName(name)) return result(scenario.id, "failed", "product", evidence);

  const verified = await provider.exec("laravel-fpm", ["php", "artisan", "archive:backup-verify", name, "--json"]);
  const verification = parseCommandJson(verified);
  refs.push(...await saveEvidence(evidenceStore, `${scenario.id}-attempt-${attempt}-backup-verify.json`, { verification }));
  return commandSucceeded(verified) && verification?.ok === true
    ? result(scenario.id, "passed", "product", evidence)
    : result(scenario.id, "failed", "product", evidence);
}

function browserCommand(provider, evidenceStore) {
  return {
    command: "pnpm",
    args: ["--filter", "@archive/next", "exec", "playwright", "test", "e2e/acceptance-smoke.authed.spec.ts", "--project", "authenticated"],
    env: {
      E2E_BASE_URL: provider.endpoints.next,
      ARCHIVE_API_BASE_URL: provider.endpoints.api,
      ARCHIVE_E2E_EMAIL: provider.credentials.email,
      ARCHIVE_E2E_PASSWORD: provider.credentials.password,
      PLAYWRIGHT_OUTPUT_DIR: join(evidenceStore.directory, "playwright"),
      ARCHIVE_ACCEPTANCE_RESULT_PATH: join(evidenceStore.directory, "playwright-results.json"),
    },
  };
}

async function browserSmoke({ scenario, provider, evidenceStore, browserJourney, browserRun }) {
  const run = await browserRun.run(() => browserJourney(browserCommand(provider, evidenceStore)));
  const refs = await saveEvidence(evidenceStore, `${scenario.id}-playwright.json`, { status: run.status, stdout: run.stdout, stderr: run.stderr, output: "playwright/", result: "playwright-results.json" });
  const evidence = { kind: "playwright", scenarioId: scenario.id, refs: [...refs, "playwright/", "playwright-results.json"] };
  return commandSucceeded(run)
    ? result(scenario.id, "passed", "product", evidence)
    : result(scenario.id, "failed", "product", evidence);
}

/** Creates the `runner.mjs` executeScenario callback without owning runner wiring. */
export function createSmokeScenarioExecutor({ browserJourney = defaultBrowserJourney } = {}) {
  if (typeof browserJourney !== "function") throw new Error("browserJourney must be a function");
  let cachedBrowserRun;
  const browserRun = { run: (start) => cachedBrowserRun ??= start() };
  return async function executeSmokeScenario(context) {
    const scenarioId = context?.scenario?.id;
    if (!SMOKE_SCENARIO_IDS.includes(scenarioId)) throw new Error(`unknown V1-804 scenario: ${scenarioId}`);
    if (scenarioId === "V1-IA-PLAT-001") return platformBoot(context);
    if (scenarioId === "V1-IA-ADMIN-002") return backupAndVerify(context);
    if (BROWSER_SCENARIOS.has(scenarioId)) return browserSmoke({ ...context, browserJourney, browserRun });
    throw new Error(`no V1-804 handler for ${scenarioId}`);
  };
}
