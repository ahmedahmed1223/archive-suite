import { describe, expect, it } from "vitest";

import {
  createUploadLinkedLocalFilePatch,
  mergeUploadIntoMetadata,
  mergeUploadIntoVideoItem
} from "./uploadLink.js";

describe("upload metadata linking", () => {
  it("adds an upload id to the local-file patch for a selected file", () => {
    const file = {
      name: "lesson-one.mp4",
      size: 1234,
      type: "video/mp4",
      webkitRelativePath: "raw/lesson-one.mp4"
    };

    const patch = createUploadLinkedLocalFilePatch(file, {
      upload: { id: "up_1", status: "queued" }
    });

    if (!patch) throw new Error("Expected upload-linked patch to be created");

    expect(patch.title).toBe("lesson-one");
    expect(patch.path).toBe("raw/lesson-one.mp4");
    expect(patch.metadata.localFile).toMatchObject({
      name: "lesson-one.mp4",
      relativePath: "raw/lesson-one.mp4",
      uploadId: "up_1",
      uploadStatus: "queued"
    });
  });

  it("merges a completed upload key into metadata and the local-file field", () => {
    const metadata = {
      localFile: {
        name: "lesson-one.mp4",
        uploadId: "up_1",
        uploadStatus: "uploading"
      },
      media: { durationSec: 90 }
    };

    const result = mergeUploadIntoMetadata(metadata, [
      { id: "up_1", status: "done", key: "sha256abc", url: "/api/files/sha256abc" }
    ]);

    expect(result).toMatchObject({
      storageKey: "sha256abc",
      fileKey: "sha256abc",
      fileHash: "sha256abc",
      checksum: "sha256abc",
      media: {
        durationSec: 90,
        sourceKey: "sha256abc"
      },
      localFile: {
        name: "lesson-one.mp4",
        uploadId: "up_1",
        uploadStatus: "done",
        storageKey: "sha256abc",
        fileKey: "sha256abc",
        fileHash: "sha256abc",
        url: "/api/files/sha256abc"
      }
    });
  });

  it("patches a saved video item once its queued upload completes", () => {
    const item = {
      id: "video_1",
      title: "Lesson",
      metadata: {
        localFile: { name: "lesson-one.mp4", uploadId: "up_1" }
      }
    };

    const result = mergeUploadIntoVideoItem(item, {
      id: "up_1",
      status: "duplicate",
      key: "sha256abc"
    });

    expect(result).toMatchObject({
      id: "video_1",
      metadata: {
        storageKey: "sha256abc",
        fileHash: "sha256abc",
        localFile: {
          uploadId: "up_1",
          uploadStatus: "duplicate",
          storageKey: "sha256abc"
        }
      }
    });
  });
});
