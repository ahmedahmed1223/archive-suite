import { Gauge } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";

export function RelatedContentPanel({ items = [], onOpenItem }) {
  if (!items.length) return null;
  return jsxs("section", {
    children: [
      jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(Gauge, { className: "h-4 w-4 va-accent-text" }), "مواد قد ترتبط بهذا السياق"] }),
      jsx("ul", { className: "mt-3 space-y-2", children: items.map((related) => jsx("li", { children: jsxs("button", {
        type: "button",
        onClick: () => onOpenItem?.(related.item),
        className: "w-full rounded-xl va-surface-subtle border p-3 text-right transition-colors hover:border-emerald-500/25",
        children: [
          jsxs("div", { className: "flex items-center justify-between gap-2", children: [
            jsx("span", { className: "min-w-0 flex-1 truncate text-sm font-semibold text-white", children: related.item.title || "بدون عنوان" }),
            jsx("span", { dir: "ltr", className: "shrink-0 font-mono text-[10px] va-accent-text", children: `${related.percent}%` })
          ] }),
          related.reason ? jsx("p", { className: "mt-1 text-[11px] text-gray-500", children: related.reason }) : null
        ]
      }) }, related.item.id)) })
    ]
  });
}
