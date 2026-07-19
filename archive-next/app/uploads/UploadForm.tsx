"use client";

import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { createArchiveApiClient, type ArchiveRecord, type IntakeTemplate, type UploadedRecord } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { uploadFileInChunks } from "@/lib/chunked-upload";
import {
  deriveIntakeNextAction,
  findDuplicateFiles,
  intakeStatusLabels,
  recoverIntakeDraft,
  summarizeFileProgress,
  type IntakeDraft,
  type IntakeFileProgress,
} from "@/lib/intake-journey";

type WizardStep = "files" | "metadata" | "review";
type IntakeMode = "guided" | "quick";

type UploadResult =
  | { status: "success"; fileName: string; record: UploadedRecord }
  | { status: "error"; fileName: string; message: string };

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; current: string }
  | { status: "complete"; results: UploadResult[] };

const steps: Array<{ key: WizardStep; label: string }> = [
  { key: "files", label: "الملفات" },
  { key: "metadata", label: "البيانات" },
  { key: "review", label: "المراجعة" }
];

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
  const api = useMemo(() => createArchiveApiClient(), []);
  const { accessToken } = useAuthSession();
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<WizardStep>("files");
  const [mode, setMode] = useState<IntakeMode>("guided");
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
  const nextAction = deriveIntakeNextAction({
    fileCount: files.length,
    mode,
    type: effectiveType,
    failedFiles: progressSummary.failed,
    completed: state.status === "complete" && progressSummary.failed === 0,
  });
  const hasVideo = files.some((file) => suggestedType(file) === "video") || effectiveType === "video";

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
        message: `تم الرفع لكن تعذر حفظ metadata: ${update.error}`
      };
    }

    return { status: "success", fileName: file.name, record: uploaded.record };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0 || state.status === "uploading") return;

    await runUploads(files);
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
        ? { fileName: file.name, status: result.status, ...(result.status === "error" ? { message: result.message } : {}) }
        : item));
    }

    setState({ status: "complete", results });
  }

  function retryFailedFiles() {
    const failed = new Set(fileProgress.filter((item) => item.status === "error").map((item) => item.fileName));
    void runUploads(files.filter((file) => failed.has(file.name)));
  }

  return (
    <article className="panel upload-wizard">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>مسار إضافة أرشيف</h2>
          <p className="field-note">رفع متعدد الملفات مع قوالب وmetadata وحقول فيديو قبل إنشاء السجلات.</p>
        </div>
        <div className="view-switcher" role="group" aria-label="وضع الإضافة">
          <button type="button" className="view-switcher__button" aria-pressed={mode === "guided"} onClick={() => setMode("guided")}>
            موجه
          </button>
          <button type="button" className="view-switcher__button" aria-pressed={mode === "quick"} onClick={() => setMode("quick")}>
            سريع
          </button>
        </div>
      </div>

      <div className="wizard-steps" aria-label="خطوات إضافة الأرشيف">
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
          <div className="state-banner state-banner-info" role="status">
            <strong>تمت استعادة مسودة الإضافة</strong>
            <span className="helper-text">أعد اختيار الملفات فقط؛ بيانات الأرشفة والخطوة السابقة محفوظتان على هذا الجهاز.</span>
            <button type="button" className="button button-secondary button-sm" onClick={() => setDraftRecovered(false)}>حسناً</button>
          </div>
        ) : null}
        {step === "files" ? (
          <section className="wizard-pane" aria-label="اختيار الملفات">
            <div
              className="upload-dropzone"
              data-drag={dragActive ? "true" : undefined}
              role="button"
              tabIndex={0}
              aria-label="اسحب الملفات هنا أو انقر للاختيار"
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
              <strong>اسحب الملفات هنا أو انقر للاختيار</strong>
              <span className="helper-text">فيديو، صوت، صور أو مستندات · حتى 600MB للملف · مدة الفيديو ودقته تُقرأ تلقائياً</span>
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
                      <span className="helper-text" role="status">
                        {intakeStatusLabels[fileProgress.find((item) => item.fileName === file.name)?.status ?? "pending"]}
                        {fileProgress.find((item) => item.fileName === file.name)?.progressPercent !== undefined
                          ? ` (${fileProgress.find((item) => item.fileName === file.name)?.progressPercent}%)`
                          : null}
                      </span>
                    </div>
                    <button type="button" className="button button-secondary button-sm" onClick={() => removeFile(file.name)}>
                      إزالة
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="helper-text">اختر ملفاً أو أكثر. في الوضع السريع يمكن المتابعة مباشرة للمراجعة.</p>
            )}
            {duplicateFiles.length ? (
              <div className="state-banner state-banner-warning" role="alert">
                <strong>ملفات مكررة في القائمة</strong>
                <span className="helper-text">تحقق قبل المتابعة: {duplicateFiles.join("، ")}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "metadata" ? (
          <section className="wizard-pane" aria-label="بيانات الأرشفة">
            {templates.length > 0 ? (
              <label>
                قالب الإدخال
                <select value={templateId} onChange={(event) => applyTemplate(event.target.value)} disabled={state.status === "uploading"}>
                  <option value="">بدون قالب</option>
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
                عنوان أو بادئة عنوان
                <input value={titlePrefix} onChange={(event) => setTitlePrefix(event.target.value)} placeholder="مثال: مقابلة الأرشيف" />
              </label>
              <label>
                النوع
                <input value={type} onChange={(event) => setType(event.target.value)} placeholder={inferredType || "video"} dir="ltr" list="intake-type-options" />
              </label>
              <label>
                النوع الفرعي
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
              وسوم
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="أرشيف, مقابلات, 2026" />
            </label>

            <label>
              وصف مختصر
              <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} />
            </label>

            <label>
              مجلد الوجهة
              <input value={folder} onChange={(event) => setFolder(event.target.value)} placeholder="campaigns/2026" dir="ltr" />
            </label>

            {hasVideo ? (
              <div className="section-divider">
                <div className="panel-title-row">
                  <div>
                    <h3>حقول الفيديو</h3>
                    <p className="field-note">المدة والدقة تُملأ تلقائياً من الملف — عدّلها عند الحاجة. تُحفظ داخل metadata.video لاستخدامها في التفريغ والمراجعة.</p>
                  </div>
                </div>
                <div className="field-row">
                  <label>
                    اللغة
                    <input value={videoLanguage} onChange={(event) => setVideoLanguage(event.target.value)} placeholder="ar" dir="ltr" />
                  </label>
                  <label>
                    المدة بالثواني
                    <input inputMode="numeric" value={videoDuration} onChange={(event) => setVideoDuration(event.target.value)} placeholder="3600" />
                  </label>
                  <label>
                    الدقة
                    <input value={videoResolution} onChange={(event) => setVideoResolution(event.target.value)} placeholder="1920x1080" dir="ltr" />
                  </label>
                  <label>
                    معدل الإطارات
                    <input value={videoFrameRate} onChange={(event) => setVideoFrameRate(event.target.value)} placeholder="25" dir="ltr" />
                  </label>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "review" ? (
          <section className="wizard-pane" aria-label="مراجعة الإضافة">
            <div className="kv-grid">
              <div className="kv-item">
                <strong>عدد الملفات</strong>
                <span>{files.length}</span>
              </div>
              <div className="kv-item">
                <strong>الحجم الإجمالي</strong>
                <span>{formatBytes(totalSize)}</span>
              </div>
              <div className="kv-item">
                <strong>النوع</strong>
                <span>{effectiveType}</span>
              </div>
              <div className="kv-item">
                <strong>الوسوم</strong>
                <span>{tagList.length ? tagList.join("، ") : "بدون وسوم"}</span>
              </div>
            </div>

            {mode === "quick" ? (
              <p className="helper-text">الوضع السريع يستخدم اسم كل ملف كعنوان ويحفظ metadata الأساسية فقط.</p>
            ) : null}
          </section>
        ) : null}

        <div className="button-row">
          {step !== "files" ? (
            <button type="button" className="button button-secondary" onClick={previousStep} disabled={state.status === "uploading"}>
              السابق
            </button>
          ) : null}
          {step !== "review" ? (
            <button type="button" className="button button-primary" onClick={nextStep} disabled={files.length === 0 || state.status === "uploading"}>
              التالي
            </button>
          ) : (
            <button type="submit" className="button button-primary" disabled={files.length === 0 || state.status === "uploading"}>
              {state.status === "uploading" ? `جار رفع ${state.current}...` : "إنشاء السجلات"}
            </button>
          )}
          <button type="button" className="button button-secondary" onClick={resetWizard} disabled={state.status === "uploading"}>
            مسح
          </button>
        </div>

        {state.status === "complete" ? (
          <div className={progressSummary.failed ? "state-banner state-banner-warning" : "state-banner state-banner-success"}>
            <strong>{progressSummary.failed ? "اكتملت الإضافة جزئياً" : "اكتملت عملية الإضافة"}</strong>
            <span className="helper-text">نجح {progressSummary.succeeded} من {progressSummary.total}. الخطوة التالية: {nextAction.label}.</span>
            <ul className="compact-list">
              {state.results.map((result) => (
                <li key={result.fileName}>
                  {result.status === "success" ? (
                    <>
                      <a className="text-accent" href={`/archive/${encodeURIComponent(result.record.id)}`}>{result.fileName}</a>
                      <span className="helper-text"> - سجل {result.record.id}</span>
                    </>
                  ) : (
                    <span className="status-error">{result.fileName}: {result.message}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="button-row">
              {progressSummary.failed ? <button type="button" className="button button-primary" onClick={retryFailedFiles}>إعادة محاولة المتعثر</button> : null}
              {"href" in nextAction ? <a className="button button-primary" href={nextAction.href}>{nextAction.label}</a> : null}
            </div>
          </div>
        ) : null}
      </form>
    </article>
  );
}
