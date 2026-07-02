"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import MediaPlayer from "@/components/MediaPlayer";
import styles from "./play.module.css";

export default function MediaPlayPage() {
  const [pathInput, setPathInput] = useState("");
  const [diskInput, setDiskInput] = useState("");
  const [path, setPath] = useState("");
  const [disk, setDisk] = useState("");
  const [transcriptText, setTranscriptText] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParam = params.get("path")?.trim() ?? "";
    const diskParam = params.get("disk")?.trim() ?? "";

    if (pathParam) {
      setPathInput(pathParam);
      setPath(pathParam);
    }

    if (diskParam) {
      setDiskInput(diskParam);
      setDisk(diskParam);
    }
  }, []);

  return (
    <main className="shell">
      <AppHeader subtitle="مشغل الوسائط" />

      <section className={`content stack ${styles.playContent}`} aria-label="تشغيل الوسائط">
        <div className="hero">
          <span className="badge">HTTP Range</span>
          <h1>تشغيل المادة.</h1>
          <p>
            يُبث الملف عبر Laravel بدلاً من فتحه محلياً، فيعمل السحب داخل
            الفيديو والصوت عبر المتصفح مع مصادقة النظام.
          </p>
        </div>

        <form
          className={`panel auth-form ${styles.pathInputForm}`}
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
        </form>

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
                  <p>VTT أو SRT</p>
                </div>
                <span className="badge">{transcriptText.trim() ? "مفعّل" : "اختياري"}</span>
              </div>
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
          <div className="empty-state">أدخل مساراً لبدء التشغيل.</div>
        )}
      </section>
    </main>
  );
}
