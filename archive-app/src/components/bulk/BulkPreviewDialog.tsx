import { AlertTriangle, Loader2, X } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { BulkProgressTracker } from "./BulkProgressTracker.jsx";

export function BulkPreviewDialog({
  actionLabel = "تطبيق",
  actionDescription = "",
  items = [],
  onConfirm,
  onClose,
  dangerous = false
}: any) {
  const [phase, setPhase] = React.useState("preview"); // "preview" | "running" | "done"
  const [progress, setProgress] = React.useState([]);

  async function handleConfirm() {
    if (phase !== "preview") return;
    setPhase("running");
    const initial = items.map((item: any) => ({ ...item, status: "pending" }));
    setProgress(initial);

    for (let i = 0; i < items.length; i++) {
      setProgress((prev: any) =>
        prev.map((p: any, idx: any) => (idx === i ? { ...p, status: "running" } : p))
      );
      try {
        await onConfirm(items[i]);
        setProgress((prev: any) =>
          prev.map((p: any, idx: any) => (idx === i ? { ...p, status: "done" } : p))
        );
      } catch (err: any) {
        setProgress((prev: any) =>
          prev.map((p: any, idx: any) => (idx === i ? { ...p, status: "failed", error: err?.message || "خطأ" } : p))
        );
      }
    }

    setPhase("done");
  }

  const isDone = phase === "done";
  const failed = progress.filter((p: any) => p.status === "failed").length;

  return jsx("div", {
    // DaisyUI `modal modal-open` — adopt modal semantics; keep custom shell look (§1881 Phase 5)
    className: "modal modal-open fixed inset-0 z-[9980] flex items-center justify-center p-4",
    children: jsxs("div", {
      className: "modal-box relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1626] p-6 shadow-2xl",
      children: [
        jsxs("div", {
          className: "mb-4 flex items-center justify-between",
          children: [
            jsx("h2", { className: "text-base font-bold text-gray-100", children: actionLabel }),
            !isDone && jsx("button", {
              type: "button",
              onClick: onClose,
              className: "rounded-lg p-1.5 text-gray-500 hover:text-white",
              children: jsx(X, { className: "h-4 w-4" })
            })
          ]
        }),

        phase === "preview" && jsxs("div", {
          className: "space-y-3",
          children: [
            actionDescription && jsx("p", { className: "text-sm text-gray-400", children: actionDescription }),
            dangerous && jsxs("div", {
              role: "alert",
              // DaisyUI `alert alert-warning` over custom amber tint (§1881 Phase 5)
              className: "alert alert-warning flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300",
              children: [jsx(AlertTriangle, { className: "mt-0.5 h-4 w-4 shrink-0" }), "هذا الإجراء لا يمكن التراجع عنه"]
            }),
            jsxs("p", {
              className: "text-sm text-gray-400",
              children: ["سيُطبَّق الإجراء على ", jsx("strong", { className: "text-white", children: items.length }), " عنصر"]
            }),
            jsx("div", {
              className: "max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] p-2",
              children: items.map((item: any) =>
                jsx("p", { className: "truncate text-xs text-gray-400", children: item.title || item.id }, item.id)
              )
            })
          ]
        }),

        (phase === "running" || phase === "done") && jsx(BulkProgressTracker, { items: progress }),

        jsx("div", {
          className: "mt-5 flex justify-end gap-2",
          children: isDone
            ? jsx("button", {
                type: "button",
                onClick: onClose,
                className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5",
                children: failed > 0 ? "إغلاق (مع أخطاء)" : "تم"
              })
            : jsxs(React.Fragment, {
                children: [
                  phase === "preview" && jsx("button", {
                    type: "button",
                    onClick: onClose,
                    className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-400 hover:bg-white/5",
                    children: "إلغاء"
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: handleConfirm,
                    disabled: phase === "running",
                    className: `rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                      dangerous
                        ? "bg-red-600/80 text-white hover:bg-red-600"
                        : "bg-blue-600/80 text-white hover:bg-blue-600"
                    }`,
                    children: phase === "running"
                      ? jsx(Loader2, { className: "h-4 w-4 animate-spin" })
                      : actionLabel
                  })
                ]
              })
        })
      ]
    })
  });
}
