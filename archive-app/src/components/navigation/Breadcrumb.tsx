import { Fragment } from "react";

/**
 * Breadcrumb navigation — shows the current page's location in the app hierarchy.
 * Supports: Home > Group > Page  (all items except the last are clickable).
 *
 * Props
 *   crumbs     – array of { id, label } objects, ordered from root to current page
 *   onNavigate – called with the crumb object when a non-last crumb is clicked
 *
 * The component renders nothing when there is only one level (top-level pages like
 * "مركز التحكم") so the context bar stays clean on the home/dashboard page.
 *
 * RTL note: the separator is ‹ (U+2039) which visually separates right-to-left
 * items in the correct reading direction (parent ‹ child ‹ current).
 */
export function Breadcrumb({ crumbs = [], onNavigate }: any) {
  if (!crumbs || crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="مسار التنقل"
      dir="rtl"
      className="flex items-center gap-0.5 text-xs text-[var(--va-text-muted)] overflow-x-auto flex-wrap"
    >
      {crumbs.map((crumb: any, idx: any) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <Fragment key={crumb.id || idx}>
            {idx > 0 && (
              <span aria-hidden="true" className="text-[var(--va-text-muted)] mx-0.5 select-none">
                ‹
              </span>
            )}
            {isLast ? (
              <span className="text-[var(--va-text)] font-medium" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate?.(crumb)}
                className="text-emerald-400 hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0 text-xs leading-none rounded-[var(--va-radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55"
              >
                {crumb.label}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

Breadcrumb.displayName = "Breadcrumb";
