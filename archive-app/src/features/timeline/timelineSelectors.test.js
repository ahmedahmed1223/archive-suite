import { describe, expect, test } from "vitest";
import {
  TIMELINE_GRANULARITIES,
  TIMELINE_LANE_GROUPS,
  bucketFor,
  buildTimeline,
  buildTimelineLanes,
  timelineTypeTotals
} from "./timelineSelectors.js";

const item = (id, createdAt, overrides = {}) => ({
  id,
  type: "video",
  isDeleted: false,
  createdAt,
  ...overrides
});

describe("bucketFor", () => {
  test("month is the default-style key", () => {
    const { key } = bucketFor(new Date("2026-06-14T10:00:00Z"), "month");
    expect(key).toBe("2026-06");
  });
  test("year/day keys", () => {
    expect(bucketFor(new Date("2026-06-14T00:00:00"), "year").key).toBe("2026");
    expect(bucketFor(new Date("2026-06-14T00:00:00"), "day").key).toBe("2026-06-14");
  });
});

describe("buildTimeline", () => {
  test("groups by month and counts", () => {
    const tl = buildTimeline([
      item("a", "2026-06-01T00:00:00"),
      item("b", "2026-06-20T00:00:00"),
      item("c", "2026-05-10T00:00:00")
    ]);
    expect(tl.buckets.map((b) => b.key)).toEqual(["2026-05", "2026-06"]);
    expect(tl.buckets.find((b) => b.key === "2026-06").count).toBe(2);
    expect(tl.total).toBe(3);
    expect(tl.maxCount).toBe(2);
  });

  test("excludes deleted unless includeDeleted", () => {
    const items = [item("a", "2026-06-01T00:00:00"), item("b", "2026-06-02T00:00:00", { isDeleted: true })];
    expect(buildTimeline(items).total).toBe(1);
    expect(buildTimeline(items, { includeDeleted: true }).total).toBe(2);
  });

  test("ignores items with invalid dates", () => {
    const tl = buildTimeline([item("a", "not-a-date"), item("b", "2026-06-01T00:00:00")]);
    expect(tl.total).toBe(1);
  });

  test("tracks byType per bucket and overall totals", () => {
    const tl = buildTimeline([
      item("a", "2026-06-01T00:00:00", { type: "video" }),
      item("b", "2026-06-02T00:00:00", { type: "audio" }),
      item("c", "2026-06-03T00:00:00", { type: "video" })
    ]);
    expect(tl.buckets[0].byType).toEqual({ video: 2, audio: 1 });
    expect(timelineTypeTotals(tl)).toEqual({ video: 2, audio: 1 });
  });

  test("reports the date range (from <= to, timezone-independent)", () => {
    const tl = buildTimeline([item("a", "2026-01-01T00:00:00"), item("b", "2026-12-31T00:00:00")]);
    expect(new Date(tl.range.from).getTime()).toBeLessThanOrEqual(new Date(tl.range.to).getTime());
    expect(tl.range.from).toBeTruthy();
    expect(tl.range.to).toBeTruthy();
  });

  test("falls back to month for unknown granularity", () => {
    const tl = buildTimeline([item("a", "2026-06-01T00:00:00")], { granularity: "decade" });
    expect(tl.buckets[0].key).toBe("2026-06");
  });

  test("granularity list is stable", () => {
    expect(TIMELINE_GRANULARITIES).toEqual(["day", "week", "month", "year"]);
  });
});

describe("buildTimelineLanes", () => {
  test("builds one chronological lane per content type", () => {
    const lanes = buildTimelineLanes([
      item("a", "2026-06-01T00:00:00", { type: "video" }),
      item("b", "2026-07-02T00:00:00", { type: "audio" }),
      item("c", "2026-07-03T00:00:00", { type: "video" })
    ], { groupBy: "type", granularity: "month" });

    expect(lanes.groupBy).toBe("type");
    expect(lanes.total).toBe(3);
    expect(lanes.lanes.map((lane) => lane.key)).toEqual(["video", "audio"]);
    expect(lanes.lanes[0].buckets.map((bucket) => bucket.key)).toEqual(["2026-06", "2026-07"]);
  });

  test("groups lanes by year using the selected date field", () => {
    const lanes = buildTimelineLanes([
      item("a", "2025-12-01T00:00:00"),
      item("b", "2026-01-02T00:00:00")
    ], { groupBy: "year", granularity: "month" });

    expect(lanes.lanes.map((lane) => lane.key)).toEqual(["2025", "2026"]);
  });

  test("supports a single all-archive lane and stable group list", () => {
    const lanes = buildTimelineLanes([item("a", "2026-06-01T00:00:00")]);
    expect(TIMELINE_LANE_GROUPS).toEqual(["all", "type", "year", "workflow"]);
    expect(lanes.lanes).toHaveLength(1);
    expect(lanes.lanes[0].key).toBe("all");
  });
});
