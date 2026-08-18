"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import EmptyState from "@/components/EmptyState";
import MentionTextarea from "@/components/MentionTextarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { RecordComment } from "@/lib/archive-api";

export function RecordCommentsPanel({
  comments,
  loading,
  error,
  onCreate,
  onDelete
}: Readonly<{
  comments: RecordComment[];
  loading: boolean;
  error: string | null;
  onCreate: (payload: { body: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}>) {
  const { t, locale } = useLocale();
  const copy = t.pages.archiveDetail.comments;
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setStatus("");
    try {
      await onCreate({ body: trimmed });
      setBody("");
      setStatus(copy.postSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.postError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel record-comments-panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">{comments.length} {copy.countLabel}</span>
      </div>

      {loading ? (
        <Skeleton label={copy.loadingLabel} />
      ) : null}

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadErrorTitle}</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      <form id="record-comment-form" className="auth-form record-note-form" onSubmit={handleSubmit}>
        <label>
          {copy.newCommentLabel}
          <MentionTextarea
            value={body}
            onChange={setBody}
            placeholder={copy.bodyPlaceholder}
            rows={3}
          />
        </label>
        <button type="submit" className="button button-primary" disabled={busy || !body.trim()}>
          {busy ? copy.postingButton : copy.postButton}
        </button>
        {status ? <p className="form-status">{status}</p> : null}
      </form>

      {!loading && comments.length ? (
        <ul className="record-note-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div>
                <div className="helper-row">
                  <span className="helper-text">{comment.authorName || copy.anonymousAuthor}</span>
                </div>
                <p>{comment.body}</p>
                {comment.createdAt ? (
                  <small className="helper-text">{new Date(comment.createdAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")}</small>
                ) : null}
              </div>
              <button
                type="button"
                className="button button-danger button-sm"
                onClick={() => void onDelete(comment.id)}
                aria-label={copy.deleteAriaLabel}
              >
                {copy.deleteButton}
              </button>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : null}
    </article>
  );
}
