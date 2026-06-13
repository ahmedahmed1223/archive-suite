import {
  createOperationSizeCheck,
  createSqliteReadinessCheck,
  createStorageEstimateCheck,
  formatPreflightSummary
} from "./preflight.js";
import { STARTUP_SEQUENCE_STEP_DEFINITIONS } from "./startupSteps.js";
import { formatFileSize } from "../../utils/formatting.js";

export {
  createOperationSizeCheck,
  createSqliteReadinessCheck,
  createStorageEstimateCheck,
  formatPreflightSummary
} from "./preflight.js";
export { STARTUP_SEQUENCE_STEP_DEFINITIONS } from "./startupSteps.js";

export async function runOperationPreflight(kind = "operation", payloadSummary = {}) {
  const checks = [];

  checks.push({
    id: "indexeddb",
    label: "IndexedDB",
    status: typeof indexedDB === "undefined" ? "error" : "ok",
    message: typeof indexedDB === "undefined" ? "غير متاح، لا يمكن تنفيذ العملية بأمان" : "جاهز"
  });

  let storageEstimate = {};
  try {
    storageEstimate = await navigator.storage?.estimate?.() || {};
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

export async function runStartupSequence({ onStep, loadAllData, initAuth } = {}) {
  const steps = STARTUP_SEQUENCE_STEP_DEFINITIONS.map((step) => ({ ...step, status: "pending" }));
  const report = (index, status = "running") => {
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
    const fatalError = { message: error?.message || "فشل بدء التشغيل", userMessage: error?.message || "فشل بدء التشغيل" };
    onStep?.({ running: false, steps, currentStepId: steps.find((step) => step.status === "running")?.id, progress: 100, warnings: [], fatalError });
    return { ok: false, limitedMode: true, steps, warnings: [], fatalError };
  }
}

export function getSystemHealthActions(store) {
  return {
    runSystemHealthCheck: store?.runSystemHealthCheck,
    updateSettings: store?.updateSettings
  };
}
