"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type UploadLink } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type UploadLinksState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function UploadLinksPanel() {
  const { t } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [links, setLinks] = useState<UploadLink[]>([]);
  const [linksState, setLinksState] = useState<UploadLinksState>({ status: "loading" });
  const [label, setLabel] = useState("");
  const [folder, setFolder] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function refresh() {
    setLinksState({ status: "loading" });
    const response = await api.uploadLinks();
    if (response.ok) {
      setLinks(response.links);
      setLinksState({ status: "ready" });
    } else {
      setLinksState({ status: "error", message: response.error || t.pages.uploadLinksPanel.loadError });
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh is redefined every render; this effect should run once on mount only
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);
    const response = await api.createUploadLink({
      label: label || undefined,
      folder: folder || undefined,
      expiresInHours
    });

    if (!response.ok) {
      setError(response.error);
      setIsCreating(false);
      return;
    }

    setLabel("");
    setFolder("");
    await refresh();
    setIsCreating(false);
  }

  async function handleRevoke(id: string) {
    setError(null);
    setRevokingId(id);
    const response = await api.revokeUploadLink(id);
    if (response.ok) await refresh();
    else setError(response.error || t.pages.uploadLinksPanel.revokeError);
    setRevokingId(null);
  }

  return (
    <article className="panel">
      <div className="toolbar-row">
        <div>
          <h2>{t.pages.uploadLinksPanel.title}</h2>
          <p className="field-note">{t.pages.uploadLinksPanel.description}</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <label>
          {t.pages.uploadLinksPanel.labelLabel}
          <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} placeholder={t.pages.uploadLinksPanel.labelPlaceholder} />
        </label>
        <label>
          {t.pages.uploadLinksPanel.folderLabel}
          <input type="text" value={folder} onChange={(event) => setFolder(event.target.value)} dir="ltr" placeholder={t.pages.uploadLinksPanel.folderPlaceholder} />
        </label>
        <label>
          {t.pages.uploadLinksPanel.expiryLabel}
          <input
            type="number"
            min={1}
            max={720}
            value={expiresInHours}
            onChange={(event) => setExpiresInHours(Number(event.target.value) || 1)}
          />
        </label>
        <button type="submit" className="button button-primary" disabled={isCreating}>{isCreating ? t.pages.uploadLinksPanel.creating : t.pages.uploadLinksPanel.createButton}</button>
        {error ? (
          <p className="form-status" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {linksState.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label={t.pages.uploadLinksPanel.loading} /></div>
      ) : linksState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.uploadLinksPanel.loadErrorHeading}</strong>
          <span className="helper-text">{linksState.message}</span>
          <div><button type="button" className="button button-secondary button-sm" onClick={() => void refresh()}>{t.pages.uploadLinksPanel.retry}</button></div>
        </div>
      ) : links.length === 0 ? (
        <p className="helper-text">{t.pages.uploadLinksPanel.empty}</p>
      ) : (
        <ul className="stack">
          {links.map((link) => (
            <li key={link.id} className="record-meta">
              <span className="badge">{link.label || t.pages.uploadLinksPanel.unlabeled}</span>
              {link.folder ? <span className="badge">{link.folder}</span> : null}
              <span className="badge">{link.revoked ? t.pages.uploadLinksPanel.revoked : t.pages.uploadLinksPanel.active}</span>
              <span className="badge">{t.pages.uploadLinksPanel.uploadedFilesCount.replace("{count}", String(link.uploadCount))}</span>
              {!link.revoked ? (
                <button type="button" className="button button-secondary button-sm" disabled={revokingId === link.id} onClick={() => void handleRevoke(link.id)}>
                  {revokingId === link.id ? t.pages.uploadLinksPanel.revoking : t.pages.uploadLinksPanel.revokeButton}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
