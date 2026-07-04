"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { createArchiveApiClient, type ImportPreview } from "@/lib/archive-api";

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: ImportPreview }
  | { status: "error"; message: string };

export function ImportFromUrlForm() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<PreviewState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) return;

    setState({ status: "loading" });
    const response = await api.previewImportUrl(url.trim());

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({ status: "ready", preview: response.preview });
  }

  return (
    <article className="panel">
      <div className="toolbar-row">
        <div>
          <h2>استيراد من رابط</h2>
          <p className="field-note">أدخل رابط ملف عام (http/https) لمعاينة نوعه وحجمه قبل إنشاء سجل.</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          رابط الملف
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/video.mp4"
            dir="ltr"
            required
            disabled={state.status === "loading"}
          />
        </label>

        <button type="submit" className="button button-primary" disabled={state.status === "loading" || !url.trim()}>
          {state.status === "loading" ? "جار المعاينة..." : "معاينة الرابط"}
        </button>

        {state.status === "error" ? (
          <p className="form-status" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "ready" ? (
          <div className="state-banner state-banner-success">
            <strong>معاينة الاستيراد</strong>
            <div className="kv-grid">
              <div className="kv-item">
                <strong>النوع المقترح</strong>
                <span>{state.preview.suggestedType}</span>
              </div>
              <div className="kv-item">
                <strong>نوع المحتوى</strong>
                <span dir="ltr">{state.preview.contentType}</span>
              </div>
              <div className="kv-item">
                <strong>الحجم</strong>
                <span>{state.preview.contentLength ? `${Math.round(state.preview.contentLength / 1024)} KB` : "غير معروف"}</span>
              </div>
              <div className="kv-item">
                <strong>العنوان المقترح</strong>
                <span>{state.preview.suggestedTitle}</span>
              </div>
            </div>
            <p className="helper-text">استخدم نموذج الرفع أعلاه أو أداة الاستيراد المجدولة لإنشاء السجل فعليًا.</p>
          </div>
        ) : null}
      </form>
    </article>
  );
}
