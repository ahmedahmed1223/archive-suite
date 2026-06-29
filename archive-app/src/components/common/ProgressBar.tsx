/**
 * ProgressBar — floating progress indicator for long operations.
 * Shows at the bottom of the screen when active.
 */
export function ProgressBar({ progress, onCancel }: any) {
  if (!progress.active && progress.percent < 100) return null;

  const etaText = progress.eta !== null
    ? progress.eta < 60
      ? `${progress.eta} ثانية متبقية`
      : `${Math.round(progress.eta / 60)} دقيقة متبقية`
    : null;

  return (
    // Outer wrapper: positions the bar but does NOT carry the progressbar role
    // (role="progressbar" must not contain focusable elements per WCAG 4.1.2)
    <div
      aria-label={progress.label || "جاري التحميل"}
      className="fixed right-0 left-0 z-[var(--va-z-sticky)] border-t border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-3 shadow-[var(--va-elev-popover)]"
      style={{ bottom: "var(--va-mobile-nav-bottom, 0px)" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-sm font-medium text-[var(--va-text)] truncate">{progress.label || "جاري المعالجة..."}</span>
          <div className="flex items-center gap-3">
            {etaText && <span className="text-xs text-[var(--va-text-muted)] whitespace-nowrap">{etaText}</span>}
            <span className="text-sm font-mono text-emerald-500">{progress.percent}%</span>
            {onCancel && progress.percent < 100 && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-[var(--va-radius-sm)] border border-[color-mix(in_oklab,var(--va-status-danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--va-status-danger)_12%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--va-status-danger)] transition-colors hover:bg-[color-mix(in_oklab,var(--va-status-danger)_18%,transparent)]"
              >
                إلغاء
              </button>
            )}
          </div>
        </div>
        {/* role="progressbar" is scoped to the track element only — no focusable descendants */}
        <progress
          role="progressbar"
          value={progress.percent}
          max={100}
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={progress.label || "جاري التحميل"}
          className="progress progress-accent h-1.5 w-full overflow-hidden rounded-full bg-[var(--va-surface-2)]"
        />
      </div>
    </div>
  );
}
