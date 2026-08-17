"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { createArchiveApiClient, type MediaReviewComment, type MediaReviewCommentType } from "@/lib/archive-api";
import { getEchoClient, onConnectionStateChange } from "@/lib/echo";
import { formatCueTime } from "@/lib/media/subtitles";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import styles from "./studio.module.css";

const api = createArchiveApiClient();

/** How often the panel polls when the realtime channel is unavailable. */
const POLL_INTERVAL_MS = 8000;

const TYPES: MediaReviewCommentType[] = ["issue", "suggestion", "highlight", "chapter"];

// Reuse the app's existing badge tone classes (03-components.css /
// 06-widgets.css) instead of inventing per-type colors.
const BADGE_TONE_CLASS: Record<MediaReviewCommentType, string> = {
  issue: "badge-danger",
  suggestion: "badge-info",
  highlight: "badge-warning",
  chapter: "badge-success"
};

const MARKER_TONE_CLASS: Record<MediaReviewCommentType, string> = {
  issue: styles.markerIssue,
  suggestion: styles.markerSuggestion,
  highlight: styles.markerHighlight,
  chapter: styles.markerChapter
};

type CommentsState =
  | { status: "loading" }
  | { status: "ready"; comments: MediaReviewComment[] }
  | { status: "error"; message: string };

function upsertComment(comments: MediaReviewComment[], comment: MediaReviewComment): MediaReviewComment[] {
  const next = comments.some((c) => c.id === comment.id) ? comments.map((c) => (c.id === comment.id ? comment : c)) : [...comments, comment];
  return next.slice().sort((a, b) => a.startSeconds - b.startSeconds);
}

