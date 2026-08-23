"use client";

import { useState, type FormEvent } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const api = createArchiveApiClient();

export function FilelessRecordForm() {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // V14-UX-REVIEW-3: daily users create several records in a row — stay on
  // the form with a success banner instead of navigating away each time.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState("");

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
    setCreatedId(response.record.id);
    setCreatedTitle(title.trim());
    setTitle("");
    setDescription("");
    setTags("");
  }

  return (
    <section className="panel">
      <h3>{t.pages.filelessRecordForm.heading}</h3>
      <p className="helper-text">{t.pages.filelessRecordForm.helperText}</p>

      {createdId ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>{t.pages.filelessRecordForm.createdBanner.replace("{title}", createdTitle)}</strong>
          <span className="button-row">
            <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(createdId)}`}>
              {t.pages.filelessRecordForm.createdOpen}
            </a>
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => { setCreatedId(null); setCreatedTitle(""); }}
            >
              {t.pages.filelessRecordForm.createdAnother}
            </button>
          </span>
        </div>
      ) : null}

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
    </section>
  );
}
