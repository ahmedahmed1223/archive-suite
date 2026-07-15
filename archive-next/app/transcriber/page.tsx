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
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialogs = useConfirmDialog();
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [recentState, setRecentState] = useState<RecentState>({ status: "loading" });
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
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
    const device = String(data.get("device") ?? "cpu").trim() || "cpu";

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
      options: { language, device, outputFormats, ...(disk ? { disk } : {}) }
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

  return (
    <AppShell subtitle="التفريغ الصوتي" contentClassName={`stack ${styles.transcriberContent}`}>
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

            <label>
              نوع المعالج
              <select name="device" defaultValue="cpu">
                <option value="cpu">CPU (أسرع تحميل)</option>
                <option value="gpu">GPU (أسرع معالجة)</option>
                <option value="auto">تلقائي</option>
              </select>
            </label>

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

        {recentState.status === "loading" && <p className="form-status">جار التحميل...</p>}
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
