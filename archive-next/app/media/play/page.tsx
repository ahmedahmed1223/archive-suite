"use client";

import { useState } from "react";
import MediaPlayer from "@/components/MediaPlayer";

export default function MediaPlayPage() {
  const [pathInput, setPathInput] = useState("");
  const [path, setPath] = useState("");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem", display: "grid", gap: "1.25rem" }}>
      <header style={{ display: "grid", gap: 4 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>تشغيل المادة</h1>
        <p style={{ margin: 0, color: "var(--muted, #666)" }}>
          يُبثّ الملف عبر الخادم (يدعم السحب/التقديم) — يعمل مع الوسائط المحلية دون قيود المتصفح على{" "}
          <code>file://</code>.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPath(pathInput.trim());
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <input
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          placeholder="مسار المادة داخل الأرشيف، مثل: video/clip.mp4"
          aria-label="مسار المادة"
          style={{ flex: 1, minWidth: 240, padding: "0.6rem 0.75rem", borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          style={{ padding: "0.6rem 1.1rem", borderRadius: 8, border: "none", background: "#1a1a1a", color: "#fff", cursor: "pointer" }}
        >
          تشغيل
        </button>
      </form>

      {path ? <MediaPlayer path={path} title={path} /> : <p style={{ color: "var(--muted, #888)" }}>أدخل مساراً ثم اضغط «تشغيل».</p>}
    </main>
  );
}
