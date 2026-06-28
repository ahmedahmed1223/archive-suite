import { Info, X } from "lucide-react";

export interface ArchiveImprovementSuggestion {
  key?: string;
  id?: string;
  title: string;
  detail: string;
  severity?: string;
  actionLabel?: string;
}

export interface ArchiveImprovementSuggestionsProps {
  suggestions?: ArchiveImprovementSuggestion[];
  title?: string;
  onAction?: (suggestion: ArchiveImprovementSuggestion) => void;
  onFeedback?: (suggestion: ArchiveImprovementSuggestion, feedback: "useful" | "not-useful" | "dismissed") => void;
}

function toneClass(severity?: string) {
  if (severity === "high") return "border-amber-500/25 bg-amber-500/10 text-amber-100";
  if (severity === "medium") return "va-accent-border va-accent-bg-soft va-accent-text-on-soft";
  return "border-white/10 bg-white/5 text-gray-300";
}

function severityLabel(severity?: string) {
  if (severity === "high") return "مهم";
  if (severity === "medium") return "مفيد";
  return "تحسين";
}

export function ArchiveImprovementSuggestions({
  suggestions = [],
  title = "اقتراحات تحسين هذا العنصر",
  onAction,
  onFeedback
}: ArchiveImprovementSuggestionsProps) {
  if (!suggestions.length) return null;

  return (
    <section className="rounded-xl va-surface-subtle border p-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-white">
        <Info className="h-4 w-4 va-accent-text" />
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.key || suggestion.id} className="rounded-xl border border-white/10 bg-gray-950/25 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{suggestion.title}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{suggestion.detail}</p>
              </div>
              <span className={`badge badge-sm shrink-0 border px-2 py-0.5 text-[11px] ${toneClass(suggestion.severity)}`}>
                {severityLabel(suggestion.severity)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAction?.(suggestion)}
                className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/5"
              >
                {suggestion.actionLabel || "فتح"}
              </button>
              <button
                type="button"
                onClick={() => onFeedback?.(suggestion, "useful")}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
              >
                مفيد
              </button>
              <button
                type="button"
                onClick={() => onFeedback?.(suggestion, "not-useful")}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
              >
                غير مفيد
              </button>
              <button
                type="button"
                onClick={() => onFeedback?.(suggestion, "dismissed")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-500 hover:bg-white/5 hover:text-white"
                aria-label={`إخفاء الاقتراح ${suggestion.title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
