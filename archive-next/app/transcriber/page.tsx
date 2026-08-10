"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type MediaJob } from "@/lib/archive-api";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { parseSubtitles, formatCueTime, type Cue } from "@/lib/media/subtitles";
import styles from "./transcriber.module.css";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const POLL_INTERVAL_MS = 3000;

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "tracking"; job: MediaJob }
  | { status: "error"; message: string };

type RecentState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "loaded"; jobs: MediaJob[] }
  | { status: "error"; message: string };

function extractTranscriptText(job: MediaJob): string {
  const result = job.result;
  if (!result) return "";
  const candidate = result["text"] ?? result["vtt"] ?? result["transcript"] ?? result["content"];
  return typeof candidate === "string" ? candidate : "";
}

export default function TranscriberPage() {
  const { t } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialogs = useConfirmDialog();
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [recentState, setRecentState] = useState<RecentState>({ status: "loading" });
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [subtitleContent, setSubtitleContent] = useState("");
  const [subtitleFileName, setSubtitleFileName] = useState("captions.srt");
  const [subtitleRecordId, setSubtitleRecordId] = useState("");
  const [subtitleFormat, setSubtitleFormat] = useState<"srt" | "vtt">("srt");
  const [subtitleFontSize, setSubtitleFontSize] = useState(24);
  const [subtitleColor, setSubtitleColor] = useState("#ffffff");
  const [subtitleAlign, setSubtitleAlign] = useState<"start" | "middle" | "end">("middle");
  const [subtitleMessage, setSubtitleMessage] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRecent = useCallback(async () => {
    setRecentState({ status: "loading" });
    const response = await api.mediaJobs({ limit: 20 });
    if (!response.ok) {
      setRecentState({ status: "error", message: response.error });
      return;
    }
    const jobs = response.jobs.filter((job) => job.operation === "transcription");
    setRecentState(jobs.length > 0 ? { status: "loaded", jobs } : { status: "empty" });
  }, [api]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // Poll the tracked job until it settles; always clear the interval on unmount or job change.
  useEffect(() => {
    if (submitState.status !== "tracking" || submitState.job.status === "completed" || submitState.job.status === "failed") {
      return;
    }

    const jobId = submitState.job.id;
    pollTimer.current = setInterval(async () => {
      const response = await api.mediaJob(jobId);
      if (!response.ok) return;
      setSubmitState({ status: "tracking", job: response.job });
      if (response.job.status === "completed" || response.job.status === "failed") {
        void loadRecent();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [api, submitState, loadRecent]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const recordId = String(data.get("recordId") ?? "").trim();
    const sourcePath = String(data.get("sourcePath") ?? "").trim();
    const disk = String(data.get("disk") ?? "").trim();
    const language = String(data.get("language") ?? "ar").trim() || "ar";

    // Collect selected output formats
    const outputFormats: string[] = [];
    if (data.get("format-srt")) outputFormats.push("srt");
    if (data.get("format-vtt")) outputFormats.push("vtt");
    if (data.get("format-ttml")) outputFormats.push("ttml");
    if (outputFormats.length === 0) {
      setSubmitState({ status: "error", message: "اختر صيغة إخراج واحدة على الأقل." });
      return;
    }

    if (!recordId || !sourcePath) {
      setSubmitState({ status: "error", message: "أدخل معرّف السجل ومسار الملف قبل بدء التفريغ." });
      return;
    }

    setSubmitState({ status: "submitting" });
    setShowRaw(false);
    setCopied(false);

    const response = await api.createMediaJob({
      recordId,
      operation: "transcription",
      sourcePath,
      options: { language, outputFormats, ...(disk ? { disk } : {}) }
    });

    if (!response.ok) {
      setSubmitState({ status: "error", message: response.error });
      return;
    }

    setSubmitState({ status: "tracking", job: response.job });
  }

  async function handleCancel(jobId: string) {
    const response = await api.cancelMediaJob(jobId);
    if (!response.ok) {
      await dialogs.alert({ title: "تعذر إلغاء المهمة", message: `فشل الإلغاء: ${response.error}` });
      return;
    }
    setSubmitState({ status: "tracking", job: response.job });
  }

  const trackedJob = submitState.status === "tracking" ? submitState.job : null;
  const transcriptText = trackedJob ? extractTranscriptText(trackedJob) : "";
  const cues: Cue[] = useMemo(() => parseSubtitles(transcriptText), [transcriptText]);
  const plainText = cues.length > 0 ? cues.map((cue) => cue.text).join(" ") : transcriptText;
  const selectableJobs = recentState.status === "loaded"
    ? recentState.jobs.filter((job) => `${job.recordId} ${job.sourcePath}`.toLowerCase().includes(mediaQuery.trim().toLowerCase()))
    : [];

  function selectPreviousMedia(job: MediaJob) {
    const form = formRef.current;
    if (!form) return;
    const recordInput = form.elements.namedItem("recordId") as HTMLInputElement | null;
    const sourceInput = form.elements.namedItem("sourcePath") as HTMLInputElement | null;
    if (recordInput) recordInput.value = job.recordId;
    if (sourceInput) sourceInput.value = job.sourcePath || "";
    recordInput?.focus();
  }

  async function handleCopy() {
    const text = showRaw ? transcriptText : plainText;
    if (!text || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ponytail: clipboard denial is non-fatal, UI just won't flip to "copied"
    }
  }

  async function loadSubtitleFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.toLowerCase().endsWith(".vtt") ? "vtt" : file.name.toLowerCase().endsWith(".srt") ? "srt" : null;
    if (!extension) {
      setSubtitleMessage("اختر ملف SRT أو WebVTT فقط.");
      return;
    }
    setSubtitleContent(await file.text());
    setSubtitleFileName(file.name);
    setSubtitleFormat(extension);
    setSubtitleMessage(`فُتح ${file.name} للتعديل محليًا.`);
  }

  async function copySubtitles() {
    if (!subtitleContent || !navigator.clipboard) return;
    await navigator.clipboard.writeText(subtitleContent);
    setSubtitleMessage("نُسخ ملف الترجمة إلى الحافظة.");
  }

  function downloadSubtitles() {
    if (!subtitleContent) return;
    const extension = subtitleFormat === "vtt" ? "vtt" : "srt";
    const filename = subtitleFileName.replace(/\.(srt|vtt)$/i, "") || "captions";
    const url = URL.createObjectURL(new Blob([subtitleContent], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    setSubtitleMessage("حُفظت نسخة ملف الترجمة على جهازك.");
  }

  async function saveSubtitlesToRecord() {
    if (!subtitleRecordId.trim() || !subtitleContent.trim()) {
      setSubtitleMessage("أدخل معرّف المادة ونص الترجمة قبل الحفظ.");
      return;
    }
    const response = await api.saveRecordSubtitles(subtitleRecordId.trim(), {
      content: subtitleContent,
      format: subtitleFormat,
      style: { fontSize: subtitleFontSize, color: subtitleColor, align: subtitleAlign }
    });
    setSubtitleMessage(response.ok ? "حُفظت الترجمة والنمط على المادة." : response.error || "تعذر حفظ الترجمة.");
  }

  return (
    <AppShell subtitle={t.pageTitles.transcription} contentClassName={`stack ${styles.transcriberContent}`} tipsPage="transcriber">
      <PageToolbar
        title="التفريغ الصوتي"
        description="أنشئ مهمة تفريغ صوتي عبر مهام الوسائط وتابع تقدّمها حتى اكتمال النص بالطوابع الزمنية."
        meta={
          <>
            <span className="badge">تفريغ عبر queue</span>
            <span className="badge">تتبّع كل {POLL_INTERVAL_MS / 1000} ثوانٍ</span>
          </>
        }
      />

      <section className="panel stack" aria-labelledby="subtitle-editor-title">
        <div className="panel-section-header">
          <div><h2 id="subtitle-editor-title">محرر SRT وWebVTT</h2><p>افتح، عدّل، انسخ، نزّل، أو احفظ الترجمة ونمط عرضها على مادة أرشيفية.</p></div>
          <span className="badge">{parseSubtitles(subtitleContent).length} مقطع</span>
        </div>
        <div className="archive-toolbar-grid">
          <label><span>ملف الترجمة</span><input type="file" accept=".srt,.vtt,text/plain" onChange={(event) => void loadSubtitleFile(event.target.files?.[0])} /></label>
          <label><span>معرّف المادة للحفظ</span><input value={subtitleRecordId} onChange={(event) => setSubtitleRecordId(event.target.value)} placeholder="record-id" /></label>
          <label><span>الصيغة</span><select value={subtitleFormat} onChange={(event) => setSubtitleFormat(event.target.value as "srt" | "vtt")}><option value="srt">SRT</option><option value="vtt">WebVTT</option></select></label>
          <label><span>حجم النص</span><input type="number" min="12" max="72" value={subtitleFontSize} onChange={(event) => setSubtitleFontSize(Number(event.target.value) || 24)} /></label>
          <label><span>لون النص</span><input type="color" value={subtitleColor} onChange={(event) => setSubtitleColor(event.target.value)} /></label>
          <label><span>المحاذاة</span><select value={subtitleAlign} onChange={(event) => setSubtitleAlign(event.target.value as "start" | "middle" | "end")}><option value="start">بداية</option><option value="middle">وسط</option><option value="end">نهاية</option></select></label>
        </div>
        <textarea className={styles.rawText} value={subtitleContent} onChange={(event) => setSubtitleContent(event.target.value)} placeholder="ألصق أو افتح ملف SRT / WebVTT هنا…" aria-label="محتوى ملف الترجمة" />
        <div className="button-row"><button className="button button-secondary" type="button" onClick={() => void copySubtitles()} disabled={!subtitleContent}>نسخ</button><button className="button button-secondary" type="button" onClick={downloadSubtitles} disabled={!subtitleContent}>تنزيل الملف</button><button className="button button-primary" type="button" onClick={() => void saveSubtitlesToRecord()} disabled={!subtitleContent || !subtitleRecordId.trim()}>حفظ على المادة</button></div>
        {subtitleMessage ? <p className="helper-text" role="status">{subtitleMessage}</p> : null}
        {subtitleContent ? <div className={styles.subtitlePreview} style={{ fontSize: `${subtitleFontSize}px`, color: subtitleColor, textAlign: subtitleAlign === "middle" ? "center" : subtitleAlign }} aria-label="معاينة نمط الترجمة">{parseSubtitles(subtitleContent).slice(0, 3).map((cue) => <p key={cue.index}>{cue.text}</p>)}</div> : null}
      </section>

      <div className={`split-layout ${styles.console}`} aria-label="أدوات التفريغ الصوتي">
        <div className={styles.formPanel}>
          <form ref={formRef} className="panel auth-form" onSubmit={handleSubmit} aria-label="إنشاء مهمة تفريغ صوتي">
            <label>
              ابحث في وسائط مهام التفريغ السابقة
              <input type="search" value={mediaQuery} onChange={(event) => setMediaQuery(event.target.value)} placeholder="معرّف السجل أو مسار الملف" />
            </label>
            {mediaQuery && selectableJobs.length ? (
              <div className="stack" aria-label="نتائج اختيار الوسائط">
                {selectableJobs.slice(0, 5).map((job) => (
                  <button key={job.id} type="button" className="button button-secondary" onClick={() => selectPreviousMedia(job)}>
                    {job.recordId} · {job.sourcePath || "بدون مسار"}
                  </button>
                ))}
              </div>
            ) : null}
            <label>
              معرّف السجل
              <input name="recordId" type="text" placeholder="record-id" required />
            </label>

            <label>
              مسار الملف المصدر
              <input name="sourcePath" type="text" placeholder="audio/clip.mp3" required />
            </label>

            <label>
              قرص التخزين (اختياري)
              <input name="disk" type="text" placeholder="مثل: archive" />
            </label>

            <label>
              لغة التفريغ
              <input name="language" type="text" defaultValue="ar" />
            </label>

            <p className="helper-text">يعتمد الجهاز على إعداد Whisper العام. اختر GPU من الإعدادات فقط بعد تشغيل عامل CUDA.</p>

            <fieldset className="stack" style={{ gap: '0.5rem' }}>
              <legend>صيغ الإخراج</legend>
              <label className="checkbox-row">
                <input name="format-srt" type="checkbox" defaultChecked />
                SRT (نص مع الطوابع)
              </label>
              <label className="checkbox-row">
                <input name="format-vtt" type="checkbox" defaultChecked />
                VTT (فيديو ويب)
              </label>
              <label className="checkbox-row">
                <input name="format-ttml" type="checkbox" defaultChecked />
                TTML (تنسيق توقيت نص)
              </label>
            </fieldset>

            <button
              type="submit"
              className="button button-primary"
              disabled={submitState.status === "submitting" || (submitState.status === "tracking" && submitState.job.status !== "completed" && submitState.job.status !== "failed")}
            >
              {submitState.status === "submitting" ? "جار الإرسال..." : "ابدأ التفريغ"}
            </button>

            <p className="form-status" role={submitState.status === "error" ? "alert" : "status"}>
              {submitState.status === "error" ? submitState.message : ""}
            </p>
          </form>
        </div>

        <div className={styles.resultPanel}>
          {trackedJob ? (
            <article className="panel stack">
              <div className="panel-section-header">
                <h2>حالة المهمة</h2>
                <span className="badge">{trackedJob.status}</span>
              </div>

              {(trackedJob.status === "queued" || trackedJob.status === "processing") && (
                <div className="state-banner">
                  <div className="helper-row">
                    <strong>{trackedJob.progressStage || "جاري التفريغ"}</strong>
                    <span className="field-note">{(trackedJob.progressPercent ?? 0)}%</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${(trackedJob.progressPercent ?? 0)}%`, height: "100%", backgroundColor: "currentColor", transition: "width 0.2s" }} />
                  </div>
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => handleCancel(trackedJob.id)}
                    disabled={submitState.status === "submitting"}
                  >
                    إلغاء
                  </button>
                </div>
              )}

              <div className="kv-grid">
                <div className="kv-item">
                  <strong>المعرّف</strong>
                  <span className="wrap-anywhere mono-text">{trackedJob.id}</span>
                </div>
                <div className="kv-item">
                  <strong>المصدر</strong>
                  <span className="wrap-anywhere">{trackedJob.sourcePath}</span>
                </div>
              </div>

              {trackedJob.status === "failed" && (
                <p role="alert" className="form-status status-error">
                  فشلت المهمة: {trackedJob.error || "خطأ غير معروف"}
                </p>
              )}

              {trackedJob.status === "completed" && (
                <>
                  <div className="toolbar-row">
                    <h3>{cues.length > 0 ? `النص (${cues.length} مقطع)` : "النص"}</h3>
                    <div className="button-row">
                      <button type="button" className="button button-secondary" onClick={() => setShowRaw((v) => !v)}>
                        {showRaw ? "عرض النص المقسّم" : "عرض النص الخام"}
                      </button>
                      <button type="button" className="button button-secondary" onClick={handleCopy}>
                        {copied ? "تم النسخ" : "نسخ النص"}
                      </button>
                    </div>
                  </div>

                  {showRaw ? (
                    <textarea readOnly value={transcriptText} className={styles.rawText} aria-label="النص الخام" />
                  ) : cues.length > 0 ? (
                    <div className={styles.cueList}>
                      {cues.map((cue) => (
                        <div className={styles.cueRow} key={cue.index}>
                          <span className={`mono-text ${styles.cueTime}`}>{formatCueTime(cue.start)}</span>
                          <span>{cue.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="helper-text">{plainText || "لا يوجد نص مُستخرج بعد."}</p>
                  )}
                </>
              )}

              {(trackedJob.status === "queued" || trackedJob.status === "processing") && (
                <p className="form-status">جار التفريغ، يتم التحديث تلقائياً...</p>
              )}
            </article>
          ) : (
            <EmptyState
              title="لا توجد مهمة تفريغ نشطة"
              description="أدخل معرّف السجل ومسار الملف ثم اضغط ابدأ التفريغ لمتابعة التقدّم هنا."
            />
          )}
        </div>
      </div>

      <section className="stack" aria-label="مهام التفريغ الأخيرة">
        <div className="toolbar-row">
          <h2>مهام التفريغ الأخيرة</h2>
        </div>

        {recentState.status === "loading" && <Skeleton label="جار تحميل عمليات التفريغ الأخيرة..." />}
        {recentState.status === "empty" && <p className="empty-state">لا توجد مهام تفريغ سابقة.</p>}
        {recentState.status === "error" && (
          <p role="alert" className="form-status status-error">
            خطأ: {recentState.message}
          </p>
        )}

        {recentState.status === "loaded" && (
          <div className="stack">
            {recentState.jobs.map((job) => (
              <article className="panel" key={job.id}>
                <div className="toolbar-row">
                  <span className="wrap-anywhere mono-text">{job.id}</span>
                  <span className="badge">{job.status}</span>
                </div>
                {job.sourcePath && (
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>المصدر</strong>
                      <span className="wrap-anywhere">{job.sourcePath}</span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
