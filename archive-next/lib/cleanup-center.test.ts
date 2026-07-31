import { describe, expect, it } from "vitest";
import type { ArchiveFile, ArchiveRecord } from "@/lib/archive-api";
import { buildCleanupItems } from "./cleanup-center";

const INCOMPLETE_RECORD = {
  id: "r1",
  title: "مادة ناقصة",
  descriptorCompletion: { complete: 2, missing: ["tags", "description"], status: "red", total: 4 }
} as unknown as ArchiveRecord;

const COMPLETE_RECORD = {
  id: "r2",
  title: "مادة كاملة",
  descriptorCompletion: { complete: 4, missing: [], status: "green", total: 4 },
  workflowStatus: "published"
} as unknown as ArchiveRecord;

describe("cleanup center (V1-833)", () => {
  it("flags incomplete records", () => {
    const items = buildCleanupItems({
      records: [INCOMPLETE_RECORD, COMPLETE_RECORD],
      files: [],
      recordSourcePaths: new Set(),
      scheduledUploads: []
    });
    expect(items.filter((i) => i.reason === "incomplete-record")).toHaveLength(1);
  });

  it("flags files with no matching record source path as orphans", () => {
    const files = [{ key: "orphan.mov", name: "orphan.mov" }] as ArchiveFile[];
    const items = buildCleanupItems({ records: [], files, recordSourcePaths: new Set(["known.mov"]), scheduledUploads: [] });
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe("orphan-file");
  });

  it("does not flag a file whose path matches a record source", () => {
    const files = [{ key: "known.mov", name: "known.mov" }] as ArchiveFile[];
    const items = buildCleanupItems({ records: [], files, recordSourcePaths: new Set(["known.mov"]), scheduledUploads: [] });
    expect(items).toHaveLength(0);
  });

  it("flags failed scheduled uploads only", () => {
    const items = buildCleanupItems({
      records: [],
      files: [],
      recordSourcePaths: new Set(),
      scheduledUploads: [
        { id: "u1", status: "failed", fileName: "a.mov" },
        { id: "u2", status: "completed", fileName: "b.mov" }
      ]
    });
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe("failed-upload");
  });

  it("flags files sharing the same name and size as possible duplicates", () => {
    const files = [
      { key: "a/dup.mov", name: "dup.mov", size: 100 },
      { key: "b/dup.mov", name: "dup.mov", size: 100 },
      { key: "c/unique.mov", name: "unique.mov", size: 50 }
    ] as ArchiveFile[];
    const items = buildCleanupItems({ records: [], files, recordSourcePaths: new Set(["a/dup.mov", "b/dup.mov", "c/unique.mov"]), scheduledUploads: [] });
    expect(items.filter((i) => i.reason === "possible-duplicate")).toHaveLength(2);
  });
});
