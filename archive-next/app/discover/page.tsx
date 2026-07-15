"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { createArchiveApiClient, type ArchiveRecord, type ArchiveSuggestion, type DiscoverSection, type SuggestionFeedbackValue } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";

type DiscoverState =
  | { status: "loading" }
  | { status: "ready"; sections: DiscoverSection[] }
  | { status: "error"; message: string };

function recordText(record: ArchiveRecord) {
  return String(record.description || record.metadata?.notes || record.metadata?.path || record.store || "بدون وصف إضافي");
}

function recordKind(record: ArchiveRecord) {
  return String(record.type || record.subtype || record.metadata?.mediaType || record.store || "سجل");
}

function recordDate(record: ArchiveRecord) {
  const value = record.updatedAt || record.createdAt;

  if (!value) {
    return "غير محدد";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA");
}

function DiscoverCard({ record }: Readonly<{ record: ArchiveRecord }>) {
  const title = String(record.title || record.name || "بدون عنوان");

  return (
    <article className="panel panel-compact">
      <div className="panel-title-row">
        <div>
          <span className="badge">{recordKind(record)}</span>
          <h3>{title}</h3>
        </div>
        <span className="badge">{recordDate(record)}</span>
      </div>
      <p className="helper-text">{recordText(record)}</p>
      <div className="button-row">
        <a className="button button-primary" href={`/archive/${encodeURIComponent(record.id || record.uid || "")}`}>
          فتح السجل
        </a>
      </div>
    </article>
  );
}

export default function DiscoverPage() {
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
        setState({ status: "error", message: response.error || "تعذر تحميل مسارات الاكتشاف." });
        return;
      }

      setState({ status: "ready", sections: response.sections });
      setSuggestions(suggestionsResponse.ok ? suggestionsResponse.suggestions : []);
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل مسارات الاكتشاف." });
    }
  }, [api]);

  useEffect(() => {
    void loadDiscover();
  }, [loadDiscover]);

  const visibleSections = state.status === "ready" ? state.sections : [];

  const surfacedCount = visibleSections.reduce((total, section) => total + section.records.length, 0);

  async function handleSuggestionFeedback(suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) {
    const response = await api.submitSuggestionFeedback(suggestion.key, { value, context: "discover" });
    if (!response.ok) throw new Error(response.error || "تعذر حفظ تقييم الاقتراح.");
    if (value === "dismissed") setSuggestions((current) => current.filter((item) => item.key !== suggestion.key));
  }

  return (
    <AppShell subtitle="الاكتشاف" navLabel="مسارات Masar">
      <PageToolbar
        eyebrow={<span className="badge">مسارات الاكتشاف</span>}
        title="الاكتشاف"
        description="استعرض مواد رائجة، عشوائية، نشطة، منسية، أو ناقصة البيانات حتى لا يبقى الأرشيف مجرد قائمة طويلة."
        meta={(
          <>
            <span className="badge">{visibleSections.length || 6} مسارات</span>
            <span className="badge">{surfacedCount} عنصر ظاهر</span>
          </>
        )}
        actions={(
          <button type="button" className="button button-primary" onClick={() => void loadDiscover()}>
            <RefreshCw aria-hidden="true" size={16} />
            تحديث
          </button>
        )}
      />

      {state.status === "loading" ? (
        <section className="page-section" role="status" aria-live="polite">
          <div className="panel panel-compact">
            <Skeleton label="جار تحميل مسارات الاكتشاف..." />
          </div>
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="page-section">
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر تحميل الاكتشاف</strong>
            <span className="helper-text">{state.message}</span>
          </div>
        </section>
      ) : null}

      {state.status === "ready" ? <SuggestionsPanel suggestions={suggestions} title="تحسينات مقترحة للأرشيف" onFeedback={handleSuggestionFeedback} /> : null}

      {state.status === "ready" && surfacedCount === 0 ? (
        <section className="page-section">
          <EmptyState
            title="لا توجد مواد كافية للاكتشاف"
            description="أضف سجلات أو افتح الأرشيف للعمل على المواد الحالية."
            actions={<a className="button button-primary" href="/archive">فتح الأرشيف</a>}
          />
        </section>
      ) : null}

      {visibleSections.map((section) => (
        <section className="page-section" key={section.key} aria-labelledby={`discover-${section.key}`}>
          <div className="toolbar-row toolbar-start">
            <Sparkles aria-hidden="true" size={18} className="text-accent" />
            <h2 id={`discover-${section.key}`} className="section-heading">{section.label}</h2>
            <span className="badge">{section.count} إجمالي</span>
          </div>
          <p className="helper-text">{section.description}</p>

          {section.records.length === 0 ? (
            <div className="panel panel-compact">
              <p className="helper-text">لا توجد عناصر ظاهرة في هذا المسار حاليا.</p>
            </div>
          ) : (
            <div className="records-surface" data-view="grid">
              {section.records.map((record) => (
                <DiscoverCard key={`${section.key}:${record.id || record.uid}`} record={record} />
              ))}
            </div>
          )}
        </section>
      ))}
    </AppShell>
  );
}
