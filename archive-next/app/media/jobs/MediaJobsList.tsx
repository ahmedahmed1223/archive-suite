"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { AlertTriangle, CheckCircle2, Clock3, FileScan, Loader2, PlusCircle, RefreshCw, ScanSearch } from "lucide-react";
import { z } from "zod";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import { FieldError } from "@/components/ui/Form";
import { createArchiveApiClient, type MediaJob, type MediaJobStatus, type MediaOperation, type PaginationMeta } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { mediaJobs } from "@/lib/i18n/dictionaries/ar/pages/mediaJobs";
import "../media.css";

type LocalizedStrings<T> = {
  [Key in keyof T]: T[Key] extends object ? LocalizedStrings<T[Key]> : string;
};

type MediaJobsCopy = LocalizedStrings<typeof mediaJobs>;

type ListState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "loaded"; jobs: MediaJob[]; pagination?: PaginationMeta }
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
function createMediaJobFormSchema(copy: MediaJobsCopy) {
  return z
    .object({
      recordId: z.string().trim().min(1, copy.validation.recordIdRequired),
      operation: z.string().trim().min(1, copy.validation.operationRequired),
      sourcePath: z.string().trim().optional().transform((value) => value || undefined),
      atSec: z.coerce.number().min(0, copy.validation.atSecMinimum).max(86400, copy.validation.atSecMaximum).default(0),
      formatSrt: z.boolean().optional().default(true),
      formatVtt: z.boolean().optional().default(true),
      formatTtml: z.boolean().optional().default(true),
      watermarkEnabled: z.boolean().optional().default(false),
      watermarkPath: z.string().trim().optional().transform((value) => value || undefined),
      watermarkPosition: z.string().default("bottom-right"),
      watermarkOpacity: z.coerce.number().min(0, copy.validation.opacityRange).max(1, copy.validation.opacityRange).default(0.85),
      watermarkMargin: z.coerce.number().min(0, copy.validation.marginMinimum).max(512, copy.validation.marginMaximum).default(24)
    })
    .superRefine((value, ctx) => {
      if (!(OPERATIONS as readonly string[]).includes(value.operation)) {
        ctx.addIssue({ code: "custom", path: ["operation"], message: copy.validation.operationUnsupported });
      }

      if (value.operation === "transcode" && value.watermarkEnabled && !value.watermarkPath) {
        ctx.addIssue({ code: "custom", path: ["watermarkPath"], message: copy.validation.watermarkPathRequired });
      }
    });
}

type MediaJobFormValues = z.input<ReturnType<typeof createMediaJobFormSchema>>;

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function operationLabel(operation: MediaOperation, copy: MediaJobsCopy) {
  const labels: Record<MediaOperation, string> = {
    thumbnail: copy.operations.thumbnail,
    transcode: copy.operations.transcode,
    transcription: copy.operations.transcription,
    ocr: copy.operations.ocr,
    montage_export: copy.operations.montageExport
  };

  return labels[operation] || operation;
}

function statusLabel(status: MediaJobStatus, copy: MediaJobsCopy) {
  const labels: Record<MediaJobStatus, string> = {
    queued: copy.statuses.queued,
    processing: copy.statuses.processing,
    completed: copy.statuses.completed,
    failed: copy.statuses.failed,
    canceled: copy.statuses.canceled
  };

  return labels[status] || status;
}

function progressValue(value: number | null | undefined) {
  return Math.min(100, Math.max(0, value ?? 0));
}

