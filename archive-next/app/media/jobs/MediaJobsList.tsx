"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
const WATERMARK_POSITIONS = [
  { value: "bottom-right", label: "أسفل يمين" },
  { value: "bottom-left", label: "أسفل يسار" },
  { value: "top-right", label: "أعلى يمين" },
  { value: "top-left", label: "أعلى يسار" },
  { value: "center", label: "الوسط" }
] as const;

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

export function MediaJobsList() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [createState, setCreateState] = useState<CreateState>({ status: "idle" });
  const [ingestState, setIngestState] = useState<IngestState>({ status: "idle" });
  const [statusFilter, setStatusFilter] = useState<MediaJobStatus | "">("");
  const [selectedOperation, setSelectedOperation] = useState<MediaOperation | "">("");

  const loadJobs = useCallback(async () => {
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
  }, [api, statusFilter]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(event.currentTarget);
    const recordId = String(data.get("recordId") ?? "").trim();
    const operation = String(data.get("operation") ?? "").trim() as MediaOperation;
    const sourcePath = String(data.get("sourcePath") ?? "").trim();

    if (!recordId || !operation) {
      setCreateState({ status: "error", message: "أدخل معرّف السجل والعملية" });
      return;
    }

    const options: Record<string, unknown> = {};

    if (operation === "thumbnail") {
      const atSec = Number(data.get("atSec") ?? 0);
      options.atSec = clampNumber(atSec, 0, 86400, 0);
    }

    if (operation === "transcode" && data.get("watermarkEnabled") === "on") {
      const watermarkPath = String(data.get("watermarkPath") ?? "").trim();
      const watermarkPosition = String(data.get("watermarkPosition") ?? "bottom-right");

      if (!watermarkPath) {
        setCreateState({ status: "error", message: "أدخل مسار صورة العلامة المائية قبل إنشاء transcode job." });
        return;
      }

      options.watermark = {
        enabled: true,
        path: watermarkPath,
        position: watermarkPosition,
        opacity: clampNumber(Number(data.get("watermarkOpacity") ?? 0.85), 0, 1, 0.85),
        margin: Math.round(clampNumber(Number(data.get("watermarkMargin") ?? 24), 0, 512, 24))
      };
    }

    setCreateState({ status: "creating" });
    const response = await api.createMediaJob({
      recordId,
      operation,
      ...(sourcePath ? { sourcePath } : {}),
      ...(Object.keys(options).length > 0 ? { options } : {})
    });

    if (!response.ok) {
      setCreateState({ status: "error", message: response.error });
      return;
    }

    setCreateState({ status: "success", job: response.job });
    setTimeout(() => {
      form.reset();
      setSelectedOperation("");
      setCreateState({ status: "idle" });
      void loadJobs();
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

    setTimeout(() => {
      setIngestState({ status: "idle" });
    }, 3000);
  }

  return (
    <div className="stack" aria-label="Media jobs management">
      <article className="panel">
        <div className="toolbar-row">
          <div>
            <h2>إنشاء media job جديد</h2>
            <p className="field-note">أنشئ job من record id ثم اختر نوع العملية المناسبة.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            معرّف السجل
            <input name="recordId" type="text" placeholder="record-id" required />
          </label>

          <label>
            نوع العملية
            <select
              name="operation"
              required
              value={selectedOperation}
              onChange={(event) => setSelectedOperation(event.target.value as MediaOperation | "")}
            >
              <option value="">اختر عملية...</option>
              {OPERATIONS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>

          <label>
            مسار الملف المصدر
            <input name="sourcePath" type="text" placeholder="media/source.mp4" />
          </label>

          {selectedOperation === "thumbnail" && (
            <label>
              لقطة عند الثانية
              <input name="atSec" type="number" min="0" max="86400" defaultValue="0" />
            </label>
          )}

          {selectedOperation === "transcode" && (
            <div className="state-banner">
              <div className="helper-row">
                <strong>Watermark overlay</strong>
                <label
                  style={{
                    alignItems: "center",
                    color: "var(--va-text-2)",
                    display: "inline-flex",
                    gap: "0.45rem"
                  }}
                >
                  <input
                    name="watermarkEnabled"
                    type="checkbox"
                    style={{ inlineSize: "auto", minBlockSize: "auto" }}
                  />
                  تفعيل
                </label>
              </div>

              <label>
                مسار صورة العلامة
                <input name="watermarkPath" type="text" placeholder="branding/watermark.png" />
              </label>

              <div className="field-row">
                <label>
                  الموضع
                  <select name="watermarkPosition" defaultValue="bottom-right">
                    {WATERMARK_POSITIONS.map((position) => (
                      <option key={position.value} value={position.value}>
                        {position.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  الشفافية
                  <input name="watermarkOpacity" type="number" min="0" max="1" step="0.05" defaultValue="0.85" />
                </label>
                <label>
                  الهامش
                  <input name="watermarkMargin" type="number" min="0" max="512" defaultValue="24" />
                </label>
              </div>
            </div>
          )}

          <button type="submit" className="button button-primary" disabled={createState.status === "creating"}>
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

      <article className="panel">
        <div className="toolbar-row">
          <div>
            <h2>Ingest Scan</h2>
            <p className="field-note">فحص إدخال الملفات وتوليد jobs جديدة عند الحاجة.</p>
          </div>
        </div>

        <button className="button button-primary" onClick={handleIngestScan} disabled={ingestState.status === "scanning"}>
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

      <section className="stack" aria-label="قائمة Media Jobs">
        <div className="toolbar-row">
          <div>
            <h2>قائمة Media Jobs</h2>
            <p className="field-note">فلترة مباشرة حسب الحالة مع إبقاء التفاصيل قابلة للمسح بسرعة.</p>
          </div>
          <label className="field-row" style={{ margin: 0 }}>
            <span className="field-note">الحالة</span>
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

        {listState.status === "loading" && <p className="form-status">جار التحميل...</p>}
        {listState.status === "empty" && <p className="empty-state">لا توجد media jobs.</p>}
        {listState.status === "error" && (
          <p role="alert" className="form-status status-error">
            خطأ: {listState.message}
          </p>
        )}

        {listState.status === "loaded" && (
          <div className="stack">
            {listState.jobs.map((job) => (
              <article className="panel" key={job.id}>
                <div className="toolbar-row">
                  <h3 style={{ margin: 0 }}>{job.operation}</h3>
                  <span className="badge">{job.status}</span>
                </div>
                <div className="kv-grid">
                  <div className="kv-item">
                    <strong>معرّف السجل</strong>
                    <span>{job.recordId}</span>
                  </div>
                  <div className="kv-item">
                    <strong>المعرّف</strong>
                    <span style={{ overflowWrap: "anywhere" }}>{job.id}</span>
                  </div>
                  {job.sourcePath && (
                    <div className="kv-item">
                      <strong>المصدر</strong>
                      <span style={{ overflowWrap: "anywhere" }}>{job.sourcePath}</span>
                    </div>
                  )}
                  {job.queuedAt && (
                    <div className="kv-item">
                      <strong>وقت الإضافة</strong>
                      <time>{new Date(job.queuedAt).toLocaleString("ar-SA")}</time>
                    </div>
                  )}
                </div>
                {job.options && Object.keys(job.options).length > 0 && (
                  <pre className="token-preview">{JSON.stringify(job.options, null, 2)}</pre>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
