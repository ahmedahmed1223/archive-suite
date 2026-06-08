import { Component } from "react";

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

    const { error } = this.state;
    const errorMessage = error?.message || String(error);

    return (
      <div
        dir="rtl"
        role="alert"
        aria-live="assertive"
        className="flex min-h-[200px] items-center justify-center p-6"
      >
        <div className="w-full max-w-lg rounded-2xl border border-red-500/25 bg-[#0d1117] p-6 text-right shadow-xl">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-2xl text-red-300"
              aria-hidden="true"
            >
              ⚠
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">حدث خطأ غير متوقع</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                يمكنك إعادة المحاولة أو تحديث الصفحة
              </p>
            </div>
          </div>

          {/* Error detail (collapsed, ltr for stack traces) */}
          {errorMessage && (
            <pre
              dir="ltr"
              className="mt-4 max-h-32 overflow-auto rounded-xl bg-black/30 p-3 text-left text-xs leading-5 text-red-200/80"
            >
              {errorMessage}
            </pre>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this._reset}
              className="flex-1 rounded-xl border border-white/10 bg-[#1a2332] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#243041]"
            >
              إعادة المحاولة
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/20"
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      </div>
    );
  }
}
