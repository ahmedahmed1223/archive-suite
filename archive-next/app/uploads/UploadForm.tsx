"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createArchiveApiClient, type IntakeTemplate, type UploadedRecord } from "@/lib/archive-api";

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; record: UploadedRecord }
  | { status: "error"; message: string };

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function UploadForm() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState("");
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [templates, setTemplates] = useState<IntakeTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    void api.intakeTemplates().then((response) => {
      if (!cancelled && response.ok) setTemplates(response.templates);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    const templateFolder = template?.fields?.folder;
    if (typeof templateFolder === "string") {
      setFolder(templateFolder);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setState({ status: "error", message: "اختر ملفًا للرفع أولًا." });
      return;
    }

    setState({ status: "uploading" });
    const response = await api.uploadFile(file, folder ? { folder } : undefined);

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({ status: "success", record: response.record });
    setFile(null);
    setFolder("");
    formRef.current?.reset();
  }

  function resetUpload() {
    setState({ status: "idle" });
    setFile(null);
    setFolder("");
    formRef.current?.reset();
  }

  return (
    <article className="panel">
      <div className="toolbar-row">
        <div>
          <h2>رفع ملف جديد</h2>
          <p className="field-note">يدعم الصور والفيديو والمستندات الشائعة. تُنشأ صورة مصغّرة تلقائيًا لملفات الوسائط.</p>
        </div>
      </div>

      <form ref={formRef} className="auth-form" onSubmit={handleSubmit}>
        {templates.length > 0 ? (
          <label>
            قالب الإدخال (اختياري)
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

        <label>
          الملف
          <input type="file" onChange={handleFileChange} required disabled={state.status === "uploading"} />
        </label>

        <label>
          مجلّد الوجهة (اختياري)
          <input
            type="text"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            placeholder="مثال: campaigns/2026"
            dir="ltr"
            disabled={state.status === "uploading"}
          />
        </label>

        {file ? (
          <p className="field-note">
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : null}

        <button type="submit" className="button button-primary" disabled={state.status === "uploading" || !file}>
          {state.status === "uploading" ? "جار الرفع..." : "رفع الملف"}
        </button>

        <p className="form-status" role={state.status === "error" ? "alert" : "status"}>
          {state.status === "error"
              ? state.message
              : ""}
        </p>

        {state.status === "success" ? (
          <div className="state-banner state-banner-success">
            <strong>تم الرفع بنجاح</strong>
            <p className="helper-text">
              {state.record.fileName} - سجل {state.record.id}
            </p>
            <div className="button-row">
              <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(state.record.id)}`}>
                فتح السجل
              </a>
              <button type="button" className="button button-secondary button-sm" onClick={resetUpload}>
                رفع ملف آخر
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </article>
  );
}
