"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, FileOutput, FileStack, Loader2, RefreshCw, Workflow } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { createArchiveApiClient, deriveRecordSourcePath, type ArchiveRecord, type MediaJobStatus, type MediaOperation } from "@/lib/archive-api";
import { buildMediaDerivativeTree, type MediaDerivativeArtifact, type MediaDerivativeJob, type MediaDerivativeTree } from "@/lib/media-derivatives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppDictionary } from "@/lib/i18n/dictionaries";

type DerivativesCopy = AppDictionary["pages"]["mediaDerivativesTree"];

type DerivativesState =
  | { status: "loading" }
  | { status: "ready"; tree: MediaDerivativeTree }
  | { status: "error"; message: string };

function operationLabel(operation: MediaOperation, copy: DerivativesCopy): string {
  const labels: Record<MediaOperation, string> = {
    thumbnail: copy.operationThumbnail,
    transcode: copy.operationTranscode,
    transcription: copy.operationTranscription,
    ocr: copy.operationOcr,
    montage_export: copy.operationMontageExport
  };

  return labels[operation];
}

function statusLabel(status: MediaJobStatus, copy: DerivativesCopy): string {
  const labels: Record<MediaJobStatus, string> = {
    queued: copy.statusQueued,
    processing: copy.statusProcessing,
    completed: copy.statusCompleted,
    failed: copy.statusFailed,
    canceled: copy.statusCanceled
  };

  return labels[status];
}

function formatSourceNote(job: MediaDerivativeJob, originalSourcePath: string | null, copy: DerivativesCopy): string {
  if (!job.sourcePath) return copy.noSourcePath;
  if (originalSourcePath && job.sourcePath === originalSourcePath) return copy.derivedFromOriginal;
  return copy.sourceNote.replace("{path}", job.sourcePath);
}

function ArtifactTreeItem({
  artifact,
  originalSourcePath,
  copy
}: Readonly<{ artifact: MediaDerivativeArtifact; originalSourcePath: string | null; copy: DerivativesCopy }>) {
  return (
    <li className="derivative-tree__artifact">
      <div className="derivative-tree__artifact-card">
        <FileOutput size={16} aria-hidden="true" />
        <span>
          <strong>{artifact.kind}</strong>
          <code dir="ltr">{artifact.key}</code>
        </span>
        {artifact.url ? <span className="badge">{copy.linkAvailableBadge}</span> : null}
      </div>
      {artifact.children.length ? (
        <ol className="derivative-tree__children" aria-label={copy.artifactChildrenAriaLabel.replace("{key}", artifact.key)}>
          {artifact.children.map((job) => <JobTreeItem key={job.id} job={job} originalSourcePath={originalSourcePath} copy={copy} />)}
        </ol>
      ) : null}
    </li>
  );
}

function JobTreeItem({
  job,
  originalSourcePath,
  copy
}: Readonly<{ job: MediaDerivativeJob; originalSourcePath: string | null; copy: DerivativesCopy }>) {
  const { locale } = useLocale();
  return (
    <li className="derivative-tree__job" data-status={job.status}>
      <details open>
        <summary>
          <Workflow size={17} aria-hidden="true" />
          <span>
            <strong>{operationLabel(job.operation, copy)}</strong>
            <small>{formatSourceNote(job, originalSourcePath, copy)}</small>
          </span>
          <span className="badge">{statusLabel(job.status, copy)}</span>
        </summary>
        <div className="derivative-tree__job-body">
          {job.queuedAt ? (
            <time className="field-note">
              {copy.queuedAtNote.replace("{date}", new Date(job.queuedAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA"))}
            </time>
          ) : null}
          {job.error ? <p className="form-status status-error">{copy.processingFailedNote.replace("{error}", job.error)}</p> : null}
          {job.artifacts.length ? (
            <ol className="derivative-tree__children" aria-label={copy.jobOutputsAriaLabel.replace("{operation}", operationLabel(job.operation, copy))}>
              {job.artifacts.map((artifact) => (
                <ArtifactTreeItem key={artifact.id} artifact={artifact} originalSourcePath={originalSourcePath} copy={copy} />
              ))}
            </ol>
          ) : (
            <p className="field-note">{copy.noArtifactsSaved}</p>
          )}
        </div>
      </details>
    </li>
  );
}

export default function MediaDerivativesTree({ record }: Readonly<{ record: ArchiveRecord }>) {
  const { t } = useLocale();
  const copy = t.pages.mediaDerivativesTree;
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
          <h2 id="media-derivatives-title">{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        {state.status === "ready" ? (
          <span className="badge">{copy.artifactCountBadge.replace("{count}", String(state.tree.artifactCount))}</span>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <p className="form-status" role="status" aria-live="polite" aria-busy="true">
          <Loader2 className="status-refresh-icon is-spinning" size={16} aria-hidden="true" />
          {copy.loadingText}
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="form-status status-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{copy.loadErrorPrefix.replace("{message}", state.message)}</span>
          <button type="button" className="button button-secondary button-sm" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden="true" />
            {copy.retryButton}
          </button>
        </div>
      ) : null}

      {state.status === "ready" && state.tree.jobCount === 0 ? (
        <EmptyState icon={<FileStack size={22} />} title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : null}

      {state.status === "ready" && state.tree.jobCount > 0 ? (
        <ol className="derivative-tree" aria-label={copy.treeAriaLabel}>
          <li className="derivative-tree__root">
            <FileStack size={18} aria-hidden="true" />
            <span>
              <strong>{copy.rootLabel}</strong>
              <code dir="ltr">{state.tree.sourcePath || record.id}</code>
            </span>
          </li>
          <li>
            <ol className="derivative-tree__children" aria-label={copy.rootChildrenAriaLabel}>
              {state.tree.jobs.map((job) => <JobTreeItem key={job.id} job={job} originalSourcePath={state.tree.sourcePath} copy={copy} />)}
            </ol>
          </li>
        </ol>
      ) : null}
    </article>
  );
}
