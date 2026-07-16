import { describe, expect, it } from "vitest";

import {
  buildFcpXml,
  buildPremiereXml,
  secondsToFrames,
  type MontageProject,
} from "./montage";

// V1-715: Premiere (xmeml) and FCPXML export alongside the existing JSON/EDL.
// Both are frame-based interchange formats, so every assertion here is about
// frame accuracy, escaping, and dropping clips an NLE could not open.

function project(overrides: Partial<MontageProject> = {}): MontageProject {
  return {
    id: "project_1",
    name: "Test Sequence",
    description: "",
    fps: 25,
    tracks: [
      { id: "t_video", type: "video", name: "Video", order: 0 },
      { id: "t_audio", type: "audio", name: "Audio", order: 1 },
    ],
    clips: [
      { id: "c1", itemId: "rec-1", title: "Opening", trackId: "t_video", timelineStartSec: 0, inSec: 1, outSec: 5 },
      { id: "c2", itemId: "rec-2", title: "Closing", trackId: "t_video", timelineStartSec: 4, inSec: 0, outSec: 2 },
    ],
    markers: [],
    comments: [],
    transitions: [],
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("secondsToFrames", () => {
  it("converts seconds to whole frames at the sequence rate", () => {
    expect(secondsToFrames(4, 25)).toBe(100);
    expect(secondsToFrames(2.5, 25)).toBe(63); // 62.5 rounds up — never a fractional frame
    expect(secondsToFrames(0, 25)).toBe(0);
  });

  it("never returns a negative frame count", () => {
    expect(secondsToFrames(-5, 25)).toBe(0);
  });
});

describe("buildPremiereXml", () => {
  it("emits an xmeml sequence with the project rate and frame-based clip timings", () => {
    const xml = buildPremiereXml(project());

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<!DOCTYPE xmeml>");
    expect(xml).toContain('<xmeml version="5">');
    expect(xml).toContain("<timebase>25</timebase>");
    // Clip 1: source 1s..5s at 25fps = in 25, out 125; timeline 0..4s = start 0, end 100.
    expect(xml).toContain("<in>25</in>");
    expect(xml).toContain("<out>125</out>");
    expect(xml).toContain("<start>0</start>");
    expect(xml).toContain("<end>100</end>");
  });

  it("escapes XML metacharacters so a title cannot break the document", () => {
    const xml = buildPremiereXml(project({
      name: "Rock & Roll <2026>",
      clips: [{ id: "c1", itemId: "rec-1", title: 'A "quoted" & <tagged> clip', trackId: "t_video", timelineStartSec: 0, inSec: 0, outSec: 1 }],
    }));

    expect(xml).toContain("Rock &amp; Roll &lt;2026&gt;");
    expect(xml).toContain("&quot;quoted&quot; &amp; &lt;tagged&gt;");
    expect(xml).not.toContain("<2026>");
  });

  it("preserves Arabic titles verbatim", () => {
    const xml = buildPremiereXml(project({ name: "مشروع الأرشيف" }));
    expect(xml).toContain("مشروع الأرشيف");
  });

  it("drops clips an NLE could not open instead of emitting a broken item", () => {
    const xml = buildPremiereXml(project({
      clips: [
        { id: "ok", itemId: "rec-1", title: "Good", trackId: "t_video", timelineStartSec: 0, inSec: 0, outSec: 2 },
        { id: "bad", itemId: "rec-2", title: "Inverted", trackId: "t_video", timelineStartSec: 0, inSec: 5, outSec: 5 },
      ],
    }));

    expect(xml).toContain("Good");
    expect(xml).not.toContain("Inverted");
  });

  it("emits a track per montage track that carries clips", () => {
    const xml = buildPremiereXml(project({
      clips: [
        { id: "v1", itemId: "rec-1", title: "Vid", trackId: "t_video", timelineStartSec: 0, inSec: 0, outSec: 2 },
        { id: "a1", itemId: "rec-2", title: "Aud", trackId: "t_audio", timelineStartSec: 0, inSec: 0, outSec: 2 },
      ],
    }));

    expect(xml).toContain("<video>");
    expect(xml).toContain("<audio>");
    expect(xml).toContain("Vid");
    expect(xml).toContain("Aud");
  });

  it("stays a well-formed document for an empty timeline", () => {
    const xml = buildPremiereXml(project({ clips: [] }));
    expect(xml).toContain("<xmeml version=\"5\">");
    expect(xml).toContain("</xmeml>");
    expect(xml).toContain("<duration>0</duration>");
  });
});

describe("buildFcpXml", () => {
  it("emits an fcpxml library with a rational frame duration for the sequence rate", () => {
    const xml = buildFcpXml(project());

    expect(xml).toContain("<!DOCTYPE fcpxml>");
    expect(xml).toContain('<fcpxml version="1.9">');
    expect(xml).toContain('frameDuration="1/25s"');
    expect(xml).toContain("<spine>");
  });

  it("expresses clip offsets and durations as frame-aligned rational seconds", () => {
    const xml = buildFcpXml(project());

    // Clip 1: offset 0, source start 1s = 25/25s, duration 4s = 100/25s.
    expect(xml).toContain('offset="0/25s"');
    expect(xml).toContain('start="25/25s"');
    expect(xml).toContain('duration="100/25s"');
  });

  it("declares one asset resource per distinct source record", () => {
    const xml = buildFcpXml(project({
      clips: [
        { id: "c1", itemId: "rec-1", title: "First", trackId: "t_video", timelineStartSec: 0, inSec: 0, outSec: 2 },
        { id: "c2", itemId: "rec-1", title: "Again", trackId: "t_video", timelineStartSec: 2, inSec: 3, outSec: 5 },
      ],
    }));

    // rec-1 is used twice but must be declared once, then referenced twice.
    expect(xml.match(/<asset /g)?.length).toBe(1);
    expect(xml.match(/<asset-clip /g)?.length).toBe(2);
  });

  it("escapes metacharacters in names and keeps Arabic intact", () => {
    const xml = buildFcpXml(project({
      name: "Q1 & Q2",
      clips: [{ id: "c1", itemId: "rec-1", title: "لقطة <افتتاح> & ختام", trackId: "t_video", timelineStartSec: 0, inSec: 0, outSec: 1 }],
    }));

    expect(xml).toContain("Q1 &amp; Q2");
    expect(xml).toContain("لقطة &lt;افتتاح&gt; &amp; ختام");
  });

  it("stays well-formed for an empty timeline", () => {
    const xml = buildFcpXml(project({ clips: [] }));
    expect(xml).toContain("</fcpxml>");
    expect(xml).toContain("<spine></spine>");
  });
});
