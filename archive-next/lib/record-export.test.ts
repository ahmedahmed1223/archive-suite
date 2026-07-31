import { describe, expect, it } from "vitest";
import type { ArchiveRecord, RecordHistoryEntry, RightsRecord } from "@/lib/archive-api";
import { buildRecordExportBundle, formatRecordExportText } from "./record-export";

const RECORD = {
  id: "r1",
  title: "مادة تجريبية",
  description: "وصف",
  type: "news",
  tags: ["عاجل"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z"
} as ArchiveRecord;

const RIGHTS = {
  id: "rt1",
  itemId: "r1",
  rightsHolder: "القناة",
  licenseType: "OWNED",
  expiresAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z"
} as RightsRecord;

const HISTORY = [
  { id: 1, event: "record.created", action: "create", resourceType: "record", resourceId: "r1", actorId: "u1", outcome: "success", statusCode: 200, metadata: null, createdAt: "2026-01-01T00:00:00Z" }
] as RecordHistoryEntry[];

describe("record export bundle (V1-844)", () => {
  it("builds a bundle from already-loaded record/rights/history data", () => {
    const bundle = buildRecordExportBundle(RECORD, RIGHTS, HISTORY);
    expect(bundle.title).toBe("مادة تجريبية");
    expect(bundle.rights?.rightsHolder).toBe("القناة");
    expect(bundle.activity).toHaveLength(1);
  });

  it("handles no rights record and no history without crashing", () => {
    const bundle = buildRecordExportBundle(RECORD, null, []);
    expect(bundle.rights).toBeNull();
    expect(bundle.activity).toEqual([]);
  });

  it("formats the bundle as readable text, no files/tokens/share links present", () => {
    const text = formatRecordExportText(buildRecordExportBundle(RECORD, RIGHTS, HISTORY));
    expect(text).toContain("مادة تجريبية");
    expect(text).toContain("القناة");
    expect(text).not.toMatch(/token|share/i);
  });
});
