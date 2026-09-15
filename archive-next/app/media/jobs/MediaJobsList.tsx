"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, PlusCircle, RefreshCw, ScanSearch } from "lucide-react";
import { z } from "zod";
import MetricStrip from "@/components/MetricStrip";
import { ContextPanel } from "@/components/operations/ContextPanel";
import { StateNotice } from "@/components/operations/StateNotice";
import { FieldError } from "@/components/ui/Form";
import { createArchiveApiClient, mediaServiceOutage, type MediaJob, type MediaServiceOutage, type MediaJobStatus, type MediaOperation, type MediaProbeReport, type MediaQueueStatus, type PaginationMeta } from "@/lib/archive-api";
import { getEchoClient, onConnectionStateChange, type EchoConnectionState } from "@/lib/echo";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatBytes, formatDuration, mediaProbeReportFromJobResult } from "@/lib/media-probe";
import type { mediaJobs } from "@/lib/i18n/dictionaries/ar/pages/mediaJobs";
import styles from "./jobs.module.css";
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
  | { status: "error"; message: string; outage?: MediaServiceOutage };

type IngestState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; ingested: number; skipped: number }
  | { status: "error"; message: string };

type CancelState =
  | { status: "idle" }
  | { status: "canceling"; jobId: string }
  | { status: "error"; jobId: string; message: string };

type RetryState =
  | { status: "idle" }
  | { status: "retrying"; jobId: string }
  | { status: "error"; jobId: string; message: string };

/** V3-PERF-005: matches StudioTimelinePanel's poll-when-disconnected fallback cadence. */
const QUEUE_STATUS_POLL_INTERVAL_MS = 8000;

const OPERATIONS: readonly MediaOperation[] = ["media_probe", "media_qc", "thumbnail", "transcode", "transcription"];
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

      if (["media_probe", "media_qc"].includes(value.operation) && !value.sourcePath) {
        ctx.addIssue({ code: "custom", path: ["sourcePath"], message: copy.validation.sourcePathRequired });
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
    derivative: copy.operations.derivative,
    thumbnail: copy.operations.thumbnail,
    transcode: copy.operations.transcode,
    transcription: copy.operations.transcription,
    ocr: copy.operations.ocr,
    media_probe: copy.operations.mediaProbe,
    media_qc: copy.operations.mediaQc,
    montage_export: copy.operations.montageExport
  };

  return labels[operation] || operation;
}

