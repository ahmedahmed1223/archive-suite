"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface AnnotationRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AnnotationCanvasProps {
  rectangles: AnnotationRect[];
  /** When true the user can draw new rectangles; otherwise the overlay is read-only. */
  editable?: boolean;
  onChange?: (rects: AnnotationRect[]) => void;
}

// A normalized SVG overlay maps review rectangles to the visible frame at any
// player size without replay-time scale calculations.
export default function AnnotationCanvas({ rectangles, editable = false, onChange }: AnnotationCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<AnnotationRect | null>(null);

  const normalize = (event: ReactPointerEvent): { x: number; y: number } => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handleDown = (event: ReactPointerEvent) => {
    if (!editable) return;
    const point = normalize(event);
    startRef.current = point;
    setDraft({ x: point.x, y: point.y, w: 0, h: 0 });
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const handleMove = (event: ReactPointerEvent) => {
    if (!editable || !startRef.current) return;
    const point = normalize(event);
    const start = startRef.current;
    setDraft({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    });
  };

  const handleUp = () => {
    if (!editable) return;
    const current = draft;
    startRef.current = null;
    setDraft(null);
    // Ignore accidental micro-drags.
    if (current && current.w > 0.01 && current.h > 0.01) {
      onChange?.([...rectangles, current]);
    }
  };

  const shapes = draft ? [...rectangles, draft] : rectangles;

  return (
    <svg
      ref={svgRef}
      className={`annotation-canvas ${editable ? "annotation-canvas-editable" : "annotation-canvas-readonly"}`}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
    >
      {shapes.map((r, index) => (
        <rect
          key={index}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
