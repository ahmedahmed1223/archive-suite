"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, GitCompareArrows, RefreshCw, Rows3, Split } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type SyncLogEntry, type SyncSummary } from "@/lib/archive-api";

type SyncState =
  | { status: "loading" }
  | { status: "ready"; entries: SyncLogEntry[]; summary: SyncSummary }
  | { status: "error"; message: string };

function statusLabel(status: SyncLogEntry["status"]) {
  return status === "conflict" ? "يحتاج مزامنة" : "متزامن";
}

type SyncFilter = "all" | SyncLogEntry["status"];

export default function SyncPage() {
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
      setState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل سجل المزامنة." });
    }
  }, [api]);

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
    <AppShell subtitle="سجل المزامنة" navLabel="المزامنة" contentClassName="sync-content">
      <PageToolbar
        icon={<GitCompareArrows size={24} />}
        eyebrow={<span className="badge">المزامنة</span>}
        title="سجل المزامنة والتعارضات"
        description="حالة مزامنة السجلات وتعارضاتها المحتملة عبر مخازن الأرشيف."
        meta={
          state.status === "ready" ? (
            <>
              <span className="badge">{state.summary.total} سجل</span>
              <span className="badge">{state.summary.synced} متزامن</span>
              <span className="badge badge-error">{state.summary.conflicts} تعارض</span>
            </>
          ) : null
        }
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadSync()} disabled={state.status === "loading"}>
            <RefreshCw size={16} aria-hidden="true" />
            تحديث
          </button>
        }
      >
        {state.status === "ready" ? (
          <div className="sync-filter-strip" role="group" aria-label="فلترة سجل المزامنة">
            {([
              ["all", "الكل", state.summary.total],
              ["synced", "متزامن", state.summary.synced],
              ["conflict", "تعارض", state.summary.conflicts]
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
          ariaLabel="ملخص المزامنة"
          items={[
            {
              label: "إجمالي السجلات",
              value: state.summary.total,
              description: "ضمن آخر 200 إدخال",
              icon: <Rows3 size={20} />,
              tone: "info"
            },
            {
              label: "متزامنة",
              value: state.summary.synced,
              description: "جاهزة عبر المخازن",
              icon: <CheckCircle2 size={20} />,
              tone: "success"
            },
            {
              label: "تعارضات",
              value: state.summary.conflicts,
              description: "تحتاج قرارا",
              icon: <Split size={20} />,
              tone: state.summary.conflicts > 0 ? "warning" : "success"
            }
          ]}
        />
      ) : null}

      {state.status === "loading" && (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جار تحميل سجل المزامنة...</p>
        </div>
      )}

      {state.status === "error" && (
        <EmptyState title="تعذر تحميل سجل المزامنة" description={state.message} />
      )}

      {state.status === "ready" && (
        filteredEntries.length ? (
          <section className="sync-workspace" aria-label="نتائج المزامنة">
            <article className="panel sync-table-panel">
              <div className="scroll-x">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>المعرّف</th>
                      <th>المخزن</th>
                      <th>الحالة</th>
                      <th>إصدار المزامنة</th>
                      <th>آخر تحديث</th>
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
                              {statusLabel(entry.status)}
                            </span>
                          </td>
                          <td>{entry.syncVersion ?? "—"}</td>
                          <td>
                            {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString("ar-SA") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
            <aside className="workspace-panel sync-preview-panel" aria-label="معاينة سجل المزامنة">
              {selectedEntry ? (
                <>
                  <span className={`badge ${selectedEntry.status === "conflict" ? "badge-error" : "badge-success"}`}>
                    {statusLabel(selectedEntry.status)}
                  </span>
                  <h2>{selectedEntry.uid}</h2>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>المخزن</strong>
                      <span>{selectedEntry.store}</span>
                    </div>
                    <div className="kv-item">
                      <strong>إصدار المزامنة</strong>
                      <span>{selectedEntry.syncVersion ?? "غير محدد"}</span>
                    </div>
                    <div className="kv-item">
                      <strong>آخر تحديث</strong>
                      <span>{selectedEntry.updatedAt ? new Date(selectedEntry.updatedAt).toLocaleString("ar-SA") : "—"}</span>
                    </div>
                  </div>
                  <div className="button-row">
                    <a className="button button-primary" href={`/archive/${encodeURIComponent(selectedEntry.uid)}`}>فتح السجل</a>
                    <a className="button button-secondary" href="/activity">
                      <Clock3 size={16} aria-hidden="true" />
                      سجل النشاط
                    </a>
                  </div>
                </>
              ) : null}
            </aside>
          </section>
        ) : (
          <EmptyState
            title="لا توجد سجلات مطابقة"
            description="غيّر الفلتر أو انتظر أول عملية مزامنة أو استيراد جماعي."
          />
        )
      )}
    </AppShell>
  );
}
