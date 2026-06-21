import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { Lock, TriangleAlert } from "lucide-react";

function durationOf(clip) {
  return Math.max(0, Number(clip.outSec || 0) - Number(clip.inSec || 0));
}

export function TimelineClip({ clip, selected, invalid, pixelsPerSecond, playheadSec, activeTool = "select", onCommand }) {
  const trimGesture = React.useRef(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `clip:${clip.id}`,
    data: { clipId: clip.id, trackId: clip.trackId, startSec: Number(clip.timelineStartSec) || 0 },
    disabled: Boolean(clip.locked)
  });
  const duration = durationOf(clip);
  const dragTransform = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;
  const label = clip.label || clip.title || clip.itemId || clip.id;

  const startTrim = (edge, event) => {
    event.preventDefault();
    event.stopPropagation();
    trimGesture.current = { edge, clientX: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const finishTrim = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const gesture = trimGesture.current;
    trimGesture.current = null;
    if (!gesture) return;
    const deltaSec = -(event.clientX - gesture.clientX) / pixelsPerSecond;
    const sourceSec = gesture.edge === "in"
      ? Math.max(0, Math.min(Number(clip.outSec) - 0.04, Number(clip.inSec) + deltaSec))
      : Math.max(Number(clip.inSec) + 0.04, Number(clip.outSec) + deltaSec);
    onCommand?.({ type: "clip.trim", clipId: clip.id, edge: gesture.edge, sourceSec });
  };

  const handleKeyDown = (event) => {
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

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={`قصاصة ${label}`}
      aria-pressed={selected}
      className={`multitrack-clip${selected ? " is-selected" : ""}${invalid ? " is-invalid" : ""}${isDragging ? " is-dragging" : ""}`}
      style={{
        insetInlineStart: `${Math.max(0, Number(clip.timelineStartSec) || 0) * pixelsPerSecond}px`,
        width: `${Math.max(28, duration * pixelsPerSecond)}px`,
        background: clip.color || undefined,
        transform: dragTransform
      }}
      {...listeners}
      {...attributes}
      onClick={() => onCommand?.(activeTool === "blade"
        ? { type: "clip.split", clipId: clip.id, atSec: Number(playheadSec) || 0 }
        : { type: "clip.select", clipId: clip.id })}
      onKeyDown={(event) => {
        handleKeyDown(event);
        if (!event.defaultPrevented) listeners?.onKeyDown?.(event);
      }}
    >
      <span className="multitrack-clip__trim" data-edge="in" aria-hidden="true" onPointerDown={(event) => startTrim("in", event)} onPointerUp={finishTrim} />
      <span className="multitrack-clip__content">
        <strong>{label}</strong>
        <small>{duration.toFixed(2)}s</small>
      </span>
      {clip.locked ? <Lock aria-hidden="true" className="multitrack-clip__state" /> : null}
      {invalid ? <TriangleAlert aria-hidden="true" className="multitrack-clip__state" /> : null}
      <span className="multitrack-clip__trim" data-edge="out" aria-hidden="true" onPointerDown={(event) => startTrim("out", event)} onPointerUp={finishTrim} />
    </div>
  );
}

export default TimelineClip;
