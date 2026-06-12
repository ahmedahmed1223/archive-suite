/**
 * ProgressBar — floating progress indicator for long operations.
 * Shows at the bottom of the screen when active.
 */
export function ProgressBar({ progress, onCancel }) {
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
      className="fixed right-0 left-0 z-50 border-t border-gray-700 bg-gray-900 p-3 shadow-xl"
      style={{ bottom: "var(--va-mobile-nav-bottom, 0px)" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-sm text-white font-medium truncate">{progress.label || "جاري المعالجة..."}</span>
          <div className="flex items-center gap-3">
            {etaText && <span className="text-xs text-gray-400 whitespace-nowrap">{etaText}</span>}
            <span className="text-sm va-accent-text font-mono">{progress.percent}%</span>
            {onCancel && progress.percent < 100 && (
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-xs btn-error btn-soft rounded px-2 py-0.5 text-xs"
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
          className="progress progress-accent h-1.5 w-full overflow-hidden rounded-full bg-gray-700"
        />
      </div>
    </div>
  );
}
