import {
  createOperationSizeCheck,
  createSqliteReadinessCheck,
  createStorageEstimateCheck,
  formatPreflightSummary,
  type HealthCheck
} from "./preflight.js";
import { STARTUP_SEQUENCE_STEP_DEFINITIONS, type StartupStepDefinition } from "./startupSteps.js";
import { formatFileSize } from "../../utils/formatting.js";

export {
  createOperationSizeCheck,
  createSqliteReadinessCheck,
  createStorageEstimateCheck,
  formatPreflightSummary
} from "./preflight.js";
export { STARTUP_SEQUENCE_STEP_DEFINITIONS } from "./startupSteps.js";

export interface StartupStepState extends StartupStepDefinition {
  status: "pending" | "running" | "done";
}

export interface StartupSequenceReport {
  ok: boolean;
  limitedMode: boolean;
  steps: StartupStepState[];
  warnings: Array<{ id?: string; message: string; severity: string; at: string }>;
  fatalError: { message: string; userMessage: string } | null;
}

export async function runOperationPreflight(
  kind = "operation",
  payloadSummary: Record<string, unknown> = {}
): Promise<{
  ok: boolean;
  kind: string;
  checkedAt: string;
  checks: HealthCheck[];
  warnings: Array<{ id?: string; message: string; severity: string; at: string }>;
  summary: string;
}> {
  const checks: HealthCheck[] = [];

  checks.push({
    id: "indexeddb",
    label: "IndexedDB",
    status: typeof indexedDB === "undefined" ? "error" : "ok",
    message: typeof indexedDB === "undefined" ? "غير متاح، لا يمكن تنفيذ العملية بأمان" : "جاهز"
  });

  let storageEstimate: StorageEstimate = {};
  try {
    storageEstimate = (await navigator.storage?.estimate?.()) || {};
  } catch {
    storageEstimate = {};
  }

  checks.push(createStorageEstimateCheck(storageEstimate, { formatFileSize }));
  checks.push(createOperationSizeCheck(payloadSummary, { formatFileSize }));
  checks.push(createSqliteReadinessCheck({
    sqliteReady: false,
    sqliteError: "SQLite غير مفعّل في هذه النسخة، التخزين المحلي يعمل عبر IndexedDB لهذه العملية."
  }));

  const errors = checks.filter((check) => check.status === "error");
  const warnings = checks.filter((check) => check.status === "warning").map((check) => ({
    id: check.id,
    message: `${check.label}: ${check.message}`,
    severity: "warning",
    at: new Date().toISOString()
  }));

  return {
    ok: errors.length === 0,
    kind,
    checkedAt: new Date().toISOString(),
    checks,
    warnings,
    summary: formatPreflightSummary({ checks })
  };
}

export async function runStartupSequence({
  onStep,
  loadAllData,
  initAuth
}: {
  onStep?: (state: {
    running: boolean;
    steps: StartupStepState[];
    currentStepId?: string;
    progress: number;
    warnings: unknown[];
    fatalError: StartupSequenceReport["fatalError"];
  }) => void;
  loadAllData?: () => Promise<unknown> | unknown;
  initAuth?: () => Promise<unknown> | unknown;
} = {}): Promise<StartupSequenceReport> {
  const steps: StartupStepState[] = STARTUP_SEQUENCE_STEP_DEFINITIONS.map((step) => ({ ...step, status: "pending" }));
  const report = (index: number, status: StartupStepState["status"] = "running") => {
    steps.forEach((step, stepIndex) => {
      if (stepIndex < index) step.status = "done";
      if (stepIndex === index) step.status = status;
    });
    onStep?.({
      running: status !== "done" || index < steps.length - 1,
      steps,
      currentStepId: steps[index]?.id,
      progress: Math.round(((index + (status === "done" ? 1 : 0.35)) / Math.max(1, steps.length)) * 100),
      warnings: [],
      fatalError: null
    });
  };

  try {
    report(0);
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB غير متاح");
    report(0, "done");
    report(1);
    await loadAllData?.();
    report(1, "done");
    report(2);
    await initAuth?.();
    report(2, "done");
    return { ok: true, limitedMode: false, steps, warnings: [], fatalError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل بدء التشغيل";
    const fatalError = { message, userMessage: message };
    onStep?.({
      running: false,
      steps,
      currentStepId: steps.find((step) => step.status === "running")?.id,
      progress: 100,
      warnings: [],
      fatalError
    });
    return { ok: false, limitedMode: true, steps, warnings: [], fatalError };
  }
}

export function getSystemHealthActions(store: { runSystemHealthCheck?: unknown; updateSettings?: unknown } | null | undefined) {
  return {
    runSystemHealthCheck: store?.runSystemHealthCheck,
    updateSettings: store?.updateSettings
  };
}
