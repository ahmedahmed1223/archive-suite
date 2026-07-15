"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type IntakeTemplate } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";

type IntakeTemplatesState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function IntakeTemplatesPanel() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [templates, setTemplates] = useState<IntakeTemplate[]>([]);
  const [templatesState, setTemplatesState] = useState<IntakeTemplatesState>({ status: "loading" });
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [folder, setFolder] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    setTemplatesState({ status: "loading" });
    const response = await api.intakeTemplates();
    if (response.ok) {
      setTemplates(response.templates);
      setTemplatesState({ status: "ready" });
    } else {
      setTemplatesState({ status: "error", message: response.error || "تعذر تحميل قوالب الإدخال." });
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const fields: Record<string, unknown> = {};
    if (folder.trim()) fields.folder = folder.trim();
    if (tags.trim()) fields.tags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);

    if (Object.keys(fields).length === 0) {
      setError("أضف حقلاً واحدًا على الأقل للقالب (مجلد أو وسوم).");
      return;
    }

    setIsCreating(true);
    const response = await api.createIntakeTemplate({ name, type: type || undefined, fields });

    if (!response.ok) {
      setError(response.error);
      setIsCreating(false);
      return;
    }

    setName("");
    setType("");
    setFolder("");
    setTags("");
    await refresh();
    setIsCreating(false);
  }

  async function handleDelete(id: string) {
    setError(null);
    setDeletingId(id);
    const response = await api.deleteIntakeTemplate(id);
    if (response.ok) await refresh();
    else setError(response.error || "تعذر حذف القالب.");
    setDeletingId(null);
  }

  return (
    <article className="panel">
      <div className="toolbar-row">
        <div>
          <h2>قوالب الإدخال</h2>
          <p className="field-note">احفظ مجموعة حقول متكررة (مجلد، وسوم) لتسريع إدخال السجلات المتشابهة.</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <label>
          اسم القالب
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          النوع (اختياري)
          <input type="text" value={type} onChange={(event) => setType(event.target.value)} placeholder="video" dir="ltr" />
        </label>
        <label>
          مجلّد افتراضي (اختياري)
          <input type="text" value={folder} onChange={(event) => setFolder(event.target.value)} dir="ltr" />
        </label>
        <label>
          وسوم افتراضية (مفصولة بفاصلة)
          <input type="text" value={tags} onChange={(event) => setTags(event.target.value)} />
        </label>
        <button type="submit" className="button button-primary" disabled={isCreating}>{isCreating ? "جار الحفظ..." : "حفظ القالب"}</button>
        {error ? (
          <p className="form-status" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {templatesState.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label="جار تحميل قوالب الإدخال..." /></div>
      ) : templatesState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل قوالب الإدخال</strong>
          <span className="helper-text">{templatesState.message}</span>
          <div><button type="button" className="button button-secondary button-sm" onClick={() => void refresh()}>إعادة المحاولة</button></div>
        </div>
      ) : templates.length === 0 ? (
        <p className="helper-text">لا توجد قوالب محفوظة بعد.</p>
      ) : (
        <ul className="stack">
          {templates.map((template) => (
            <li key={template.id} className="record-meta">
              <span className="badge">{template.name}</span>
              {template.type ? <span className="badge">{template.type}</span> : null}
              <button type="button" className="button button-secondary button-sm" disabled={deletingId === template.id} onClick={() => void handleDelete(template.id)}>
                {deletingId === template.id ? "جار الحذف..." : "حذف"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
