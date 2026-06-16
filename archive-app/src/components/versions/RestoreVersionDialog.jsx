import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { RotateCcw, X, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { VersionDiffViewer } from "./VersionDiffViewer.jsx";

/**
 * Confirmation dialog for restoring a previous version.
 * Shows a diff preview; user confirms full restore or cancels.
 *
 * @param {{
 *   version: { version: number, createdAt: string, snapshot: object },
 *   currentSnapshot: object,
 *   onConfirm: () => void,
 *   onClose: () => void,
 * }} props
 */
export function RestoreVersionDialog({ version, currentSnapshot, onConfirm, onClose }) {
  const [showDiff, setShowDiff] = useState(true);

  return jsx("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": `استعادة النسخة ${version.version}`,
    // DaisyUI `modal modal-open` — adopt modal semantics; keep RTL shell look (§1881 Phase 5)
    className: "modal modal-open fixed inset-0 z-[3000] flex items-end justify-center p-4 sm:items-center",
    children: jsxs("div", {
      className: "modal-box relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0d0d] p-0 shadow-2xl",
      children: [
        // Header
        jsxs("div", {
          className: "flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4",
          children: [
            jsxs("div", {
              children: [
                jsxs("h2", {
                  className: "text-base font-bold text-white",
                  children: ["استعادة النسخة ", version.version],
                }),
                jsx("p", {
                  className: "text-xs text-gray-500",
                  children: new Date(version.createdAt).toLocaleString("ar-EG", {
                    year: "numeric", month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }),
                }),
              ],
            }),
            jsx("button", {
              type: "button",
              onClick: onClose,
              className: "rounded-lg border border-white/10 p-1.5 text-gray-500 transition-colors hover:text-gray-300",
              children: jsx(X, { className: "h-4 w-4" }),
            }),
          ],
        }),

        // Warning — DaisyUI `alert alert-warning` over custom amber tint (§1881 Phase 5)
        jsxs("div", {
          role: "alert",
          className: "alert alert-warning mx-5 mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-3",
          children: [
            jsx(AlertTriangle, { className: "mt-0.5 h-4 w-4 shrink-0 text-amber-400" }),
            jsx("p", {
              className: "text-xs leading-5 text-amber-200",
              children: "ستُستبدل البيانات الحالية للسجل بقيم هذه النسخة. يمكن التراجع لاحقاً من قائمة الإصدارات.",
            }),
          ],
        }),

        // Diff toggle
        jsxs("div", {
          className: "px-5 py-4",
          children: [
            jsxs("button", {
              type: "button",
              onClick: () => setShowDiff((s) => !s),
              className: "mb-3 flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-300",
              children: [
                showDiff ? jsx(ChevronUp, { className: "h-3.5 w-3.5" }) : jsx(ChevronDown, { className: "h-3.5 w-3.5" }),
                showDiff ? "إخفاء الفروقات" : "عرض الفروقات",
              ],
            }),
            showDiff && jsx(VersionDiffViewer, {
              before:      currentSnapshot,
              after:       version.snapshot,
              beforeLabel: "الحالي",
              afterLabel:  `النسخة ${version.version}`,
            }),
          ],
        }),

        // Actions
        jsxs("div", {
          className: "flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4",
          children: [
            jsx("button", {
              type: "button",
              onClick: onClose,
              className: "rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white",
              children: "إلغاء",
            }),
            jsxs("button", {
              type: "button",
              onClick: onConfirm,
              className: "flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500",
              children: [
                jsx(RotateCcw, { className: "h-4 w-4" }),
                "استعادة النسخة",
              ],
            }),
          ],
        }),
      ],
    }),
  });
}
