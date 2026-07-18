"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createArchiveApiClient } from "@/lib/archive-api";

const api = createArchiveApiClient();

export function FilelessRecordForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setStatus("");
    const response = await api.createRecord({
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(type.trim() ? { type: type.trim() } : {}),
      tags: tags.split(/[,،]/).map((tag) => tag.trim()).filter(Boolean)
    });
    setBusy(false);
    if (!response.ok) {
      setStatus(response.error);
      return;
    }
    router.push(`/archive/${encodeURIComponent(response.record.id)}`);
  }

  return (
    <details className="panel">
      <summary><strong>إنشاء سجل وصفي بلا ملف</strong></summary>
      <p className="helper-text">أنشئ البيانات أولاً، ثم أضف ملفاً واحداً أو عدة مرفقات لاحقاً من صفحة السجل.</p>
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>العنوان *</span><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={500} /></label>
        <label className="field"><span>الوصف</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
        <div className="form-grid">
          <label className="field"><span>النوع</span><input value={type} onChange={(event) => setType(event.target.value)} /></label>
          <label className="field"><span>الوسوم</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="افصل بفاصلة" /></label>
        </div>
        <button className="button button-primary" disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء السجل"}</button>
        {status ? <p className="form-status" role="status">{status}</p> : null}
      </form>
    </details>
  );
}
