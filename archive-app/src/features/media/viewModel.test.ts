import { describe, expect, it } from "vitest";

import {
  buildDerivedFileRecordsFromJobs,
  createMediaMetadataPatch,
  mergeDerivedFiles,
  removeDerivedFile
} from "./viewModel.js";

describe("media derived files", () => {
  it("builds linked derived-file records from completed transcode jobs", () => {
    const records = buildDerivedFileRecordsFromJobs([
      { id: "job-1", type: "transcode", status: "done", sourceKey: "uploads/source.mp4", outputKey: "derived/source-web.mp4", updatedAt: 1700000000000 },
      { id: "job-2", type: "thumbnail", status: "done", sourceKey: "uploads/source.mp4", outputKey: "thumbnails/source.jpg" },
      { id: "job-3", type: "transcode", status: "running", sourceKey: "uploads/source.mp4", outputKey: "derived/pending.mp4" },
      { id: "job-4", type: "transcode", status: "done", sourceKey: "uploads/other.mp4", outputKey: "derived/other-web.mp4" }
    ], { sourceKey: "uploads/source.mp4" });

    expect(records).toEqual([
      {
        id: "job-1",
        key: "derived/source-web.mp4",
        label: "نسخة ويب",
        type: "video/mp4",
        jobId: "job-1",
        sourceKey: "uploads/source.mp4",
        createdAt: "2023-11-14T22:13:20.000Z"
      }
    ]);
  });

  it("merges derived files without duplicating output keys and preserves legacy derivedKey", () => {
    const existing = [{ id: "old", key: "derived/old-web.mp4", label: "نسخة قديمة" }];
    const next = mergeDerivedFiles(existing, [
      { id: "new", key: "derived/new-web.mp4", label: "نسخة ويب" },
      { id: "dupe", key: "derived/old-web.mp4", label: "مكرر" }
    ]);

    expect(next.map((file) => file.key)).toEqual(["derived/new-web.mp4", "derived/old-web.mp4"]);
    expect(createMediaMetadataPatch({ probe: { codec: "h264" }, derivedFiles: next })).toEqual({
      metadata: {
        media: {
          codec: "h264",
          derivedFiles: next,
          derivedKey: "derived/new-web.mp4"
        }
      }
    });
  });

  it("removes a derived file by key and supports clearing the last derived key", () => {
    const next = removeDerivedFile([
      { id: "a", key: "derived/a.mp4", label: "A" },
      { id: "b", key: "derived/b.mp4", label: "B" }
    ], "derived/a.mp4");

    expect(next.map((file) => file.key)).toEqual(["derived/b.mp4"]);
    expect(createMediaMetadataPatch({ probe: { codec: "h264" }, derivedFiles: [] })).toEqual({
      metadata: {
        media: {
          codec: "h264",
          derivedFiles: [],
          derivedKey: ""
        }
      }
    });
  });
});
