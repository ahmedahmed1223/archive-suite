import { describe, expect, it } from "vitest";

import { buildArchiveHandoff, markQueueArchived } from "./archiveHandoff.js";
import { shouldQueueUpload } from "./ingestQueue.js";

describe("file archive handoff", () => {
  it("honors automatic and per-upload queue policy", () => {
    expect(shouldQueueUpload({ globalDefault: true })).toBe(true);
    expect(shouldQueueUpload({ globalDefault: true, uploadOverride: false })).toBe(false);
  });

  it("passes stored file metadata to the archive wizard", () => {
    expect(buildArchiveHandoff({ key: "incoming/a.mp4", name: "a.mp4", size: 30, mimeType: "video/mp4" }, { id: "q1" })).toEqual({
      fileKey: "incoming/a.mp4", name: "a.mp4", size: 30, mimeType: "video/mp4", queueId: "q1"
    });
  });

  it("marks the queue archived only with a saved item id", () => {
    const record = { id: "q1", fileKey: "a.mp4", status: "pending" };
    expect(markQueueArchived(record, { id: "item1" }, "2026-06-20T00:00:00.000Z")).toMatchObject({ status: "archived", archiveItemId: "item1" });
    expect(() => markQueueArchived(record, {})).toThrow(/saved archive item/i);
  });
});
