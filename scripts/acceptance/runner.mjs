import { validateResult } from "./contracts.mjs";
import { ACCEPTANCE_SCENARIOS, selectScenarios } from "./registry.mjs";

export const AUTH_BUDGET = Object.freeze({ loginsPerMinute: 30, refreshesPerMinute: 120 });

export class AcceptanceInputError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "AcceptanceInputError";
  }
}

export function calculateAuthBudget(scenarios) {
  const logins = scenarios.reduce((total, scenario) => total + (scenario.loginSessions ?? 0), 0);
  const refreshes = scenarios.reduce((total, scenario) => total + (scenario.refreshSessions ?? scenario.loginSessions ?? 0), 0);
  return Object.freeze({ logins, refreshes });
}

function assertAuthBudget(scenarios) {
  const budget = calculateAuthBudget(scenarios);
  if (budget.logins > AUTH_BUDGET.loginsPerMinute) {
    throw new Error(`acceptance run requires ${budget.logins} logins; the server contract allows ${AUTH_BUDGET.loginsPerMinute} logins per minute`);
  }
  if (budget.refreshes > AUTH_BUDGET.refreshesPerMinute) {
    throw new Error(`acceptance run requires ${budget.refreshes} refreshes; the server contract allows ${AUTH_BUDGET.refreshesPerMinute} refreshes per minute`);
  }
  return budget;
}

function selectFromScenarios(scenarios, { tag, ids }) {
  const requested = ids?.length ? new Set(ids) : null;
  if (requested) {
    const known = new Set(scenarios.map(({ id }) => id));
    const unknown = [...requested].filter((id) => !known.has(id));
    if (unknown.length) throw new Error(`unknown scenario: ${unknown.join(", ")}`);
  }
  const selected = scenarios.filter((scenario) => (!tag || scenario.tags.includes(tag)) && (!requested || requested.has(scenario.id)));
  if (!selected.length) throw new Error("no acceptance scenarios selected");
  return selected;
}

function failedIds(lastFailed) {
  if (Array.isArray(lastFailed)) {
    return lastFailed.map((item) => typeof item === "string" ? item : item?.scenarioId).filter(Boolean);
  }
  if (lastFailed?.results && Array.isArray(lastFailed.results)) {
    return lastFailed.results.filter((result) => result.status === "failed").map((result) => result.scenarioId);
  }
  return null;
}

async function resolveLastFailed(lastFailed, readLastFailed) {
  if (lastFailed !== true) return failedIds(lastFailed);
  if (typeof readLastFailed !== "function") throw new Error("--last-failed requires a previous acceptance manifest");
  return failedIds(await readLastFailed());
}

function missingCapabilities(scenario, provider) {
  const available = new Set(provider?.capabilities ?? []);
  return scenario.capabilities.filter((capability) => !available.has(capability));
}

function resultForExecutionError(scenario, attempt, classification = "environment") {
  return {
    scenarioId: scenario.id,
    status: "failed",
    classification,
    attempts: attempt,
    attemptResults: attempt ? [{ attempt, status: "failed", classification }] : [],
  };
}

async function executeWithOneFlakeRetry({ scenario, provider, evidenceStore, executeScenario }) {
  let result;
  const attemptResults = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      result = await executeScenario({ scenario, provider, evidenceStore, attempt });
      validateResult(result);
      if (result.scenarioId !== scenario.id) throw new Error("scenario executor returned a result for a different scenario");
      result = { ...result, attempts: attempt };
    } catch {
      result = resultForExecutionError(scenario, attempt);
    }
    attemptResults.push({ attempt, status: result.status, ...(result.classification ? { classification: result.classification } : {}) });
    result = { ...result, attemptResults: [...attemptResults] };
    if (!(result.status === "failed" && result.classification === "flake" && attempt === 1)) return result;
  }
  return result;
}

