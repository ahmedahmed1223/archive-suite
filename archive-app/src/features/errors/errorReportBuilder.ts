export const ERROR_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical"
} as const;

export interface ErrorReportContext {
  id?: string;
  timestamp?: string;
  page?: string;
  operation?: string;
  targetId?: string | null;
  targetType?: string | null;
  severity?: string;
  suggestion?: string;
  recoverable?: boolean;
}

export interface ErrorReport {
  id: string;
  timestamp: string;
  name: string;
  message: string;
  stack: string;
  page: string;
  operation: string;
  targetId: string | null;
  targetType: string | null;
  severity: string;
  suggestion: string;
  recoverable: boolean;
  device: ReturnType<typeof collectDevice>;
}

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

function normalizeError(error: unknown) {
  if (!error) return { name: "Error", message: "خطأ غير معروف", stack: "" };
  if (typeof error === "string") return { name: "Error", message: error, stack: "" };
  const candidate = error as { name?: string; message?: string; stack?: string };
  return {
    name: candidate.name || "Error",
    message: candidate.message || String(error) || "خطأ غير معروف",
    stack: candidate.stack || ""
  };
}

export function buildErrorReport(error: unknown, context: ErrorReportContext = {}): ErrorReport {
  const normalized = normalizeError(error);
  const severity = SEVERITY_SET.has(context.severity as (typeof ERROR_SEVERITY)[keyof typeof ERROR_SEVERITY])
    ? (context.severity as string)
    : ERROR_SEVERITY.ERROR;
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

export function formatErrorReport(report: ErrorReport | null | undefined) {
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
