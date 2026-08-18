import { describe, expect, test } from "vitest";
import type { ArchiveRecord, RightsRecord } from "@/lib/archive-api";
import { buildReadinessItems } from "./RecordReadinessPanel";

const baseRecord: ArchiveRecord = { id: "rec-1", title: "" };

describe("buildReadinessItems (V1-824)", () => {
  test("everything missing reports all items incomplete", () => {
    const items = buildReadinessItems(baseRecord, null, false);
    expect(items.every((item) => !item.done)).toBe(true);
  });

  test("a fully-described record with rights and a comment is fully ready", () => {
    const record: ArchiveRecord = {
      id: "rec-1",
      title: "عنوان",
      description: "وصف",
      tags: ["أرشيف"],
      metadata: { filePath: "/media/a.mp4" }
    };
    const rights = { rightsHolder: "x", licenseType: "public" } as unknown as RightsRecord;

    const items = buildReadinessItems(record, rights, true);
    expect(items.every((item) => item.done)).toBe(true);
  });

  test("missing only rights leaves exactly one incomplete item", () => {
    const record: ArchiveRecord = {
      id: "rec-1",
      title: "عنوان",
      description: "وصف",
      tags: ["أرشيف"],
      metadata: { filePath: "/media/a.mp4" }
    };

    const items = buildReadinessItems(record, null, true);
    const incomplete = items.filter((item) => !item.done);
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]?.key).toBe("rights");
  });
});
