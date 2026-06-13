import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";

const STATUS_ICON = {
  pending: (cls) => jsx(Circle, { className: `h-4 w-4 text-gray-600 ${cls}` }),
  running: (cls) => jsx(Loader2, { className: `h-4 w-4 animate-spin text-blue-400 ${cls}` }),
  done:    (cls) => jsx(CheckCircle2, { className: `h-4 w-4 text-green-400 ${cls}` }),
  failed:  (cls) => jsx(XCircle, { className: `h-4 w-4 text-red-400 ${cls}` })
};

export function BulkProgressTracker({ items = [] }) {
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const pct = items.length > 0 ? Math.round(((done + failed) / items.length) * 100) : 0;

  return jsxs("div", {
    className: "space-y-3",
    children: [
      jsxs("div", {
        className: "flex items-center justify-between text-xs text-gray-500",
        children: [
          jsxs("span", { children: [done + failed, " / ", items.length] }),
          jsxs("span", { children: [pct, "%"] })
        ]
      }),
      jsx("div", {
        className: "h-1.5 w-full overflow-hidden rounded-full bg-white/10",
        children: jsx("div", {
          className: "h-full rounded-full bg-blue-500 transition-all duration-300",
          style: { width: `${pct}%` }
        })
      }),
      jsx("div", {
        className: "max-h-48 space-y-1 overflow-y-auto",
        children: items.map((item) =>
          jsxs("div", {
            className: "flex items-center gap-2 rounded-lg px-2 py-1",
            children: [
              STATUS_ICON[item.status]?.("shrink-0") ?? STATUS_ICON.pending("shrink-0"),
              jsx("span", { className: "flex-1 truncate text-xs text-gray-300", children: item.title || item.id }),
              item.status === "failed" && item.error && jsx("span", {
                className: "shrink-0 text-xs text-red-400",
                children: item.error
              })
            ]
          }, item.id)
        )
      }),
      failed > 0 && jsxs("p", {
        className: "text-xs text-red-400",
        children: [failed, " عنصر فشل"]
      })
    ]
  });
}
