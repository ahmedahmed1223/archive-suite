import { describe, expect, it } from "vitest";

import { createIngestQueueRecord, moveQueuedFile, shouldQueueUpload } from "./ingestQueue.js";

describe("file ingest queue", () => {
  it("uses the global default unless an upload override is explicit", () => {
    expect(shouldQueueUpload({ globalDefault: true })).toBe(true);
    expect(shouldQueueUpload({ globalDefault: true, uploadOverride: false })).toBe(false);
    expect(shouldQueueUpload({ globalDefault: false, uploadOverride: true })).toBe(true);
  });

  it("creates a pending record without an archive item", () => {
    const record = createIngestQueueRecord({ key: "incoming/a.mp4", name: "a.mp4", size: 20 }, { id: "queue-1", now: "2026-06-20T00:00:00.000Z" });
    expect(record).toMatchObject({ id: "queue-1", fileKey: "incoming/a.mp4", status: "pending", archiveItemId: null });
  });

  it("keeps the queue linked when a file is moved", () => {
    expect(moveQueuedFile({ id: "q", fileKey: "old/a.mp4" }, "new/file.mp4").fileKey).toBe("new/file.mp4");
  });
});