export function MediaJobsList() {
  const { t } = useLocale();
  const copy = t.pages.mediaJobs;
  const api = useMemo(() => createArchiveApiClient(), []);
  const mediaJobFormSchema = useMemo(() => createMediaJobFormSchema(copy), [copy]);
  const watermarkPositions = [
    { value: "bottom-right", label: copy.positions.bottomRight },
    { value: "bottom-left", label: copy.positions.bottomLeft },
    { value: "top-right", label: copy.positions.topRight },
    { value: "top-left", label: copy.positions.topLeft },
    { value: "center", label: copy.positions.center }
  ] as const;
  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [createState, setCreateState] = useState<CreateState>({ status: "idle" });
  const [ingestState, setIngestState] = useState<IngestState>({ status: "idle" });
  const [statusFilter, setStatusFilter] = useState<MediaJobStatus | "">("");
  const [loadingMore, setLoadingMore] = useState(false);
  const createForm = useForm<MediaJobFormValues>({
    defaultValues: {
      recordId: "",
      operation: "",
      sourcePath: "",
      atSec: 0,
      formatSrt: true,
      formatVtt: true,
      formatTtml: true,
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
  const jobs = listState.status === "loaded" ? listState.jobs : [];
  const queuedCount = jobs.filter((job) => job.status === "queued").length;
  const processingCount = jobs.filter((job) => job.status === "processing").length;
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;

  const loadJobs = useCallback(async () => {
    setListState({ status: "loading" });
    const response = await api.mediaJobs({
      limit: 20,
      page: 1,
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

    setListState({ status: "loaded", jobs: response.jobs, pagination: response.pagination });
  }, [api, statusFilter]);

  const loadMoreJobs = useCallback(async () => {
    if (listState.status !== "loaded" || !listState.pagination?.hasMore || loadingMore) return;
    setLoadingMore(true);
    const response = await api.mediaJobs({
      limit: 20,
      page: listState.pagination.page + 1,
      status: statusFilter || undefined
    });
    setLoadingMore(false);

    if (!response.ok) return;

    setListState((current) => (current.status === "loaded"
      ? { status: "loaded", jobs: [...current.jobs, ...response.jobs], pagination: response.pagination }
      : current));
  }, [api, listState, loadingMore, statusFilter]);

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
      setCreateState({ status: "error", message: parsed.error.issues[0]?.message || copy.validation.reviewFields });
      return;
    }

    const data = parsed.data;
    const operation = data.operation as MediaOperation;
    const options: Record<string, unknown> = {};

    if (operation === "thumbnail") {
      options.atSec = clampNumber(data.atSec, 0, 86400, 0);
    }

    if (operation === "transcription") {
      const formats: string[] = [];
      if (data.formatSrt) formats.push("srt");
      if (data.formatVtt) formats.push("vtt");
      if (data.formatTtml) formats.push("ttml");
      if (formats.length > 0) {
        options.outputFormats = formats;
      }
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
    <div className="stack" aria-label={copy.list.ariaLabel}>
      <MetricStrip
        ariaLabel={copy.metrics.ariaLabel}
        items={[
          {
            label: copy.metrics.displayedLabel,
            value: listState.status === "loading" ? "..." : jobs.length,
            description: statusFilter
              ? copy.metrics.filtered.replace("{status}", statusLabel(statusFilter, copy))
              : listState.status === "loaded" && listState.pagination
                ? copy.metrics.total.replace("{count}", String(listState.pagination.total))
                : copy.metrics.latest,
            icon: <Clock3 size={20} />,
            tone: "accent"
          },
          {
            label: copy.metrics.processingLabel,
            value: processingCount,
            description: copy.metrics.queued.replace("{count}", String(queuedCount)),
            icon: <Loader2 size={20} />,
            tone: processingCount > 0 ? "warning" : "default"
          },
          {
            label: copy.metrics.completedLabel,
            value: completedCount,
            description: copy.metrics.readyForReview,
            icon: <CheckCircle2 size={20} />,
            tone: "success"
          },
          {
            label: copy.metrics.failedLabel,
            value: failedCount,
            description: copy.metrics.needsReview,
            icon: <AlertTriangle size={20} />,
            tone: failedCount > 0 ? "danger" : "default"
          }
        ]}
      />

      <article className="workspace-panel">
        <div className="workspace-panel__header">
          <div>
            <h2>{copy.create.title}</h2>
            <p className="field-note">{copy.create.description}</p>
          </div>
          <span className="badge">{copy.create.badge}</span>
        </div>

        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            {copy.create.recordIdLabel}
            <input type="text" placeholder={copy.create.recordIdPlaceholder} {...createForm.register("recordId")} />
            <FieldError>{formErrors.recordId?.message}</FieldError>
          </label>

          <label>
            {copy.create.operationLabel}
            <select
              {...createForm.register("operation")}
            >
              <option value="">{copy.create.operationPlaceholder}</option>
              {OPERATIONS.map((op) => (
                <option key={op} value={op}>
                    {operationLabel(op, copy)}
                </option>
              ))}
            </select>
            <FieldError>{formErrors.operation?.message}</FieldError>
          </label>

          <label>
            {copy.create.sourcePathLabel}
            <input type="text" placeholder={copy.create.sourcePathPlaceholder} {...createForm.register("sourcePath")} />
          </label>

          {selectedOperation === "transcription" && (
            <div className="state-banner">
              <p className="helper-text">{copy.create.whisperHint}</p>

              <div className="helper-row">
                <strong>{copy.create.outputFormats}</strong>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" {...createForm.register("formatSrt")} />
                {copy.create.srtOption}
              </label>
              <label className="checkbox-row">
                <input type="checkbox" {...createForm.register("formatVtt")} />
                {copy.create.vttOption}
              </label>
              <label className="checkbox-row">
                <input type="checkbox" {...createForm.register("formatTtml")} />
                {copy.create.ttmlOption}
              </label>
            </div>
          )}

          {selectedOperation === "thumbnail" && (
            <label>
              {copy.create.thumbnailAtSecond}
              <input type="number" min="0" max="86400" {...createForm.register("atSec", { valueAsNumber: true })} />
              <FieldError>{formErrors.atSec?.message}</FieldError>
            </label>
          )}

          {selectedOperation === "transcode" && (
            <div className="state-banner">
              <div className="helper-row">
                <strong>{copy.create.watermarkTitle}</strong>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    {...createForm.register("watermarkEnabled")}
                  />
                  {copy.create.watermarkEnabled}
                </label>
              </div>

              <label>
                {copy.create.watermarkPathLabel}
                <input type="text" placeholder={copy.create.watermarkPathPlaceholder} {...createForm.register("watermarkPath")} />
                <FieldError>{formErrors.watermarkPath?.message}</FieldError>
              </label>

              <div className="field-row">
                <label>
                  {copy.create.watermarkPositionLabel}
                  <select {...createForm.register("watermarkPosition")}>
                    {watermarkPositions.map((position) => (
                      <option key={position.value} value={position.value}>
                        {position.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {copy.create.watermarkOpacityLabel}
                  <input type="number" min="0" max="1" step="0.05" {...createForm.register("watermarkOpacity", { valueAsNumber: true })} />
                  <FieldError>{formErrors.watermarkOpacity?.message}</FieldError>
                </label>
                <label>
                  {copy.create.watermarkMarginLabel}
                  <input type="number" min="0" max="512" {...createForm.register("watermarkMargin", { valueAsNumber: true })} />
                  <FieldError>{formErrors.watermarkMargin?.message}</FieldError>
                </label>
              </div>
            </div>
          )}

          <button type="submit" className="button button-primary" disabled={createState.status === "creating"}>
            <PlusCircle size={16} aria-hidden="true" />
            {createState.status === "creating" ? copy.create.creating : copy.create.submit}
          </button>

          <p className="form-status" role={createState.status === "error" ? "alert" : "status"}>
            {createState.status === "success"
              ? copy.create.success.replace("{status}", statusLabel(createState.job.status, copy))
              : createState.status === "error"
                ? createState.message
                : ""}
          </p>
        </form>
      </article>

      <article className="workspace-panel">
        <div className="workspace-panel__header">
          <div>
            <h2>{copy.ingest.title}</h2>
            <p className="field-note">{copy.ingest.description}</p>
          </div>
          <span className="badge">{copy.ingest.badge}</span>
        </div>

        <button className="button button-primary" onClick={handleIngestScan} disabled={ingestState.status === "scanning"}>
          <ScanSearch size={16} aria-hidden="true" />
          {ingestState.status === "scanning" ? copy.ingest.scanning : copy.ingest.scan}
        </button>
        <p className="form-status" role={ingestState.status === "error" ? "alert" : "status"}>
          {ingestState.status === "done"
            ? copy.ingest.success.replace("{ingested}", String(ingestState.ingested)).replace("{skipped}", String(ingestState.skipped))
            : ingestState.status === "error"
              ? ingestState.message
              : ""}
        </p>
      </article>

      <section className="workspace-panel" aria-label={copy.list.ariaLabel}>
        <div className="workspace-panel__header">
          <div>
            <h2>{copy.list.title}</h2>
            <p className="field-note">{copy.list.description}</p>
          </div>
          <div className="button-row">
            <label className="field-row field-row-reset">
              <span className="field-note">{copy.list.statusLabel}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as MediaJobStatus | "")}
              >
                <option value="">{copy.list.allStatuses}</option>
                <option value="queued">{copy.statuses.queued}</option>
                <option value="processing">{copy.statuses.processing}</option>
                <option value="completed">{copy.statuses.completed}</option>
                <option value="failed">{copy.statuses.failed}</option>
              </select>
            </label>
            <button className="button button-secondary button-sm" type="button" onClick={() => void loadJobs()}>
              <RefreshCw size={16} aria-hidden="true" />
              {copy.list.refresh}
            </button>
          </div>
        </div>

        {listState.status === "loading" && (
          <p className="form-status" role="status" aria-live="polite" aria-busy="true">
            <Loader2 className="status-refresh-icon is-spinning" size={16} aria-hidden="true" />
            {copy.list.loading}
          </p>
        )}
        {listState.status === "empty" && (
          <EmptyState
            icon={<FileScan size={22} />}
            title={statusFilter ? copy.list.emptyFiltered.replace("{status}", statusLabel(statusFilter, copy)) : copy.list.empty}
            description={statusFilter ? copy.list.emptyFilteredDescription : copy.list.emptyDescription}
            actions={statusFilter ? (
              <button className="button button-secondary button-sm" type="button" onClick={() => setStatusFilter("")}>
                {copy.list.showAll}
              </button>
            ) : undefined}
          />
        )}
        {listState.status === "error" && (
          <div role="alert" className="form-status status-error">
            <span>{copy.list.loadError.replace("{error}", listState.message)}</span>
            <button className="button button-secondary button-sm" type="button" onClick={() => void loadJobs()}>
              {copy.list.retry}
            </button>
          </div>
        )}

        {listState.status === "loaded" && (
          <div className="stack">
            {listState.jobs.map((job) => (
              <article className="media-job-card" data-status={job.status} key={job.id}>
                <div className="toolbar-row">
                  <h3>{operationLabel(job.operation, copy)}</h3>
                  <span className="badge">{statusLabel(job.status, copy)}</span>
                </div>
                {(job.status === "queued" || job.status === "processing") && job.progressPercent !== null && (
                  <div className="state-banner">
                    <div className="helper-row">
                      <span className="field-note">{job.progressStage || copy.list.processingFallback}</span>
                      <span className="field-note">{progressValue(job.progressPercent)}%</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={copy.list.progressAriaLabel}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progressValue(job.progressPercent)}
                      style={{ width: "100%", height: "4px", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: "2px", overflow: "hidden" }}
                    >
                      <div style={{ width: `${progressValue(job.progressPercent)}%`, height: "100%", backgroundColor: "currentColor", transition: "width 0.2s" }} />
                    </div>
                  </div>
                )}
                <div className="kv-grid">
                  <div className="kv-item">
                    <strong>{copy.list.recordIdLabel}</strong>
                    <span>{job.recordId}</span>
                  </div>
                  <div className="kv-item">
                    <strong>{copy.list.idLabel}</strong>
                    <span className="wrap-anywhere">{job.id}</span>
                  </div>
                  {job.sourcePath && (
                    <div className="kv-item">
                      <strong>{copy.list.sourceLabel}</strong>
                      <span className="wrap-anywhere">{job.sourcePath}</span>
                    </div>
                  )}
                  {job.queuedAt && (
                    <div className="kv-item">
                      <strong>{copy.list.queuedAtLabel}</strong>
                      <time>{new Date(job.queuedAt).toLocaleString("ar-SA")}</time>
                    </div>
                  )}
                </div>
                {job.options && Object.keys(job.options).length > 0 && (
                  <details className="section-divider">
                    <summary className="field-note">{copy.list.optionsLabel}</summary>
                    <pre className="token-preview">{JSON.stringify(job.options, null, 2)}</pre>
                  </details>
                )}
              </article>
            ))}
            {listState.pagination?.hasMore ? (
              <div className="button-row" style={{ justifyContent: "center" }}>
                <button type="button" className="button button-secondary" onClick={() => void loadMoreJobs()} disabled={loadingMore}>
                  {loadingMore ? copy.list.loadingMore : copy.list.loadMore}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
