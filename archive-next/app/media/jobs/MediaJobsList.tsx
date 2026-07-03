"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FieldError } from "@/components/ui/Form";
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

const mediaJobFormSchema = z
  .object({
    recordId: z.string().trim().min(1, "أدخل معرّف السجل."),
    operation: z.string().trim().min(1, "اختر نوع العملية."),
    sourcePath: z.string().trim().optional().transform((value) => value || undefined),
    atSec: z.coerce.number().min(0, "الثانية لا يمكن أن تكون سالبة.").max(86400, "الحد الأقصى 86400 ثانية.").default(0),
    watermarkEnabled: z.boolean().optional().default(false),
    watermarkPath: z.string().trim().optional().transform((value) => value || undefined),
    watermarkPosition: z.string().default("bottom-right"),
    watermarkOpacity: z.coerce.number().min(0, "الشفافية بين 0 و 1.").max(1, "الشفافية بين 0 و 1.").default(0.85),
    watermarkMargin: z.coerce.number().min(0, "الهامش لا يمكن أن يكون سالبًا.").max(512, "الهامش الأقصى 512.").default(24)
  })
  .superRefine((value, ctx) => {
    if (!(OPERATIONS as readonly string[]).includes(value.operation)) {
      ctx.addIssue({ code: "custom", path: ["operation"], message: "اختر عملية مدعومة." });
    }

    if (value.operation === "transcode" && value.watermarkEnabled && !value.watermarkPath) {
      ctx.addIssue({ code: "custom", path: ["watermarkPath"], message: "أدخل مسار صورة العلامة المائية." });
    }
  });

type MediaJobFormValues = z.input<typeof mediaJobFormSchema>;

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
  const createForm = useForm<MediaJobFormValues>({
    defaultValues: {
      recordId: "",
      operation: "",
      sourcePath: "",
      atSec: 0,
      watermarkEnabled: false,
      watermarkPath: "",
      watermarkPosition: "bottom-right",
      watermarkOpacity: 0.85,
      watermarkMargin: 24
    },
    shouldUnregister: false
  });
  const selectedOperation = createForm.watch("operation") as MediaOperation | "";
  const formErrors = createForm.formState.errors;

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

  const handleCreate = createForm.handleSubmit(async (values) => {
    createForm.clearErrors();
    const parsed = mediaJobFormSchema.safeParse(values);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field && typeof field === "string") {
          createForm.setError(field as keyof MediaJobFormValues, { type: "zod", message: issue.message });
        }
      });
      setCreateState({ status: "error", message: parsed.error.issues[0]?.message || "راجع حقول المهمة." });
      return;
    }

    const data = parsed.data;
    const operation = data.operation as MediaOperation;
    const options: Record<string, unknown> = {};

    if (operation === "thumbnail") {
      options.atSec = clampNumber(data.atSec, 0, 86400, 0);
    }

    if (operation === "transcode" && data.watermarkEnabled) {
      options.watermark = {
        enabled: true,
        path: data.watermarkPath,
        position: data.watermarkPosition,
        opacity: clampNumber(data.watermarkOpacity, 0, 1, 0.85),
        margin: Math.round(clampNumber(data.watermarkMargin, 0, 512, 24))
      };
    }

    setCreateState({ status: "creating" });
    const response = await api.createMediaJob({
      recordId: data.recordId,
      operation,
      ...(data.sourcePath ? { sourcePath: data.sourcePath } : {}),
      ...(Object.keys(options).length > 0 ? { options } : {})
    });

    if (!response.ok) {
      setCreateState({ status: "error", message: response.error });
      return;
    }

    setCreateState({ status: "success", job: response.job });
    setTimeout(() => {
      createForm.reset();
      setCreateState({ status: "idle" });
      void loadJobs();
    }, 1500);
  });

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
            <input type="text" placeholder="record-id" {...createForm.register("recordId")} />
            <FieldError>{formErrors.recordId?.message}</FieldError>
          </label>

          <label>
            نوع العملية
            <select
              {...createForm.register("operation")}
            >
              <option value="">اختر عملية...</option>
              {OPERATIONS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <FieldError>{formErrors.operation?.message}</FieldError>
          </label>

          <label>
            مسار الملف المصدر
            <input type="text" placeholder="media/source.mp4" {...createForm.register("sourcePath")} />
          </label>

          {selectedOperation === "thumbnail" && (
            <label>
              لقطة عند الثانية
              <input type="number" min="0" max="86400" {...createForm.register("atSec", { valueAsNumber: true })} />
              <FieldError>{formErrors.atSec?.message}</FieldError>
            </label>
          )}

          {selectedOperation === "transcode" && (
            <div className="state-banner">
              <div className="helper-row">
                <strong>إضافة علامة مائية</strong>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    {...createForm.register("watermarkEnabled")}
                  />
                  تفعيل
                </label>
              </div>

              <label>
                مسار صورة العلامة
                <input type="text" placeholder="branding/watermark.png" {...createForm.register("watermarkPath")} />
                <FieldError>{formErrors.watermarkPath?.message}</FieldError>
              </label>

              <div className="field-row">
                <label>
                  الموضع
                  <select {...createForm.register("watermarkPosition")}>
                    {WATERMARK_POSITIONS.map((position) => (
                      <option key={position.value} value={position.value}>
                        {position.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  الشفافية
                  <input type="number" min="0" max="1" step="0.05" {...createForm.register("watermarkOpacity", { valueAsNumber: true })} />
                  <FieldError>{formErrors.watermarkOpacity?.message}</FieldError>
                </label>
                <label>
                  الهامش
                  <input type="number" min="0" max="512" {...createForm.register("watermarkMargin", { valueAsNumber: true })} />
                  <FieldError>{formErrors.watermarkMargin?.message}</FieldError>
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
            <h2>مسح الإدخال</h2>
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
            <h2>قائمة مهام الوسائط</h2>
            <p className="field-note">فلترة مباشرة حسب الحالة مع إبقاء التفاصيل قابلة للمسح بسرعة.</p>
          </div>
          <label className="field-row field-row-reset">
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
                  <h3>{job.operation}</h3>
                  <span className="badge">{job.status}</span>
                </div>
                <div className="kv-grid">
                  <div className="kv-item">
                    <strong>معرّف السجل</strong>
                    <span>{job.recordId}</span>
                  </div>
                  <div className="kv-item">
                    <strong>المعرّف</strong>
                    <span className="wrap-anywhere">{job.id}</span>
                  </div>
                  {job.sourcePath && (
                    <div className="kv-item">
                      <strong>المصدر</strong>
                      <span className="wrap-anywhere">{job.sourcePath}</span>
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
                  <details className="section-divider">
                    <summary className="field-note">خيارات المهمة</summary>
                    <pre className="token-preview">{JSON.stringify(job.options, null, 2)}</pre>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
