import { Component } from "react";
import { useT } from "../../i18n/useT.js";

/**
 * Inner functional component so the class ErrorBoundary can use hooks for
 * translated strings without violating React's rules of hooks.
 */
function ErrorBoundaryFallback({ error, onReset }) {
  const { t } = useT();
  const errorMessage = error?.message || String(error);

  return (
    <div
      dir="rtl"
      role="alert"
      aria-live="assertive"
      className="flex min-h-[200px] items-center justify-center p-6"
    >
      <div className="w-full max-w-lg rounded-[var(--va-radius-xl)] border border-[color-mix(in_oklab,var(--va-status-danger)_25%,transparent)] bg-[var(--va-elevated)] p-6 text-right shadow-[var(--va-elev-2)]">
        {/* Icon + Title */}
        <div className="flex items-start gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--va-radius-lg)] bg-[color-mix(in_oklab,var(--va-status-danger)_15%,transparent)] text-2xl text-[var(--va-status-danger)]"
            aria-hidden="true"
          >
            ⚠
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[var(--va-text)]">{t("error.generic")}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--va-text-2)]">
              {t("error.retryOrReload")}
            </p>
          </div>
        </div>

        {/* Error detail (collapsed, ltr for stack traces) */}
        {errorMessage && (
          <pre
            dir="ltr"
            className="mt-4 max-h-32 overflow-auto rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-bg)] p-3 text-left text-xs leading-5 text-[var(--va-text-2)]"
          >
            {errorMessage}
          </pre>
        )}

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--va-text)] transition-colors hover:bg-[var(--va-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]"
          >
            {t("actions.retry")}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 rounded-[var(--va-radius-md)] border border-[color-mix(in_oklab,var(--va-status-danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--va-status-danger)_10%,var(--va-surface))] px-4 py-2.5 text-sm font-semibold text-[var(--va-status-danger)] transition-colors hover:bg-[color-mix(in_oklab,var(--va-status-danger)_18%,var(--va-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--va-status-danger)_55%,transparent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]"
          >
            {t("status.reload")}
          </button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this._reset = () => this.setState({ hasError: false, error: null });
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this._reset);
    }

    return (
      <ErrorBoundaryFallback error={this.state.error} onReset={this._reset} />
    );
  }
}
