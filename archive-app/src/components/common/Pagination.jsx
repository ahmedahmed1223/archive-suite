import * as React from "react";

/**
 * Pagination — accessible RTL pagination component.
 * Supports keyboard navigation and screen reader announcements.
 *
 * @param {object} props
 * @param {number} props.page           - Current page (1-based)
 * @param {number} props.totalPages     - Total number of pages
 * @param {function} props.onPageChange - Called with the new page number
 * @param {number} [props.totalItems]   - Optional total result count shown as a label
 */
export function Pagination({ page = 1, totalPages = 1, onPageChange, totalItems }) {
  if (totalPages <= 1) return null;

  const pages = getPageRange(page, totalPages);

  return (
    <nav
      aria-label="تنقل الصفحات"
      dir="rtl"
      className="flex flex-wrap items-center justify-center gap-1 mt-4"
    >
      {/* Total count — screen readers announce it when it changes */}
      {totalItems != null && (
        <span
          className="text-xs text-gray-500 ms-auto"
          aria-live="polite"
          aria-atomic="true"
        >
          {totalItems} نتيجة
        </span>
      )}

      {/* Previous page */}
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="الصفحة السابقة"
        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ‹
      </button>

      {/* Page number buttons + ellipsis */}
      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="px-1 text-gray-600 select-none"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-label={`صفحة ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-[2rem] h-8 rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? "bg-[color-mix(in_srgb,var(--va-action)_85%,transparent)] text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {p}
          </button>
        )
      )}

      {/* Next page */}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="الصفحة التالية"
        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ›
      </button>
    </nav>
  );
}

/**
 * Generate a compact page number range with ellipsis markers.
 * Returns at most 7 slots so the pagination bar stays narrow.
 */
function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default Pagination;
