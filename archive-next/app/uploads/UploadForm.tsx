"use client";

import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { createArchiveApiClient, type ArchiveRecord, type IntakeTemplate, type UploadedRecord } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { clearScheduledUploadResumeEntry, uploadFileForSchedule, uploadFileInChunks } from "@/lib/chunked-upload";
import { scheduleSummary, scheduledUploadProgress, validateScheduleTime, type ScheduledUploadStage } from "@/lib/scheduled-upload";
import {
  deriveIntakeNextAction,
  findDuplicateFiles,
  getIntakeStatusLabels,
  recoverIntakeDraft,
  summarizeFileProgress,
  type IntakeDraft,
  type IntakeFileProgress,
} from "@/lib/intake-journey";

type WizardStep = "files" | "metadata" | "review";
type IntakeMode = "guided" | "quick";
type ProcessingMode = "now" | "scheduled";

type UploadResult =
  | { status: "success"; fileName: string; record: UploadedRecord }
  | { status: "scheduled"; fileName: string }
  | { status: "error"; fileName: string; message: string };

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; current: string; stage?: ScheduledUploadStage }
  | { status: "complete"; results: UploadResult[] };

/** V1-711: files at or above this size go through the resumable chunked
 * upload path instead of a single multipart POST (which the server caps at
 * 600MB and which cannot resume after a dropped connection). */
const CHUNKED_UPLOAD_THRESHOLD_BYTES = 100 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function fileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function suggestedType(file: File) {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.includes("pdf") || file.type.startsWith("text/")) return "document";
  return "file";
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// Reads duration + resolution straight from the file so operators don't have to
// type them by hand. Resolves empty on any decode error — auto-fill is best-effort.
function probeVideoMetadata(file: File): Promise<{ durationSeconds?: number; resolution?: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const done = (result: { durationSeconds?: number; resolution?: string }) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    video.onloadedmetadata = () =>
      done({
        durationSeconds: Number.isFinite(video.duration) ? Math.round(video.duration) : undefined,
        resolution: video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : undefined
      });
    video.onerror = () => done({});
    video.src = url;
  });
}

