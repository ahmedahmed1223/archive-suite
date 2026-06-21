import { describe, expect, it } from "vitest";

import {
  addTimelineTrack,
  createDefaultTracks,
  findTrackCollisions,
  frameToSeconds,
  moveClipToTrack,
  normalizeMultiTrackProject,
  removeTimelineTrack,
  reorderTimelineTracks,
  resolveSnappedTime,
  rippleAfterEdit,
  secondsToFrame,
  splitMultiTrackClip,
  trimMultiTrackClip,
  updateTimelineTrack
} from "./multiTrackModel.js";

describe("normalizeMultiTrackProject", () => {
  it("places legacy rough cuts sequentially on magnetic V1", () => {
    const project = normalizeMultiTrackProject({
      id: "project-1",
      roughCuts: [
        { id: "a", itemId: "item-a", inSec: 0, outSec: 4, order: 0 },
        { id: "b", itemId: "item-b", inSec: 2, outSec: 7, order: 1 }
      ]
    });

    expect(project.timelineTracks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "v1", type: "video", magnetic: true })
    ]));
    expect(project.roughCuts.map((clip) => [clip.trackId, clip.timelineStartSec])).toEqual([
      ["v1", 0],
      ["v1", 4]
    ]);
  });

  it("preserves explicit track positions and merges timeline preferences", () => {
    const project = normalizeMultiTrackProject({
      timelineTracks: [{ id: "overlay", type: "video", name: "Overlay", order: 4 }],
      timelinePreferences: { snapping: false, rippleMode: "off" },
      roughCuts: [{ id: "a", trackId: "overlay", timelineStartSec: 9, inSec: 0, outSec: 2 }]
    });

    expect(project.roughCuts[0]).toMatchObject({ trackId: "overlay", timelineStartSec: 9 });
    expect(project.timelinePreferences).toMatchObject({
      snapping: false,
      rippleMode: "off",
      linkAudioVideo: true,
      showWaveforms: true
    });
  });
});

describe("dynamic track operations", () => {
  it("adds and edits dynamic tracks immutably", () => {
    const tracks = createDefaultTracks();
    const added = addTimelineTrack(
      tracks,
      { type: "audio", name: "Music" },
      { idFactory: () => "a2" }
    );
    const updated = updateTimelineTrack(added, "a2", { muted: true, magnetic: false });

    expect(updated.at(-1)).toMatchObject({
      id: "a2",
      type: "audio",
      name: "Music",
      muted: true,
      magnetic: false
    });
    expect(tracks).not.toEqual(updated);
    expect(tracks).toHaveLength(2);
  });

  it("rejects unknown track types", () => {
    expect(() => addTimelineTrack(createDefaultTracks(), { type: "data" }))
      .toThrow(/track type/i);
  });
});

