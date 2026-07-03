"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { formatDate, getRecordWorkflowStatus, WORKFLOW_STATES, workflowStatusLabels, type WorkflowStatus } from "@/lib/record-utils";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

export default function KanbanPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  async function load() {
    setState({ status: "loading" });
    const response = await api.search({ limit: 1000 });
    setState(response.ok ? { status: "ready", records: response.records } : { status: "error", message: response.error });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const records = state.status === "ready" ? state.records : [];
  const grouped = useMemo(() => {
    const map = new Map<WorkflowStatus, ArchiveRecord[]>();
    WORKFLOW_STATES.forEach((status) => map.set(status, []));
    records.forEach((record) => {
      const status = getRecordWorkflowStatus(record);
      map.set(status, [...(map.get(status) || []), record]);
    });
    return map;
  }, [records]);

  async function moveRecord(record: ArchiveRecord, status: WorkflowStatus) {
    setBusyId(record.id);
    setFeedback("");
    const response = await api.bulkRecords({
      store: record.store || "default",
      records: [{ ...record, workflowStatus: status }]
    });
    if (response.ok) {
      setFeedback(`تم نقل "${record.title || record.id}" إلى ${workflowStatusLabels[status]}`);
      await load();
    } else {
      setFeedback(response.error);
    }
    setBusyId(null);
  }

  return (
    <AppShell subtitle="كانبان" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Workflow</span>}
        title="لوحة كانبان"
        description="عرض سير عمل السجلات حسب الحالة مع نقل سريع عبر endpoint records/bulk الحالي."
        meta={(
          <>
            <span className="badge">{records.length} سجل</span>
            <span className="badge">{WORKFLOW_STATES.length} حالات</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/archive">فتح الأرشيف</a>}
      />

      {feedback ? (
        <div className="state-banner" role="status">
          <strong>تحديث كانبان</strong>
          <span className="helper-text">{feedback}</span>
        </div>
      ) : null}

      {state.status === "loading" ? <div className="panel panel-compact"><p className="form-status">جار تحميل اللوحة...</p></div> : null}
      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل كانبان</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}
      {state.status === "ready" && records.length === 0 ? (
        <EmptyState title="لا توجد سجلات." description="أضف سجلات إلى الأرشيف لتظهر في لوحة سير العمل." />
      ) : null}

      {state.status === "ready" && records.length > 0 ? (
        <section className="workflow-board" aria-label="لوحة سير العمل">
          {WORKFLOW_STATES.map((status) => {
            const items = grouped.get(status) || [];
            return (
              <article className="workflow-column" key={status}>
                <div className="panel-title-row">
                  <h2>{workflowStatusLabels[status]}</h2>
                  <span className="badge">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <p className="helper-text">لا توجد سجلات في هذه الحالة.</p>
                ) : (
                  items.slice(0, 24).map((record) => (
                    <div className="kanban-card" key={record.id}>
                      <strong>{record.title || record.id}</strong>
                      <span className="helper-text">{record.type || "غير محدد"} · {formatDate(record.updatedAt || record.createdAt)}</span>
                      <div className="button-row">
                        <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(record.id)}`}>فتح</a>
                        <select
                          value={status}
                          disabled={busyId === record.id}
                          onChange={(event) => void moveRecord(record, event.target.value as WorkflowStatus)}
                          aria-label={`نقل ${record.title || record.id}`}
                        >
                          {WORKFLOW_STATES.map((next) => <option key={next} value={next}>{workflowStatusLabels[next]}</option>)}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </article>
            );
          })}
        </section>
      ) : null}
    </AppShell>
  );
}