export interface StudioTimelinePanelProps {
  recordId: string;
  store: string;
  attachmentId: string | null;
  durationSeconds: number | null;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

/**
 * V3-MEDIA-003: timeline markers/comments for the studio. Renders a
 * proportional marker strip (0..durationSeconds) plus a list of comments
 * with type, resolve/reopen, and precise jump-to-timestamp.
 *
 * Realtime: subscribes to the record's `media-review-comments.{recordUid}`
 * Echo/Reverb channel (see lib/echo.ts). When Echo is unconfigured or its
 * connection drops, falls back to polling GET .../media-review-comments
 * every POLL_INTERVAL_MS. Each poll (and the refetch on reconnect) replaces
 * the full comment list from the server response rather than merging
 * deltas, so a missed broadcast during the gap can never leave a stale or
 * partial list -- the next poll/reconnect is always a full reconciliation.
 */
export default function StudioTimelinePanel({ recordId, store, attachmentId, durationSeconds, currentTime, onSeek }: Readonly<StudioTimelinePanelProps>) {
  const { t } = useLocale();
  const copy = t.pages.mediaStudio.timeline;
  const [state, setState] = useState<CommentsState>({ status: "loading" });
  const [type, setType] = useState<MediaReviewCommentType>("issue");
  const [body, setBody] = useState("");
  const [markRange, setMarkRange] = useState(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formStatus, setFormStatus] = useState("");
  const [isLive, setIsLive] = useState(false);

  const fetchComments = useCallback(async () => {
    const response = await api.mediaReviewComments(recordId, { store, attachmentId: attachmentId ?? undefined });
    if (response.ok) {
      setState({ status: "ready", comments: response.comments });
    } else {
      setState({ status: "error", message: response.error });
    }
  }, [recordId, store, attachmentId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  // Realtime subscription with reconnect-and-reconcile polling fallback.
  useEffect(() => {
    const echo = getEchoClient();
    if (!echo) {
      // No Reverb key configured at all -- poll from the start.
      const interval = setInterval(() => void fetchComments(), POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }

    const channelName = `media-review-comments.${recordId}`;
    const channel = echo.private(channelName);
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => void fetchComments(), POLL_INTERVAL_MS);
    };

    channel.listen(".media-review-comment.updated", (payload: { action: string; comment: MediaReviewComment | null; commentId: string | null }) => {
      setState((current) => {
        if (current.status !== "ready") return current;
        if (payload.action === "deleted") {
          return { status: "ready", comments: current.comments.filter((c) => c.id !== payload.commentId) };
        }
        return payload.comment ? { status: "ready", comments: upsertComment(current.comments, payload.comment) } : current;
      });
    });

    const unbindConnectionState = onConnectionStateChange((connectionState) => {
      const live = connectionState === "connected";
      setIsLive(live);
      if (live) {
        // Reconnected: one full refetch reconciles anything missed while down.
        stopPolling();
        void fetchComments();
      } else {
        startPolling();
      }
    });

    return () => {
      unbindConnectionState();
      stopPolling();
      echo.leave(channelName);
    };
  }, [recordId, fetchComments]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || busy) return;

    const startSeconds = markRange && rangeStart !== null ? Math.min(rangeStart, currentTime) : currentTime;
    const endSeconds = markRange && rangeStart !== null ? Math.max(rangeStart, currentTime) : undefined;

    setBusy(true);
    setFormStatus("");
    const response = await api.createMediaReviewComment(recordId, {
      store,
      attachmentId: attachmentId ?? undefined,
      type,
      startSeconds,
      endSeconds,
      body: trimmed,
      clientDurationSeconds: durationSeconds ?? undefined
    });
    setBusy(false);

    if (!response.ok) {
      setFormStatus(response.error || copy.postError);
      return;
    }

    setState((current) => (current.status === "ready" ? { status: "ready", comments: upsertComment(current.comments, response.comment) } : current));
    setBody("");
    setMarkRange(false);
    setRangeStart(null);
  }

  function handleCaptureRangeStart() {
    setRangeStart(currentTime);
    setMarkRange(true);
  }

  async function handleResolve(comment: MediaReviewComment) {
    const response = await api.resolveMediaReviewComment(comment.id);
    if (response.ok) {
      setState((current) => (current.status === "ready" ? { status: "ready", comments: upsertComment(current.comments, response.comment) } : current));
    } else {
      setFormStatus(response.error);
    }
  }

  async function handleReopen(comment: MediaReviewComment) {
    const response = await api.reopenMediaReviewComment(comment.id);
    if (response.ok) {
      setState((current) => (current.status === "ready" ? { status: "ready", comments: upsertComment(current.comments, response.comment) } : current));
    } else {
      setFormStatus(response.error);
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm(copy.deleteConfirm)) return;
    const response = await api.deleteMediaReviewComment(commentId);
    if (response.ok) {
      setState((current) => (current.status === "ready" ? { status: "ready", comments: current.comments.filter((c) => c.id !== commentId) } : current));
    } else {
      setFormStatus(response.error);
    }
  }

  const comments = state.status === "ready" ? state.comments : [];
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : null;

  return (
    <article className="panel" aria-label={copy.title}>
      <div className="panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge" title={isLive ? copy.liveLabel : copy.pollingLabel}>
          {isLive ? copy.liveLabel : copy.pollingLabel}
        </span>
      </div>

      {state.status === "loading" ? <Skeleton label={copy.loadingLabel} /> : null}
      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadError}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {duration ? (
        <TimelineStrip duration={duration} currentTime={currentTime} comments={comments} onSeek={onSeek} />
      ) : (
        <p className="helper-text">{copy.durationUnavailable}</p>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          {copy.typeLabel}
          <select value={type} onChange={(event) => setType(event.target.value as MediaReviewCommentType)}>
            {TYPES.map((option) => (
              <option key={option} value={option}>
                {copy.types[option]}
              </option>
            ))}
          </select>
        </label>

        <div className="helper-row">
          <span className="helper-text" dir="ltr">
            {markRange && rangeStart !== null
              ? `${formatCueTime(Math.min(rangeStart, currentTime))} – ${formatCueTime(Math.max(rangeStart, currentTime))}`
              : formatCueTime(currentTime)}
          </span>
          {markRange ? (
            <button type="button" className="button button-secondary button-sm" onClick={() => { setMarkRange(false); setRangeStart(null); }}>
              {copy.clearRangeButton}
            </button>
          ) : (
            <button type="button" className="button button-secondary button-sm" onClick={handleCaptureRangeStart}>
              {copy.markRangeButton}
            </button>
          )}
        </div>

        <label>
          {copy.bodyLabel}
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={copy.bodyPlaceholder} rows={3} />
        </label>

        <button type="submit" className="button button-primary" disabled={busy || !body.trim()}>
          {busy ? copy.postingButton : copy.postButton}
        </button>
        {formStatus ? <p className="form-status">{formStatus}</p> : null}
      </form>

      {state.status === "ready" && comments.length === 0 ? <p className="helper-text">{copy.empty}</p> : null}

      {comments.length ? (
        <ul className="record-note-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div>
                <div className="helper-row">
                  <span className={`badge ${BADGE_TONE_CLASS[comment.type]}`}>{copy.types[comment.type]}</span>
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    dir="ltr"
                    onClick={() => onSeek(comment.startSeconds)}
                    aria-label={copy.jumpAriaLabel}
                  >
                    {formatCueTime(comment.startSeconds)}
                    {comment.endSeconds !== null ? ` – ${formatCueTime(comment.endSeconds)}` : ""}
                  </button>
                  {comment.state === "resolved" ? <span className="helper-text">{copy.resolvedLabel}</span> : null}
                </div>
                <p>{comment.body}</p>
              </div>
              <div className="helper-row">
                {comment.state === "open" ? (
                  <button type="button" className="button button-secondary button-sm" onClick={() => void handleResolve(comment)}>
                    {copy.resolveButton}
                  </button>
                ) : (
                  <button type="button" className="button button-secondary button-sm" onClick={() => void handleReopen(comment)}>
                    {copy.reopenButton}
                  </button>
                )}
                <button type="button" className="button button-danger button-sm" onClick={() => void handleDelete(comment.id)} aria-label={copy.deleteAriaLabel}>
                  {copy.deleteAriaLabel}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function TimelineStrip({
  duration,
  currentTime,
  comments,
  onSeek
}: Readonly<{ duration: number; currentTime: number; comments: MediaReviewComment[]; onSeek: (seconds: number) => void }>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();
  const copy = t.pages.mediaStudio.timeline;

  const playheadPercent = useMemo(() => clampPercent((currentTime / duration) * 100), [currentTime, duration]);

  function handleTrackClick(event: MouseEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    onSeek(clampPercent(ratio * 100) / 100 * duration);
  }

  return (
    <div className={styles.timelineStrip} ref={trackRef} onClick={handleTrackClick} role="presentation" aria-label={copy.stripAriaLabel}>
      <div className={styles.timelinePlayhead} style={{ insetInlineStart: `${playheadPercent}%` }} />
      {comments.map((comment) => {
        const startPercent = clampPercent((comment.startSeconds / duration) * 100);
        const widthPercent =
          comment.endSeconds !== null ? Math.max(0.5, clampPercent(((comment.endSeconds - comment.startSeconds) / duration) * 100)) : 0;

        return (
          <button
            key={comment.id}
            type="button"
            className={`${styles.timelineMarker} ${MARKER_TONE_CLASS[comment.type]} ${comment.state === "resolved" ? styles.markerResolved : ""}`}
            style={{ insetInlineStart: `${startPercent}%`, inlineSize: widthPercent ? `${widthPercent}%` : undefined }}
            title={`${copy.types[comment.type]} · ${formatCueTime(comment.startSeconds)}`}
            aria-label={`${copy.types[comment.type]} ${formatCueTime(comment.startSeconds)}`}
            onClick={(event) => {
              event.stopPropagation();
              onSeek(comment.startSeconds);
            }}
          />
        );
      })}
    </div>
  );
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
