import { Clock } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { getItemStateMeta, isOverdue } from "../../features/archive/itemStatus.js";

const BADGE_COLORS = {
  gray: "border-gray-500/30 bg-gray-500/15 text-gray-300",
  blue: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  amber: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  green: "border-green-500/30 bg-green-500/15 text-green-300",
  zinc: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300"
};

export function StatusBadge({ item, compact = false, now }: any) {
  const meta = getItemStateMeta(item);
  const overdue = isOverdue(item, now);
  return jsxs("span", {
    // DaisyUI `badge` — semantic badge primitive; custom color tints preserved (§1881 Phase 3)
    className: [
      "badge shrink-0 gap-1 border font-medium",
      compact ? "badge-xs px-1.5 py-0.5 text-[10px]" : "badge-sm px-2.5 py-0.5 text-xs",
      (BADGE_COLORS as any)[meta.color] || BADGE_COLORS.gray
    ].join(" "),
    children: [
      meta.label,
      overdue && jsx("span", {
        className: "inline-flex items-center text-red-300",
        title: "تجاوز تاريخ الاستحقاق",
        children: jsx(Clock, { className: compact ? "h-2.5 w-2.5" : "h-3 w-3" })
      })
    ]
  });
}

export default StatusBadge;
