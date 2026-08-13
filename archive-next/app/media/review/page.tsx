"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnnotationCanvas from "@/components/AnnotationCanvas";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MediaPlayer from "@/components/MediaPlayer";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ReviewComment, type ReviewRect } from "@/lib/archive-api";
import { getEchoClient } from "@/lib/echo";
import styles from "./review.module.css";
import "../media.css";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

function formatTimecode(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

type ReviewCommentUpdatedEvent = {
  mediaUid: string;
  comment: ReviewComment;
};

type CommentsLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

function mergeReviewComments(current: ReviewComment[], incoming: ReviewComment): ReviewComment[] {
  const next = new Map<string, ReviewComment>();

  for (const comment of current) {
    next.set(comment.id, comment);
  }

  next.set(incoming.id, incoming);

  return Array.from(next.values()).sort(
    (a, b) =>
      a.timecodeSeconds - b.timecodeSeconds ||
      toTimestamp(a.createdAt) - toTimestamp(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
}

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeReviewComments(comments: ReviewComment[]): ReviewComment[] {
  return comments.reduce<ReviewComment[]>((accumulator, comment) => mergeReviewComments(accumulator, comment), []);
}

export default function ReviewPage() {
  const { t } = useLocale();
  const copy = t.pages.mediaReview;
  const api = useMemo(() => createArchiveApiClient(), []);
  const playerRef = useRef<HTMLMediaElement | null>(null);

  const [mediaUid, setMediaUid] = useState("media-123");
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [body, setBody] = useState("");
  const [timecode, setTimecode] = useState(0);
  const [commentsState, setCommentsState] = useState<CommentsLoadState>({ status: "loading" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [draftRects, setDraftRects] = useState<ReviewRect[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const currentMediaUid = useMemo(() => mediaUid.trim(), [mediaUid]);

  const fetchComments = useCallback(async () => {
    if (!currentMediaUid) {
      setComments([]);
      setCommentsState({ status: "idle" });
      return;
    }

    setComments([]);
    setCommentsState({ status: "loading" });
    try {
      const result = await api.reviewComments(currentMediaUid);
      if (result.ok) {
        setComments(normalizeReviewComments(result.comments));
        setCommentsState({ status: "ready" });
      } else {
        setCommentsState({ status: "error", message: result.error || copy.errors.loadComments });
      }
    } catch (err) {
      setCommentsState({ status: "error", message: err instanceof Error ? err.message : copy.errors.loadComments });
    }
  }, [api, copy.errors.loadComments, currentMediaUid]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  // Live review updates are additive to the existing fetch path: if the socket
  // is available, merge new comment payloads immediately and keep the fetch as
  // the reconciliation/fallback path.
  useEffect(() => {
    if (!currentMediaUid) return;

    const echo = getEchoClient();
    if (!echo) return;

    const channelName = `review.media.${currentMediaUid}`;
    const channel = echo.private(channelName);

    channel.listen(".review-comment.updated", (event: ReviewCommentUpdatedEvent) => {
      if (event.mediaUid !== currentMediaUid) return;

      setComments((current) => mergeReviewComments(current, event.comment));
    });

    return () => {
      echo.leave(channelName);
    };
  }, [currentMediaUid]);

  const handleAddComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim() || !currentMediaUid) return;

    const commentTimecode = useCurrentTime && playerRef.current
      ? Math.round(playerRef.current.currentTime * 100) / 100
      : timecode;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.createReviewComment(currentMediaUid, {
        body: body.trim(),
        timecodeSeconds: commentTimecode,
        annotation: draftRects.length > 0 ? draftRects : undefined
      });

      if (result.ok) {
        setComments((prev) => mergeReviewComments(prev, result.comment));
        setBody("");
        setTimecode(0);
        setDraftRects([]);
        setDrawMode(false);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.addComment);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleResolved = async (commentId: string, currentResolved: boolean) => {
    try {
      const result = await api.updateReviewComment(commentId, { resolved: !currentResolved });
      if (result.ok) {
        setComments((prev) => mergeReviewComments(prev.filter((comment) => comment.id !== commentId), result.comment));
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.updateComment);
    }
  };

  const handleSeekToComment = (comment: ReviewComment) => {
    if (playerRef.current) {
      playerRef.current.currentTime = comment.timecodeSeconds;
      playerRef.current.play().catch(() => undefined);
    }
    setDrawMode(false);
    setActiveCommentId(comment.id);
  };

  return (
    <AppShell subtitle={t.pageTitles.visualReview} contentClassName={styles.reviewContent} tipsPage="media-review">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={(
          <>
            <span className="badge">{copy.toolbar.commentCount.replace("{count}", String(comments.length))}</span>
            <span className={`badge ${styles.statusIndicator}`} data-status={drawMode ? "editing" : "reviewing"}>
              {drawMode ? copy.toolbar.drawingMode : copy.toolbar.reviewMode}
            </span>
          </>
        )}
      />

      <OperationalSafetyPanel action={copy.safetyAction} confidence={88} auditHref="/activity" />

      {error && (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.errors.operationFailed}</strong>
          <p className="helper-text">{error}</p>
        </div>
      )}

      <div className={`media-review-layout ${styles.mediaReviewLayout}`}>
          <section className={`stack ${styles.playerSection}`} aria-label={copy.media.ariaLabel}>
            <article className="panel auth-form">
              <label>
                {copy.media.sourceLabel}
                <input
                  type="text"
                  value={mediaUid}
                  onChange={(event) => setMediaUid(event.target.value)}
                  placeholder={copy.media.sourcePlaceholder}
                  dir="ltr"
                  aria-label={copy.media.sourceLabel}
                />
                <p className="helper-text">{copy.media.sourceDescription}</p>
              </label>
            </article>

            {currentMediaUid ? (
              <article className={`panel ${styles.mediaFramePanel}`}>
                <div className="media-frame">
                  <MediaPlayer
                    path={currentMediaUid}
                    onReady={(el) => {
                      playerRef.current = el;
                    }}
                  />
                  <AnnotationCanvas
                    rectangles={
                      drawMode
                        ? draftRects
                        : comments.find((comment) => comment.id === activeCommentId)?.annotation ?? []
                    }
                    editable={drawMode}
                    onChange={setDraftRects}
                  />
                </div>

                <div className={`toolbar-row ${styles.toolbarRow}`}>
                  <button
                    type="button"
                    className={drawMode ? "button button-danger" : "button button-secondary"}
                    onClick={() => {
                      setDrawMode((value) => !value);
                      setActiveCommentId(null);
                    }}
                  >
                    {drawMode ? copy.media.stopDrawing : copy.media.drawAnnotation}
                  </button>
                  {drawMode && draftRects.length > 0 ? (
                    <button type="button" className="button button-secondary" onClick={() => setDraftRects([])}>
                      {copy.media.clearDrawing.replace("{count}", String(draftRects.length))}
                    </button>
                  ) : null}
                </div>
              </article>
            ) : (
              <EmptyState
                title={copy.media.emptyTitle}
                description={copy.media.emptyDescription}
              />
            )}

            <form className={`panel auth-form ${styles.commentForm}`} onSubmit={handleAddComment}>
              <div className={styles.commentFormHeader}>
                <h2>{copy.form.title}</h2>
                {useCurrentTime ? <span className="badge">{copy.form.playbackTime}</span> : <span className="badge">{copy.form.manualTime}</span>}
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={useCurrentTime}
                  onChange={(event) => setUseCurrentTime(event.target.checked)}
                />
                {copy.form.currentPlaybackTime}
              </label>

              {!useCurrentTime && (
                <label className={styles.timecodeInput}>
                  {copy.form.timecodeSeconds}
                  <input
                    type="number"
                    value={timecode}
                    onChange={(event) => setTimecode(Number.parseFloat(event.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </label>
              )}

              <label>
                {copy.form.comment}
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={copy.form.commentPlaceholder}
                  rows={4}
                />
              </label>

              <button type="submit" className="button button-primary" disabled={!body.trim() || !currentMediaUid || isSubmitting}>
                {isSubmitting ? copy.form.adding : copy.form.addComment}
              </button>
            </form>
          </section>

          <aside className={`panel ${styles.commentsAside}`} aria-label={copy.comments.ariaLabel}>
            <div className={styles.commentsHeader}>
              <div className={styles.commentsHeaderInfo}>
                <h2>{copy.comments.title}</h2>
                <p>
                  {commentsState.status === "loading"
                    ? copy.comments.loadingDescription
                    : commentsState.status === "ready" && comments.length
                      ? copy.comments.orderedDescription
                      : commentsState.status === "error"
                        ? copy.comments.errorDescription
                        : copy.comments.emptyDescription}
                </p>
              </div>
              <span className="badge">{comments.length}</span>
            </div>

            <div className={`review-comments-rail ${styles.commentsList}`}>
              {commentsState.status === "loading" ? (
                <div className="panel panel-compact"><Skeleton label={copy.comments.loadingDescription} /></div>
              ) : commentsState.status === "error" ? (
                <div className="state-banner state-banner-error" role="alert">
                  <strong>{copy.comments.errorDescription}</strong>
                  <span className="helper-text">{commentsState.message}</span>
                  <div><button type="button" className="button button-secondary button-sm" onClick={() => void fetchComments()}>{copy.comments.retry}</button></div>
                </div>
              ) : commentsState.status === "ready" && comments.length === 0 ? (
                <EmptyState
                  title={copy.comments.emptyTitle}
                  description={copy.comments.emptyStateDescription}
                />
              ) : commentsState.status === "ready" ? (
                comments.map((comment) => (
                  <article
                    key={comment.id}
                    className={`${styles.commentItem} ${comment.id === activeCommentId ? styles.commentItemActive : ""} ${
                      comment.resolved ? styles.commentItemResolved : ""
                    }`}
                  >
                    <div className={styles.commentActions}>
                      <button className={styles.commentTimecode} type="button" onClick={() => handleSeekToComment(comment)}>
                        {formatTimecode(comment.timecodeSeconds)}
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => void handleToggleResolved(comment.id, comment.resolved)}
                      >
                        {comment.resolved ? copy.comments.reopen : copy.comments.resolve}
                      </button>
                    </div>
                    <p className={styles.commentBody}>{comment.body}</p>
                    <span className={styles.commentAuthor}>{comment.author}</span>
                  </article>
                ))
              ) : null}
            </div>
          </aside>
        </div>
    </AppShell>
  );
}
