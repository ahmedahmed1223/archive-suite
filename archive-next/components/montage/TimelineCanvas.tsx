"use client";

import { useCallback } from "react";
import { reduceEditor, type EditorAction, type EditorState } from "@/lib/montage-editor";

export type TimelineCanvasCopy = {
  timelineAriaLabel: string;
  selectHint: string;
  selectedHint: string;
};

type TimelineCanvasProps = {
  state: EditorState;
  dispatch: (action: EditorAction) => void;
  fps?: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  copy: TimelineCanvasCopy;
};

/**
 * V1.5 Task 5: keyboard-accessible timeline.
 * Every pointer gesture has an equivalent key command; timecode renders
 * dir="ltr" inside the RTL layout; a status region announces each edit.
 */
export default function TimelineCanvas({
  state,
  dispatch,
  fps = 25,
  selectedClipId,
  onSelectClip,
  copy,
}: TimelineCanvasProps) {
  const { clips, tracks } = state.timeline;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const clip = clips.find((c) => c.id === selectedClipId);
      if (!clip) return;
      const frame = 1 / fps;

      switch (event.key) {
        case "s":
          dispatch({ type: "split", clipId: clip.id, at: clip.timelineStart + frame });
          break;
        case "ArrowLeft":
          event.preventDefault();
          dispatch({
            type: "move",
            clipId: clip.id,
            trackId: clip.trackId,
            start: Math.max(0, clip.timelineStart - frame),
          });
          break;
        case "ArrowRight":
          event.preventDefault();
          dispatch({
            type: "move",
            clipId: clip.id,
            trackId: clip.trackId,
            start: clip.timelineStart + frame,
          });
          break;
        case "t":
          dispatch({
            type: "rippleTrim",
            clipId: clip.id,
            out: Math.max(clip.sourceIn + frame, clip.sourceOut - frame),
          });
          break;
        default:
          return;
      }
    },
    [clips, dispatch, fps, selectedClipId],
  );

  const secondsToTimecode = (s: number): string => {
    const total = Math.round(s * fps);
    const ss = Math.floor(total / fps);
    const ff = total % fps;
    return `${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
  };

  return (
    <div className="timeline-canvas">
      <div
        role="listbox"
        aria-label={copy.timelineAriaLabel}
        tabIndex={0}
        className="timeline-canvas__tracks"
        onKeyDown={handleKeyDown}
      >
        {tracks.map((track) => (
          <div key={track.id} className="timeline-canvas__track" data-track-kind={track.kind}>
            <span className="timeline-canvas__track-label">{track.name ?? track.id}</span>
            <div className="timeline-canvas__clips">
              {clips
                .filter((clip) => clip.trackId === track.id)
                .sort((a, b) => a.timelineStart - b.timelineStart)
                .map((clip) => (
                  <button
                    key={clip.id}
                    role="option"
                    aria-selected={clip.id === selectedClipId}
                    className="timeline-canvas__clip"
                    onClick={() => onSelectClip(clip.id)}
                    style={{
                      insetInlineStart: `${clip.timelineStart * 2}rem`,
                      inlineSize: `${Math.max(2, (clip.sourceOut - clip.sourceIn) * 2)}rem`,
                    }}
                  >
                    <span dir="ltr" className="timeline-canvas__timecode">
                      {secondsToTimecode(clip.sourceOut - clip.sourceIn)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <p role="status" className="timeline-canvas__status sr-only">
        {selectedClipId ? copy.selectedHint : copy.selectHint}
      </p>
    </div>
  );
}

export { reduceEditor };
