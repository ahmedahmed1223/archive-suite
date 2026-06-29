"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createArchiveApiClient, type MediaJob, type MediaJobStatus, type MediaOperation } from "@/lib/archive-api";

type ListState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "loaded"; jobs: MediaJob[] }
  | { status: "error"; message: string };

type CreateState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "success"; job: MediaJob }
  | { status: "error"; message: string };

type IngestState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; ingested: number; skipped: number }
  | { status: "error"; message: string };

const OPERATIONS: readonly MediaOperation[] = ["thumbnail", "transcode", "transcription"];

export function MediaJobsList() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [createState, setCreateState] = useState<CreateState>({ status: "idle" });
  const [ingestState, setIngestState] = useState<IngestState>({ status: "idle" });
  const [statusFilter, setStatusFilter] = useState<MediaJobStatus | "">("");

  useEffect(() => {
    loadJobs();
  }, [statusFilter]);

  async function loadJobs() {
    setListState({ status: "loading" });
    const response = await api.mediaJobs({
      limit: 20,
      status: statusFilter || undefined
    });

    if (!response.ok) {
      setListState({ status: "error", message: response.error });
      return;
    }

    if (response.jobs.length === 0) {
      setListState({ status: "empty" });
      return;
    }

    setListState({ status: "loaded", jobs: response.jobs });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const recordId = String(data.get("recordId") ?? "").trim();
    const operation = String(data.get("operation") ?? "").trim() as MediaOperation;

    if (!recordId || !operation) {
      setCreateState({ status: "error", message: "أدخل معرّف السجل والعملية" });
      return;
    }

    setCreateState({ status: "creating" });
    const response = await api.createMediaJob({
      recordId,
      operation
    });

    if (!response.ok) {
      setCreateState({ status: "error", message: response.error });
      return;
    }

    setCreateState({ status: "success", job: response.job });
    // Reset form and reload list
    setTimeout(() => {
      event.currentTarget.reset();
      setCreateState({ status: "idle" });
      loadJobs();
    }, 1500);
  }

  async function handleIngestScan() {
    setIngestState({ status: "scanning" });
    const response = await api.ingestScan();

    if (!response.ok) {
      setIngestState({ status: "error", message: response.error });
      return;
    }

    setIngestState({
      status: "done",
      ingested: Array.isArray(response.ingested) ? response.ingested.length : 0,
      skipped: response.skipped
    });

    // Reset after 3s
    setTimeout(() => {
      setIngestState({ status: "idle" });
    }, 3000);
  }

  return (
    <section className="content" aria-label="Media jobs management">
      {/* Create Job Form */}
      <article className="panel">
        <h2>إنشاء media job جديد</h2>
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            معرّف السجل
            <input name="recordId" type="text" placeholder="record-id" required />
          </label>

          <label>
            نوع العملية
            <select name="operation" required>
              <option value="">اختر عملية...</option>
              {OPERATIONS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={createState.status === "creating"}>
            {createState.status === "creating" ? "جار الإنشاء..." : "إنشاء job"}
          </button>

          <p className="form-status" role={createState.status === "error" ? "alert" : "status"}>
            {createState.status === "success"
              ? `تم الإنشاء: ${createState.job.id} (${createState.job.status})`
              : createState.status === "error"
                ? createState.message
                : ""}
          </p>
        </form>
      </article>

      {/* Ingest Trigger */}
      <article className="panel">
        <h2>Ingest Scan</h2>
        <button onClick={handleIngestScan} disabled={ingestState.status === "scanning"}>
          {ingestState.status === "scanning" ? "جار المسح..." : "بدء مسح الدخول"}
        </button>
        <p className="form-status" role={ingestState.status === "error" ? "alert" : "status"}>
          {ingestState.status === "done"
            ? `تم: ${ingestState.ingested} مدخول، تم تخطي ${ingestState.skipped}`
            : ingestState.status === "error"
              ? ingestState.message
              : ""}
        </p>
      </article>

      {/* Jobs List */}
      <article className="panel">
        <h2>قائمة Media Jobs</h2>

        <div style={{ marginBottom: "1rem" }}>
          <label>
            تصفية حسب الحالة:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MediaJobStatus | "")}
            >
              <option value="">الكل</option>
              <option value="queued">قيد الانتظار</option>
              <option value="processing">قيد المعالجة</option>
              <option value="completed">مكتمل</option>
              <option value="failed">فشل</option>
            </select>
          </label>
        </div>

        {listState.status === "loading" && <p>جار التحميل...</p>}
        {listState.status === "empty" && <p>لا توجد media jobs</p>}
        {listState.status === "error" && (
          <p role="alert" style={{ color: "red" }}>
            خطأ: {listState.message}
          </p>
        )}

        {listState.status === "loaded" && (
          <div className="grid">
            {listState.jobs.map((job) => (
              <article className="panel" key={job.id}>
                <h3>{job.operation}</h3>
                <div style={{ fontSize: "0.875rem", color: "#666" }}>
                  <p>
                    <strong>الحالة:</strong> <span className="badge">{job.status}</span>
                  </p>
                  <p>
                    <strong>معرّف السجل:</strong> {job.recordId}
                  </p>
                  <p>
                    <strong>المعرّف:</strong> {job.id}
                  </p>
                  {job.queuedAt && (
                    <p>
                      <strong>وقت الإضافة:</strong> {new Date(job.queuedAt).toLocaleString("ar-SA")}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
