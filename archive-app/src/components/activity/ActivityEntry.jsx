import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  ChevronDown,
  ChevronUp,
  CirclePlus,
  FolderInput,
  Layers,
  PenLine,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Trash2
} from "lucide-react";

import { describeActivity } from "../../features/activityLog/viewModel.js";
import { formatDateTime } from "../../utils/formatting.js";
import { DiffView } from "./DiffView.jsx";

const ACTION_ICON = {
  create: CirclePlus,
  update: PenLine,
  delete: Trash2,
  restore: RefreshCw,
  move: FolderInput,
  bulk_update: Layers,
  bulk_delete: Trash2
};

const ACTION_TONE = {
  create: "va-accent-border va-accent-bg-soft va-accent-text-on-soft",
  update: "border-blue-500/20 bg-blue-500/10 text-blue-200",
  delete: "border-red-500/20 bg-red-500/10 text-red-200",
  bulk_delete: "border-red-500/20 bg-red-500/10 text-red-200",
  restore: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  move: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  bulk_update: "border-purple-500/20 bg-purple-500/10 text-purple-200"
};

function toneClasses(action) {
  return ACTION_TONE[action] || "border-white/10 bg-white/5 text-gray-300";
}

/**
 * Single activity row: description, user, timestamp, expandable DiffView,
 * and undo/redo controls for undoable entries.
 */
export function ActivityEntry({ entry, settings = {}, onUndo, onRedo }) {
  const [expanded, setExpanded] = React.useState(false);
  const Icon = ACTION_ICON[entry.action] || PenLine;
  const hasDiff = entry.snapshot?.diff && Object.keys(entry.snapshot.diff).length > 0;
  const canUndo = entry.undoable && !entry.undone && typeof onUndo === "function";
  const canRedo = entry.undoable && entry.undone && typeof onRedo === "function";

  return jsxs("article", {
    className: `va-entity-card rounded-2xl va-surface-muted border p-4 text-start transition-colors hover:border-emerald-500/25 ${entry.undone ? "opacity-60" : ""}`,
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "flex flex-wrap items-start justify-between gap-3",
        children: [
          jsxs("div", {
            className: "flex min-w-0 items-start gap-3",
            children: [
              jsx("span", {
                className: `mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClasses(entry.action)}`,
                "aria-hidden": "true",
                children: jsx(Icon, { className: "h-4 w-4" })
              }),
              jsxs("div", {
                className: "min-w-0",
                children: [
                  jsx("h3", { className: "truncate text-sm font-semibold text-white", children: describeActivity(entry) }),
                  jsxs("p", {
                    className: "mt-1 text-xs text-gray-500",
                    children: [
                      entry.userName || "النظام",
                      " · ",
                      entry.timestamp ? formatDateTime(entry.timestamp, settings.numberSystem) : "بدون تاريخ",
                      entry.undone ? " · تم التراجع" : ""
                    ]
                  })
                ]
              })
            ]
          }),
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              canUndo && jsxs("button", {
                type: "button",
                onClick: () => onUndo(entry),
                className: "btn btn-xs btn-warning gap-1.5",
                children: [jsx(RotateCcw, { className: "h-3.5 w-3.5" }), "تراجع"]
              }),
              canRedo && jsxs("button", {
                type: "button",
                onClick: () => onRedo(entry),
                className: "btn btn-xs btn-primary gap-1.5",
                children: [jsx(RotateCw, { className: "h-3.5 w-3.5" }), "إعادة"]
              }),
              hasDiff && jsxs("button", {
                type: "button",
                onClick: () => setExpanded((value) => !value),
                "aria-expanded": expanded,
                className: "btn btn-xs btn-ghost gap-1.5",
                children: [
                  expanded ? jsx(ChevronUp, { className: "h-3.5 w-3.5" }) : jsx(ChevronDown, { className: "h-3.5 w-3.5" }),
                  "الفروقات"
                ]
              })
            ]
          })
        ]
      }),
      expanded && hasDiff && jsx("div", { className: "mt-3", children: jsx(DiffView, { diff: entry.snapshot.diff }) })
    ]
  });
}

export default ActivityEntry;
