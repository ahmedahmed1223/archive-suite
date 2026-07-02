"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import MediaPlayer from "@/components/MediaPlayer";

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

      <section className="content stack" aria-label="تشغيل الوسائط">
        <div className="hero">
          <span className="badge">HTTP Range</span>
          <h1>تشغيل المادة.</h1>
          <p>
            يُبث الملف عبر Laravel بدلاً من فتحه محلياً، فيعمل السحب داخل
            الفيديو والصوت عبر المتصفح مع مصادقة النظام.
          </p>
        </div>

        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            setPath(pathInput.trim());
            setDisk(diskInput.trim());
          }}
        >
          <input
            value={pathInput}
            onChange={(event) => setPathInput(event.target.value)}
            placeholder="مسار المادة داخل الأرشيف، مثل: video/clip.mp4"
            aria-label="مسار المادة"
            className="search-input"
          />
          <input
            value={diskInput}
            onChange={(event) => setDiskInput(event.target.value)}
            placeholder="disk اختياري"
            aria-label="قرص التخزين"
            className="search-input input-narrow"
          />
          <button type="submit" className="button button-primary">تشغيل</button>
        </form>

        <article className="panel">
          {path ? (
            <MediaPlayer
              path={path}
              disk={disk || undefined}
              title={disk ? `${disk}:${path}` : path}
              showTimeline
              transcriptText={transcriptText}
            />
          ) : (
            <div className="empty-state">أدخل مساراً أو اختر ملفاً قابلاً للتشغيل من صفحة الملفات.</div>
          )}
        </article>

        <section className="panel stack" aria-label="تفريغ متزامن">
          <div className="panel-title-row">
            <div>
              <h2>تفريغ زمني</h2>
              <p>VTT أو SRT</p>
            </div>
            <span className="badge">{transcriptText.trim() ? "مفعّل" : "اختياري"}</span>
          </div>
          <textarea
            className="search-input"
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            rows={7}
            dir="ltr"
            placeholder={"WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nالمقطع الأول"}
          />
        </section>
      </section>
    </main>
  );
}
