"use client";

import { X } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type ActiveFilter = {
  key: string;
  label: string;
  onRemove: () => void;
};

/**
 * V15-SEARCH-002: a reusable, presentation-only active-filter bar.
 * It is dumb: it receives the active filters and remove handlers, so the
 * same component serves the work inbox filters, search chips, and any
 * future faceted surface. No search logic lives here.
 */
export default function ActiveFilterBar({
  filters,
  onReset,
  resetLabel,
}: Readonly<{
  filters: ActiveFilter[];
  onReset?: () => void;
  resetLabel?: string;
}>) {
  const { t } = useLocale();

  if (filters.length === 0) return null;

  return (
    <div className="active-filter-bar" role="group" aria-label={t.pages.searchResults.activeFilters}>
      <ul className="active-filter-bar__list">
        {filters.map((filter) => (
          <li key={filter.key} className="active-filter-bar__chip">
            <span className="active-filter-bar__label" dir="auto">{filter.label}</span>
            <button
              type="button"
              className="active-filter-bar__remove"
              aria-label={`${t.pages.searchResults.removeFilter} ${filter.label}`}
              onClick={filter.onRemove}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {onReset ? (
        <button type="button" className="active-filter-bar__reset button button-sm button-secondary" onClick={onReset}>
          {resetLabel ?? t.pages.searchResults.resetFilters}
        </button>
      ) : null}
    </div>
  );
}
