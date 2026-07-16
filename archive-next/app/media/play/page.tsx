"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MediaPlayer from "@/components/MediaPlayer";
import MediaSourcePicker from "@/components/MediaSourcePicker";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import PageToolbar from "@/components/PageToolbar";
import { parseSubtitles } from "@/lib/media/subtitles";
import { createArchiveApiClient } from "@/lib/archive-api";
import styles from "./play.module.css";
import "../media.css";

export default function MediaPlayPage() {
  const [pathInput, setPathInput] = useState("");
  const [diskInput, setDiskInput] = useState("");
  const [path, setPath] = useState("");
  const [disk, setDisk] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptFileName, setTranscriptFileName] = useState("");
  const [transcriptStatus, setTranscriptStatus] = useState("");
  const [recordId, setRecordId] = useState("");
  const [recordStore, setRecordStore] = useState("");
  const transcriptCueCount = parseSubtitles(transcriptText).length;
  const api = useMemo(() => createArchiveApiClient(), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParam = params.get("path")?.trim() ?? "";
    const diskParam = params.get("disk")?.trim() ?? "";
    const recordIdParam = params.get("recordId")?.trim() ?? "";

    if (pathParam) {
      setPathInput(pathParam);
      setPath(pathParam);
    }

    if (diskParam) {
      setDiskInput(diskParam);
      setDisk(diskParam);
    }

    if (!recordIdParam) return;

    setRecordId(recordIdParam);
    setTranscriptStatus("جار تحميل التفريغ المحفوظ...");
    void api.record(recordIdParam)
      .then((response) => {
        if (!response.ok) {
          setTranscriptStatus(`تعذر تحميل التفريغ المحفوظ: ${response.error}`);
          return;
        }

        setTranscriptText(response.record.transcript ?? "");
        setRecordStore(response.record.store ?? "");
        setTranscriptStatus(response.record.transcript?.trim() ? "تم تحميل التفريغ المحفوظ." : "لا يوجد تفريغ محفوظ لهذا السجل.");
      })
      .catch(() => setTranscriptStatus("تعذر تحميل التفريغ المحفوظ."));
  }, [api]);

  async function handleTranscriptFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["srt", "vtt"].includes(extension)) {
      setTranscriptStatus("اختر ملف SRT أو VTT.");
      return;
    }

    try {
      const text = await file.text();
      const cues = parseSubtitles(text);
      if (cues.length === 0) {
        setTranscriptStatus("لم يتم العثور على مقاطع زمنية صالحة داخل الملف.");
        return;
      }

      setTranscriptText(text);
      setTranscriptFileName(file.name);
      if (!recordId) {
        setTranscriptStatus(`تم استيراد ${cues.length} مقطع زمني للمعاينة فقط.`);
        return;
      }

      setTranscriptStatus("جار حفظ التفريغ في السجل...");
      const response = await api.updateRecordTranscript(recordId, {
        transcript: text,
        ...(recordStore ? { store: recordStore } : {})
      });
      setTranscriptStatus(
        response.ok
          ? `تم استيراد وحفظ ${cues.length} مقطع زمني في السجل.`
          : `تم الاستيراد للمعاينة، وتعذر حفظ التفريغ: ${response.error}`
      );
    } catch (error) {
      setTranscriptStatus(error instanceof Error ? error.message : "تعذر قراءة ملف التفريغ.");
    } finally {
      event.target.value = "";
    }
  }

  function clearTranscript() {
    setTranscriptText("");
    setTranscriptFileName("");
    setTranscriptStatus("");
  }

  return (
    <AppShell subtitle="مشغل الوسائط" contentClassName={styles.playContent} tipsPage="media-play">
      <PageToolbar
        eyebrow={<span className="badge">HTTP Range</span>}
        title="تشغيل المادة"
        description="يُبث الملف عبر الخادم بدلاً من فتحه محلياً، فيعمل السحب داخل الفيديو والصوت عبر المتصفح مع مصادقة النظام."
        meta={<span className="badge">{path ? "قيد التشغيل" : "بانتظار مسار"}</span>}
      >
        <form
          className={`auth-form ${styles.pathInputForm}`}
          onSubmit={(event) => {
            event.preventDefault();
            setPath(pathInput.trim());
            setDisk(diskInput.trim());
          }}
        >
          <label>
            مسار المادة داخل الأرشيف
            <input
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              placeholder="مثل: video/clip.mp4"
              aria-label="مسار المادة"
            />
            <p className="helper-text">مسار نسبي داخل التخزين المختار</p>
          </label>
          <label>
            قرص التخزين (اختياري)
            <input
              value={diskInput}
              onChange={(event) => setDiskInput(event.target.value)}
              placeholder="مثل: archive"
              aria-label="قرص التخزين"
            />
            <p className="helper-text">ترك فارغ للقرص الافتراضي</p>
          </label>
          <button type="submit" className="button button-primary">تشغيل</button>
          <MediaSourcePicker
            label="تصفح المصادر"
            onSelect={(selectedPath) => {
              setPathInput(selectedPath);
              setPath(selectedPath);
            }}
          />
        </form>
      </PageToolbar>

      <OperationalSafetyPanel action="تشغيل المادة" dryRun confidence={96} auditHref="/activity" />

      {path ? (
        <div className={styles.theaterLayout}>
          <article className={`panel media-frame ${styles.playerPanel}`}>
            <MediaPlayer
              path={path}
              disk={disk || undefined}
              title={disk ? `${disk}:${path}` : path}
              showTimeline
              transcriptText={transcriptText}
            />
          </article>

          <section className={`panel stack ${styles.transcriptPanel}`} aria-label="تفريغ متزامن">
            <div className="panel-title-row">
              <div>
                <h2>تفريغ زمني</h2>
                <p>{recordId ? "VTT أو SRT — يحفظ في السجل" : "VTT أو SRT — معاينة محلية"}</p>
              </div>
              <span className="badge">{transcriptCueCount > 0 ? `${transcriptCueCount} مقطع` : "اختياري"}</span>
            </div>
            <div className={styles.transcriptActions}>
              <label className="button button-secondary button-sm">
                استيراد SRT/VTT
                <input
                  type="file"
                  accept=".srt,.vtt,text/vtt"
                  onChange={handleTranscriptFile}
                  className={styles.transcriptFileInput}
                />
              </label>
              <button type="button" className="button button-secondary button-sm" onClick={clearTranscript} disabled={!transcriptText.trim()}>
                مسح التفريغ
              </button>
              {transcriptFileName ? <span className="badge">{transcriptFileName}</span> : null}
            </div>
            {transcriptStatus ? <p className="form-status">{transcriptStatus}</p> : null}
            <textarea
              value={transcriptText}
              onChange={(event) => setTranscriptText(event.target.value)}
              rows={7}
              dir="ltr"
              placeholder={"WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nالمقطع الأول"}
              className={styles.transcriptInput}
            />
          </section>
        </div>
      ) : (
        <EmptyState
          title="أدخل مساراً لبدء التشغيل."
          description="استخدم مسار الملف النسبي داخل التخزين، مع تحديد القرص إن لم يكن الافتراضي."
        />
      )}
    </AppShell>
  );
}
