"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, FileOutput, FileStack, Loader2, RefreshCw, Workflow } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { createArchiveApiClient, deriveRecordSourcePath, type ArchiveRecord, type MediaJobStatus, type MediaOperation } from "@/lib/archive-api";
import { buildMediaDerivativeTree, type MediaDerivativeArtifact, type MediaDerivativeJob, type MediaDerivativeTree } from "@/lib/media-derivatives";

type DerivativesState =
  | { status: "loading" }
  | { status: "ready"; tree: MediaDerivativeTree }
  | { status: "error"; message: string };

function operationLabel(operation: MediaOperation): string {
  const labels: Record<MediaOperation, string> = {
    thumbnail: "صورة مصغرة",
    transcode: "تحويل صيغة",
    transcription: "تفريغ نصي",
    ocr: "استخراج نص OCR",
    montage_export: "تصدير مونتاج"
  };

  return labels[operation];
}

function statusLabel(status: MediaJobStatus): string {
  const labels: Record<MediaJobStatus, string> = {
    queued: "قيد الانتظار",
    processing: "قيد المعالجة",
    completed: "مكتمل",
    failed: "فشل",
    canceled: "ملغى"
  };

  return labels[status];
}

function formatSourceNote(job: MediaDerivativeJob, originalSourcePath: string | null): string {
  if (!job.sourcePath) return "لا يوجد مسار مصدر مسجل";
  if (originalSourcePath && job.sourcePath === originalSourcePath) return "مشتق من المادة الأصلية";
  return "المصدر: ".concat(job.sourcePath);
}

function ArtifactTreeItem({ artifact, originalSourcePath }: Readonly<{ artifact: MediaDerivativeArtifact; originalSourcePath: string | null }>) {
  return (
    <li className="derivative-tree__artifact">
      <div className="derivative-tree__artifact-card">
        <FileOutput size={16} aria-hidden="true" />
        <span>
          <strong>{artifact.kind}</strong>
          <code dir="ltr">{artifact.key}</code>
        </span>
        {artifact.url ? <span className="badge">رابط متاح</span> : null}
      </div>
      {artifact.children.length ? (
        <ol className="derivative-tree__children" aria-label={`مشتقات ${artifact.key}`}>
          {artifact.children.map((job) => <JobTreeItem key={job.id} job={job} originalSourcePath={originalSourcePath} />)}
        </ol>
      ) : null}
    </li>
  );
}

function JobTreeItem({ job, originalSourcePath }: Readonly<{ job: MediaDerivativeJob; originalSourcePath: string | null }>) {
  return (
    <li className="derivative-tree__job" data-status={job.status}>
      <details open>
        <summary>
          <Workflow size={17} aria-hidden="true" />
          <span>
            <strong>{operationLabel(job.operation)}</strong>
            <small>{formatSourceNote(job, originalSourcePath)}</small>
          </span>
          <span className="badge">{statusLabel(job.status)}</span>
        </summary>
        <div className="derivative-tree__job-body">
          {job.queuedAt ? <time className="field-note">أضيفت {new Date(job.queuedAt).toLocaleString("ar-SA")}</time> : null}
          {job.error ? <p className="form-status status-error">فشلت المعالجة: {job.error}</p> : null}
          {job.artifacts.length ? (
            <ol className="derivative-tree__children" aria-label={`مخرجات ${operationLabel(job.operation)}`}>
              {job.artifacts.map((artifact) => <ArtifactTreeItem key={artifact.id} artifact={artifact} originalSourcePath={originalSourcePath} />)}
            </ol>
          ) : (
            <p className="field-note">لا توجد مخرجات محفوظة لهذه المهمة حتى الآن.</p>
          )}
        </div>
      </details>
    </li>
  );
}

export default function MediaDerivativesTree({ record }: Readonly<{ record: ArchiveRecord }>) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<DerivativesState>({ status: "loading" });
  const sourcePath = deriveRecordSourcePath(record)?.sourcePath ?? null;

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.mediaJobs({ recordId: record.id, limit: 100 });
    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({ status: "ready", tree: buildMediaDerivativeTree(record.id, sourcePath, response.jobs) });
  }, [api, record.id, sourcePath]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <article className="panel media-derivatives" aria-labelledby="media-derivatives-title">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2 id="media-derivatives-title">شجرة المشتقات</h2>
          <p className="helper-text">تتبع التحويلات ومخرجاتها من المادة الأصلية إلى أي مشتق لاحق.</p>
        </div>
        {state.status === "ready" ? <span className="badge">{state.tree.artifactCount} مخرج</span> : null}
      </div>

      {state.status === "loading" ? (
        <p className="form-status" role="status" aria-live="polite" aria-busy="true">
          <Loader2 className="status-refresh-icon is-spinning" size={16} aria-hidden="true" />
          جار تحميل مشتقات الوسائط...
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="form-status status-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>تعذر تحميل شجرة المشتقات: {state.message}</span>
          <button type="button" className="button button-secondary button-sm" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden="true" />
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {state.status === "ready" && state.tree.jobCount === 0 ? (
        <EmptyState
          icon={<FileStack size={22} />}
          title="لا توجد مشتقات مسجلة بعد"
          description="أنشئ مهمة وسائط لهذا السجل؛ ستظهر مخرجاتها هنا تلقائياً بعد حفظها من المعالجة."
        />
      ) : null}

      {state.status === "ready" && state.tree.jobCount > 0 ? (
        <ol className="derivative-tree" aria-label="شجرة مشتقات الوسائط">
          <li className="derivative-tree__root">
            <FileStack size={18} aria-hidden="true" />
            <span>
              <strong>المادة الأصلية</strong>
              <code dir="ltr">{state.tree.sourcePath || record.id}</code>
            </span>
          </li>
          <li>
            <ol className="derivative-tree__children" aria-label="تحويلات المادة الأصلية">
              {state.tree.jobs.map((job) => <JobTreeItem key={job.id} job={job} originalSourcePath={state.tree.sourcePath} />)}
            </ol>
          </li>
        </ol>
      ) : null}
    </article>
  );
}
