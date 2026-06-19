import { describe, expect, it } from "vitest";
import {
  buildClipLayout,
  clipDuration,
  moveClip,
  pxToTime,
  timeToPx,
  totalDuration,
  trimClip
} from "./timelineModel.js";

const clips = [
  { id: "a", itemId: "i1", inSec: 0, outSec: 10, label: "open", order: 0 },
  { id: "b", itemId: "i2", inSec: 5, outSec: 15, label: "mid", order: 1 },
  { id: "c", itemId: "i3", inSec: 0, outSec: 4, label: "end", order: 2 }
];

describe("clipDuration", () => {
  it("returns outSec - inSec clamped at zero", () => {
    expect(clipDuration({ inSec: 2, outSec: 9 })).toBe(7);
    expect(clipDuration({ inSec: 9, outSec: 2 })).toBe(0);
    expect(clipDuration(null)).toBe(0);
  });
});

describe("totalDuration", () => {
  it("sums the source length of every clip", () => {
    expect(totalDuration(clips)).toBe(10 + 10 + 4);
  });

  it("handles empty / invalid input", () => {
    expect(totalDuration([])).toBe(0);
    expect(totalDuration(undefined)).toBe(0);
  });
});

describe("timeToPx / pxToTime", () => {
  it("scales seconds to pixels", () => {
    expect(timeToPx(10, 10)).toBe(100);
    expect(timeToPx(0, 10)).toBe(0);
  });

  it("round-trips px <-> time", () => {
    expect(pxToTime(timeToPx(7.5, 8), 8)).toBeCloseTo(7.5, 6);
    expect(timeToPx(pxToTime(240, 12), 12)).toBeCloseTo(240, 6);
  });

  it("falls back to scale 1 for a non-positive pxPerSecond", () => {
    expect(timeToPx(5, 0)).toBe(5);
    expect(timeToPx(5, -3)).toBe(5);
  });

  it("clamps negative / invalid pixels and seconds to 0", () => {
    expect(pxToTime(-10, 10)).toBe(0);
    expect(pxToTime(NaN, 10)).toBe(0);
    expect(timeToPx(-4, 10)).toBe(0);
  });
});

describe("buildClipLayout", () => {
  it("positions clips sequentially with cumulative start", () => {
    const layout = buildClipLayout(clips, { pxPerSecond: 10 });
    expect(layout.map((c) => c.startSec)).toEqual([0, 10, 20]);
    expect(layout.map((c) => c.durationSec)).toEqual([10, 10, 4]);
    expect(layout.map((c) => c.startPx)).toEqual([0, 100, 200]);
    expect(layout.map((c) => c.widthPx)).toEqual([100, 100, 40]);
  });

  it("preserves clip identity fields", () => {
    const [first] = buildClipLayout(clips, { pxPerSecond: 5 });
    expect(first).toMatchObject({ id: "a", itemId: "i1", label: "open", inSec: 0, outSec: 10 });
  });

  it("respects the order field, not array index", () => {
    const shuffled = [clips[2], clips[0], clips[1]];
    const layout = buildClipLayout(shuffled, { pxPerSecond: 10 });
    expect(layout.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty layout for empty input", () => {
    expect(buildClipLayout([])).toEqual([]);
    expect(buildClipLayout(undefined)).toEqual([]);
  });

  it("defaults to a positive scale when pxPerSecond is invalid", () => {
    const layout = buildClipLayout(clips, { pxPerSecond: 0 });
    expect(layout[1].startPx).toBe(10); // scale 1
  });
});

describe("moveClip", () => {
  it("reorders a clip to the position containing newStartSec", () => {
    // c starts at sec 20; move it to sec 0 → front
    const moved = moveClip(clips, "c", 0);
    expect(moved.map((c) => c.id)).toEqual(["c", "a", "b"]);
    expect(moved.map((c) => c.order)).toEqual([0, 1, 2]);
  });

  it("moves a clip to the end when newStartSec is past the timeline", () => {
    const moved = moveClip(clips, "a", 999);
    expect(moved.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("clamps a negative newStartSec to the front", () => {
    const moved = moveClip(clips, "b", -50);
    expect(moved.map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("does not mutate the input array or clip objects", () => {
    const snapshot = JSON.parse(JSON.stringify(clips));
    moveClip(clips, "c", 0);
    expect(clips).toEqual(snapshot);
  });

  it("returns an ordered copy for an unknown id", () => {
    const result = moveClip(clips, "zzz", 5);
    expect(result.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("does not move locked clips", () => {
    const locked = clips.map((clip) => clip.id === "b" ? { ...clip, locked: true } : clip);
    const moved = moveClip(locked, "b", 0);
    expect(moved.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("trimClip", () => {
  it("updates source in/out immutably", () => {
    const next = trimClip(clips, "a", { startSec: 2, endSec: 8 });
    const a = next.find((c) => c.id === "a");
    expect(a).toMatchObject({ inSec: 2, outSec: 8 });
    expect(clips[0].inSec).toBe(0); // original untouched
  });

  it("keeps the unspecified bound", () => {
    const next = trimClip(clips, "b", { startSec: 7 });
    const b = next.find((c) => c.id === "b");
    expect(b.inSec).toBe(7);
    expect(b.outSec).toBe(15);
  });

  it("clamps so end is never before start", () => {
    const next = trimClip(clips, "a", { startSec: 9, endSec: 3 });
    const a = next.find((c) => c.id === "a");
    expect(a.inSec).toBe(3);
    expect(a.outSec).toBe(3);
  });

  it("clamps negatives to zero", () => {
    const next = trimClip(clips, "c", { startSec: -5 });
    const c = next.find((c) => c.id === "c");
    expect(c.inSec).toBe(0);
  });

  it("leaves other clips untouched and ignores unknown ids", () => {
    const next = trimClip(clips, "nope", { startSec: 1 });
    expect(next).toEqual(clips);
  });

  it("does not trim locked clips", () => {
    const locked = clips.map((clip) => clip.id === "a" ? { ...clip, locked: true } : clip);
    const next = trimClip(locked, "a", { startSec: 2, endSec: 8 });
    expect(next.find((clip) => clip.id === "a")).toMatchObject({ inSec: 0, outSec: 10, locked: true });
  });
});
