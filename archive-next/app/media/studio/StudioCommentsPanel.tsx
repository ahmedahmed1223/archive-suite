"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import MentionTextarea from "@/components/MentionTextarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { createArchiveApiClient, type RecordComment } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const api = createArchiveApiClient();

type CommentsState =
  | { status: "loading" }
  | { status: "ready"; comments: RecordComment[] }
  | { status: "error"; message: string };

export default function StudioCommentsPanel({ recordId, store }: Readonly<{ recordId: string; store: string }>) {
  const { t, locale } = useLocale();
  const copy = t.pages.mediaStudio.comments;
  const [state, setState] = useState<CommentsState>({ status: "loading" });
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [postStatus, setPostStatus] = useState("");

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    api.recordComments(recordId, store).then((response) => {
      if (!active) return;
      setState(response.ok ? { status: "ready", comments: response.comments } : { status: "error", message: response.error });
    });
    return () => {
      active = false;
    };
  }, [recordId, store]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setPostStatus("");
    const response = await api.createRecordComment(recordId, { body: trimmed }, store);
    setBusy(false);

    if (!response.ok) {
      setPostStatus(response.error || copy.postError);
      return;
    }

    setState((current) => (current.status === "ready" ? { status: "ready", comments: [...current.comments, response.comment] } : current));
    setBody("");
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm(copy.deleteConfirm)) return;
    const response = await api.deleteRecordComment(commentId);
    if (!response.ok) {
      setPostStatus(response.error);
      return;
    }
    setState((current) =>
      current.status === "ready" ? { status: "ready", comments: current.comments.filter((comment) => comment.id !== commentId) } : current
    );
  }

  const comments = state.status === "ready" ? state.comments : [];

  return (
    <article className="panel" aria-label={copy.title}>
      <div className="panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">
          {comments.length} {copy.countLabel}
        </span>
      </div>

      {state.status === "loading" ? <Skeleton label={copy.loadingLabel} /> : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadError}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          {copy.newCommentLabel}
          <MentionTextarea value={body} onChange={setBody} placeholder={copy.bodyPlaceholder} rows={3} />
        </label>
        <button type="submit" className="button button-primary" disabled={busy || !body.trim()}>
          {busy ? copy.postingButton : copy.postButton}
        </button>
        {postStatus ? <p className="form-status">{postStatus}</p> : null}
      </form>

      {state.status === "ready" && comments.length === 0 ? <p className="helper-text">{copy.empty}</p> : null}

      {comments.length ? (
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
                onClick={() => void handleDelete(comment.id)}
                aria-label={copy.deleteAriaLabel}
              >
                {copy.deleteAriaLabel}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
