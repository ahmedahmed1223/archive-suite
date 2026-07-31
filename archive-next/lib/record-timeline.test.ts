import { describe, expect, it } from "vitest";
import type { RecordComment, RecordHistoryEntry, RightsRecord } from "@/lib/archive-api";
import { buildRecordTimeline } from "./record-timeline";

const HISTORY = [
  { id: 1, event: "record.created", action: "create", resourceType: "record", resourceId: "r1", actorId: "u1", outcome: "success", statusCode: 200, metadata: null, createdAt: "2026-01-01T00:00:00Z" },
  { id: 2, event: "record.updated", action: "update", resourceType: "record", resourceId: "r1", actorId: "u1", outcome: "success", statusCode: 200, metadata: null, createdAt: "2026-01-03T00:00:00Z" }
] as RecordHistoryEntry[];

const COMMENTS = [
  { id: "c1", itemId: "r1", body: "راجع الحقوق", authorId: "u1", authorName: "أحمد", createdAt: "2026-01-02T00:00:00Z", updatedAt: null }
] as RecordComment[];

const RIGHTS = {
  id: "rt1", itemId: "r1", rightsHolder: "القناة", licenseType: "OWNED",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-04T00:00:00Z"
} as RightsRecord;

describe("record timeline (V1-829)", () => {
  it("merges history, comments, and rights into one list", () => {
    const timeline = buildRecordTimeline({ history: HISTORY, comments: COMMENTS, rights: RIGHTS });
    expect(timeline).toHaveLength(4);
  });

  it("sorts entries newest first", () => {
    const timeline = buildRecordTimeline({ history: HISTORY, comments: COMMENTS, rights: RIGHTS });
    const timestamps = timeline.map((e) => e.timestamp);
    expect(timestamps).toEqual([...timestamps].sort().reverse());
  });

  it("skips history entries with no timestamp instead of crashing", () => {
    const noTimestamp = [{ ...HISTORY[0], createdAt: null }] as RecordHistoryEntry[];
    const timeline = buildRecordTimeline({ history: noTimestamp, comments: [], rights: null });
    expect(timeline).toHaveLength(0);
  });

  it("omits the rights entry when no rights record exists", () => {
    const timeline = buildRecordTimeline({ history: [], comments: [], rights: null });
    expect(timeline).toHaveLength(0);
  });
});