export function UploadForm() {
  const { t, locale } = useLocale();
  const listSeparator = locale === "en" ? ", " : "، ";
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: "files", label: t.pages.uploadForm.stepFiles },
    { key: "metadata", label: t.pages.uploadForm.stepMetadata },
    { key: "review", label: t.pages.uploadForm.stepReview }
  ];
  const api = useMemo(() => createArchiveApiClient(), []);
  const { accessToken } = useAuthSession();
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<WizardStep>("files");
  const [mode, setMode] = useState<IntakeMode>("guided");
  const [processingMode, setProcessingMode] = useState<ProcessingMode>("now");
  const [scheduleLocalValue, setScheduleLocalValue] = useState("");
  const [folder, setFolder] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [type, setType] = useState("");
  const [subtype, setSubtype] = useState("");
  const [tags, setTags] = useState("");
  const [summary, setSummary] = useState("");
  const [videoLanguage, setVideoLanguage] = useState("ar");
  const [videoDuration, setVideoDuration] = useState("");
  const [videoResolution, setVideoResolution] = useState("");
  const [videoFrameRate, setVideoFrameRate] = useState("");
  const [templates, setTemplates] = useState<IntakeTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [fileProgress, setFileProgress] = useState<IntakeFileProgress[]>([]);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void api.intakeTemplates().then((response) => {
      if (!cancelled && response.ok) setTemplates(response.templates);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    const draft = recoverIntakeDraft(window.localStorage.getItem("archive.intake-draft"));
    if (draft) {
      setStep(draft.step);
      setMode(draft.mode);
      setFolder(draft.folder);
      setTitlePrefix(draft.titlePrefix);
      setType(draft.type);
      setSubtype(draft.subtype);
      setTags(draft.tags);
      setSummary(draft.summary);
      setTemplateId(draft.templateId);
      setDraftRecovered(true);
    }
  }, []);

  useEffect(() => {
    const draft: IntakeDraft = {
      version: 1, step, mode, folder, titlePrefix, type, subtype, tags, summary, templateId,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem("archive.intake-draft", JSON.stringify(draft));
  }, [step, mode, folder, titlePrefix, type, subtype, tags, summary, templateId]);

  const selectedTemplate = templates.find((item) => item.id === templateId);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const inferredType = files.length === 1 ? suggestedType(files[0]) : "";
  const effectiveType = type || selectedTemplate?.type || inferredType || "file";
  const tagList = parseTags(tags);
  const duplicateFiles = findDuplicateFiles(files);
  const progressSummary = summarizeFileProgress(fileProgress);
  const statusLabels = getIntakeStatusLabels(locale);
  const nextAction = deriveIntakeNextAction({
    fileCount: files.length,
    mode,
    type: effectiveType,
    failedFiles: progressSummary.failed,
    completed: state.status === "complete" && progressSummary.failed === 0,
    locale,
  });
  const hasScheduledResults = state.status === "complete" && state.results.some((result) => result.status === "scheduled");
  const hasVideo = files.some((file) => suggestedType(file) === "video") || effectiveType === "video";
  const detectedZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const scheduleValidation = useMemo(
    () => (processingMode === "scheduled" ? validateScheduleTime(scheduleLocalValue, detectedZone, new Date(), locale) : null),
    [processingMode, scheduleLocalValue, detectedZone, locale]
  );

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;

    const templateFolder = template.fields?.folder;
    const templateTags = template.fields?.tags;

    if (typeof templateFolder === "string") setFolder(templateFolder);
    if (Array.isArray(templateTags)) setTags(templateTags.filter((tag): tag is string => typeof tag === "string").join(", "));
    if (template.type) setType(template.type);
  }

  function ingestFiles(list: FileList | File[]) {
    const next = Array.from(list ?? []);
    setFiles(next);
    setFileProgress(next.map((file) => ({ fileName: file.name, status: "pending" })));
    setState({ status: "idle" });

    // Auto-fill video fields from the first video so they aren't typed manually.
    const firstVideo = next.find((file) => suggestedType(file) === "video");
    if (firstVideo) {
      void probeVideoMetadata(firstVideo).then(({ durationSeconds, resolution }) => {
        if (durationSeconds) setVideoDuration((prev) => prev || String(durationSeconds));
        if (resolution) setVideoResolution((prev) => prev || resolution);
      });
    }
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    ingestFiles(event.target.files ?? []);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (state.status === "uploading") return;
    if (event.dataTransfer.files?.length) ingestFiles(event.dataTransfer.files);
  }

  function openFileDialog() {
    if (state.status !== "uploading") inputRef.current?.click();
  }

  function handleDropzoneKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFileDialog();
    }
  }

  function removeFile(fileName: string) {
    setFiles((current) => current.filter((file) => file.name !== fileName));
    setFileProgress((current) => current.filter((file) => file.fileName !== fileName));
  }

  function nextStep() {
    if (step === "files") setStep(mode === "quick" ? "review" : "metadata");
    if (step === "metadata") setStep("review");
  }

  function previousStep() {
    if (step === "review") setStep(mode === "quick" ? "files" : "metadata");
    if (step === "metadata") setStep("files");
  }

  function resetWizard() {
    setFiles([]);
    setStep("files");
    setProcessingMode("now");
    setScheduleLocalValue("");
    setFolder("");
    setTitlePrefix("");
    setType("");
    setSubtype("");
    setTags("");
    setSummary("");
    setVideoLanguage("ar");
    setVideoDuration("");
    setVideoResolution("");
    setVideoFrameRate("");
    setTemplateId("");
    setState({ status: "idle" });
    setFileProgress([]);
    window.localStorage.removeItem("archive.intake-draft");
    if (inputRef.current) inputRef.current.value = "";
  }

  function buildArchiveRecord(file: File, uploaded: UploadedRecord): ArchiveRecord {
    const now = new Date().toISOString();
    const title = titlePrefix.trim()
      ? files.length > 1
        ? `${titlePrefix.trim()} - ${fileBaseName(file.name)}`
        : titlePrefix.trim()
      : fileBaseName(uploaded.fileName || file.name);

    const metadata: Record<string, unknown> = {
      ...(summary.trim() ? { summary: summary.trim() } : {}),
      originalFileName: file.name,
      folder: folder.trim() || undefined,
      mimeType: file.type || undefined,
      fileSize: file.size,
      intakeMode: mode,
      templateId: templateId || undefined,
      checksum: uploaded.checksum,
      filePath: uploaded.filePath,
      source: "upload-wizard"
    };

    if (suggestedType(file) === "video" || effectiveType === "video") {
      metadata.video = {
        language: videoLanguage.trim() || "ar",
        durationSeconds: videoDuration.trim() ? Number(videoDuration) : undefined,
        resolution: videoResolution.trim() || undefined,
        frameRate: videoFrameRate.trim() || undefined
      };
    }

    return {
      ...uploaded,
      uid: uploaded.uid || uploaded.id,
      title,
      type: effectiveType,
      subtype: subtype.trim() || null,
      tags: tagList,
      metadata,
      updatedAt: now
    };
  }

  /**
   * V1-712: builds the record payload for the "schedule processing" path.
   * Deliberately separate from buildArchiveRecord — there is no UploadedRecord
   * yet (the upload session isn't completed), so no checksum/filePath/uid.
   */
  function buildScheduleRecord(file: File): Pick<ArchiveRecord, "title" | "type" | "subtype" | "tags" | "metadata"> {
    const title = titlePrefix.trim()
      ? files.length > 1
        ? `${titlePrefix.trim()} - ${fileBaseName(file.name)}`
        : titlePrefix.trim()
      : fileBaseName(file.name);

    const metadata: Record<string, unknown> = {
      ...(summary.trim() ? { summary: summary.trim() } : {}),
      originalFileName: file.name,
      folder: folder.trim() || undefined,
      mimeType: file.type || undefined,
      fileSize: file.size,
      intakeMode: mode,
      templateId: templateId || undefined,
      source: "upload-wizard-scheduled"
    };

    if (suggestedType(file) === "video" || effectiveType === "video") {
      metadata.video = {
        language: videoLanguage.trim() || "ar",
        durationSeconds: videoDuration.trim() ? Number(videoDuration) : undefined,
        resolution: videoResolution.trim() || undefined,
        frameRate: videoFrameRate.trim() || undefined
      };
    }

    return {
      title,
      type: effectiveType,
      subtype: subtype.trim() || null,
      tags: tagList,
      metadata
    };
  }

  async function uploadOne(file: File): Promise<UploadResult> {
    const auth = accessToken ? { accessToken } : undefined;
    const effectiveFolder = folder.trim() || undefined;

    const uploaded = file.size >= CHUNKED_UPLOAD_THRESHOLD_BYTES
      ? await uploadFileInChunks(api, file, {
          folder: effectiveFolder,
          onProgress: ({ uploadedBytes, totalBytes }) => {
            const progressPercent = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
            setFileProgress((current) => current.map((item) =>
              item.fileName === file.name ? { ...item, progressPercent } : item));
          }
        })
      : await api.uploadFile(file, effectiveFolder ? { folder: effectiveFolder } : undefined, auth);

    if (!uploaded.ok) {
      return { status: "error", fileName: file.name, message: uploaded.error };
    }

    const record = buildArchiveRecord(file, uploaded.record);
    const update = await api.bulkRecords({ store: "archive-items", records: [record] }, auth);

    if (!update.ok) {
      return {
        status: "error",
        fileName: file.name,
        message: t.pages.uploadForm.uploadMetadataError.replace("{error}", update.error)
      };
    }

    return { status: "success", fileName: file.name, record: uploaded.record };
  }

  /**
   * V1-712: stages the file through the upload-session API (never a direct
   * multipart upload — the schedule worker completes it later) and creates
   * the schedule. Never links a record before that worker completes it.
   */
  async function scheduleOne(file: File, scheduledAtUtc: string, zone: string): Promise<UploadResult> {
    const auth = accessToken ? { accessToken } : undefined;
    const effectiveFolder = folder.trim() || undefined;

    setState({ status: "uploading", current: file.name, stage: "uploading" });
    const staged = await uploadFileForSchedule(api, file, {
      folder: effectiveFolder,
      onProgress: ({ uploadedBytes, totalBytes }) => {
        const progressPercent = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
        setFileProgress((current) => current.map((item) =>
          item.fileName === file.name ? { ...item, progressPercent } : item));
      }
    });

    if (!staged.ok) {
      return { status: "error", fileName: file.name, message: staged.error };
    }

    setState({ status: "uploading", current: file.name, stage: "staging" });
    const created = await api.createScheduledUpload(
      {
        uploadSessionId: staged.sessionId,
        scheduledAt: scheduledAtUtc,
        timeZone: zone,
        idempotencyKey: staged.sessionId,
        record: buildScheduleRecord(file)
      },
      auth
    );

    if (!created.ok) {
      return { status: "error", fileName: file.name, message: t.pages.uploadForm.scheduleCreateError.replace("{error}", created.error) };
    }

    clearScheduledUploadResumeEntry(file, effectiveFolder);
    setState({ status: "uploading", current: file.name, stage: "scheduled" });
    return { status: "scheduled", fileName: file.name };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0 || state.status === "uploading") return;

    if (processingMode === "scheduled") {
      const validation = validateScheduleTime(scheduleLocalValue, detectedZone, new Date(), locale);
      if (!validation.valid) return;
      await runScheduledUploads(files, validation.utc, detectedZone);
      return;
    }

    await runUploads(files);
  }

  async function runScheduledUploads(targetFiles: File[], scheduledAtUtc: string, zone: string) {
    const previousResults = state.status === "complete"
      ? state.results.filter((result) => !targetFiles.some((file) => file.name === result.fileName))
      : [];

    const results: UploadResult[] = [...previousResults];
    for (const file of targetFiles) {
      setFileProgress((current) => current.map((item) => item.fileName === file.name ? { ...item, status: "uploading", message: undefined } : item));
      const result = await scheduleOne(file, scheduledAtUtc, zone);
      results.push(result);
      setFileProgress((current) => current.map((item) => item.fileName === file.name
        ? {
            fileName: file.name,
            status: result.status === "error" ? "error" as const : "success" as const,
            ...(result.status === "error" ? { message: result.message } : {})
          }
        : item));
    }

    setState({ status: "complete", results });
  }

  async function runUploads(targetFiles: File[]) {
    const previousResults = state.status === "complete"
      ? state.results.filter((result) => !targetFiles.some((file) => file.name === result.fileName))
      : [];

    const results: UploadResult[] = [...previousResults];
    for (const file of targetFiles) {
      setState({ status: "uploading", current: file.name });
      setFileProgress((current) => current.map((item) => item.fileName === file.name ? { ...item, status: "uploading", message: undefined } : item));
      const result = await uploadOne(file);
      results.push(result);
      setFileProgress((current) => current.map((item) => item.fileName === file.name
        ? {
            fileName: file.name,
            status: result.status === "error" ? "error" as const : "success" as const,
            ...(result.status === "error" ? { message: result.message } : {})
          }
        : item));
    }

    setState({ status: "complete", results });
  }

  function retryFailedFiles() {
    const failed = new Set(fileProgress.filter((item) => item.status === "error").map((item) => item.fileName));
    const targets = files.filter((file) => failed.has(file.name));

    if (processingMode === "scheduled") {
      const validation = validateScheduleTime(scheduleLocalValue, detectedZone, new Date(), locale);
      if (!validation.valid) return;
      void runScheduledUploads(targets, validation.utc, detectedZone);
      return;
    }

    void runUploads(targets);
  }

  return (
    <article className="panel upload-wizard">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{t.pages.uploadForm.heading}</h2>
          <p className="field-note">{t.pages.uploadForm.subheading}</p>
        </div>
        <div className="view-switcher" role="group" aria-label={t.pages.uploadForm.modeGroupAriaLabel}>
          <button type="button" className="view-switcher__button" aria-pressed={mode === "guided"} onClick={() => setMode("guided")}>
            {t.pages.uploadForm.modeGuided}
          </button>
          <button type="button" className="view-switcher__button" aria-pressed={mode === "quick"} onClick={() => setMode("quick")}>
            {t.pages.uploadForm.modeQuick}
          </button>
        </div>
      </div>

      <div className="wizard-steps" aria-label={t.pages.uploadForm.stepsAriaLabel}>
        {steps.map((item) => (
          <button
            key={item.key}
            type="button"
            className="wizard-step"
            data-active={step === item.key ? "true" : undefined}
            onClick={() => setStep(item.key)}
            disabled={item.key !== "files" && files.length === 0}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {draftRecovered ? (
          <div className="state-banner state-banner-info" role="status" aria-live="polite" aria-atomic="true">
            <strong>{t.pages.uploadForm.draftRecoveredTitle}</strong>
            <span className="helper-text">{t.pages.uploadForm.draftRecoveredHelper}</span>
            <button type="button" className="button button-secondary button-sm" onClick={() => setDraftRecovered(false)}>{t.pages.uploadForm.draftRecoveredDismiss}</button>
          </div>
        ) : null}
        {step === "files" ? (
          <section className="wizard-pane" aria-label={t.pages.uploadForm.filesStepAriaLabel}>
            <div
              className="upload-dropzone"
              data-drag={dragActive ? "true" : undefined}
              role="button"
              tabIndex={0}
              aria-label={t.pages.uploadForm.dropzoneLabel}
              onClick={openFileDialog}
              onKeyDown={handleDropzoneKey}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <UploadCloud aria-hidden="true" size={28} />
              <strong>{t.pages.uploadForm.dropzoneLabel}</strong>
              <span className="helper-text">{t.pages.uploadForm.dropzoneHelper}</span>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={handleFilesChange}
                disabled={state.status === "uploading"}
              />
            </div>

            {files.length ? (
              <ul className="file-queue">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    <div>
                      <strong>{file.name}</strong>
                      <span className="helper-text">{suggestedType(file)} · {formatBytes(file.size)}</span>
                      <span className="helper-text" role="status" aria-live="polite" aria-atomic="true">
                        {statusLabels[fileProgress.find((item) => item.fileName === file.name)?.status ?? "pending"]}
                        {fileProgress.find((item) => item.fileName === file.name)?.progressPercent !== undefined
                          ? ` (${fileProgress.find((item) => item.fileName === file.name)?.progressPercent}%)`
                          : null}
                      </span>
                    </div>
                    <button type="button" className="button button-secondary button-sm" onClick={() => removeFile(file.name)}>
                      {t.pages.uploadForm.removeFileButton}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="helper-text">{t.pages.uploadForm.noFilesHelper}</p>
            )}
            {duplicateFiles.length ? (
              <div className="state-banner state-banner-warning" role="alert">
                <strong>{t.pages.uploadForm.duplicateFilesTitle}</strong>
                <span className="helper-text">{t.pages.uploadForm.duplicateFilesHelper.replace("{files}", duplicateFiles.join(listSeparator))}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "metadata" ? (
          <section className="wizard-pane" aria-label={t.pages.uploadForm.metadataStepAriaLabel}>
            {templates.length > 0 ? (
              <label>
                {t.pages.uploadForm.templateLabel}
                <select value={templateId} onChange={(event) => applyTemplate(event.target.value)} disabled={state.status === "uploading"}>
                  <option value="">{t.pages.uploadForm.noTemplateOption}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="field-row">
              <label>
                {t.pages.uploadForm.titlePrefixLabel}
                <input value={titlePrefix} onChange={(event) => setTitlePrefix(event.target.value)} placeholder={t.pages.uploadForm.titlePrefixPlaceholder} />
              </label>
              <label>
                {t.pages.uploadForm.typeLabel}
                <input value={type} onChange={(event) => setType(event.target.value)} placeholder={inferredType || "video"} dir="ltr" list="intake-type-options" />
              </label>
              <label>
                {t.pages.uploadForm.subtypeLabel}
                <input value={subtype} onChange={(event) => setSubtype(event.target.value)} placeholder="interview / raw / report" dir="ltr" list="intake-subtype-options" />
              </label>
            </div>
            <datalist id="intake-type-options">
              <option value="video" />
              <option value="audio" />
              <option value="image" />
              <option value="document" />
              <option value="map" />
            </datalist>
            <datalist id="intake-subtype-options">
              <option value="interview" />
              <option value="raw" />
              <option value="report" />
              <option value="broadcast" />
              <option value="highlights" />
            </datalist>

            <label>
              {t.pages.uploadForm.tagsLabel}
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t.pages.uploadForm.tagsPlaceholder} />
            </label>

            <label>
              {t.pages.uploadForm.summaryLabel}
              <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} />
            </label>

            <label>
              {t.pages.uploadForm.folderLabel}
              <input value={folder} onChange={(event) => setFolder(event.target.value)} placeholder="campaigns/2026" dir="ltr" />
            </label>

            {hasVideo ? (
              <div className="section-divider">
                <div className="panel-title-row">
                  <div>
                    <h3>{t.pages.uploadForm.videoFieldsHeading}</h3>
                    <p className="field-note">{t.pages.uploadForm.videoFieldsHelper}</p>
                  </div>
                </div>
                <div className="field-row">
                  <label>
                    {t.pages.uploadForm.videoLanguageLabel}
                    <input value={videoLanguage} onChange={(event) => setVideoLanguage(event.target.value)} placeholder="ar" dir="ltr" />
                  </label>
                  <label>
                    {t.pages.uploadForm.videoDurationLabel}
                    <input inputMode="numeric" value={videoDuration} onChange={(event) => setVideoDuration(event.target.value)} placeholder="3600" />
                  </label>
                  <label>
                    {t.pages.uploadForm.videoResolutionLabel}
                    <input value={videoResolution} onChange={(event) => setVideoResolution(event.target.value)} placeholder="1920x1080" dir="ltr" />
                  </label>
                  <label>
                    {t.pages.uploadForm.videoFrameRateLabel}
                    <input value={videoFrameRate} onChange={(event) => setVideoFrameRate(event.target.value)} placeholder="25" dir="ltr" />
                  </label>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "review" ? (
          <section className="wizard-pane" aria-label={t.pages.uploadForm.reviewStepAriaLabel}>
            <fieldset className="schedule-choice">
              <legend>{t.pages.uploadForm.processingTimeLegend}</legend>
              {(["now", "scheduled"] as const).map((value) => (
                <label key={value} className="schedule-choice-card">
                  <input
                    type="radio"
                    name="processingMode"
                    value={value}
                    checked={processingMode === value}
                    onChange={() => setProcessingMode(value)}
                    disabled={state.status === "uploading"}
                  />
                  <strong>{value === "now" ? t.pages.uploadForm.processNowOption : t.pages.uploadForm.processScheduledOption}</strong>
                </label>
              ))}
            </fieldset>

            {processingMode === "scheduled" ? (
              <div className="field-row">
                <label>
                  {t.pages.uploadForm.scheduleDateLabel}
                  <input
                    type="datetime-local"
                    value={scheduleLocalValue}
                    onChange={(event) => setScheduleLocalValue(event.target.value)}
                    disabled={state.status === "uploading"}
                  />
                </label>
                <div className="kv-item">
                  <strong>{t.pages.uploadForm.detectedZoneLabel}</strong>
                  <span dir="ltr">{detectedZone}</span>
                </div>
              </div>
            ) : null}

            {processingMode === "scheduled" && scheduleLocalValue ? (
              scheduleValidation?.valid ? (
                <p className="helper-text" role="status" aria-live="polite" aria-atomic="true">{scheduleSummary(scheduleLocalValue, detectedZone, locale === "en" ? "en-US" : "ar-SA")}</p>
              ) : (
                <div className="state-banner state-banner-warning" role="alert">
                  <strong>{scheduleValidation && !scheduleValidation.valid ? scheduleValidation.message : ""}</strong>
                </div>
              )
            ) : null}

            <div className="kv-grid">
              <div className="kv-item">
                <strong>{t.pages.uploadForm.fileCountLabel}</strong>
                <span>{files.length}</span>
              </div>
              <div className="kv-item">
                <strong>{t.pages.uploadForm.totalSizeLabel}</strong>
                <span>{formatBytes(totalSize)}</span>
              </div>
              <div className="kv-item">
                <strong>{t.pages.uploadForm.typeLabel}</strong>
                <span>{effectiveType}</span>
              </div>
              <div className="kv-item">
                <strong>{t.pages.uploadForm.tagsLabel}</strong>
                <span>{tagList.length ? tagList.join(listSeparator) : t.pages.uploadForm.noTagsValue}</span>
              </div>
            </div>

            {mode === "quick" ? (
              <p className="helper-text">{t.pages.uploadForm.quickModeHelper}</p>
            ) : null}
          </section>
        ) : null}

        <div className="button-row">
          {step !== "files" ? (
            <button type="button" className="button button-secondary" onClick={previousStep} disabled={state.status === "uploading"}>
              {t.pages.uploadForm.previousButton}
            </button>
          ) : null}
          {step !== "review" ? (
            <button type="button" className="button button-primary" onClick={nextStep} disabled={files.length === 0 || state.status === "uploading"}>
              {t.pages.uploadForm.nextButton}
            </button>
          ) : (
            <button
              type="submit"
              className="button button-primary"
              disabled={
                files.length === 0 ||
                state.status === "uploading" ||
                (processingMode === "scheduled" && scheduleValidation?.valid !== true)
              }
            >
              {state.status === "uploading"
                ? state.stage
                  ? `${scheduledUploadProgress(state.stage, locale)}: ${state.current}`
                  : t.pages.uploadForm.uploadingFile.replace("{file}", state.current)
                : processingMode === "scheduled"
                  ? t.pages.uploadForm.uploadAndScheduleButton
                  : t.pages.uploadForm.createRecordsButton}
            </button>
          )}
          <button type="button" className="button button-secondary" onClick={resetWizard} disabled={state.status === "uploading"}>
            {t.pages.uploadForm.clearButton}
          </button>
        </div>

        {state.status === "complete" ? (
          <div className={progressSummary.failed ? "state-banner state-banner-warning" : "state-banner state-banner-success"}>
            <strong>
              {progressSummary.failed
                ? t.pages.uploadForm.completePartialTitle
                : hasScheduledResults
                  ? t.pages.uploadForm.completeScheduledTitle
                  : t.pages.uploadForm.completeSuccessTitle}
            </strong>
            <span className="helper-text">
              {t.pages.uploadForm.completeSummary.replace("{succeeded}", String(progressSummary.succeeded)).replace("{total}", String(progressSummary.total))}
              {hasScheduledResults ? null : t.pages.uploadForm.nextActionSuffix.replace("{label}", nextAction.label)}
            </span>
            <ul className="compact-list">
              {state.results.map((result) => (
                <li key={result.fileName}>
                  {result.status === "success" ? (
                    <>
                      <a className="text-accent" href={`/archive/${encodeURIComponent(result.record.id)}`}>{result.fileName}</a>
                      <span className="helper-text">{t.pages.uploadForm.resultRecordSuffix.replace("{id}", result.record.id)}</span>
                    </>
                  ) : result.status === "scheduled" ? (
                    <span>{t.pages.uploadForm.resultScheduledSuffix.replace("{file}", result.fileName)}</span>
                  ) : (
                    <span className="status-error">{t.pages.uploadForm.resultErrorFormat.replace("{file}", result.fileName).replace("{message}", result.message)}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="button-row">
              {progressSummary.failed ? <button type="button" className="button button-primary" onClick={retryFailedFiles}>{t.pages.uploadForm.retryFailedButton}</button> : null}
              {hasScheduledResults ? (
                <a className="button button-primary" href="/uploads/scheduled">{t.pages.uploadForm.viewScheduledLink}</a>
              ) : "href" in nextAction ? (
                <a className="button button-primary" href={nextAction.href}>{nextAction.label}</a>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>
    </article>
  );
}
