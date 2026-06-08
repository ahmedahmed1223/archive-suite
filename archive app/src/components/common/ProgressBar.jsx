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
      className="fixed bottom-0 right-0 left-0 z-50 bg-gray-900 border-t border-gray-700 p-3 shadow-xl"
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
                className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-2 py-0.5 rounded transition-colors"
              >
                إلغاء
              </button>
            )}
          </div>
        </div>
        {/* role="progressbar" is scoped to the track element only — no focusable descendants */}
        <div
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={progress.label || "جاري التحميل"}
          className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden"
        >
          <div
            className="va-accent-bg h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
