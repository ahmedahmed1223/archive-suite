import * as React from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import type { ChecklistStep } from "./checklistModel.js";
import { isChecklistComplete } from "./checklistModel.js";

type Props = {
  steps: ChecklistStep[];
  onDismiss: () => void;
};

/**
 * Compact checklist card — shown until all steps are done or user dismisses.
 * No new dependency: reuses design tokens and button classes already in the app.
 */
export function GettingStartedChecklist({ steps, onDismiss }: Props) {
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = isChecklistComplete(steps);
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <section
      className="rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4"
      aria-label="قائمة البداية السريعة"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0 va-accent-text" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--va-text)]">
              {allDone ? "أنجزت كل خطوات البداية!" : "خطوات البداية السريعة"}
            </h2>
            <p className="text-[11px] text-[var(--va-text-muted)]">
              {doneCount} من {total} خطوات
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إخفاء قائمة البداية"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--va-border-soft)] text-[var(--va-text-muted)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text-2)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* progress bar */}
      <div
        className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--va-surface-2)]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percent}% اكتمال`}
      >
        <div
          className="h-full rounded-full va-accent-bg transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="space-y-2" role="list">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-2.5 text-sm ${step.done ? "text-[var(--va-text-muted)] line-through" : "text-[var(--va-text-2)]"}`}
          >
            {step.done
              ? <CheckCircle2 className="h-4 w-4 shrink-0 va-accent-text" aria-hidden="true" />
              : <Circle className="h-4 w-4 shrink-0 text-[var(--va-text-muted)]" aria-hidden="true" />
            }
            <span>{step.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
