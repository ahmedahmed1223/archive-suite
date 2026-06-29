import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { Lock, MessageCircle, TriangleAlert } from "lucide-react";

function durationOf(clip: any) {
  return Math.max(0, Number(clip.outSec || 0) - Number(clip.inSec || 0));
}

export function TimelineClip({ clip, selected, invalid, pixelsPerSecond, playheadSec, activeTool = "select", onCommand, thumbnailUrl, comments = [] }: any) {
  const trimGesture = React.useRef<any>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `clip:${clip.id}`,
    data: { clipId: clip.id, trackId: clip.trackId, startSec: Number(clip.timelineStartSec) || 0 },
    disabled: Boolean(clip.locked)
  });
  const duration = durationOf(clip);
  const dragTransform = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;
  const label = clip.label || clip.title || clip.itemId || clip.id;

  const startTrim = (edge: any, event: any) => {
    event.preventDefault();
    event.stopPropagation();
    trimGesture.current = { edge, clientX: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const finishTrim = (event: any) => {
    event.preventDefault();
    event.stopPropagation();
    const gesture = trimGesture.current;
    trimGesture.current = null;
    if (!gesture) return;
    const deltaSec = -(event.clientX - (gesture as any).clientX) / pixelsPerSecond;
    const sourceSec = (gesture as any).edge === "in"
      ? Math.max(0, Math.min(Number(clip.outSec) - 0.04, Number(clip.inSec) + deltaSec))
      : Math.max(Number(clip.inSec) + 0.04, Number(clip.outSec) + deltaSec);
    onCommand?.({ type: "clip.trim", clipId: clip.id, edge: (gesture as any).edge, sourceSec });
  };

  const handleKeyDown = (event: any) => {
    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      onCommand?.({ type: "clip.nudge", clipId: clip.id, frames: 1 });
      return;
    }
    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      onCommand?.({ type: "clip.nudge", clipId: clip.id, frames: -1 });
      return;
    }
    if (event.shiftKey && event.key === "ArrowUp") {
      event.preventDefault();
      onCommand?.({ type: "clip.move-track", clipId: clip.id, direction: -1 });
      return;
    }
    if (event.shiftKey && event.key === "ArrowDown") {
      event.preventDefault();
      onCommand?.({ type: "clip.move-track", clipId: clip.id, direction: 1 });
      return;
    }
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      onCommand?.({ type: "clip.split", clipId: clip.id, atSec: Number(playheadSec) || 0 });
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onCommand?.({ type: "clip.delete", clipId: clip.id });
    }
  };

  const clipStartSec = Math.max(0, Number(clip.timelineStartSec) || 0);
  const visibleComments = duration > 0
    ? comments.filter((comment: any) => {
        const at = Number(comment?.atSec);
        return Number.isFinite(at) && at >= clipStartSec && at <= clipStartSec + duration;
      })
    : [];
  const backgroundStyle = thumbnailUrl
    ? { backgroundImage: `linear-gradient(180deg, rgba(15,17,21,0.55), rgba(15,17,21,0.85)), url(${JSON.stringify(thumbnailUrl).slice(1, -1)})` }
    : clip.color
      ? { background: clip.color }
      : undefined;

  return (
    <div
      ref={setNodeRef}
      aria-label={`قصاصة ${label}`}
      className={`multitrack-clip${selected ? " is-selected" : ""}${invalid ? " is-invalid" : ""}${isDragging ? " is-dragging" : ""}${thumbnailUrl ? " has-thumbnail" : ""}`}
      style={{
        insetInlineStart: `${clipStartSec * pixelsPerSecond}px`,
        width: `${Math.max(28, duration * pixelsPerSecond)}px`,
        transform: dragTransform,
        ...(backgroundStyle || {})
      }}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onCommand?.(activeTool === "blade"
        ? { type: "clip.split", clipId: clip.id, atSec: Number(playheadSec) || 0 }
        : { type: "clip.select", clipId: clip.id })}
      onKeyDown={(event: any) => {
        handleKeyDown(event);
        if (!event.defaultPrevented) listeners?.onKeyDown?.(event);
      }}
    >
      <span className="multitrack-clip__trim" data-edge="in" aria-hidden="true" onPointerDown={(event: any) => startTrim("in", event)} onPointerUp={finishTrim} />
      <span className="multitrack-clip__content">
        <strong>{label}</strong>
        <small>{duration.toFixed(2)}s{visibleComments.length ? ` · ${visibleComments.length} 💬` : ""}</small>
      </span>
      {clip.locked ? <Lock aria-hidden="true" className="multitrack-clip__state" /> : null}
      {invalid ? <TriangleAlert aria-hidden="true" className="multitrack-clip__state" /> : null}
      {visibleComments.length ? (
        <span className="multitrack-clip__comments" aria-hidden="true">
          {visibleComments.map((comment: any) => {
            const at = Number(comment.atSec) - clipStartSec;
            return (
              <button
                key={comment.id || `${at}-${comment.body?.slice(0, 8)}`}
                type="button"
                className={`multitrack-clip__comment-pin${comment.status === "resolved" ? " is-resolved" : ""}`}
                title={comment.body}
                aria-label={`تعليق عند ${at.toFixed(1)} ثانية: ${comment.body}`}
                style={{ insetInlineStart: `${at * pixelsPerSecond}px` }}
                onClick={(event: any) => {
                  event.stopPropagation();
                  onCommand?.({ type: "clip.comment-focus", clipId: clip.id, commentId: comment.id, atSec: comment.atSec });
                }}
              >
                <MessageCircle aria-hidden="true" className="h-3 w-3" />
              </button>
            );
          })}
        </span>
      ) : null}
      <span className="multitrack-clip__trim" data-edge="out" aria-hidden="true" onPointerDown={(event: any) => startTrim("out", event)} onPointerUp={finishTrim} />
    </div>
  );
}

export default TimelineClip;
