"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { createArchiveApiClient, type ArchiveRecord, type ArchiveSuggestion, type DiscoverSection, type SuggestionFeedbackValue } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type DiscoverState =
  | { status: "loading" }
  | { status: "ready"; sections: DiscoverSection[] }
  | { status: "error"; message: string };

function recordText(record: ArchiveRecord, locale: "ar" | "en") {
  return String(record.description || record.metadata?.notes || record.metadata?.path || record.store || (locale === "en" ? "No additional description" : "بدون وصف إضافي"));
}

function recordKind(record: ArchiveRecord, locale: "ar" | "en") {
  return String(record.type || record.subtype || record.metadata?.mediaType || record.store || (locale === "en" ? "Record" : "سجل"));
}

function recordDate(record: ArchiveRecord, locale: "ar" | "en") {
  const value = record.updatedAt || record.createdAt;

  if (!value) {
    return locale === "en" ? "Unspecified" : "غير محدد";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA");
}

function DiscoverCard({ record, locale }: Readonly<{ record: ArchiveRecord; locale: "ar" | "en" }>) {
  const title = String(record.title || record.name || (locale === "en" ? "Untitled" : "بدون عنوان"));

  return (
    <article className="panel panel-compact">
      <div className="panel-title-row">
        <div>
          <span className="badge">{recordKind(record, locale)}</span>
          <h3>{title}</h3>
        </div>
        <span className="badge">{recordDate(record, locale)}</span>
      </div>
      <p className="helper-text">{recordText(record, locale)}</p>
      <div className="button-row">
        <a className="button button-primary" href={`/archive/${encodeURIComponent(record.id || record.uid || "")}`}>
          {locale === "en" ? "Open record" : "فتح السجل"}
        </a>
      </div>
    </article>
  );
}

export default function DiscoverPage() {
  const { locale } = useLocale();
  const copy = locale === "en" ? { loadError: "Could not load discovery paths.", feedbackError: "Could not save suggestion feedback.", eyebrow: "Discovery paths", title: "Discover", description: "Explore popular, random, active, forgotten, or incomplete material so the archive is more than a long list.", paths: "paths", items: "items shown", refresh: "Refresh", loading: "Loading discovery paths…", error: "Could not load discovery", suggestions: "Suggested archive improvements", emptyTitle: "Not enough material to discover", emptyDescription: "Add records or open the archive to work with the current material.", openArchive: "Open archive", total: "total", noItems: "No items are currently shown in this path." } : { loadError: "تعذر تحميل مسارات الاكتشاف.", feedbackError: "تعذر حفظ تقييم الاقتراح.", eyebrow: "مسارات الاكتشاف", title: "الاكتشاف", description: "استعرض مواد رائجة، عشوائية، نشطة، منسية، أو ناقصة البيانات حتى لا يبقى الأرشيف مجرد قائمة طويلة.", paths: "مسارات", items: "عنصر ظاهر", refresh: "تحديث", loading: "جارٍ تحميل مسارات الاكتشاف…", error: "تعذر تحميل الاكتشاف", suggestions: "تحسينات مقترحة للأرشيف", emptyTitle: "لا توجد مواد كافية للاكتشاف", emptyDescription: "أضف سجلات أو افتح الأرشيف للعمل على المواد الحالية.", openArchive: "فتح الأرشيف", total: "إجمالي", noItems: "لا توجد عناصر ظاهرة في هذا المسار حالياً." };
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
    <AppShell subtitle="الاكتشاف" navLabel="مسارات Masar" tipsPage="discover">
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
                <DiscoverCard key={`${section.key}:${record.id || record.uid}`} record={record} locale={locale} />
              ))}
            </div>
          )}
        </section>
      ))}
    </AppShell>
  );
}
