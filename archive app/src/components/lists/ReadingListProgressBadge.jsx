import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { READING_LIST_STATUS } from "../../stores/slices/readingListsSlice.js";

const STATUS_CONFIG = {
  [READING_LIST_STATUS.NOT_STARTED]: { icon: Circle, label: "لم يبدأ", className: "text-gray-400" },
  [READING_LIST_STATUS.IN_PROGRESS]: { icon: PlayCircle, label: "قيد المراجعة", className: "text-blue-400" },
  [READING_LIST_STATUS.COMPLETED]: { icon: CheckCircle2, label: "مكتمل", className: "text-green-400" }
};

export function ReadingListProgressBadge({ status = READING_LIST_STATUS.NOT_STARTED, showLabel = false, size = "sm" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[READING_LIST_STATUS.NOT_STARTED];
  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return jsxs("span", {
    className: `inline-flex items-center gap-1 ${cfg.className}`,
    title: cfg.label,
    "aria-label": cfg.label,
    children: [
      jsx(cfg.icon, { className: iconClass }),
      showLabel && jsx("span", { className: "text-xs", children: cfg.label })
    ]
  });
}
