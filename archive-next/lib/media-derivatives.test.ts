import { describe, expect, it } from "vitest";
import type { MediaJob } from "./archive-api";
import { buildMediaDerivativeTree } from "./media-derivatives";

function job(overrides: Partial<MediaJob> & Pick<MediaJob, "id" | "recordId" | "operation">): MediaJob {
  return {
    status: "completed",
    queuedAt: "2026-07-10T08:00:00.000Z",
    result: null,
    ...overrides
  };
}

describe("buildMediaDerivativeTree", () => {
  it("places a completed transformation and its artifact beneath the original material", () => {
    const tree = buildMediaDerivativeTree("record-1", "archive/original.mov", [
      job({
        id: "thumbnail-job",
        recordId: "record-1",
        operation: "thumbnail",
        sourcePath: "archive/original.mov",
        result: { artifacts: [{ kind: "thumbnail", key: "record-1/thumb.jpg", url: null }] }
      })
    ]);

    expect(tree.jobs).toHaveLength(1);
    expect(tree.jobs[0]?.artifacts).toMatchObject([{ kind: "thumbnail", key: "record-1/thumb.jpg" }]);
    expect(tree.artifactCount).toBe(1);
  });

  it("nests a transformation beneath the artifact that supplied its source", () => {
    const tree = buildMediaDerivativeTree("record-1", "archive/original.mov", [
      job({
        id: "transcode-job",
        recordId: "record-1",
        operation: "transcode",
        queuedAt: "2026-07-10T08:00:00.000Z",
        result: { artifacts: [{ kind: "video", key: "record-1/transcoded.mp4" }] }
      }),
      job({
        id: "derived-thumbnail-job",
        recordId: "record-1",
        operation: "thumbnail",
        sourcePath: "record-1/transcoded.mp4",
        queuedAt: "2026-07-10T08:01:00.000Z",
        result: { artifacts: [{ kind: "thumbnail", key: "record-1/transcoded-thumb.jpg" }] }
      })
    ]);

    expect(tree.jobs).toHaveLength(1);
    expect(tree.jobs[0]?.id).toBe("transcode-job");
    expect(tree.jobs[0]?.artifacts[0]?.children.map((child) => child.id)).toEqual(["derived-thumbnail-job"]);
  });

  it("keeps unknown sources at the root and ignores malformed artifact entries", () => {
    const tree = buildMediaDerivativeTree("record-1", null, [
      job({
        id: "unknown-source-job",
        recordId: "record-1",
        operation: "ocr",
        sourcePath: "outside/untracked.pdf",
        result: { artifacts: [{ kind: "ocr_text" }, null, "invalid"] }
      })
    ]);

    expect(tree.jobs.map((entry) => entry.id)).toEqual(["unknown-source-job"]);
    expect(tree.jobs[0]?.artifacts).toEqual([]);
    expect(tree.artifactCount).toBe(0);
  });

  it("orders siblings by their queued time then stable job id", () => {
    const tree = buildMediaDerivativeTree("record-1", null, [
      job({ id: "z-job", recordId: "record-1", operation: "ocr", queuedAt: "2026-07-10T09:00:00.000Z" }),
      job({ id: "a-job", recordId: "record-1", operation: "thumbnail", queuedAt: "2026-07-10T08:00:00.000Z" }),
      job({ id: "b-job", recordId: "record-1", operation: "transcode", queuedAt: "2026-07-10T08:00:00.000Z" })
    ]);

    expect(tree.jobs.map((entry) => entry.id)).toEqual(["a-job", "b-job", "z-job"]);
  });
});
