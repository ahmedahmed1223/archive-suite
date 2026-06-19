import { describe, expect, it } from "vitest";
import {
  addProjectMarker,
  addTemporalComment,
  buildMediaReadiness,
  buildMontagePresetClipPatch,
  buildProjectDeliveryPackage,
  buildProductionBoardSummary,
  buildProjectTimeline,
  createProjectValue,
  createRoughCutValue,
  DEFAULT_TIMELINE_SETTINGS,
  duplicateRoughCut,
  getProjectCommentsForClip,
  splitRoughCut
} from "./viewModel.js";

describe("professional montage project model", () => {
  it("keeps old rough cuts compatible while adding professional clip fields", () => {
    const cut = createRoughCutValue({
      itemId: "item-1",
      inSec: 2,
      outSec: 8,
      notes: "  opening note  ",
      color: "#22c55e",
      trackId: "a-roll",
      locked: true,
      reviewStatus: "approved",
      volumeDb: -4
    });

    expect(cut).toMatchObject({
      itemId: "item-1",
      inSec: 2,
      outSec: 8,
      notes: "opening note",
      color: "#22c55e",
      trackId: "a-roll",
      locked: true,
      reviewStatus: "approved",
      volumeDb: -4
    });
  });

  it("adds timeline settings and carries them into the interchange timeline", () => {
    const project = createProjectValue({
      id: "project-1",
      name: "Daily cut",
      timelineSettings: { fps: 30, resolution: "1280x720", aspectRatio: "16:9" },
      markers: [{ id: "m1", atSec: 3, label: "cold open" }],
      roughCuts: [
        {
          id: "cut-1",
          itemId: "item-1",
          inSec: 1,
          outSec: 5,
          label: "Open",
          color: "#38bdf8",
          notes: "Needs lower third",
          reviewStatus: "needs_review",
          trackId: "v1",
          volumeDb: -3
        }
      ]
    });
    const itemsById = new Map([
      ["item-1", { id: "item-1", title: "Source", path: "source.mp4" }]
    ]);

    const timeline = buildProjectTimeline(project, itemsById);

    expect(timeline.fps).toBe(30);
    expect(timeline.settings).toEqual({ fps: 30, resolution: "1280x720", aspectRatio: "16:9" });
    expect(timeline.markers).toEqual([{ id: "m1", atSec: 3, label: "cold open" }]);
    expect(timeline.clips[0]).toMatchObject({
      color: "#38bdf8",
      notes: "Needs lower third",
      reviewStatus: "needs_review",
      trackId: "v1",
      volumeDb: -3
    });
  });

  it("defaults timeline settings for legacy projects", () => {
    const project = createProjectValue({ name: "Legacy" });
    expect(project.timelineSettings).toEqual(DEFAULT_TIMELINE_SETTINGS);
    expect(project.markers).toEqual([]);
  });

  it("adds timeline markers and carries them in sorted order", () => {
    const project = createProjectValue({ id: "p1", name: "Markers" });
    const withLate = addProjectMarker(project, { atSec: 20, label: "ending" });
    const withEarly = addProjectMarker(withLate, { atSec: 4, label: "cold open", color: "#38bdf8" });
    const timeline = buildProjectTimeline(withEarly, new Map());

    expect(withEarly.markers.map((marker) => marker.label)).toEqual(["cold open", "ending"]);
    expect(timeline.markers.map((marker) => marker.atSec)).toEqual([4, 20]);
  });

  it("adds temporal comments that can be queried by clip", () => {
    const project = createProjectValue({
      id: "p1",
      name: "Comments",
      roughCuts: [{ id: "c1", itemId: "i1", inSec: 0, outSec: 5 }]
    });

    const next = addTemporalComment(project, { clipId: "c1", atSec: 2.5, body: "راجع مستوى الصوت", authorId: "u1" });

    expect(next.comments).toHaveLength(1);
    expect(getProjectCommentsForClip(next, "c1")[0]).toMatchObject({
      clipId: "c1",
      atSec: 2.5,
      body: "راجع مستوى الصوت",
      authorId: "u1",
      status: "open"
    });
  });

  it("stores transitions, filters, and transform controls on rough cuts and timeline clips", () => {
    const project = createProjectValue({
      id: "p1",
      name: "Effects",
      roughCuts: [{
        id: "c1",
        itemId: "i1",
        inSec: 0,
        outSec: 8,
        transition: { type: "fade", durationSec: 1.25 },
        filters: { look: "cinematic", brightness: 0.1, contrast: 1.2, saturation: 1.1 },
        transform: { scale: 1.2, x: 12, y: -8, rotation: 3, opacity: 0.9 }
      }]
    });
    const timeline = buildProjectTimeline(project, new Map([["i1", { id: "i1", path: "a.mp4" }]]));

    expect(project.roughCuts[0]).toMatchObject({
      transition: { type: "fade", durationSec: 1.25 },
      filters: { look: "cinematic", brightness: 0.1, contrast: 1.2, saturation: 1.1 },
      transform: { scale: 1.2, x: 12, y: -8, rotation: 3, opacity: 0.9 }
    });
    expect(timeline.clips[0]).toMatchObject({
      transition: { type: "fade", durationSec: 1.25 },
      filters: { look: "cinematic", brightness: 0.1, contrast: 1.2, saturation: 1.1 },
      transform: { scale: 1.2, x: 12, y: -8, rotation: 3, opacity: 0.9 }
    });
  });

  it("splits and duplicates clips without losing effects", () => {
    const project = createProjectValue({
      id: "p1",
      name: "Cut tools",
      roughCuts: [{ id: "c1", itemId: "i1", inSec: 0, outSec: 10, label: "Scene", transition: { type: "dissolve", durationSec: 0.5 }, transform: { scale: 1.1 } }]
    });

    const split = splitRoughCut(project, "c1", 4);
    expect(split.roughCuts.map((clip) => [clip.inSec, clip.outSec])).toEqual([[0, 4], [4, 10]]);
    expect(split.roughCuts[1]).toMatchObject({ label: "Scene B", transition: { type: "dissolve", durationSec: 0.5 } });

    const duplicated = duplicateRoughCut(split, split.roughCuts[0].id);
    expect(duplicated.roughCuts).toHaveLength(3);
    expect(duplicated.roughCuts[1]).toMatchObject({ itemId: "i1", inSec: 0, outSec: 4, transform: { scale: 1.1 } });
  });

  it("builds named preset patches for common montage looks", () => {
    expect(buildMontagePresetClipPatch("cinematic")).toMatchObject({
      filters: { look: "cinematic", contrast: 1.12, saturation: 0.95 }
    });
    expect(buildMontagePresetClipPatch("reset")).toMatchObject({
      transition: { type: "cut", durationSec: 0 },
      filters: { look: "none" },
      transform: { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 }
    });
  });

  it("builds a delivery package manifest with timeline, sources, comments, and readiness", () => {
    const project = createProjectValue({
      id: "p1",
      name: "Package",
      roughCuts: [{ id: "c1", itemId: "i1", inSec: 0, outSec: 5, label: "Open" }],
      comments: [{ id: "comment-1", clipId: "c1", atSec: 3, body: "مراجعة", status: "open" }]
    });
    const itemsById = new Map([
      ["i1", { id: "i1", title: "Source", path: "source.mp4", metadata: { media: { thumbnailKey: "t.jpg" } } }]
    ]);

    const manifest = buildProjectDeliveryPackage(project, itemsById);

    expect(manifest.project).toMatchObject({ id: "p1", name: "Package" });
    expect(manifest.timeline.clips).toHaveLength(1);
    expect(manifest.sources[0]).toMatchObject({ id: "i1", title: "Source", readinessStatus: "warning" });
    expect(manifest.comments).toHaveLength(1);
  });

  it("summarizes production board risks across active projects", () => {
    const projects = [
      createProjectValue({ id: "p1", name: "A", roughCuts: [{ itemId: "i1", inSec: 0, outSec: 2, reviewStatus: "approved" }], tasks: [{ title: "Review", status: "todo" }] }),
      createProjectValue({ id: "p2", name: "B", status: "archived" })
    ];
    const items = [{ id: "i1", path: "source.mp4", metadata: { media: {} } }];

    const summary = buildProductionBoardSummary(projects, items);

    expect(summary).toMatchObject({
      activeProjects: 1,
      openTasks: 1,
      approvedClips: 1,
      mediaWarnings: 1
    });
  });
});

describe("media readiness", () => {
  it("reports ready media when source and derived assets are present", () => {
    const readiness = buildMediaReadiness({
      path: "clip.mp4",
      metadata: {
        media: {
          thumbnailKey: "thumb.jpg",
          audioKey: "audio.mp3",
          transcription: "full text",
          derivedKey: "web.mp4"
        }
      }
    });

    expect(readiness.status).toBe("ready");
    expect(readiness.missing).toEqual([]);
    expect(readiness.score).toBe(5);
  });

  it("identifies missing source as a blocking readiness issue", () => {
    const readiness = buildMediaReadiness({ metadata: { media: {} } });

    expect(readiness.status).toBe("blocked");
    expect(readiness.missing.map((item) => item.id)).toContain("source");
  });
});
