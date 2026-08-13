"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { createArchiveApiClient, type ArchiveRecord, type ArchiveSuggestion, type DiscoverSection, type SuggestionFeedbackValue } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type DiscoverState =
  | { status: "loading" }
  | { status: "ready"; sections: DiscoverSection[] }
  | { status: "error"; message: string };

type DiscoverCopy = AppDictionary["pages"]["discover"];

function recordText(record: ArchiveRecord, copy: DiscoverCopy) {
  return String(record.description || record.metadata?.notes || record.metadata?.path || record.store || copy.noAdditionalDescription);
}

function recordKind(record: ArchiveRecord, copy: DiscoverCopy) {
  return String(record.type || record.subtype || record.metadata?.mediaType || record.store || copy.record);
}

function recordDate(record: ArchiveRecord, locale: "ar" | "en", copy: DiscoverCopy) {
  const value = record.updatedAt || record.createdAt;

  if (!value) {
    return copy.unspecified;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA");
}

function DiscoverCard({ record, locale, copy }: Readonly<{ record: ArchiveRecord; locale: "ar" | "en"; copy: DiscoverCopy }>) {
  const title = String(record.title || record.name || copy.untitled);

  return (
    <article className="panel panel-compact">
      <div className="panel-title-row">
        <div>
          <span className="badge">{recordKind(record, copy)}</span>
          <h3>{title}</h3>
        </div>
        <span className="badge">{recordDate(record, locale, copy)}</span>
      </div>
      <p className="helper-text">{recordText(record, copy)}</p>
      <div className="button-row">
        <a className="button button-primary" href={`/archive/${encodeURIComponent(record.id || record.uid || "")}`}>
          {copy.openRecord}
        </a>
      </div>
    </article>
  );
}

export default function DiscoverPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.discover;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<DiscoverState>({ status: "loading" });
  const [suggestions, setSuggestions] = useState<ArchiveSuggestion[]>([]);

  const loadDiscover = useCallback(async () => {
    setState({ status: "loading" });

    try {
      const [response, suggestionsResponse] = await Promise.all([
        api.discover({ limit: 8 }),
        api.suggestions({ context: "discover" })
      ]);

      if (!response.ok) {
          setState({ status: "error", message: response.error || copy.loadError });
        return;
      }

      setState({ status: "ready", sections: response.sections });
      setSuggestions(suggestionsResponse.ok ? suggestionsResponse.suggestions : []);
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : copy.loadError });
    }
  }, [api, copy.loadError]);

  useEffect(() => {
    void loadDiscover();
  }, [loadDiscover]);

  const visibleSections = state.status === "ready" ? state.sections : [];

  const surfacedCount = visibleSections.reduce((total, section) => total + section.records.length, 0);

  async function handleSuggestionFeedback(suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) {
    const response = await api.submitSuggestionFeedback(suggestion.key, { value, context: "discover" });
    if (!response.ok) throw new Error(response.error || copy.feedbackError);
    if (value === "dismissed") setSuggestions((current) => current.filter((item) => item.key !== suggestion.key));
  }

  return (
    <AppShell subtitle={t.pageTitles.discover} navLabel={t.pageTitles.masarTours} tipsPage="discover">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>} title={copy.title} description={copy.description}
        meta={(
          <>
            <span className="badge">{visibleSections.length || 6} {copy.paths}</span><span className="badge">{surfacedCount} {copy.items}</span>
          </>
        )}
        actions={(
          <button type="button" className="button button-primary" onClick={() => void loadDiscover()}>
            <RefreshCw aria-hidden="true" size={16} />
            {copy.refresh}
          </button>
        )}
      />

      {state.status === "loading" ? (
        <section className="page-section" role="status" aria-live="polite">
          <div className="panel panel-compact">
            <Skeleton label={copy.loading} />
          </div>
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="page-section">
          <div className="state-banner state-banner-error" role="alert">
            <strong>{copy.error}</strong>
            <span className="helper-text">{state.message}</span>
          </div>
        </section>
      ) : null}

      {state.status === "ready" ? <SuggestionsPanel suggestions={suggestions} title={copy.suggestions} onFeedback={handleSuggestionFeedback} /> : null}

      {state.status === "ready" && surfacedCount === 0 ? (
        <section className="page-section">
          <EmptyState
            title={copy.emptyTitle} description={copy.emptyDescription} actions={<a className="button button-primary" href="/archive">{copy.openArchive}</a>}
          />
        </section>
      ) : null}

      {visibleSections.map((section) => (
        <section className="page-section" key={section.key} aria-labelledby={`discover-${section.key}`}>
          <div className="toolbar-row toolbar-start">
            <Sparkles aria-hidden="true" size={18} className="text-accent" />
            <h2 id={`discover-${section.key}`} className="section-heading">{section.label}</h2>
            <span className="badge">{section.count} {copy.total}</span>
          </div>
          <p className="helper-text">{section.description}</p>

          {section.records.length === 0 ? (
            <div className="panel panel-compact">
              <p className="helper-text">{copy.noItems}</p>
            </div>
          ) : (
            <div className="records-surface" data-view="grid">
              {section.records.map((record) => (
                <DiscoverCard key={`${section.key}:${record.id || record.uid}`} record={record} locale={locale} copy={copy} />
              ))}
            </div>
          )}
        </section>
      ))}
    </AppShell>
  );
}
