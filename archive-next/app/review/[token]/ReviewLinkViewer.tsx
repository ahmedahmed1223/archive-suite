"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type ReviewLinkDecisionValue, type ReviewLinkDetails } from "@/lib/archive-api";
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

type DecisionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "done"; sessionState: string | null; approvalsReceived: number; requiredApprovals: number }
  | { status: "error"; message: string };

function DecisionPanel({
  token,
  requiredApprovals,
  copy
}: {
  token: string;
  requiredApprovals: number;
  copy: ReturnType<typeof useLocale>["t"]["pages"]["reviewLink"]["viewer"]["decision"];
}) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<DecisionState>({ status: "idle" });

  async function submit(decision: ReviewLinkDecisionValue) {
    if (reviewerName.trim() === "") {
      setState({ status: "error", message: copy.reviewerNameRequired });
      return;
    }

    setState({ status: "submitting" });

    const response = await api.decideReviewLink(token, {
      reviewerName: reviewerName.trim(),
      reviewerEmail: reviewerEmail.trim() || undefined,
      decision,
      notes: notes.trim() || undefined
    });

    if (!response.ok) {
      setState({ status: "error", message: copy.errorGeneric });
      return;
    }

    setState({
      status: "done",
      sessionState: response.session?.state ?? null,
      approvalsReceived: response.approvals.received,
      requiredApprovals: response.approvals.required
    });
  }

  const submitting = state.status === "submitting";

  return (
    <div className="panel">
      <h2>{copy.title}</h2>
      <label className="field">
        <span>{copy.reviewerNameLabel}</span>
        <input
          type="text"
          value={reviewerName}
          placeholder={copy.reviewerNamePlaceholder}
          onChange={(event) => setReviewerName(event.target.value)}
          disabled={submitting}
        />
      </label>
      <label className="field">
        <span>{copy.reviewerEmailLabel}</span>
        <input type="email" value={reviewerEmail} onChange={(event) => setReviewerEmail(event.target.value)} disabled={submitting} />
      </label>
      <label className="field">
        <span>{copy.notesLabel}</span>
        <textarea
          value={notes}
          placeholder={copy.notesPlaceholder}
          onChange={(event) => setNotes(event.target.value)}
          disabled={submitting}
        />
      </label>
      <div className="button-row">
        <button type="button" className="button button-primary" onClick={() => void submit("approve")} disabled={submitting}>
          {submitting ? copy.submitting : copy.approve}
        </button>
        <button type="button" onClick={() => void submit("request_changes")} disabled={submitting}>
          {submitting ? copy.submitting : copy.requestChanges}
        </button>
      </div>
      {state.status === "error" ? (
        <p className="helper-text" role="alert">{state.message}</p>
      ) : null}
      {state.status === "done" ? (
        <div role="status" className="kv-grid">
          <p>{copy.submitted}</p>
          <p>
            {copy.approvalsProgress.replace("{received}", String(state.approvalsReceived)).replace("{required}", String(state.requiredApprovals))}
          </p>
          {state.sessionState === "approved" ? <p className="badge badge-positive">{copy.approvedFull}</p> : null}
          {state.sessionState === "changes_requested" ? <p className="badge badge-warning">{copy.changesRequested}</p> : null}
        </div>
      ) : (
        requiredApprovals > 1 ? <p className="helper-text">{copy.approvalsProgress.replace("{received}", "0").replace("{required}", String(requiredApprovals))}</p> : null
      )}
    </div>
  );
}

export function ReviewLinkViewer({ token }: { token: string }) {
  const { locale, t } = useLocale();
  const copy = t.pages.reviewLink.viewer;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ReviewLinkState>({ status: "loading" });
  const [mediaUnavailable, setMediaUnavailable] = useState(false);

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
  const mediaUrl = api.reviewLinkMediaUrl(token);
  const isWatermarked = data.review.watermarkPolicy === "visible";
  const allowDownload = data.review.allowDownload ?? false;
  const derivativeType = data.review.derivative?.derivativeType;
  const isImageDerivative = derivativeType === "thumbnail";
  const isAudioDerivative = derivativeType === "waveform";

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

      <section className="panel" aria-label={copy.media.title} style={{ position: "relative" }}>
        <h2>{copy.media.title}</h2>
        {isWatermarked ? <p className="badge badge-warning">{copy.media.watermarkBanner}</p> : null}
        {mediaUnavailable ? (
          <p className="helper-text">{copy.media.unavailable}</p>
        ) : isImageDerivative ? (
          // eslint-disable-next-line @next/next/no-img-element -- external review token URL, not a Next-optimizable asset
          <img src={mediaUrl} alt={copy.media.title} style={{ maxWidth: "100%" }} onError={() => setMediaUnavailable(true)} />
        ) : isAudioDerivative ? (
          <audio src={mediaUrl} controls style={{ width: "100%" }} onError={() => setMediaUnavailable(true)} />
        ) : (
          <video src={mediaUrl} controls style={{ width: "100%", maxHeight: "60vh" }} onError={() => setMediaUnavailable(true)} />
        )}
        {!mediaUnavailable && allowDownload ? (
          <a className="button button-secondary" href={`${mediaUrl}?download=1`}>
            {copy.media.downloadLabel}
          </a>
        ) : null}
      </section>

      {/* Decisions require a backing review session, which only exists when
          the link's media resolved to a real record at creation time (see
          ExternalReviewService::createLink's soft-degrade for legacy
          opaque-uid links). versionToken is set only in that case. */}
      {data.review.versionToken ? (
        <DecisionPanel token={token} requiredApprovals={data.review.requiredApprovals ?? 1} copy={copy.decision} />
      ) : null}

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
