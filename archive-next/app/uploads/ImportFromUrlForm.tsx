"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { createArchiveApiClient, type ImportPreview } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: ImportPreview }
  | { status: "error"; message: string };

export function ImportFromUrlForm() {
  const { t } = useLocale();
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
          <h2>{t.pages.importFromUrlForm.title}</h2>
          <p className="field-note">{t.pages.importFromUrlForm.description}</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          {t.pages.importFromUrlForm.urlLabel}
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t.pages.importFromUrlForm.urlPlaceholder}
            dir="ltr"
            required
            disabled={state.status === "loading"}
          />
        </label>

        <button type="submit" className="button button-primary" disabled={state.status === "loading" || !url.trim()}>
          {state.status === "loading" ? t.pages.importFromUrlForm.previewing : t.pages.importFromUrlForm.previewButton}
        </button>

        {state.status === "error" ? (
          <p className="form-status" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "ready" ? (
          <div className="state-banner state-banner-success">
            <strong>{t.pages.importFromUrlForm.previewHeading}</strong>
            <div className="kv-grid">
              <div className="kv-item">
                <strong>{t.pages.importFromUrlForm.suggestedType}</strong>
                <span>{state.preview.suggestedType}</span>
              </div>
              <div className="kv-item">
                <strong>{t.pages.importFromUrlForm.contentType}</strong>
                <span dir="ltr">{state.preview.contentType}</span>
              </div>
              <div className="kv-item">
                <strong>{t.pages.importFromUrlForm.size}</strong>
                <span>{state.preview.contentLength ? `${Math.round(state.preview.contentLength / 1024)} KB` : t.pages.importFromUrlForm.sizeUnknown}</span>
              </div>
              <div className="kv-item">
                <strong>{t.pages.importFromUrlForm.suggestedTitle}</strong>
                <span>{state.preview.suggestedTitle}</span>
              </div>
            </div>
            <p className="helper-text">{t.pages.importFromUrlForm.helperText}</p>
          </div>
        ) : null}
      </form>
    </article>
  );
}
