/**
 * V1.5 Task 4: pure immutable montage editor state machine.
 * No React, no I/O — the studio components dispatch actions; undo/redo live
 * in memory only; every operation returns a new state object.
 */

export type MontageSourceRef = {
  recordId: string;
  sourceVersionToken: string;
  attachmentId?: string | null;
};

export type MontageClipState = {
  id: string;
  trackId: string;
  source: MontageSourceRef;
  timelineStart: number;
  sourceIn: number;
  sourceOut: number;
};

export type MontageTrackState = {
  id: string;
  kind: "video" | "audio" | "overlay";
  name?: string;
};

export type MontageTimeline = {
  tracks: MontageTrackState[];
  clips: MontageClipState[];
};

export type EditorState = {
  projectId: string;
  revisionNumber: number;
  timeline: MontageTimeline;
  past: MontageTimeline[];
  future: MontageTimeline[];
};

export type EditorAction =
  | { type: "split"; clipId: string; at: number }
  | { type: "move"; clipId: string; trackId: string; start: number }
  | { type: "rippleTrim"; clipId: string; out: number }
  | { type: "setEffect"; clipId: string; effect: Record<string, unknown> };

const FRAME_EPSILON = 1e-6;

/** Normalize a time value onto frame boundaries for the project fps. */
export function snapToFrame(seconds: number, fps: number): number {
  const frame = 1 / Math.max(1, fps);
  return Math.round(seconds / frame + FRAME_EPSILON) * frame;
}

function withHistory(state: EditorState, next: MontageTimeline): EditorState {
  return {
    ...state,
    timeline: next,
    past: [...state.past, state.timeline].slice(-50),
    future: [],
  };
}

function updateClip(
  timeline: MontageTimeline,
  clipId: string,
  fn: (clip: MontageClipState) => MontageClipState,
): MontageTimeline {
  return {
    ...timeline,
    clips: timeline.clips.map((clip) => (clip.id === clipId ? fn(clip) : clip)),
  };
}

/** Ripple trim: shorten one clip and pull every later clip on that track left. */
function rippleTrimClips(
  clips: MontageClipState[],
  clipId: string,
  newOut: number,
): MontageClipState[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;

  const delta = target.sourceOut - newOut;
  if (delta <= 0) return clips;

  let shifted = false;
  const updated = clips.map((clip) => {
    if (clip.id === clipId) {
      shifted = true;
      return { ...clip, sourceOut: newOut };
    }
    if (clip.trackId === target.trackId && clip.timelineStart >= target.sourceOut - FRAME_EPSILON) {
      shifted = true;
      return { ...clip, timelineStart: clip.timelineStart - delta };
    }
    return clip;
  });

  return shifted ? updated : clips;
}

export function reduceEditor(state: EditorState, action: EditorAction, fps = 25): EditorState {
  switch (action.type) {
    case "split": {
      const at = snapToFrame(action.at, fps);
      const target = state.timeline.clips.find((c) => c.id === action.clipId);
      if (!target) return state;
      if (at <= target.timelineStart || at >= target.timelineStart + (target.sourceOut - target.sourceIn)) {
        return state;
      }
      const offset = at - target.timelineStart;
      const left: MontageClipState = { ...target, sourceOut: target.sourceIn + offset };
      const right: MontageClipState = {
        ...target,
        id: `${target.id}-b${state.past.length}-${at}`,
        timelineStart: at,
        sourceIn: target.sourceIn + offset,
      };
      const timeline: MontageTimeline = {
        ...state.timeline,
        clips: [
          ...state.timeline.clips.filter((c) => c.id !== action.clipId),
          left,
          right,
        ],
      };
      return withHistory(state, timeline);
    }

    case "move": {
      const start = snapToFrame(action.start, fps);
      if (start < 0) return state;
      if (!state.timeline.tracks.some((t) => t.id === action.trackId)) return state;
      return withHistory(
        state,
        updateClip(state.timeline, action.clipId, (clip) => ({
          ...clip,
          trackId: action.trackId,
          timelineStart: start,
        })),
      );
    }

    case "rippleTrim": {
      const out = snapToFrame(action.out, fps);
      const target = state.timeline.clips.find((c) => c.id === action.clipId);
      if (!target || out <= target.sourceIn) return state;
      const nextClips = rippleTrimClips(state.timeline.clips, action.clipId, out);
      if (nextClips === state.timeline.clips) return state;
      return withHistory(state, { ...state.timeline, clips: nextClips });
    }

    case "setEffect":
      return withHistory(
        state,
        updateClip(state.timeline, action.clipId, (clip) => ({
          ...clip,
          ...( { effect: action.effect } as Partial<MontageClipState>),
        })),
      );

    default:
      return state;
  }
}

export function undoEditor(state: EditorState): EditorState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return {
    ...state,
    timeline: previous,
    past: state.past.slice(0, -1),
    future: [state.timeline, ...state.future],
  };
}

export function redoEditor(state: EditorState): EditorState {
  if (state.future.length === 0) return state;
  const [next, ...rest] = state.future;
  return {
    ...state,
    timeline: next,
    past: [...state.past, state.timeline],
    future: rest,
  };
}

/** Serialize the current timeline as an immutable revision payload. */
export function serializeRevision(state: EditorState): {
  expectedRevision: number;
  tracks: MontageTrackState[];
  clips: MontageClipState[];
} {
  return {
    expectedRevision: state.revisionNumber,
    tracks: state.timeline.tracks,
    clips: state.timeline.clips,
  };
}
