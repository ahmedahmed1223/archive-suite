import { spawn } from "node:child_process";

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

async function platformBoot({ scenario, provider }) {
  const health = await provider.exec("laravel", ["curl", "--fail", "--silent", "--show-error", "http://localhost:8000/api/v1/health"]);
  const worker = await provider.exec("laravel-worker", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[q]ueue:work'"]);
  const reverb = await provider.exec("laravel-reverb", ["sh", "-lc", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[r]everb:start'"]);
  const evidence = { kind: "readiness", scenarioId: scenario.id, checks: ["api-health", "worker", "reverb"] };
  return commandSucceeded(health) && commandSucceeded(worker) && commandSucceeded(reverb)
    ? result(scenario.id, "passed", "product", evidence)
    : result(scenario.id, "failed", "product", evidence);
}

async function backupAndVerify({ scenario, provider }) {
  const backup = await provider.exec("laravel-fpm", ["php", "artisan", "archive:backup-run", "--json"]);
  const created = parseCommandJson(backup);
  const name = created?.ok === true ? created?.details?.backup?.name : null;
  const evidence = { kind: "backup", scenarioId: scenario.id, checks: ["backup-created", "backup-verified"] };
  if (!commandSucceeded(backup) || !isSafeBackupName(name)) return result(scenario.id, "failed", "product", evidence);

  const verified = await provider.exec("laravel-fpm", ["php", "artisan", "archive:backup-verify", name, "--json"]);
  const verification = parseCommandJson(verified);
  return commandSucceeded(verified) && verification?.ok === true
    ? result(scenario.id, "passed", "product", evidence)
    : result(scenario.id, "failed", "product", evidence);
}

function browserCommand(scenarioId) {
  return {
    command: "pnpm",
    args: ["verify:laravel-next:live"],
    env: {
      // The owning spec imports acknowledgement keys/releases from the app's
      // real constants and calls roleSession once per browser context.
      ARCHIVE_E2E_SPECS: "e2e/acceptance-smoke.spec.ts",
      ARCHIVE_ACCEPTANCE_SCENARIO_ID: scenarioId,
    },
  };
}

async function browserSmoke({ scenario, browserJourney }) {
  const run = await browserJourney(browserCommand(scenario.id));
  const evidence = { kind: "playwright", scenarioId: scenario.id };
  return commandSucceeded(run)
    ? result(scenario.id, "passed", "product", evidence)
    : result(scenario.id, "failed", "product", evidence);
}

/** Creates the `runner.mjs` executeScenario callback without owning runner wiring. */
export function createSmokeScenarioExecutor({ browserJourney = defaultBrowserJourney } = {}) {
  if (typeof browserJourney !== "function") throw new Error("browserJourney must be a function");
  return async function executeSmokeScenario(context) {
    const scenarioId = context?.scenario?.id;
    if (!SMOKE_SCENARIO_IDS.includes(scenarioId)) throw new Error(`unknown V1-804 scenario: ${scenarioId}`);
    if (scenarioId === "V1-IA-PLAT-001") return platformBoot(context);
    if (scenarioId === "V1-IA-ADMIN-002") return backupAndVerify(context);
    if (BROWSER_SCENARIOS.has(scenarioId)) return browserSmoke({ ...context, browserJourney });
    throw new Error(`no V1-804 handler for ${scenarioId}`);
  };
}
