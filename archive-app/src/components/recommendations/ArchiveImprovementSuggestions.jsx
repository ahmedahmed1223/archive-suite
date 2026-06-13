import { Info, X } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";

function toneClass(severity) {
  if (severity === "high") return "border-amber-500/25 bg-amber-500/10 text-amber-100";
  if (severity === "medium") return "va-accent-border va-accent-bg-soft va-accent-text-on-soft";
  return "border-white/10 bg-white/5 text-gray-300";
}

function severityLabel(severity) {
  if (severity === "high") return "مهم";
  if (severity === "medium") return "مفيد";
  return "تحسين";
}

export function ArchiveImprovementSuggestions({
  suggestions = [],
  title = "اقتراحات تحسين هذا العنصر",
  onAction,
  onFeedback
}) {
  if (!suggestions.length) return null;
  return jsxs("section", {
    className: "rounded-xl va-surface-subtle border p-4",
    children: [
      jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(Info, { className: "h-4 w-4 va-accent-text" }), title] }),
      jsx("ul", { className: "mt-3 space-y-2", children: suggestions.map((suggestion) => jsxs("li", { className: "rounded-xl border border-white/10 bg-gray-950/25 p-3", children: [
        jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
          jsxs("div", { className: "min-w-0 flex-1", children: [
            jsx("p", { className: "text-sm font-semibold text-white", children: suggestion.title }),
            jsx("p", { className: "mt-1 text-xs leading-5 text-gray-500", children: suggestion.detail })
          ] }),
          jsx("span", { className: `shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${toneClass(suggestion.severity)}`, children: severityLabel(suggestion.severity) })
        ] }),
        jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [
          jsx("button", {
            type: "button",
            onClick: () => onAction?.(suggestion),
            className: "inline-flex min-h-8 items-center justify-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/5",
            children: suggestion.actionLabel || "فتح"
          }),
          jsx("button", { type: "button", onClick: () => onFeedback?.(suggestion, "useful"), className: "rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 hover:bg-white/5 hover:text-white", children: "مفيد" }),
          jsx("button", { type: "button", onClick: () => onFeedback?.(suggestion, "not-useful"), className: "rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 hover:bg-white/5 hover:text-white", children: "غير مفيد" }),
          jsx("button", { type: "button", onClick: () => onFeedback?.(suggestion, "dismissed"), className: "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-500 hover:bg-white/5 hover:text-white", "aria-label": `إخفاء الاقتراح ${suggestion.title}`, children: jsx(X, { className: "h-3.5 w-3.5" }) })
        ] })
      ] }, suggestion.key || suggestion.id)) })
    ]
  });
}
