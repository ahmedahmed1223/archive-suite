import { describe, expect, test } from "vitest";
import {
  formatBytes,
  formatDate,
  getFileExtension,
  getFileKind,
  getFileName,
  getUniqueStores,
  isPlayableFile,
  mapOperation,
  mapProvider,
  mediaPlayHref
} from "./file-helpers";
import type { ArchiveFile, StorageWorkspaceOperation, StorageWorkspaceProvider } from "@/lib/archive-api";

describe("getFileExtension", () => {
  test("returns the lowercased extension", () => {
    expect(getFileExtension({ key: "clips/Interview.MP4" })).toBe("mp4");
  });

  test("returns the whole (lowercased) key when there is no dot to split on", () => {
    expect(getFileExtension({ key: "README" })).toBe("readme");
  });
});

describe("isPlayableFile", () => {
  test("is playable when the mime type is audio or video", () => {
    expect(isPlayableFile({ key: "a", mimeType: "video/mp4" })).toBe(true);
    expect(isPlayableFile({ key: "a", mimeType: "audio/mpeg" })).toBe(true);
  });

  test("is playable by extension when mime type is missing", () => {
    expect(isPlayableFile({ key: "clip.mov" })).toBe(true);
  });

  test("is not playable for a document extension", () => {
    expect(isPlayableFile({ key: "report.pdf" })).toBe(false);
  });
});

describe("getFileKind", () => {
  test("classifies media by extension", () => {
    expect(getFileKind({ key: "song.mp3" })).toBe("media");
  });

  test("classifies images by extension", () => {
    expect(getFileKind({ key: "photo.png" })).toBe("image");
  });

  test("classifies documents by extension", () => {
    expect(getFileKind({ key: "notes.docx" })).toBe("document");
  });

  test("falls back to other for unknown extensions", () => {
    expect(getFileKind({ key: "archive.zip" })).toBe("other");
  });
});

describe("mediaPlayHref", () => {
  test("builds a play URL with the path only", () => {
    expect(mediaPlayHref({ key: "clips/a.mp4" })).toBe("/media/play?path=clips%2Fa.mp4");
  });

  test("includes the disk param when a store is present", () => {
    expect(mediaPlayHref({ key: "clips/a.mp4", store: "dropbox" })).toBe("/media/play?path=clips%2Fa.mp4&disk=dropbox");
  });
});

describe("formatBytes", () => {
  test("renders a dash for undefined", () => {
    expect(formatBytes(undefined)).toBe("-");
  });

  test("renders 0 B for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  test("scales to the right unit", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
});

describe("formatDate", () => {
  test("renders a dash for undefined", () => {
    expect(formatDate(undefined, "en")).toBe("-");
  });

  test("returns the raw value for an invalid date", () => {
    expect(formatDate("not-a-date", "en")).toBe("not-a-date");
  });

  test("formats a valid date", () => {
    expect(formatDate("2024-01-15T00:00:00Z", "en")).not.toBe("2024-01-15T00:00:00Z");
  });
});

describe("getUniqueStores", () => {
  test("dedupes and sorts store names", () => {
    const files = [{ store: "b" }, { store: "a" }, { store: "a" }, { store: undefined }] as ArchiveFile[];
    expect(getUniqueStores(files)).toEqual(["a", "b"]);
  });
});

describe("getFileName", () => {
  test("prefers the explicit name", () => {
    expect(getFileName({ key: "a/b/c.mp4", name: "Custom" } as ArchiveFile)).toBe("Custom");
  });

  test("falls back to the last path segment of the key", () => {
    expect(getFileName({ key: "a/b/c.mp4" } as ArchiveFile)).toBe("c.mp4");
  });
});

describe("mapProvider", () => {
  test("maps status and translates known capabilities", () => {
    const provider: StorageWorkspaceProvider = {
      id: "dropbox",
      type: "dropbox",
      label: "Dropbox",
      capabilities: ["browse", "upload", "create_folder"],
      status: "available"
    };

    expect(mapProvider(provider)).toEqual({
      id: "dropbox",
      type: "dropbox",
      label: "Dropbox",
      capabilities: ["browse", "upload", "create-folder"],
      status: "ready"
    });
  });

  test("maps not_configured to offline", () => {
    const provider: StorageWorkspaceProvider = { id: "azure", type: "azure", label: "Azure", capabilities: [], status: "not_configured" };
    expect(mapProvider(provider).status).toBe("offline");
  });
});

describe("mapOperation", () => {
  test("counts completed and skipped items and flags failed as retryable", () => {
    const operation: StorageWorkspaceOperation = {
      id: "op-1",
      action: "copy",
      status: "failed",
      sourceProviderId: "local",
      items: [
        { id: 1, status: "completed" },
        { id: 2, status: "skipped" },
        { id: 3, status: "failed", errorCode: "conflict" }
      ]
    };

    expect(mapOperation(operation)).toEqual({
      id: "op-1",
      type: "copy",
      status: "failed",
      completedItems: 2,
      totalItems: 3,
      message: "conflict",
      retryable: true
    });
  });

  test("maps queued/paused status to running", () => {
    const operation: StorageWorkspaceOperation = { id: "op-2", action: "move", status: "queued", sourceProviderId: "local", items: [] };
    expect(mapOperation(operation).status).toBe("running");
  });
});
