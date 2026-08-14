import { describe, expect, it } from "vitest";
import type { ArchiveRecord, RecordComment, RightsRecord } from "@/lib/archive-api";
import { buildHandoffEntry, formatHandoffReport } from "./handoff-report";

const RECORD = {
  id: "r1",
  title: "مادة تجريبية",
  type: "news",
  tags: ["عاجل"],
  descriptorCompletion: { complete: 4, missing: [], status: "green", total: 4 }
} as unknown as ArchiveRecord;

const RIGHTS = { id: "rt1", itemId: "r1", rightsHolder: "القناة", licenseType: "OWNED" } as RightsRecord;

const COMMENTS = [
  { id: "c1", itemId: "r1", body: "راجع الحقوق", authorId: "u1", authorName: "أحمد", createdAt: null, updatedAt: null }
] as RecordComment[];

describe("handoff report (V1-864)", () => {
  it("builds an entry with status, rights and open comment count", () => {
    const entry = buildHandoffEntry(RECORD, RIGHTS, COMMENTS);
    expect(entry.title).toBe("مادة تجريبية");
    expect(entry.rightsHolder).toBe("القناة");
    expect(entry.openCommentCount).toBe(1);
    expect(entry.statusLabel).toBeTruthy();
  });

  it("handles no rights and no comments", () => {
    const entry = buildHandoffEntry(RECORD, null, []);
    expect(entry.rightsHolder).toBeNull();
    expect(entry.openCommentCount).toBe(0);
  });

  it("formats an empty selection with an explicit message instead of a blank report", () => {
    expect(formatHandoffReport([])).toBe("لا توجد مواد في هذا التسليم.");
  });

  it("formats entries into a readable multi-record report", () => {
    const entry = buildHandoffEntry(RECORD, RIGHTS, COMMENTS);
    const text = formatHandoffReport([entry]);
    expect(text).toContain("مادة تجريبية");
    expect(text).toContain("القناة");
    expect(text).toContain("تعليقات مفتوحة: 1");
  });

  it("formats an English handoff report when English is selected", () => {
    const entry = buildHandoffEntry(RECORD, null, COMMENTS, "en");

    expect(entry.statusLabel).toBe("Draft");
    expect(formatHandoffReport([entry], "en")).toContain("Open comments: 1");
    expect(formatHandoffReport([], "en")).toBe("There are no items in this handoff.");
  });
});
