import { Lightbulb, X } from "lucide-react";

// Mirrors the dashboard's presentational style (see ArchiveImprovementSuggestions.tsx).
// State, navigation, and persistence are owned by the caller.

export interface SuggestionItem {
  id: string;
  title: string;
  description: string;
  severity?: string;
  actionLabel?: string;
}

export interface SuggestionsPanelProps {
  suggestions?: SuggestionItem[];
  title?: string;
  onAction?: (suggestion: SuggestionItem) => void;
  onDismiss?: (suggestion: SuggestionItem) => void;
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

function SuggestionRow({
  suggestion,
  onAction,
  onDismiss
}: {
  suggestion: SuggestionItem;
  onAction?: (suggestion: SuggestionItem) => void;
  onDismiss?: (suggestion: SuggestionItem) => void;
}) {
  return (
    <li className="rounded-xl border border-white/10 bg-gray-950/25 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{suggestion.title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{suggestion.description}</p>
        </div>
        <span className={`badge badge-sm shrink-0 border px-2 py-0.5 text-[11px] ${toneClass(suggestion.severity)}`}>
          {severityLabel(suggestion.severity)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onAction?.(suggestion)}
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/5"
        >
          {suggestion.actionLabel || "فتح"}
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.(suggestion)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-500 hover:bg-white/5 hover:text-white"
          aria-label={`إخفاء الاقتراح ${suggestion.title}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

export function SuggestionsPanel({
  suggestions = [],
  title = "اقتراحات تحسين الاستخدام",
  onAction,
  onDismiss
}: SuggestionsPanelProps) {
  if (!suggestions.length) return null;

  return (
    <section className="rounded-xl va-surface-subtle border p-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-white">
        <Lightbulb className="h-4 w-4 va-accent-text" />
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-gray-500">
        ملاحظات لطيفة تساعدك على تنظيم أرشيفك تدريجياً. أخفِ ما لا يهمك.
      </p>
      <ul className="mt-3 space-y-2">
        {suggestions.map((suggestion) => (
          <SuggestionRow key={suggestion.id} suggestion={suggestion} onAction={onAction} onDismiss={onDismiss} />
        ))}
      </ul>
    </section>
  );
}

export default SuggestionsPanel;
