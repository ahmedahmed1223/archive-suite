import * as React from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardCopy, Lightbulb } from "lucide-react";

import { formatErrorReport } from "../../features/errors/errorReportBuilder.js";
import type { ErrorReport } from "../../features/errors/errorReportBuilder.js";

export interface ErrorDetailsPanelProps {
  report?: ErrorReport | null;
  onCopy?: (copied: boolean) => void;
}

const SEVERITY_STYLES = {
  info: { label: "معلومة", color: "#38bdf8", border: "border-sky-500/30", bg: "bg-sky-500/10", text: "text-sky-200" },
  warning: { label: "تحذير", color: "#f59e0b", border: "border-amber-500/30", bg: "bg-amber-500/10", text: "text-amber-200" },
  error: { label: "خطأ", color: "#ef4444", border: "border-red-500/30", bg: "bg-red-500/10", text: "text-red-200" },
  critical: { label: "حرج", color: "#f43f5e", border: "border-rose-500/40", bg: "bg-rose-500/15", text: "text-rose-200" }
} as const;

/**
 * Layered error details (§1281): a plain message, a suggested fix, and a
 * collapsible technical section - so a user reads the simple line while a
 * power user can expand the stack/device data and copy a full report.
 */
export function ErrorDetailsPanel({ report, onCopy }: ErrorDetailsPanelProps) {
  const [showTechnical, setShowTechnical] = React.useState(false);
  if (!report) return null;
  const style = SEVERITY_STYLES[report.severity as keyof typeof SEVERITY_STYLES] || SEVERITY_STYLES.error;

  const copyReport = async () => {
    const text = formatErrorReport(report);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      onCopy?.(true);
    } catch {
      onCopy?.(false);
    }
  };

  return (
    <div className={`space-y-3 rounded-xl border ${style.border} ${style.bg} p-4 text-right`} dir="rtl">
      <div className="flex items-start gap-2">
        <AlertTriangle className={`h-5 w-5 shrink-0 ${style.text}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge badge-sm border ${style.border} px-2 py-0.5 text-[11px] font-semibold ${style.text}`}>
              {style.label}
            </span>
            {report.operation ? <span className="text-xs text-gray-400">{report.operation}</span> : null}
            {report.page ? <span className="text-xs text-gray-600">{`· ${report.page}`}</span> : null}
          </div>
          <p className="mt-1 break-words text-sm font-semibold text-white">{report.message}</p>
        </div>
      </div>
      {report.suggestion ? (
        <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <Lightbulb className="h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm text-gray-200">{report.suggestion}</p>
        </div>
      ) : null}
      <div>
        <button
          type="button"
          onClick={() => setShowTechnical((value) => !value)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white"
          aria-expanded={showTechnical}
        >
          {showTechnical ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showTechnical ? "إخفاء التفاصيل التقنية" : "عرض التفاصيل التقنية"}
        </button>
        {showTechnical ? (
          <div className="mt-2 space-y-2">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs text-gray-400">
              <dt className="text-gray-500">الوقت</dt>
              <dd className="text-gray-300">{report.timestamp}</dd>
              <dt className="text-gray-500">النوع</dt>
              <dd className="text-gray-300">{report.name}</dd>
              {report.device?.userAgent ? <dt className="text-gray-500">الجهاز</dt> : null}
              {report.device?.userAgent ? (
                <dd className="truncate text-gray-300" title={report.device.userAgent}>
                  {report.device.userAgent}
                </dd>
              ) : null}
              <dt className="text-gray-500">الاتصال</dt>
              <dd className="text-gray-300">{report.device?.online ? "متصل" : "غير متصل"}</dd>
            </dl>
            {report.stack ? (
              <pre className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-gray-950/60 p-2 text-left text-[11px] leading-relaxed text-gray-400" dir="ltr">
                {report.stack}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={copyReport}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white"
      >
        <ClipboardCopy className="h-3.5 w-3.5" />
        نسخ تقرير الخطأ
      </button>
    </div>
  );
}

export default ErrorDetailsPanel;
