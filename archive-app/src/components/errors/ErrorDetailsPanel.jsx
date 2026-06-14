import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardCopy, Lightbulb } from "lucide-react";

import { formatErrorReport } from "../../features/errors/errorReportBuilder.js";

const SEVERITY_STYLES = {
  info: { label: "معلومة", color: "#38bdf8", border: "border-sky-500/30", bg: "bg-sky-500/10", text: "text-sky-200" },
  warning: { label: "تحذير", color: "#f59e0b", border: "border-amber-500/30", bg: "bg-amber-500/10", text: "text-amber-200" },
  error: { label: "خطأ", color: "#ef4444", border: "border-red-500/30", bg: "bg-red-500/10", text: "text-red-200" },
  critical: { label: "حرج", color: "#f43f5e", border: "border-rose-500/40", bg: "bg-rose-500/15", text: "text-rose-200" }
};

/**
 * Layered error details (§1281): a plain message, a suggested fix, and a
 * collapsible technical section — so a user reads the simple line while a
 * power user can expand the stack/device data and copy a full report.
 */
export function ErrorDetailsPanel({ report, onCopy }) {
  const [showTechnical, setShowTechnical] = React.useState(false);
  if (!report) return null;
  const style = SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.error;

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

  return jsxs("div", {
    className: `space-y-3 rounded-xl border ${style.border} ${style.bg} p-4 text-right`,
    dir: "rtl",
    children: [
      jsxs("div", { className: "flex items-start gap-2", children: [
        jsx(AlertTriangle, { className: `h-5 w-5 shrink-0 ${style.text}` }),
        jsxs("div", { className: "min-w-0 flex-1", children: [
          jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
            jsx("span", { className: `rounded-full border ${style.border} px-2 py-0.5 text-[11px] font-semibold ${style.text}`, children: style.label }),
            report.operation ? jsx("span", { className: "text-xs text-gray-400", children: report.operation }) : null,
            report.page ? jsx("span", { className: "text-xs text-gray-600", children: `· ${report.page}` }) : null
          ] }),
          jsx("p", { className: "mt-1 break-words text-sm font-semibold text-white", children: report.message })
        ] })
      ] }),
      report.suggestion ? jsxs("div", { className: "flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5", children: [
        jsx(Lightbulb, { className: "h-4 w-4 shrink-0 text-amber-300" }),
        jsx("p", { className: "text-sm text-gray-200", children: report.suggestion })
      ] }) : null,
      jsxs("div", { children: [
        jsxs("button", {
          type: "button",
          onClick: () => setShowTechnical((value) => !value),
          className: "inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white",
          "aria-expanded": showTechnical,
          children: [
            showTechnical ? jsx(ChevronUp, { className: "h-3.5 w-3.5" }) : jsx(ChevronDown, { className: "h-3.5 w-3.5" }),
            showTechnical ? "إخفاء التفاصيل التقنية" : "عرض التفاصيل التقنية"
          ]
        }),
        showTechnical ? jsxs("div", { className: "mt-2 space-y-2", children: [
          jsxs("dl", { className: "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs text-gray-400", children: [
            jsx("dt", { className: "text-gray-500", children: "الوقت" }), jsx("dd", { className: "text-gray-300", children: report.timestamp }),
            jsx("dt", { className: "text-gray-500", children: "النوع" }), jsx("dd", { className: "text-gray-300", children: report.name }),
            report.device?.userAgent ? jsx("dt", { className: "text-gray-500", children: "الجهاز" }) : null,
            report.device?.userAgent ? jsx("dd", { className: "truncate text-gray-300", title: report.device.userAgent, children: report.device.userAgent }) : null,
            jsx("dt", { className: "text-gray-500", children: "الاتصال" }), jsx("dd", { className: "text-gray-300", children: report.device?.online ? "متصل" : "غير متصل" })
          ] }),
          report.stack ? jsx("pre", { className: "max-h-40 overflow-auto rounded-lg border border-white/10 bg-gray-950/60 p-2 text-left text-[11px] leading-relaxed text-gray-400", dir: "ltr", children: report.stack }) : null
        ] }) : null
      ] }),
      jsxs("button", {
        type: "button",
        onClick: copyReport,
        className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white",
        children: [jsx(ClipboardCopy, { className: "h-3.5 w-3.5" }), "نسخ تقرير الخطأ"]
      })
    ]
  });
}

export default ErrorDetailsPanel;
