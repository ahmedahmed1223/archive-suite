"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnnotationCanvas from "@/components/AnnotationCanvas";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MediaPlayer from "@/components/MediaPlayer";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ReviewComment, type ReviewRect } from "@/lib/archive-api";
import { getEchoClient } from "@/lib/echo";
import styles from "./review.module.css";
import "../media.css";

function formatTimecode(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

type ReviewCommentUpdatedEvent = {
  mediaUid: string;
  comment: ReviewComment;
};

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
  const api = useMemo(() => createArchiveApiClient(), []);
  const playerRef = useRef<HTMLMediaElement | null>(null);

  const [mediaUid, setMediaUid] = useState("media-123");
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [body, setBody] = useState("");
  const [timecode, setTimecode] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [draftRects, setDraftRects] = useState<ReviewRect[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const currentMediaUid = useMemo(() => mediaUid.trim(), [mediaUid]);

  const fetchComments = useCallback(async () => {
    if (!currentMediaUid) return;

    setLoading(true);
    setError(null);
    try {
      const result = await api.reviewComments(currentMediaUid);
      if (result.ok) {
        setComments(normalizeReviewComments(result.comments));
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل تعليقات المراجعة.");
    } finally {
      setLoading(false);
    }
  }, [api, currentMediaUid]);

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
      setError(err instanceof Error ? err.message : "تعذر إضافة التعليق.");
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
      setError(err instanceof Error ? err.message : "تعذر تحديث التعليق.");
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
    <AppShell subtitle="المراجعة المرئية" contentClassName={styles.reviewContent}>
      <PageToolbar
        eyebrow={<span className="badge">Frame review</span>}
        title="مراجعة مرئية بتعليقات زمنية"
        description="شغّل المادة، اقفز إلى timecode محدد، وارسم مستطيلاً فوق الإطار عند الحاجة لتوثيق الملاحظة بدقة."
        meta={(
          <>
            <span className="badge">{comments.length} تعليق</span>
            <span className={`badge ${styles.statusIndicator}`} data-status={drawMode ? "editing" : "reviewing"}>
              {drawMode ? "وضع الرسم" : "عرض التعليقات"}
            </span>
          </>
        )}
      />

      {error && (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر إكمال العملية</strong>
          <p className="helper-text">{error}</p>
        </div>
      )}

      <div className={`media-review-layout ${styles.mediaReviewLayout}`}>
          <section className={`stack ${styles.playerSection}`} aria-label="المشغل ونموذج التعليق">
            <article className="panel auth-form">
              <label>
                مسار المادة أو معرف جلسة المراجعة
                <input
                  type="text"
                  value={mediaUid}
                  onChange={(event) => setMediaUid(event.target.value)}
                  placeholder="media/file.mp4"
                  aria-label="مسار المادة أو معرف جلسة المراجعة"
                />
                <p className="helper-text">يستخدم نفس الحقل لتشغيل المادة وربط تعليقات المراجعة.</p>
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
                    {drawMode ? "إيقاف الرسم" : "رسم ملاحظة على الإطار"}
                  </button>
                  {drawMode && draftRects.length > 0 ? (
                    <button type="button" className="button button-secondary" onClick={() => setDraftRects([])}>
                      مسح الرسم ({draftRects.length})
                    </button>
                  ) : null}
                </div>
              </article>
            ) : (
              <EmptyState
                title="أدخل مسار مادة لبدء المراجعة."
                description="استخدم نفس الحقل أعلاه لتشغيل المادة وربط تعليقات المراجعة الخاصة بها."
              />
            )}

            <form className={`panel auth-form ${styles.commentForm}`} onSubmit={handleAddComment}>
              <div className={styles.commentFormHeader}>
                <h2>إضافة تعليق</h2>
                {useCurrentTime ? <span className="badge">من وقت التشغيل</span> : <span className="badge">وقت يدوي</span>}
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={useCurrentTime}
                  onChange={(event) => setUseCurrentTime(event.target.checked)}
                />
                استخدام وقت التشغيل الحالي
              </label>

              {!useCurrentTime && (
                <label className={styles.timecodeInput}>
                  Timecode بالثواني
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
                التعليق
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="اكتب الملاحظة هنا"
                  rows={4}
                />
              </label>

              <button type="submit" className="button button-primary" disabled={!body.trim() || !currentMediaUid || loading}>
                {loading ? "جار الإضافة" : "إضافة التعليق"}
              </button>
            </form>
          </section>

          <aside className={`panel ${styles.commentsAside}`} aria-label="تعليقات المراجعة">
            <div className={styles.commentsHeader}>
              <div className={styles.commentsHeaderInfo}>
                <h2>التعليقات</h2>
                <p>
                  {loading
                    ? "جار تحميل التعليقات..."
                    : comments.length
                      ? "مرتبة حسب الزمن داخل المادة."
                      : "لا توجد تعليقات بعد."}
                </p>
              </div>
              <span className="badge">{comments.length}</span>
            </div>

            <div className={`review-comments-rail ${styles.commentsList}`}>
              {comments.length === 0 ? (
                <EmptyState
                  title="لا توجد تعليقات بعد."
                  description="ابدأ بإضافة أول تعليق من النموذج المجاور للمشغل."
                />
              ) : (
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
                        {comment.resolved ? "إعادة فتح" : "حل"}
                      </button>
                    </div>
                    <p className={styles.commentBody}>{comment.body}</p>
                    <span className={styles.commentAuthor}>{comment.author}</span>
                  </article>
                ))
              )}
            </div>
          </aside>
        </div>
    </AppShell>
  );
}
