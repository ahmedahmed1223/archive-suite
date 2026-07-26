import { sanitize } from "../observability.mjs";
import {
  boundedDiagnosticDetail,
  FAILURE_CLASSIFICATIONS,
  FAILURE_REASONS,
  validateResult,
} from "./contracts.mjs";
import { ACCEPTANCE_SCENARIOS, selectScenarios } from "./registry.mjs";
import { snapshotForScenario } from "./platform.mjs";

export const AUTH_BUDGET = Object.freeze({ loginsPerMinute: 30, refreshesPerMinute: 120 });
export const RUN_DEADLINE_MS = 15 * 60_000;
export const CLEANUP_DEADLINE_MS = 60_000;

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

export async function resolveAcceptanceSelection({
  tag,
  ids,
  lastFailed = false,
  scenarios = ACCEPTANCE_SCENARIOS,
  readLastFailed,
} = {}) {
  try {
    const previousFailedIds = await resolveLastFailed(lastFailed, readLastFailed);
    const requestedIds = previousFailedIds ?? (ids?.length ? ids : undefined);
    const selected = scenarios === ACCEPTANCE_SCENARIOS && !previousFailedIds
      ? selectScenarios({ tag, ids: requestedIds })
      : selectFromScenarios(scenarios, { tag, ids: requestedIds });
    if (!selected.length) throw new Error("no acceptance scenarios selected");
    return selected;
  } catch (error) {
    throw new AcceptanceInputError(error instanceof Error ? error.message : String(error), { cause: error });
  }
}

function missingCapabilities(scenario, provider) {
  const available = new Set(provider?.capabilities ?? []);
  return scenario.capabilities.filter((capability) => !available.has(capability));
}

function classifyError(error, fallback = "environment") {
  if (FAILURE_CLASSIFICATIONS.includes(error?.classification)) return error.classification;
  if (["ENOENT", "EACCES", "EPERM"].includes(error?.code)) return "platform";
  const detail = String(error?.message ?? error ?? "");
  if (/fixture|seed|test data|record not found/i.test(detail)) return "data";
  if (/ECONNRESET|EPIPE|socket hang up|flak/i.test(detail)) return "flake";
  if (/docker|compose|provider|spawn|executable|command not found/i.test(detail)) return "platform";
  return fallback;
}

function reasonForError(error, fallback = "executor-error") {
  return FAILURE_REASONS.includes(error?.reason) ? error.reason : fallback;
}

function resultForExecutionError(scenario, attempt, classification = "environment", error, reason = "executor-error") {
  const detail = boundedDiagnosticDetail(error?.message ?? error ?? "");
  return {
    scenarioId: scenario.id,
    status: "failed",
    classification: classifyError(error, classification),
    reason: reasonForError(error, reason),
    ...(detail ? { detail } : {}),
    attempts: attempt,
    attemptResults: [],
  };
}

function attemptSnapshot(result, attempt) {
  return sanitize({
    attempt,
    status: result.status,
    ...(result.classification ? { classification: result.classification } : {}),
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.detail ? { detail: result.detail } : {}),
    ...(result.evidence ? { evidence: result.evidence } : {}),
  });
}

function normalizeResult(input, scenario, attempt) {
  const result = {
    ...sanitize(input),
    scenarioId: input?.scenarioId,
    attempts: attempt,
  };
  if (result.status === "failed") {
    result.classification = FAILURE_CLASSIFICATIONS.includes(result.classification) ? result.classification : "environment";
    result.reason = FAILURE_REASONS.includes(result.reason) ? result.reason : "scenario-failed";
    if (result.detail !== undefined) result.detail = boundedDiagnosticDetail(result.detail);
  }
  validateResult(result);
  if (result.scenarioId !== scenario.id) throw new Error("scenario executor returned a result for a different scenario");
  return result;
}

function timeoutError(reason, milliseconds) {
  const error = new Error(`${reason === "run-timeout" ? "acceptance run" : "acceptance scenario"} exceeded ${milliseconds}ms`);
  error.name = "AcceptanceTimeoutError";
  error.classification = "environment";
  error.reason = reason;
  return error;
}

function abortPromise(signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

async function executeWithOneFlakeRetry({
  scenario,
  provider,
  evidenceStore,
  executeScenario,
  runSignal,
  setTimer,
  clearTimer,
  selectedScenarioIds,
}) {
  let result;
  const attemptResults = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (runSignal.aborted) {
      result = resultForExecutionError(scenario, attempt - 1, "environment", runSignal.reason, "run-timeout");
      result.attemptResults = [...attemptResults];
      return result;
    }
    const scenarioController = new AbortController();
    const signal = AbortSignal.any([runSignal, scenarioController.signal]);
    const timeout = setTimer(
      () => scenarioController.abort(timeoutError("scenario-timeout", scenario.timeoutMs)),
      scenario.timeoutMs,
    );
    try {
      const aborted = abortPromise(signal);
      const execution = Promise.resolve().then(
        () => executeScenario({ scenario, provider, evidenceStore, attempt, signal, selectedScenarioIds }),
      );
      result = normalizeResult(await Promise.race([execution, aborted]), scenario, attempt);
    } catch (error) {
      result = resultForExecutionError(scenario, attempt, "environment", error);
    } finally {
      clearTimer(timeout);
    }
    attemptResults.push(attemptSnapshot(result, attempt));
    result = { ...result, attemptResults: [...attemptResults] };
    if (!(result.status === "failed" && result.classification === "flake" && attempt === 1)) return result;
  }
  return result;
}

