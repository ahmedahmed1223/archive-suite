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
export function Breadcrumb({ crumbs = [], onNavigate }) {
  if (!crumbs || crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="مسار التنقل"
      dir="rtl"
      className="flex items-center gap-0.5 text-xs text-gray-500 overflow-x-auto flex-wrap"
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <Fragment key={crumb.id || idx}>
            {idx > 0 && (
              <span aria-hidden="true" className="text-gray-600 mx-0.5 select-none">
                ‹
              </span>
            )}
            {isLast ? (
              <span className="text-gray-300 font-medium" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate?.(crumb)}
                className="va-accent-text hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0 text-xs leading-none"
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
