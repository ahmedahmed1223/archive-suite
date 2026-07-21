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
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const visibleSuggestions = suggestions.filter((suggestion) => !dismissed.includes(suggestion.key));
  const selectedVisible = visibleSuggestions.filter((suggestion) => selected.has(suggestion.key));

  if (visibleSuggestions.length === 0) return null;

  async function handleFeedback(suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) {
    setBusyKeys((current) => new Set(current).add(suggestion.key));
    setError("");
    try {
      await onFeedback(suggestion, value);
      if (value === "dismissed") {
        setDismissed((current) => [...current, suggestion.key]);
        setSelected((current) => {
          const next = new Set(current);
          next.delete(suggestion.key);
          return next;
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ تقييم الاقتراح.");
    } finally {
      setBusyKeys((current) => {
        const next = new Set(current);
        next.delete(suggestion.key);
        return next;
      });
    }
  }

  // V1-744: bulk equivalents of the per-item feedback buttons below — same
  // onFeedback prop, called once per selected suggestion, so callers need no
  // changes to support bulk approve/reject.
  async function handleBulkFeedback(value: SuggestionFeedbackValue) {
    if (selectedVisible.length === 0) return;
    await Promise.all(selectedVisible.map((suggestion) => handleFeedback(suggestion, value)));
    setSelected(new Set());
  }

  function toggleSelected(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(visibleSuggestions.map((suggestion) => suggestion.key)) : new Set());
  }

  const allSelected = selectedVisible.length > 0 && selectedVisible.length === visibleSuggestions.length;

  return (
    <section className="panel panel-compact" aria-labelledby="suggestions-title">
      <div className="panel-section-header">
        <div className="toolbar-row toolbar-start">
          <Lightbulb aria-hidden="true" size={18} className="text-accent" />
          <h2 id="suggestions-title">{title}</h2>
        </div>
        <span className="badge">{visibleSuggestions.length}</span>
      </div>
      {visibleSuggestions.length > 1 ? (
        <div className="toolbar-row toolbar-start">
          <label className="checklist-control">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => toggleSelectAll(event.target.checked)}
              aria-label="تحديد كل الاقتراحات"
            />
            <span>{selectedVisible.length > 0 ? `${selectedVisible.length} محدد` : "تحديد الكل"}</span>
          </label>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={selectedVisible.length === 0}
            onClick={() => void handleBulkFeedback("useful")}
          >
            <ThumbsUp aria-hidden="true" size={15} /> اعتماد المحدد
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={selectedVisible.length === 0}
            onClick={() => void handleBulkFeedback("dismissed")}
          >
            <EyeOff aria-hidden="true" size={15} /> رفض المحدد
          </button>
        </div>
      ) : null}
      <div className="suggestions-panel-list" role="list">
        {visibleSuggestions.map((suggestion) => {
          const busy = busyKeys.has(suggestion.key);
          return (
            <article className="panel panel-compact" role="listitem" key={suggestion.key}>
              <div className="panel-title-row">
                <div className="toolbar-row toolbar-start">
                  <input
                    type="checkbox"
                    checked={selected.has(suggestion.key)}
                    onChange={(event) => toggleSelected(suggestion.key, event.target.checked)}
                    aria-label={`تحديد ${suggestion.title}`}
                  />
                  <div>
                    <span className="badge">{severityLabel[suggestion.severity] || "تحسين"}</span>
                    <h3>{suggestion.title}</h3>
                  </div>
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