describe("moveClipToTrack", () => {
  it("moves a video clip to an unlocked video track", () => {
    const result = moveClipToTrack({
      clips: [{ id: "c1", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 3 }],
      tracks: [{ id: "v1", type: "video" }, { id: "v2", type: "video" }],
      clipId: "c1",
      trackId: "v2",
      startSec: 5
    });

    expect(result.ok).toBe(true);
    expect(result.clips[0]).toMatchObject({ trackId: "v2", timelineStartSec: 5 });
  });

  it("moves only compatible clips between tracks", () => {
    const result = moveClipToTrack({
      clips: [{ id: "c1", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 3 }],
      tracks: [{ id: "v1", type: "video" }, { id: "a1", type: "audio" }],
      clipId: "c1",
      trackId: "a1",
      startSec: 5
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("incompatible-track");
  });

  it("refuses to move clips onto a locked track", () => {
    const result = moveClipToTrack({
      clips: [{ id: "c1", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 3 }],
      tracks: [{ id: "v1", type: "video" }, { id: "v2", type: "video", locked: true }],
      clipId: "c1",
      trackId: "v2",
      startSec: 5
    });

    expect(result).toMatchObject({ ok: false, reason: "track-locked" });
  });
});

describe("frame and snapping math", () => {
  it("converts seconds and frames at the project FPS", () => {
    expect(secondsToFrame(1.24, 25)).toBe(31);
    expect(frameToSeconds(31, 25)).toBeCloseTo(1.24, 6);
    expect(secondsToFrame(-2, 25)).toBe(0);
  });

  it("snaps to the nearest frame and neighboring clip edge", () => {
    expect(resolveSnappedTime({
      candidateSec: 4.019,
      fps: 25,
      snapping: true,
      targets: [2, 4]
    })).toBe(4);
    expect(resolveSnappedTime({
      candidateSec: 4.019,
      fps: 25,
      snapping: false,
      targets: [4]
    })).toBeCloseTo(4.019, 6);
  });
});

describe("ripple and collision behavior", () => {
  const tracks = [
    { id: "v1", type: "video", magnetic: true },
    { id: "v2", type: "video", magnetic: false }
  ];
  const clips = [
    { id: "a", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 4 },
    { id: "b", trackId: "v1", timelineStartSec: 4, inSec: 0, outSec: 3 },
    { id: "overlay", trackId: "v2", timelineStartSec: 1, inSec: 0, outSec: 2 }
  ];

  it("ripples later clips on the magnetic primary track only", () => {
    const next = rippleAfterEdit({ clips, tracks, editedClipId: "a", deltaSec: 2, scope: "primary" });
    expect(next.find((clip) => clip.id === "b").timelineStartSec).toBe(6);
    expect(next.find((clip) => clip.id === "overlay").timelineStartSec).toBe(1);
  });

  it("respects locked tracks when rippling all unlocked tracks", () => {
    const next = rippleAfterEdit({
      clips,
      tracks: tracks.map((track) => track.id === "v2" ? { ...track, locked: true } : track),
      editedClipId: "a",
      deltaSec: 1,
      scope: "all-unlocked"
    });
    expect(next.find((clip) => clip.id === "b").timelineStartSec).toBe(5);
    expect(next.find((clip) => clip.id === "overlay").timelineStartSec).toBe(1);
  });

  it("detects true overlap per track", () => {
    expect(findTrackCollisions([
      { id: "a", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 4 },
      { id: "b", trackId: "v1", timelineStartSec: 3, inSec: 0, outSec: 2 },
      { id: "c", trackId: "v2", timelineStartSec: 3, inSec: 0, outSec: 2 }
    ])).toEqual([
      expect.objectContaining({ trackId: "v1", firstId: "a", secondId: "b", overlapSec: 1 })
    ]);
  });
});

describe("trim and split", () => {
  const tracks = [{ id: "v1", type: "video", magnetic: true }];
  const clips = [
    { id: "a", itemId: "item", trackId: "v1", timelineStartSec: 0, inSec: 2, outSec: 8 },
    { id: "b", itemId: "next", trackId: "v1", timelineStartSec: 6, inSec: 0, outSec: 2 }
  ];

  it("trims a clip and ripples later magnetic clips by the duration delta", () => {
    const result = trimMultiTrackClip({
      clips,
      tracks,
      clipId: "a",
      edge: "out",
      sourceSec: 10,
      rippleMode: "primary"
    });
    expect(result.ok).toBe(true);
    expect(result.clips.find((clip) => clip.id === "a").outSec).toBe(10);
    expect(result.clips.find((clip) => clip.id === "b").timelineStartSec).toBe(8);
  });

  it("splits a clip at timeline time and keeps source continuity", () => {
    const result = splitMultiTrackClip({
      clips,
      clipId: "a",
      timelineSec: 3,
      idFactory: () => "a-right"
    });
    expect(result.ok).toBe(true);
    expect(result.clips.slice(0, 2)).toEqual([
      expect.objectContaining({ id: "a", inSec: 2, outSec: 5, timelineStartSec: 0 }),
      expect.objectContaining({ id: "a-right", inSec: 5, outSec: 8, timelineStartSec: 3 })
    ]);
  });

  it("refuses trim and split edits on a locked clip", () => {
    const locked = clips.map((clip) => clip.id === "a" ? { ...clip, locked: true } : clip);
    expect(trimMultiTrackClip({ clips: locked, tracks, clipId: "a", edge: "out", sourceSec: 7 })).toMatchObject({ ok: false, reason: "clip-locked" });
    expect(splitMultiTrackClip({ clips: locked, clipId: "a", timelineSec: 2 })).toMatchObject({ ok: false, reason: "clip-locked" });
  });
});

describe("track ordering and guarded removal", () => {
  const tracks = [
    { id: "v1", type: "video", order: 0 },
    { id: "v2", type: "video", order: 1 },
    { id: "a1", type: "audio", order: 2 }
  ];

  it("reorders tracks and resequences order values", () => {
    expect(reorderTimelineTracks(tracks, "a1", "v1").map((track) => [track.id, track.order]))
      .toEqual([["a1", 0], ["v1", 1], ["v2", 2]]);
  });

  it("moves clips before deleting a non-empty track", () => {
    const result = removeTimelineTrack({
      tracks,
      clips: [{ id: "c", trackId: "v2", timelineStartSec: 2, inSec: 0, outSec: 2 }],
      trackId: "v2",
      strategy: "move",
      destinationTrackId: "v1"
    });
    expect(result.ok).toBe(true);
    expect(result.tracks.map((track) => track.id)).toEqual(["v1", "a1"]);
    expect(result.clips[0].trackId).toBe("v1");
  });
});