function summarize(results, cleanup) {
  const outcomesPassed = results.every((result) => result.status === "passed");
  const cleanupFailed = !cleanup.keptForDiagnostics && !cleanup.proved;
  const status = outcomesPassed && !cleanupFailed
    ? "passed"
    : !cleanupFailed && results.every((result) => result.status === "blocked-capability")
      ? "blocked-capability"
      : "failed";
  const exitCode = status === "passed" ? 0 : status === "blocked-capability" ? 2 : 1;
  return { status, exitCode, results, cleanup };
}

async function persistEvidence(evidenceStore, summary) {
  if (!evidenceStore) return;
  let originalError;
  let manifest = summary;
  try {
    await evidenceStore.writeArtifact?.("cleanup.json", summary.cleanup);
  } catch (error) {
    originalError = error;
    manifest = { ...summary, status: "failed", exitCode: 1, evidence: { status: "failed" } };
  }
  try {
    await evidenceStore.finalize?.(manifest);
  } catch (error) {
    originalError ??= error;
    try {
      await evidenceStore.writeArtifact?.("runner-error.json", { phase: "manifest-finalization", status: "failed" });
    } catch {
      // The original persistence failure is more useful than a failed fallback.
    }
  }
  if (originalError) throw originalError;
}

/**
 * Runs a selected acceptance slice in one deliberate sequence. A flake gets
 * exactly one retry; all other outcomes are evidence, not retries.
 */
export async function runAcceptance({
  tag,
  ids,
  lastFailed = false,
  keepEnvironment = false,
  scenarios = ACCEPTANCE_SCENARIOS,
  provider,
  evidenceStore,
  executeScenario = async ({ scenario }) => resultForExecutionError(scenario, 1),
  readLastFailed,
} = {}) {
  if (!provider) throw new Error("acceptance provider is required");
  if (typeof executeScenario !== "function") throw new Error("executeScenario must be a function");

  let selected;
  try {
    const previousFailedIds = await resolveLastFailed(lastFailed, readLastFailed);
    const requestedIds = previousFailedIds ?? (ids?.length ? ids : undefined);
    selected = scenarios === ACCEPTANCE_SCENARIOS && !previousFailedIds
      ? selectScenarios({ tag, ids: requestedIds })
      : selectFromScenarios(scenarios, { tag, ids: requestedIds });
    if (!selected.length) throw new Error("no acceptance scenarios selected");
  } catch (error) {
    throw new AcceptanceInputError(error instanceof Error ? error.message : String(error), { cause: error });
  }
  const budget = assertAuthBudget(selected);
  const results = [];
  let cleanup = { keptForDiagnostics: Boolean(keepEnvironment), proved: false };

  try {
    const runnable = selected.filter((scenario) => missingCapabilities(scenario, provider).length === 0);
    if (runnable.length) {
      await provider.prepare?.();
      await provider.install?.();
      await provider.start?.();
    }
    for (const scenario of selected) {
      if (missingCapabilities(scenario, provider).length) {
        results.push({ scenarioId: scenario.id, status: "blocked-capability", attempts: 0 });
        continue;
      }
      results.push(await executeWithOneFlakeRetry({ scenario, provider, evidenceStore, executeScenario }));
    }
  } catch (error) {
    for (const scenario of selected) {
      if (results.some((result) => result.scenarioId === scenario.id)) continue;
      if (missingCapabilities(scenario, provider).length) {
        results.push({ scenarioId: scenario.id, status: "blocked-capability", attempts: 0, attemptResults: [] });
      } else {
        results.push(resultForExecutionError(scenario, 0, "platform"));
      }
    }
  } finally {
    if (!keepEnvironment) {
      try {
        const destroyed = await provider.destroy?.();
        cleanup = { keptForDiagnostics: false, proved: destroyed?.proved === true };
      } catch {
        cleanup = { keptForDiagnostics: false, proved: false };
      }
    }
  }

  const summary = summarize(results, cleanup);
  await persistEvidence(evidenceStore, summary);
  return { ...summary, budget, selected: selected.map(({ id }) => id) };
}
