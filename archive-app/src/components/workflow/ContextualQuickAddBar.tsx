import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { ChevronDown, ChevronUp, Plus, Zap } from "lucide-react";

import { QuickAddBar } from "../templates/QuickAddBar.jsx";
import { getRecentDefaults } from "../../features/workflow/recentDefaults.js";

/**
 * ContextualQuickAddBar — a collapsible quick-add strip at the top of ArchivePage.
 * Persists last-used type/tags across sessions via recentDefaults.
 */
export function ContextualQuickAddBar({ contentTypes = [], className = "" }: any) {
  const [open, setOpen] = React.useState(false);
  const [addedCount, setAddedCount] = React.useState(0);
  const defaults = React.useMemo(() => getRecentDefaults(), [open]);

  const defaultTypeId = defaults.typeId || contentTypes[0]?.id || "";

  function handleDone(count: any) {
    setAddedCount((c: any) => c + count);
    setOpen(false);
  }

  return jsxs("div", {
    className: `rounded-2xl border border-emerald-500/15 bg-gray-900/60 ${className}`,
    dir: "rtl",
    children: [
      jsxs("button", {
        type: "button",
        onClick: () => setOpen((v: any) => !v),
        "aria-expanded": open,
        "aria-label": open ? "إغلاق شريط الإضافة السريعة" : "فتح شريط الإضافة السريعة",
        className: "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-right text-sm transition-colors hover:bg-white/5 rounded-2xl",
        children: [
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsx(Zap, { className: "h-4 w-4 text-emerald-400", "aria-hidden": "true" }),
              jsx("span", { className: "font-semibold text-emerald-300", children: "إضافة سريعة" }),
              addedCount > 0 && jsx("span", {
                className: "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300",
                children: `${addedCount} مضاف`
              })
            ]
          }),
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              !open && jsxs("span", {
                className: "flex items-center gap-1 rounded-lg border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-400",
                "aria-hidden": "true",
                children: [jsx(Plus, { className: "h-3 w-3" }), "إضافة عنصر"]
              }),
              open
                ? jsx(ChevronUp, { className: "h-4 w-4 text-gray-400", "aria-hidden": "true" })
                : jsx(ChevronDown, { className: "h-4 w-4 text-gray-400", "aria-hidden": "true" })
            ]
          })
        ]
      }),
      open && jsx("div", {
        className: "border-t border-white/10 p-3",
        children: jsx(QuickAddBar, {
          contentTypes,
          defaultTypeId,
          onDone: handleDone,
          onClose: () => setOpen(false)
        })
      })
    ]
  });
}

ContextualQuickAddBar.displayName = "ContextualQuickAddBar";
