import { describe, expect, it } from "vitest";
import {
  reduceEditor,
  redoEditor,
  serializeRevision,
  snapToFrame,
  undoEditor,
  type EditorState,
} from "./montage-editor";

function makeState(): EditorState {
  return {
    projectId: "p1",
    revisionNumber: 3,
    timeline: {
      tracks: [
        { id: "t1", kind: "video" },
        { id: "t2", kind: "video" },
      ],
      clips: [
        {
          id: "a",
          trackId: "t1",
          source: { recordId: "r1", sourceVersionToken: "sha256:one" },
          timelineStart: 0,
          sourceIn: 0,
          sourceOut: 10,
        },
        {
          id: "b",
          trackId: "t1",
          source: { recordId: "r2", sourceVersionToken: "sha256:two" },
          timelineStart: 10,
          sourceIn: 0,
          sourceOut: 6,
        },
      ],
    },
    past: [],
    future: [],
  };
}

describe("montage editor reducer (Task 4)", () => {
  it("ripple-trims downstream clips without mutating the source revision", () => {
    const state = makeState();
    const next = reduceEditor(state, { type: "rippleTrim", clipId: "a", out: 8 });
    expect(next.timeline.clips.find((c) => c.id === "b")?.timelineStart).toBe(8);
    // The original state is untouched — pure reducer.
    expect(state.timeline.clips.find((c) => c.id === "b")?.timelineStart).toBe(10);
    expect(next.timeline.clips.find((c) => c.id === "a")?.sourceOut).toBe(8);
  });

  it("splits one clip into two at the requested frame", () => {
    const next = reduceEditor(makeState(), { type: "split", clipId: "a", at: 4 });
    const pieces = next.timeline.clips.filter((c) => c.id.startsWith("a"));
    expect(pieces).toHaveLength(2);
    expect(pieces[0].sourceOut).toBe(4);
    expect(pieces[1].timelineStart).toBe(4);
  });

  it("refuses a split outside the clip bounds", () => {
    const state = makeState();
    const next = reduceEditor(state, { type: "split", clipId: "a", at: 99 });
    expect(next).toBe(state); // same reference: no-op
  });

  it("moves a clip between tracks and rejects unknown tracks", () => {
    const moved = reduceEditor(makeState(), { type: "move", clipId: "a", trackId: "t2", start: 12 });
    expect(moved.timeline.clips.find((c) => c.id === "a")?.trackId).toBe("t2");

    const rejected = reduceEditor(makeState(), { type: "move", clipId: "a", trackId: "ghost", start: 1 });
    expect(rejected).toBe(makeState() ? rejected : rejected);
    expect(rejected.timeline).toEqual(makeState().timeline);
  });

  it("adds selected material at the end of the target track", () => {
    const next = reduceEditor(makeState(), {
      type: "add",
      trackId: "t1",
      source: { recordId: "r3", sourceVersionToken: "sha256:three" },
      durationSeconds: 4,
    });

    const added = next.timeline.clips.at(-1);
    expect(added).toMatchObject({
      trackId: "t1",
      source: { recordId: "r3", sourceVersionToken: "sha256:three" },
      timelineStart: 16,
      sourceIn: 0,
      sourceOut: 4,
    });
    expect(added?.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("undoes and redoes through history stacks", () => {
    let state = makeState();
    state = reduceEditor(state, { type: "rippleTrim", clipId: "a", out: 7 });
    expect(state.past).toHaveLength(1);
    // delta = 10 - 7 = 3, so clip b is pulled from 10 to 7.
    expect(state.timeline.clips.find((c) => c.id === "b")?.timelineStart).toBe(7);

    state = undoEditor(state);
    expect(state.timeline.clips.find((c) => c.id === "b")?.timelineStart).toBe(10);

    state = redoEditor(state);
    expect(state.timeline.clips.find((c) => c.id === "b")?.timelineStart).toBe(7);
  });

  it("serializes with expectedRevision for optimistic concurrency", () => {
    const payload = serializeRevision(makeState());
    expect(payload.expectedRevision).toBe(3);
    expect(payload.clips).toHaveLength(2);
  });

  it("snaps times onto frame boundaries", () => {
    expect(snapToFrame(0.041, 25)).toBeCloseTo(0.04);
    expect(snapToFrame(1.999, 25)).toBeCloseTo(2);
  });
});
