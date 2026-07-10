"use client";

import { useState } from "react";
import { EyeOff, Lightbulb, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ArchiveSuggestion, SuggestionFeedbackValue } from "@/lib/archive-api";

const severityLabel: Record<string, string> = {
  high: "مهم",
  medium: "تحسين",
  low: "ملاحظة"
};

export default function SuggestionsPanel({
  suggestions,
  title = "اقتراحات تحسين",
  onFeedback
}: Readonly<{
  suggestions: ArchiveSuggestion[];
  title?: string;
  onFeedback: (suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) => Promise<void>;
}>) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const visibleSuggestions = suggestions.filter((suggestion) => !dismissed.includes(suggestion.key));

  if (visibleSuggestions.length === 0) return null;

  async function handleFeedback(suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) {
    setBusyKey(suggestion.key);
    setError("");
    try {
      await onFeedback(suggestion, value);
      if (value === "dismissed") {
        setDismissed((current) => [...current, suggestion.key]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ تقييم الاقتراح.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="panel panel-compact" aria-labelledby="suggestions-title">
      <div className="panel-section-header">
        <div className="toolbar-row toolbar-start">
          <Lightbulb aria-hidden="true" size={18} className="text-accent" />
          <h2 id="suggestions-title">{title}</h2>
        </div>
        <span className="badge">{visibleSuggestions.length}</span>
      </div>
      <div className="suggestions-panel-list" role="list">
        {visibleSuggestions.map((suggestion) => {
          const busy = busyKey === suggestion.key;
          return (
            <article className="panel panel-compact" role="listitem" key={suggestion.key}>
              <div className="panel-title-row">
                <div>
                  <span className="badge">{severityLabel[suggestion.severity] || "تحسين"}</span>
                  <h3>{suggestion.title}</h3>
                </div>
                <span className="badge">{suggestion.count} مادة</span>
              </div>
              <p className="helper-text">{suggestion.detail}</p>
              <div className="button-row">
                <a className="button button-primary button-sm" href={suggestion.actionHref}>فتح</a>
                <button type="button" className="button button-secondary button-sm" disabled={busy} onClick={() => void handleFeedback(suggestion, "useful")}>
                  <ThumbsUp aria-hidden="true" size={15} /> مفيد
                </button>
                <button type="button" className="button button-secondary button-sm" disabled={busy} onClick={() => void handleFeedback(suggestion, "not-useful")}>
                  <ThumbsDown aria-hidden="true" size={15} /> غير مفيد
                </button>
                <button type="button" className="button button-secondary button-sm" disabled={busy} onClick={() => void handleFeedback(suggestion, "dismissed")}>
                  <EyeOff aria-hidden="true" size={15} /> إخفاء
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {error ? <p className="form-status" role="alert">{error}</p> : null}
    </section>
  );
}
