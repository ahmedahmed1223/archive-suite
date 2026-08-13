"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type ReviewLinkDetails } from "@/lib/archive-api";
import { buildShareExpiry, redactAdminSecrets } from "@/lib/admin-action-summary";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type ReviewLinkState =
  | { status: "loading" }
  | { status: "ready"; data: ReviewLinkDetails }
  | { status: "error"; message: string };

function localizedExpiryLabel(
  expiresAt: string | null | undefined,
  labels: { noExpiry: string; unavailable: string; expired: string; soon: string; active: string }
): string {
  if (!expiresAt) return labels.noExpiry;
  const expiryTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryTime)) return labels.unavailable;
  const remaining = expiryTime - Date.now();
  if (remaining <= 0) return labels.expired;
  if (remaining <= 48 * 60 * 60 * 1000) return labels.soon;
  return labels.active;
}

export function ReviewLinkViewer({ token }: { token: string }) {
  const { locale, t } = useLocale();
  const copy = t.pages.reviewLink.viewer;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ReviewLinkState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    api.reviewLink(token).then((response) => {
      if (!active) return;

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({ status: "ready", data: response });
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

  const { data } = state;
  const expiry = buildShareExpiry(data.review.expiresAt);
  const expiryLabel = localizedExpiryLabel(data.review.expiresAt, copy.expiryLabels);

  return (
    <main className="share-list" aria-label={copy.content}>
      <p className="helper-text">{copy.notice}</p>
      <div className="kv-grid">
        <div className="kv-item">
          <strong>{copy.asset}</strong>
          <span className="wrap-anywhere">{data.mediaUid}</span>
        </div>
        <div className="kv-item">
          <strong>{copy.permission}</strong>
          <span>{data.review.permission}</span>
        </div>
        {data.review.expiresAt ? (
          <div className="kv-item">
            <strong>{copy.expires}</strong>
            <time>{new Date(data.review.expiresAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")}</time>
          </div>
        ) : null}
        <div className="kv-item"><strong>{copy.expiryEstimate}</strong><span className={`badge badge-${expiry.tone}`}>{expiryLabel}</span><small className="helper-text">{copy.expiryHint}</small></div>
      </div>
      {data.comments.length === 0 ? (
        <div className="empty-state">{copy.empty}</div>
      ) : (
        data.comments.map((comment) => (
          <article className="panel" key={comment.id}>
            <div className="panel-title-row">
              <h2>{comment.author}</h2>
              <span className="badge">{Math.floor(comment.timecodeSeconds / 60)}:{Math.floor(comment.timecodeSeconds % 60).toString().padStart(2, "0")}</span>
            </div>
            <p>{redactAdminSecrets(comment.body)}</p>
          </article>
        ))
      )}
    </main>
  );
}
