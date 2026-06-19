// Context-aware sidebar quick-actions strip (§1408).
//
// Renders the high-signal shortcuts that change with the current page, driven by
// the pure `getQuickActions` decision logic. This is the lightweight, low-risk
// slice of the "ContextualSidebar" idea: instead of rewriting the whole sidebar
// into a smart wrapper, we surface a per-page actions strip at the top of it.

import { Plus, Search, Compass, LayoutGrid, FolderOpen, Archive, ArrowRight } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";

import { getQuickActions } from "../../features/navigation/navigationContext.js";

// Map quick-action ids/targets to icons without coupling the pure module to UI.
const ACTION_ICONS = {
  add: Plus,
  "add-another": Plus,
  search: Search,
  discover: Compass,
  dashboard: LayoutGrid,
  collections: FolderOpen,
  archive: Archive
};

function iconForAction(action) {
  return ACTION_ICONS[action.id] || ACTION_ICONS[action.targetPage] || ArrowRight;
}

/**
 * @param {{
 *   currentPage: string,
 *   onNavigate: (action: { id:string, targetPage:string, intent?:string }) => void,
 *   collapsed?: boolean
 * }} props
 */
export function ContextualQuickActions({ currentPage, onNavigate, collapsed = false }) {
  const actions = getQuickActions(currentPage);
  if (!actions.length) return null;

  return jsxs("section", {
    "aria-label": "إجراءات سريعة حسب الصفحة",
    className: "rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2",
    children: [
      !collapsed && jsx("p", {
        className: "mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--va-text-muted)]",
        children: "إجراءات سريعة"
      }),
      jsx("div", {
        className: collapsed ? "flex flex-col items-center gap-1" : "flex flex-wrap gap-1",
        children: actions.map((action) => {
          const Icon = iconForAction(action);
          return jsxs("button", {
            type: "button",
            onClick: () => onNavigate?.(action),
            title: action.label,
            "aria-label": action.label,
            className: [
              "inline-flex items-center gap-1.5 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] px-2 py-1 text-xs font-medium text-[var(--va-text-2)] transition-colors hover:border-[var(--va-border-strong)] hover:bg-[var(--va-surface)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
              collapsed ? "justify-center" : ""
            ].join(" "),
            children: [
              jsx(Icon, { className: "h-3.5 w-3.5 shrink-0" }),
              !collapsed && jsx("span", { className: "truncate", children: action.label })
            ]
          }, action.id);
        })
      })
    ]
  });
}

export default ContextualQuickActions;
