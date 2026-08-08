"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, GitCompareArrows, RefreshCw, Rows3, Split } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type SyncLogEntry, type SyncSummary } from "@/lib/archive-api";
import "./sync.css";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatArabicDateTime } from "@/lib/arabic-format";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type SyncState =
  | { status: "loading" }
  | { status: "ready"; entries: SyncLogEntry[]; summary: SyncSummary }
  | { status: "error"; message: string };

function statusLabel(status: SyncLogEntry["status"], locale: "ar" | "en") {
  return locale === "en" ? (status === "conflict" ? "Needs sync" : "Synced") : (status === "conflict" ? "يحتاج مزامنة" : "متزامن");
}

type SyncFilter = "all" | SyncLogEntry["status"];

export default function SyncPage() {
  const { locale } = useLocale();
  const copy = locale === "en" ? { loadError: "Could not load the sync log.", eyebrow: "Sync", title: "Sync log and conflicts", description: "Record synchronization status and possible conflicts across archive stores.", records: "records", synced: "synced", conflicts: "conflicts", refresh: "Refresh", filter: "Filter sync log", all: "All", conflict: "Conflict", summary: "Sync summary", total: "Total records", last200: "Within the last 200 entries", ready: "Available across stores", needsDecision: "Needs a decision", loading: "Loading sync log…", error: "Could not load the sync log", results: "Sync results", columns: { id: "Identifier", store: "Store", status: "Status", version: "Sync version", updated: "Last updated" }, preview: "Sync record preview", unspecified: "Unspecified", openRecord: "Open record", activity: "Activity log", emptyTitle: "No matching records", emptyDescription: "Change the filter or wait for the first sync or bulk import." } : { loadError: "تعذر تحميل سجل المزامنة.", eyebrow: "المزامنة", title: "سجل المزامنة والتعارضات", description: "حالة مزامنة السجلات وتعارضاتها المحتملة عبر مخازن الأرشيف.", records: "سجل", synced: "متزامن", conflicts: "تعارض", refresh: "تحديث", filter: "فلترة سجل المزامنة", all: "الكل", conflict: "تعارض", summary: "ملخص المزامنة", total: "إجمالي السجلات", last200: "ضمن آخر 200 إدخال", ready: "جاهزة عبر المخازن", needsDecision: "تحتاج قراراً", loading: "جارٍ تحميل سجل المزامنة…", error: "تعذر تحميل سجل المزامنة", results: "نتائج المزامنة", columns: { id: "المعرّف", store: "المخزن", status: "الحالة", version: "إصدار المزامنة", updated: "آخر تحديث" }, preview: "معاينة سجل المزامنة", unspecified: "غير محدد", openRecord: "فتح السجل", activity: "سجل النشاط", emptyTitle: "لا توجد سجلات مطابقة", emptyDescription: "غيّر الفلتر أو انتظر أول عملية مزامنة أو استيراد جماعي." };
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<SyncState>({ status: "loading" });
  const [filter, setFilter] = useState<SyncFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const loadSync = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await api.sync({ limit: 200 });
      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }
      setState({ status: "ready", entries: response.entries, summary: response.summary });
      setSelectedKey((current) => current ?? (response.entries[0] ? `${response.entries[0].store}:${response.entries[0].uid}` : null));
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : copy.loadError });
    }
  }, [api, copy.loadError]);

  useEffect(() => {
    void loadSync();
  }, [loadSync]);

  const entries = state.status === "ready" ? state.entries : [];
  const filteredEntries = useMemo(
    () => entries.filter((entry) => filter === "all" || entry.status === filter),
    [entries, filter]
  );
  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => `${entry.store}:${entry.uid}` === selectedKey) ?? filteredEntries[0] ?? null,
    [filteredEntries, selectedKey]
  );

  return (
    <AppShell subtitle="سجل المزامنة" navLabel="المزامنة" contentClassName="sync-content" tipsPage="sync">
      <PageToolbar
        icon={<GitCompareArrows size={24} />}
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={
          state.status === "ready" ? (
            <>
              <span className="badge">{state.summary.total} {copy.records}</span>
              <span className="badge">{state.summary.synced} {copy.synced}</span>
              <span className="badge badge-error">{state.summary.conflicts} {copy.conflicts}</span>
            </>
          ) : null
        }
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadSync()} disabled={state.status === "loading"}>
            <RefreshCw size={16} aria-hidden="true" />
            {copy.refresh}
          </button>
        }
      >
        {state.status === "ready" ? (
          <div className="sync-filter-strip" role="group" aria-label={copy.filter}>
            {([
              ["all", copy.all, state.summary.total],
              ["synced", copy.synced, state.summary.synced],
              ["conflict", copy.conflict, state.summary.conflicts]
            ] as const).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                className="badge"
                data-active={filter === value ? "true" : "false"}
                onClick={() => setFilter(value)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </PageToolbar>

      {state.status === "ready" ? (
        <MetricStrip
          ariaLabel={copy.summary}
          items={[
            {
              label: copy.total,
              value: state.summary.total,
              description: copy.last200,
              icon: <Rows3 size={20} />,
              tone: "info"
            },
            {
              label: copy.synced,
              value: state.summary.synced,
              description: copy.ready,
              icon: <CheckCircle2 size={20} />,
              tone: "success"
            },
            {
              label: copy.conflicts,
              value: state.summary.conflicts,
              description: copy.needsDecision,
              icon: <Split size={20} />,
              tone: state.summary.conflicts > 0 ? "warning" : "success"
            }
          ]}
        />
      ) : null}

      {state.status === "loading" && (
        <div className="panel panel-compact">
          <Skeleton label={copy.loading} />
        </div>
      )}

      {state.status === "error" && (
        <EmptyState title={copy.error} description={state.message} />
      )}

      {state.status === "ready" && (
        filteredEntries.length ? (
          <section className="sync-workspace" aria-label={copy.results}>
            <article className="panel sync-table-panel">
              <div className="scroll-x">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{copy.columns.id}</th><th>{copy.columns.store}</th><th>{copy.columns.status}</th><th>{copy.columns.version}</th><th>{copy.columns.updated}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => {
                      const key = `${entry.store}:${entry.uid}`;

                      return (
                        <tr key={key} data-selected={selectedEntry && `${selectedEntry.store}:${selectedEntry.uid}` === key ? "true" : "false"}>
                          <td className="wrap-anywhere">
                            <button type="button" className="sync-row-button" onClick={() => setSelectedKey(key)}>
                              {entry.uid}
                            </button>
                          </td>
                          <td>{entry.store}</td>
                          <td>
                            <span className={`badge ${entry.status === "conflict" ? "badge-error" : "badge-success"}`}>
                              {statusLabel(entry.status, locale)}
                            </span>
                          </td>
                          <td>{entry.syncVersion ?? "—"}</td>
                          <td>
                            {locale === "en" ? (entry.updatedAt ? new Date(entry.updatedAt).toLocaleString("en-US") : "—") : formatArabicDateTime(entry.updatedAt, "—")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
            <aside className="workspace-panel sync-preview-panel" aria-label={copy.preview}>
              {selectedEntry ? (
                <>
                  <span className={`badge ${selectedEntry.status === "conflict" ? "badge-error" : "badge-success"}`}>
                    {statusLabel(selectedEntry.status, locale)}
                  </span>
                  <h2>{selectedEntry.uid}</h2>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>{copy.columns.store}</strong>
                      <span>{selectedEntry.store}</span>
                    </div>
                    <div className="kv-item">
                      <strong>{copy.columns.version}</strong><span>{selectedEntry.syncVersion ?? copy.unspecified}</span>
                    </div>
                    <div className="kv-item">
                      <strong>{copy.columns.updated}</strong><span>{locale === "en" ? (selectedEntry.updatedAt ? new Date(selectedEntry.updatedAt).toLocaleString("en-US") : "—") : formatArabicDateTime(selectedEntry.updatedAt, "—")}</span>
                    </div>
                  </div>
                  <div className="button-row">
                    <a className="button button-primary" href={`/archive/${encodeURIComponent(selectedEntry.uid)}`}>{copy.openRecord}</a>
                    <a className="button button-secondary" href="/activity">
                      <Clock3 size={16} aria-hidden="true" />
                      {copy.activity}
                    </a>
                  </div>
                </>
              ) : null}
            </aside>
          </section>
        ) : (
          <EmptyState
            title={copy.emptyTitle}
            description={copy.emptyDescription}
          />
        )
      )}
    </AppShell>
  );
}
