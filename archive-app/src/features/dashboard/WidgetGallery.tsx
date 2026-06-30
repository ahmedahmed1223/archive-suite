import * as React from "react";
import { Eye, EyeOff, X } from "lucide-react";
import type { DashboardLayout } from "./dashboardLayoutModel.js";
import type { WidgetDescriptor } from "./widgetGalleryModel.js";
import { listWidgets, toggleWidgetVisibility } from "./widgetGalleryModel.js";

type Props = {
  layout: DashboardLayout;
  panelTitles: Record<string, string>;
  onLayoutChange: (next: DashboardLayout) => void;
  onClose: () => void;
};

/**
 * Widget Gallery — inline panel (not a modal) that appears inside the edit
 * toolbar area, matching the existing editing UX in DashboardPage.
 * No new dependency: uses existing design tokens + lucide icons already imported.
 */
export function WidgetGallery({ layout, panelTitles, onLayoutChange, onClose }: Props) {
  const widgets: WidgetDescriptor[] = listWidgets(layout, panelTitles);

  const handleToggle = (id: string) => {
    onLayoutChange(toggleWidgetVisibility(layout, id));
  };

  return (
    <div
      role="dialog"
      aria-label="معرض اللوحات"
      aria-modal="false"
      className="rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--va-text)]">إظهار / إخفاء اللوحات</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق معرض اللوحات"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--va-border-soft)] text-[var(--va-text-muted)] hover:bg-[var(--va-surface-2)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2" role="list">
        {widgets.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => handleToggle(w.id)}
              aria-pressed={w.visible}
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                w.visible
                  ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft"
                  : "border-[var(--va-border-soft)] text-[var(--va-text-muted)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text-2)]"
              }`}
            >
              {w.visible
                ? <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                : <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              }
              <span className="truncate">{w.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