function summarize(results, cleanup, orchestrationFailure) {
  const outcomesPassed = results.every((result) => result.status === "passed");
  const cleanupFailed = !cleanup.keptForDiagnostics && !cleanup.proved;
  const status = outcomesPassed && !cleanupFailed && !orchestrationFailure
    ? "passed"
    : !cleanupFailed && results.every((result) => result.status === "blocked-capability")
      ? "blocked-capability"
      : "failed";
  const exitCode = status === "passed" ? 0 : status === "blocked-capability" ? 2 : 1;
  return {
    status,
    exitCode,
    results,
    cleanup,
    ...(orchestrationFailure ? {
      orchestrationFailure: {
        classification: classifyError(orchestrationFailure, "platform"),
        reason: reasonForError(orchestrationFailure, "provider-failure"),
        detail: boundedDiagnosticDetail(orchestrationFailure?.message ?? orchestrationFailure),
      },
    } : {}),
  };
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

function dateFrom(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("acceptance clock returned an invalid date");
  return date;
}

function providerSummary(provider) {
  if (typeof provider.describe === "function") return sanitize(provider.describe());
  let endpoints;
  try { endpoints = provider.endpoints; } catch { endpoints = undefined; }
  return sanitize({
    name: provider.name ?? provider.capabilities?.[0] ?? "unknown",
    capabilities: [...(provider.capabilities ?? [])],
    ...(provider.projectName ? { project: provider.projectName } : {}),
    ...(provider.resources ? { resources: provider.resources } : {}),
    ...(endpoints ? { endpoints } : {}),
    ...(provider.imageDigests ? { imageDigests: provider.imageDigests } : {}),
  });
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
  runMetadata = {},
  now = () => new Date(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  runDeadlineMs = RUN_DEADLINE_MS,
  cleanupDeadlineMs = CLEANUP_DEADLINE_MS,
} = {}) {
  if (!provider) throw new Error("acceptance provider is required");
  if (typeof executeScenario !== "function") throw new Error("executeScenario must be a function");

  const selected = await resolveAcceptanceSelection({ tag, ids, lastFailed, scenarios, readLastFailed });
  const started = dateFrom(now());
  const budget = assertAuthBudget(selected);
  const results = [];
  let orchestrationFailure;
  const selectedScenarioIds = selected.map(({ id }) => id);
  let cleanup = { keptForDiagnostics: Boolean(keepEnvironment), proved: false };
  const runController = new AbortController();
  const deadline = setTimer(
    () => runController.abort(timeoutError("run-timeout", runDeadlineMs)),
    runDeadlineMs,
  );

  try {
    const runnable = selected.filter((scenario) => missingCapabilities(scenario, provider).length === 0);
    if (runnable.length) {
      await Promise.race([
        (async () => {
          await provider.prepare?.({ signal: runController.signal });
          await provider.install?.({ signal: runController.signal });
          await provider.start?.({ signal: runController.signal });
        })(),
        abortPromise(runController.signal),
      ]);
    }
    for (const scenario of selected) {
      if (missingCapabilities(scenario, provider).length) {
        results.push({ scenarioId: scenario.id, status: "blocked-capability", blockedCapabilities: missingCapabilities(scenario, provider), attempts: 0 });
        continue;
      }
      const snapshot = await snapshotForScenario(provider, scenario, { signal: runController.signal });
      const executed = await executeWithOneFlakeRetry({
        scenario,
        provider,
        evidenceStore,
        executeScenario,
        runSignal: runController.signal,
        setTimer,
        clearTimer,
        selectedScenarioIds,
      });
      results.push(snapshot ? { ...executed, snapshot } : executed);
    }
    await provider.collect?.({ signal: runController.signal });
  } catch (error) {
    orchestrationFailure = error;
    for (const scenario of selected) {
      if (results.some((result) => result.scenarioId === scenario.id)) continue;
      if (missingCapabilities(scenario, provider).length) {
        results.push({ scenarioId: scenario.id, status: "blocked-capability", blockedCapabilities: missingCapabilities(scenario, provider), attempts: 0, attemptResults: [] });
      } else {
        results.push(resultForExecutionError(
          scenario,
          0,
          "platform",
          error,
          runController.signal.aborted ? "run-timeout" : "provider-failure",
        ));
      }
    }
  } finally {
    try {
      await executeScenario.cleanup?.();
    } catch (error) {
      orchestrationFailure ??= error;
      cleanup = { keptForDiagnostics: false, proved: false };
    }
    if (!keepEnvironment) {
      const cleanupController = new AbortController();
      const cleanupTimeout = setTimer(
        () => cleanupController.abort(timeoutError("scenario-timeout", cleanupDeadlineMs)),
        cleanupDeadlineMs,
      );
      try {
        const destroyed = await Promise.race([
          Promise.resolve().then(() => provider.destroy?.({ signal: cleanupController.signal })),
          abortPromise(cleanupController.signal),
        ]);
        cleanup = { keptForDiagnostics: false, proved: destroyed?.proved === true };
      } catch (error) {
        cleanup = {
          keptForDiagnostics: false,
          proved: false,
          ...(cleanupController.signal.aborted ? { timedOut: true } : {}),
        };
      } finally {
        clearTimer(cleanupTimeout);
      }
    }
  }

  clearTimer(deadline);
  const finished = dateFrom(now());
  const summary = summarize(results, cleanup, orchestrationFailure);
  const finalResult = {
    ...summary,
    ...sanitize(runMetadata),
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: Math.max(0, finished.getTime() - started.getTime()),
    budget,
    selected: selectedScenarioIds,
    provider: providerSummary(provider),
  };
  await persistEvidence(evidenceStore, finalResult);
  return finalResult;
}
