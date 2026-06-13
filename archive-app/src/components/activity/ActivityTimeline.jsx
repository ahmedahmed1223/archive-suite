import { jsx, jsxs } from "react/jsx-runtime";
import { CalendarDays } from "lucide-react";

import { groupActivitiesByDay } from "../../features/activityLog/viewModel.js";
import { ActivityEntry } from "./ActivityEntry.jsx";

/**
 * Day-grouped activity timeline. Entries are grouped via
 * groupActivitiesByDay (اليوم / أمس / date label) newest-first.
 */
export function ActivityTimeline({ entries = [], settings = {}, onUndo, onRedo }) {
  const groups = groupActivitiesByDay(entries);
  return jsx("div", {
    className: "space-y-6",
    dir: "rtl",
    children: groups.map((group) => jsxs("section", {
      "aria-label": group.label,
      children: [
        jsxs("h2", {
          className: "mb-3 flex items-center gap-2 text-sm font-bold text-white",
          children: [
            jsx(CalendarDays, { className: "h-4 w-4 va-accent-text", "aria-hidden": "true" }),
            group.label,
            jsx("span", { className: "text-xs font-normal text-gray-600", children: `(${group.entries.length})` })
          ]
        }),
        jsx("div", {
          className: "space-y-3 border-r border-white/10 pr-4",
          children: group.entries.map((entry) => jsx(ActivityEntry, {
            entry,
            settings,
            onUndo,
            onRedo
          }, entry.id))
        })
      ]
    }, group.date))
  });
}

export default ActivityTimeline;