function MediaProbeSummary({ report, locale, copy }: { report: MediaProbeReport; locale: string; copy: MediaJobsCopy }) {
  return (
    <ContextPanel title={copy.probe.contextTitle} description={copy.probe.ariaLabel}>
      <section className="state-banner" aria-label={copy.probe.ariaLabel}>
      <div className="helper-row">
        <strong>{copy.probe.title}</strong>
        <span className="badge">{report.formatNames.join(", ") || copy.probe.unknown}</span>
      </div>
      <div className="kv-grid">
        <div className="kv-item"><strong>{copy.probe.duration}</strong><span dir="ltr">{formatDuration(report.durationSeconds)}</span></div>
        <div className="kv-item"><strong>{copy.probe.size}</strong><span dir="ltr">{formatBytes(report.sizeBytes, locale)}</span></div>
        <div className="kv-item"><strong>{copy.probe.bitRate}</strong><span dir="ltr">{report.bitRate ? `${Math.round(report.bitRate / 1000).toLocaleString(locale)} kb/s` : "—"}</span></div>
        <div className="kv-item"><strong>{copy.probe.streamCount}</strong><span>{report.streams.length.toLocaleString(locale)}</span></div>
      </div>
      <details className="section-divider">
        <summary className="field-note">{copy.probe.streamDetails}</summary>
        <div className="stack">
          {report.streams.map((stream) => (
            <div className="kv-grid" key={stream.index}>
              <div className="kv-item"><strong>#{stream.index}</strong><span>{stream.type}</span></div>
              <div className="kv-item"><strong>{copy.probe.codec}</strong><span dir="ltr">{stream.codec}</span></div>
              {(stream.width || stream.height) && <div className="kv-item"><strong>{copy.probe.dimensions}</strong><span dir="ltr">{stream.width ?? "?"} × {stream.height ?? "?"}</span></div>}
              {stream.language && <div className="kv-item"><strong>{copy.probe.language}</strong><span>{stream.language}</span></div>}
            </div>
          ))}
        </div>
      </details>
      </section>
    </ContextPanel>
  );
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
  const { locale, t } = useLocale();
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
  const [retryState, setRetryState] = useState<RetryState>({ status: "idle" });
  const [ingestState, setIngestState] = useState<IngestState>({ status: "idle" });
  const [cancelState, setCancelState] = useState<CancelState>({ status: "idle" });
  const [statusFilter, setStatusFilter] = useState<MediaJobStatus | "">("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [connectionState, setConnectionState] = useState<EchoConnectionState | null>(() => getEchoClient() ? null : "unavailable");
  const [queueStatus, setQueueStatus] = useState<MediaQueueStatus | null>(null);
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
  const showReconnectBanner = connectionState === "unavailable" || connectionState === "failed" || connectionState === "disconnected";
  const jobs = listState.status === "loaded" ? listState.jobs : [];
  const queuedCount = jobs.filter((job) => job.status === "queued").length;
  const processingCount = jobs.filter((job) => job.status === "processing").length;
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;

  const handleCancel = async (job: MediaJob) => {
    setCancelState({ status: "canceling", jobId: job.id });
    const response = await api.cancelMediaJob(job.id);

    if (!response.ok) {
      setCancelState({ status: "error", jobId: job.id, message: response.error });
      return;
    }

    applyJobUpdate(response.job);
    setCancelState({ status: "idle" });
  };

  const loadJobs = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setListState({ status: "loading" });
    }
    const response = await api.mediaJobs({
      limit: 20,
      page: 1,
      status: statusFilter || undefined
    });

    if (!response.ok) {
      if (!options?.silent) {
        setListState({ status: "error", message: response.error });
      }
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

  const activeJobIds = useMemo(
    () => jobs.filter((job) => job.status === "queued" || job.status === "processing").map((job) => job.id),
    [jobs]
  );

  const applyJobUpdate = useCallback((updated: MediaJob) => {
    setListState((current) =>
      current.status === "loaded"
        ? { ...current, jobs: current.jobs.map((job) => (job.id === updated.id ? updated : job)) }
        : current
    );
  }, []);

  // RT-801: subscribe to each active job's private channel for live progress.
  // getEchoClient() returns null when Reverb isn't configured, so this is a
  // no-op there — the polling fallback below still covers that case.
  useEffect(() => {
    const echo = getEchoClient();
    if (!echo || activeJobIds.length === 0) return;

    const channelNames = activeJobIds.map((id) => `media-job.${id}`);
    channelNames.forEach((channelName) => {
      echo.private(channelName).listen(".media-job.updated", (event: { job: MediaJob }) => {
        applyJobUpdate(event.job);
      });
    });

    return () => {
      channelNames.forEach((channelName) => echo.leave(channelName));
    };
  }, [activeJobIds, applyJobUpdate]);

  // RT-803: safe fallback while jobs are active, regardless of socket state —
  // reconciles any missed push and covers environments without Reverb.
  useEffect(() => {
    if (activeJobIds.length === 0) return;

    const interval = setInterval(() => {
      void loadJobs({ silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [activeJobIds.length, loadJobs]);

  // RT-803: explicit reconnect visibility — the polling fallback above
  // already keeps data fresh, this just tells the user why live updates
  // paused instead of leaving it silent.
  useEffect(() => {
    if (activeJobIds.length === 0) {
      setConnectionState(getEchoClient() ? null : "unavailable");
      return;
    }

    if (!getEchoClient()) {
      setConnectionState("unavailable");
      return;
    }

    return onConnectionStateChange(setConnectionState);
  }, [activeJobIds.length]);

  // RT-802 aggregate CPU/GPU queue depth, kept fresh via realtime broadcast
  // with a poll-when-disconnected fallback (V3-PERF-005; same idea as
  // StudioTimelinePanel's comment feed and MediaJobsList's own job-list
  // fallback above): fetch once on mount, then either poll on a fixed
  // interval (no Reverb configured) or subscribe and only poll while the
  // socket is down, reconciling with a full refetch on reconnect.
  const fetchQueueStatus = useCallback(async () => {
    const response = await api.mediaJobQueueStatus();
    if (response.ok) setQueueStatus(response.status);
  }, [api]);

  useEffect(() => {
    void fetchQueueStatus();
  }, [fetchQueueStatus]);

  useEffect(() => {
    const echo = getEchoClient();
    if (!echo) {
      const interval = setInterval(() => void fetchQueueStatus(), QUEUE_STATUS_POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }

    const channelName = "media-queue-status";
    const channel = echo.private(channelName);
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => void fetchQueueStatus(), QUEUE_STATUS_POLL_INTERVAL_MS);
    };

    channel.listen(".media-queue.updated", (event: { status: MediaQueueStatus }) => {
      setQueueStatus(event.status);
    });

    const unbindConnectionState = onConnectionStateChange((connectionState) => {
      if (connectionState === "connected") {
        stopPolling();
        void fetchQueueStatus();
      } else {
        startPolling();
      }
    });

    return () => {
      unbindConnectionState();
      stopPolling();
      echo.leave(channelName);
    };
  }, [fetchQueueStatus]);

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
      // A refusal for an unavailable service names what to fix; the generic
      // message alone would send the operator back to re-queue into the same
      // wall.
      const outage = mediaServiceOutage(response);
      setCreateState({ status: "error", message: response.error, ...(outage && { outage }) });
      return;
    }

    setCreateState({ status: "success", job: response.job });
    setTimeout(() => {
      createForm.reset();
      setCreateState({ status: "idle" });
      void loadJobs();
    }, 1500);
  });

  async function handleRetry(jobId: string) {
    setRetryState({ status: "retrying", jobId });
    const response = await api.retryMediaJob(jobId);

    if (!response.ok) {
      // Includes the service refusal: retrying into a service that is still
      // down has to say so rather than look like a queue hiccup.
      const outage = mediaServiceOutage(response);
      setRetryState({
        status: "error",
        jobId,
        message: outage ? `${copy.create.serviceUnavailableTitle} (${outage.service})` : response.error,
      });
      return;
    }

    setRetryState({ status: "idle" });
    void loadJobs();
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

      {queueStatus && (
        <div className="state-banner" aria-label={copy.queueStatus.ariaLabel}>
          <div className="helper-row">
            <span className="field-note">{copy.queueStatus.defaultQueueLabel}: {queueStatus.default}</span>
            <span className="field-note">{copy.queueStatus.gpuQueueLabel}: {queueStatus.gpu}</span>
            <span className="field-note">
              {copy.queueStatus.deviceLabel}: {queueStatus.device === "cuda" ? copy.queueStatus.deviceCuda : copy.queueStatus.deviceCpu}
            </span>
          </div>
          {queueStatus.resourceFailure && (
            <p className="form-status status-error" role="alert">
              {copy.queueStatus.resourceFailure.replace("{error}", queueStatus.resourceFailure)}
            </p>
          )}
        </div>
      )}

      {failedCount > 0 && (
        <StateNotice
          state="conflict"
          title={copy.workflow.partialFailureTitle}
          description={copy.workflow.partialFailureDescription}
        />
      )}

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
            <FieldError>{formErrors.sourcePath?.message}</FieldError>
          </label>

          {selectedOperation === "media_probe" && <p className="field-note">{copy.create.mediaProbeHint}</p>}
          {selectedOperation === "media_qc" && <p className="field-note">{copy.create.mediaQcHint}</p>}

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

          {createState.status === "error" && createState.outage ? (
            <div className="state-banner state-banner-error" role="alert" data-service={createState.outage.service}>
              <strong>{copy.create.serviceUnavailableTitle}</strong>
              <span className="helper-text">
                {copy.create.serviceUnavailableBody
                  .replace("{service}", createState.outage.service)
                  .replace("{state}", createState.outage.serviceState === "down" ? copy.create.serviceDown : copy.create.serviceRequiresSetup)
                  .replace("{reason}", createState.outage.reason ?? "")}
              </span>
            </div>
          ) : null}
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

        {showReconnectBanner && (
          <StateNotice
            state="offline"
            title={copy.workflow.realtimeUnavailable}
            description={copy.workflow.realtimeUnavailableDescription}
          />
        )}
        {listState.status === "loading" && (
          <StateNotice state="loading" title={copy.list.loading} />
        )}
        {listState.status === "empty" && (
          <StateNotice
            state="empty"
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
          <StateNotice
            state="error"
            title={copy.list.loadError.replace("{error}", listState.message)}
            actions={(
              <button className="button button-secondary button-sm" type="button" onClick={() => void loadJobs()}>
                {copy.list.retry}
              </button>
            )}
          />
        )}

        {listState.status === "loaded" && (
          <div className="stack">
            {listState.jobs.map((job) => {
              const probeReport = mediaProbeReportFromJobResult(job.result);
              const isActive = job.status === "queued" || job.status === "processing";
              const processingState = job.status === "completed"
                ? "complete"
                : job.status === "failed" || job.status === "canceled"
                  ? "blocked"
                  : "current";
              const reviewState = job.status === "completed" ? "current" : "pending";
              return (
              <article className="media-job-card" data-status={job.status} key={job.id}>
                <div className="toolbar-row">
                  <h3>{operationLabel(job.operation, copy)}</h3>
                  <span className="badge">{statusLabel(job.status, copy)}</span>
                </div>
                <ol className={styles.workflowStageList} aria-label={copy.workflow.ariaLabel}>
                  <li data-state={job.sourcePath ? "complete" : "pending"}>
                    <strong>{copy.workflow.source}</strong>
                    <span>{job.sourcePath || copy.workflow.sourceMissing}</span>
                  </li>
                  <li data-state="complete">
                    <strong>{copy.workflow.record}</strong>
                    <span>{copy.workflow.recordLinked}</span>
                  </li>
                  <li data-state={processingState} aria-current={processingState === "current" ? "step" : undefined}>
                    <strong>{copy.workflow.processing}</strong>
                    <span>{statusLabel(job.status, copy)}</span>
                  </li>
                  <li data-state={reviewState} aria-current={reviewState === "current" ? "step" : undefined}>
                    <strong>{copy.workflow.review}</strong>
                    <span>{job.status === "completed" ? copy.metrics.readyForReview : copy.list.processingFallback}</span>
                  </li>
                </ol>
                {isActive && job.progressPercent !== null && (
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
                      style={{ width: "100%", height: "4px", backgroundColor: "var(--color-border-secondary)", borderRadius: "2px", overflow: "hidden" }}
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
                      <time>{new Date(job.queuedAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")}</time>
                    </div>
                  )}
                </div>
                {job.options && Object.keys(job.options).length > 0 && (
                  <details className="section-divider">
                    <summary className="field-note">{copy.list.optionsLabel}</summary>
                    <pre className="token-preview">{JSON.stringify(job.options, null, 2)}</pre>
                  </details>
                )}
                {job.status === "failed" && (
                  <div className="state-banner state-banner-error" role="alert">
                    <strong>{copy.workflow.failureLabel}</strong>
                    <span className="helper-text">{job.error || copy.workflow.partialFailureDescription}</span>
                    <div className="helper-row">
                      <strong>{copy.workflow.retryGuidance}</strong>
                      <span className="helper-text">{copy.workflow.retryGuidanceDescription}</span>
                    </div>
                  </div>
                )}
                {probeReport && <MediaProbeSummary report={probeReport} locale={locale === "en" ? "en-US" : "ar-SA"} copy={copy} />}
                <div className="button-row" role="group" aria-label={copy.workflow.ariaLabel}>
                  <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(job.recordId)}`}>
                    {copy.workflow.recordLink}
                  </a>
                  <a className="button button-secondary button-sm" href={`/media/studio?recordId=${encodeURIComponent(job.recordId)}`}>
                    {copy.workflow.reviewLink}
                  </a>
                  {isActive && (
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      onClick={() => void handleCancel(job)}
                      disabled={cancelState.status === "canceling" && cancelState.jobId === job.id}
                    >
                      {cancelState.status === "canceling" && cancelState.jobId === job.id ? copy.workflow.canceling : copy.workflow.cancel}
                    </button>
                  )}
                </div>
                {cancelState.status === "error" && cancelState.jobId === job.id && (
                  <p className="form-status status-error" role="alert">
                    {copy.workflow.cancelError.replace("{error}", cancelState.message)}
                  </p>
                )}
              </article>
              );
            })}
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
