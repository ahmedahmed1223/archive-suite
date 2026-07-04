"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type SyncLogEntry, type SyncSummary } from "@/lib/archive-api";

type SyncState =
  | { status: "loading" }
  | { status: "ready"; entries: SyncLogEntry[]; summary: SyncSummary }
  | { status: "error"; message: string };

function statusLabel(status: SyncLogEntry["status"]) {
  return status === "conflict" ? "يحتاج مزامنة" : "متزامن";
}

export default function SyncPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<SyncState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    void api.sync({ limit: 200 }).then((response) => {
      if (!active) return;
      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }
      setState({ status: "ready", entries: response.entries, summary: response.summary });
    }).catch((error) => {
      if (!active) return;
      setState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل سجل المزامنة." });
    });

    return () => {
      active = false;
    };
  }, [api]);

  return (
    <AppShell subtitle="سجل المزامنة" navLabel="المزامنة" contentClassName="sync-content">
      <PageToolbar
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
      />

      {state.status === "loading" && (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جار تحميل سجل المزامنة...</p>
        </div>
      )}

      {state.status === "error" && (
        <EmptyState title="تعذر تحميل سجل المزامنة" description={state.message} />
      )}

      {state.status === "ready" && (
        state.entries.length ? (
          <article className="panel">
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
                {state.entries.map((entry) => (
                  <tr key={`${entry.store}:${entry.uid}`}>
                    <td className="wrap-anywhere">
                      <a href={`/archive/${encodeURIComponent(entry.uid)}`}>{entry.uid}</a>
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
                ))}
              </tbody>
            </table>
          </article>
        ) : (
          <EmptyState
            title="لا توجد سجلات مزامنة بعد"
            description="ستظهر هنا حالة كل سجل بعد أول عملية مزامنة أو استيراد جماعي."
          />
        )
      )}
    </AppShell>
  );
}
