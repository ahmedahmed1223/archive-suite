"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { redactAdminSecrets } from "@/lib/admin-action-summary";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type ShareState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[]; permission?: string }
  | { status: "error"; message: string };

export function ShareViewer({ token }: { token: string }) {
  const { t } = useLocale();
  const copy = t.pages.shareViewer;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ShareState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    api.share(token).then((response) => {
      if (!active) return;

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({
        status: "ready",
        records: response.records,
        permission: typeof response.permission === "string" ? response.permission : undefined
      });
    });

    return () => {
      active = false;
    };
  }, [api, token]);

  if (state.status === "loading") {
    return (
      <div className="state-banner" role="status">
        <strong>{copy.loading}</strong>
        <p className="helper-text">{copy.loadingDescription}</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="state-banner state-banner-error" role="alert">
        <strong>{copy.error}</strong>
        <p className="helper-text">{redactAdminSecrets(state.message)}</p>
      </div>
    );
  }

  return (
    <main className="share-list" aria-label={copy.content}>
      <p className="helper-text">{copy.notice}</p>
      <div className="kv-grid">
        <div className="kv-item">
          <strong>{copy.permission}</strong>
          <span>{state.permission ?? "view"}</span>
        </div>
        <div className="kv-item">
          <strong>{copy.records}</strong>
          <span>{state.records.length}</span>
        </div>
      </div>
      {state.records.length === 0 ? (
        <div className="empty-state">{copy.empty}</div>
      ) : (
        state.records.map((record) => (
          <article className="panel" key={record.uid ?? record.id}>
            <h2>{record.title}</h2>
            {record.description ? <p>{redactAdminSecrets(record.description)}</p> : null}
            <div className="record-meta">
              <span className="badge">{record.type ?? copy.record}</span>
              <span className="badge wrap-anywhere">{record.uid ?? record.id}</span>
            </div>
          </article>
        ))
      )}
    </main>
  );
}
