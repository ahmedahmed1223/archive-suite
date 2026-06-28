import { describe, expect, it } from "vitest";
import {
  buildRenderGraph,
  getActiveLayers,
  getTimelineEndSec,
  serializeMultiTrackTimeline
} from "./renderGraph.js";

const tracks = [
  { id: "v1", type: "video", name: "Story", order: 0, magnetic: true },
  { id: "v2", type: "video", name: "Overlay", order: 1 },
  { id: "t1", type: "title", name: "Titles", order: 2 }
];

describe("montage render graph", () => {
  it("returns active layered clips ordered by track then clip", () => {
    const project = {
      id: "p1",
      name: "Layered",
      timelineTracks: tracks,
      roughCuts: [
        { id: "v1-a", itemId: "one", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 8 },
        { id: "v2-a", itemId: "two", trackId: "v2", timelineStartSec: 2, inSec: 1, outSec: 5 },
        { id: "title-a", itemId: "title", mediaType: "title", trackId: "t1", timelineStartSec: 3, inSec: 0, outSec: 2 }
      ]
    };
    const itemsById = new Map([
      ["one", { id: "one", path: "one.mp4" }],
      ["two", { id: "two", path: "two.mp4" }],
      ["title", { id: "title", title: "Headline" }]
    ]);

    const graph = buildRenderGraph(project, itemsById);

    expect(getActiveLayers(graph, 3).map((layer) => layer.clipId)).toEqual(["v1-a", "v2-a", "title-a"]);
    expect(getTimelineEndSec(graph)).toBe(8);
  });

  it("includes transforms, filter stack, audio, keyframes, and validation warnings", () => {
    const graph = buildRenderGraph({
      id: "p2",
      timelineTracks: tracks,
      roughCuts: [{
        id: "fx",
        itemId: "missing",
        trackId: "v2",
        timelineStartSec: 1,
        inSec: 0,
        outSec: 4,
        transform: { scale: 1.2, x: 10 },
        filterStack: [{ id: "sharp", type: "sharpen", params: { amount: 1 } }],
        audio: { volumeDb: -4, pan: 0.25 },
        keyframes: [{ id: "k1", property: "transform.x", timeSec: 1, value: 20, easing: "linear" }]
      }]
    }, new Map());

    expect(graph.layers[0]).toMatchObject({
      clipId: "fx",
      startSec: 1,
      endSec: 5,
      transform: { scale: 1.2, x: 10 },
      audio: { volumeDb: -4, pan: 0.25 },
      keyframes: [{ id: "k1", property: "transform.x", timeSec: 1, value: 20, easing: "linear" }]
    });
    expect((graph.layers[0]!.filters as Array<Record<string, unknown>>)[0]).toMatchObject({ type: "sharpen", exportOnly: true });
    expect(graph.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(["missing-source", "export-only-filter"]));
  });

  it("normalizes legacy clips sequentially and serializes deterministically", () => {
    const graph = buildRenderGraph({
      id: "legacy",
      roughCuts: [
        { id: "a", itemId: "a", order: 0, inSec: 0, outSec: 4 },
        { id: "b", itemId: "b", order: 1, inSec: 2, outSec: 7 }
      ]
    }, new Map([
      ["a", { path: "a.mp4" }],
      ["b", { path: "b.mp4" }]
    ]));

    expect(graph.layers.map((layer) => layer.startSec)).toEqual([0, 4]);
    expect(serializeMultiTrackTimeline(graph)).toMatchObject({
      version: "multitrack/v1",
      totalDuration: 9,
      tracks: expect.any(Array),
      clips: expect.any(Array)
    });
  });
});
