"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const api = createArchiveApiClient();

export function FilelessRecordForm() {
  const { t } = useLocale();
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
      <summary><strong>{t.pages.filelessRecordForm.heading}</strong></summary>
      <p className="helper-text">{t.pages.filelessRecordForm.helperText}</p>
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>{t.pages.filelessRecordForm.titleLabel}</span><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={500} /></label>
        <label className="field"><span>{t.pages.filelessRecordForm.descriptionLabel}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
        <div className="form-grid">
          <label className="field"><span>{t.pages.filelessRecordForm.typeLabel}</span><input value={type} onChange={(event) => setType(event.target.value)} /></label>
          <label className="field"><span>{t.pages.filelessRecordForm.tagsLabel}</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t.pages.filelessRecordForm.tagsPlaceholder} /></label>
        </div>
        <button className="button button-primary" disabled={busy}>{busy ? t.pages.filelessRecordForm.submitButtonBusy : t.pages.filelessRecordForm.submitButton}</button>
        {status ? <p className="form-status" role="status">{status}</p> : null}
      </form>
    </details>
  );
}
