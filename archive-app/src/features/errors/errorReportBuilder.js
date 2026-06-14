/**
 * Structured error reports (§1281).
 *
 * Turns a raw error plus operation context into a normalized, serializable
 * report used by the error log, the layered details panel, and the "copy
 * report" action. Device/environment data is collected defensively so the
 * builder also works in non-browser (test/SSR) contexts.
 */

export const ERROR_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical"
};

const SEVERITY_SET = new Set(Object.values(ERROR_SEVERITY));

function newReportId() {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function collectDevice() {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const win = typeof window !== "undefined" ? window : null;
  return {
    userAgent: nav?.userAgent || "",
    platform: nav?.platform || "",
    language: nav?.language || "",
    online: typeof nav?.onLine === "boolean" ? nav.onLine : true,
    viewport: win ? { width: win.innerWidth || 0, height: win.innerHeight || 0 } : null
  };
}

function normalizeError(error) {
  if (!error) return { name: "Error", message: "خطأ غير معروف", stack: "" };
  if (typeof error === "string") return { name: "Error", message: error, stack: "" };
  return {
    name: error.name || "Error",
    message: error.message || String(error) || "خطأ غير معروف",
    stack: error.stack || ""
  };
}

/**
 * Builds a normalized error report.
 * context: { page, operation, targetId, targetType, severity, suggestion, recoverable }
 */
export function buildErrorReport(error, context = {}) {
  const normalized = normalizeError(error);
  const severity = SEVERITY_SET.has(context.severity) ? context.severity : ERROR_SEVERITY.ERROR;
  return {
    id: context.id || newReportId(),
    timestamp: context.timestamp || new Date().toISOString(),
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack,
    page: context.page || "",
    operation: context.operation || "",
    targetId: context.targetId || null,
    targetType: context.targetType || null,
    severity,
    suggestion: context.suggestion || "",
    recoverable: context.recoverable === true,
    device: collectDevice()
  };
}

/**
 * Plain-text rendering of a report for the clipboard / bug ticket.
 */
export function formatErrorReport(report) {
  if (!report) return "";
  const lines = [
    `# تقرير خطأ ${report.id}`,
    `الوقت: ${report.timestamp}`,
    `الخطورة: ${report.severity}`,
    report.page ? `الصفحة: ${report.page}` : null,
    report.operation ? `العملية: ${report.operation}` : null,
    `الرسالة: ${report.name}: ${report.message}`,
    report.suggestion ? `الحل المقترح: ${report.suggestion}` : null,
    report.device?.userAgent ? `الجهاز: ${report.device.userAgent}` : null,
    report.device ? `الاتصال: ${report.device.online ? "متصل" : "غير متصل"}` : null,
    report.stack ? `\nالتتبّع:\n${report.stack}` : null
  ];
  return lines.filter(Boolean).join("\n");
}
