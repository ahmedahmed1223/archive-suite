import { describe, expect, test } from "vitest";
import {
  buildArchiveAnalytics,
  buildMonthlyGrowth,
  findDuplicateGroups,
  healthMetrics,
  liveItems,
  topTags,
  totalsByType,
  uncategorizedItems
} from "./analyticsSelectors.js";

type ItemOverrides = Record<string, any>;

const item = (id: string, overrides: ItemOverrides = {}) => ({
  id,
  type: "video",
  title: `عنوان ${id}`,
  tags: [],
  isDeleted: false,
  isFavorite: false,
  createdAt: "2026-06-01T00:00:00Z",
  ...overrides
});

describe("liveItems", () => {
  test("drops deleted and non-object entries, tolerates non-array", () => {
    expect(liveItems([item("a"), item("b", { isDeleted: true }), null]).map((i) => i.id)).toEqual(["a"]);
    expect(liveItems("nope")).toEqual([]);
  });
});

describe("buildMonthlyGrowth", () => {
  test("counts items per month over a dense trailing window", () => {
    const growth = buildMonthlyGrowth(
      [
        item("a", { createdAt: "2026-04-10T00:00:00Z" }),
        item("b", { createdAt: "2026-06-02T00:00:00Z" }),
        item("c", { createdAt: "2026-06-20T00:00:00Z" })
      ],
      { months: 3 }
    );
    expect(growth.series).toHaveLength(3);
    expect(growth.series.map((s) => s.key)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(growth.series.map((s) => s.count)).toEqual([1, 0, 2]);
    expect(growth.total).toBe(3);
    expect(growth.maxCount).toBe(2);
  });

  test("returns empty series when no valid dates exist", () => {
    const growth = buildMonthlyGrowth([item("a", { createdAt: "not-a-date" })]);
    expect(growth).toEqual({ series: [], total: 0, maxCount: 0 });
  });

  test("excludes deleted items from the series", () => {
    const growth = buildMonthlyGrowth(
      [item("a"), item("b", { isDeleted: true })],
      { months: 1 }
    );
    expect(growth.total).toBe(1);
  });
});

describe("topTags", () => {
  test("ranks by frequency then alphabetically, honoring the limit", () => {
    const ranked = topTags(
      [
        item("a", { tags: ["news", "sport"] }),
        item("b", { tags: ["news", " "] }),
        item("c", { tags: ["news", "sport"] })
      ],
      1
    );
    expect(ranked).toEqual([{ tag: "news", count: 3 }]);
  });

  test("ignores blank tags entirely", () => {
    expect(topTags([item("a", { tags: ["", "  "] })])).toEqual([]);
  });
});

describe("uncategorizedItems", () => {
  test("flags items with no tags and no folder/collection membership", () => {
    const items = [
      item("a", { tags: [] }),
      item("b", { tags: ["x"] }),
      item("c", { tags: [] })
    ];
    const folders = [{ id: "f1", itemIds: ["c"] }];
    const collections = [{ id: "col1", itemIds: [] }];
    const result = uncategorizedItems(items, folders, collections);
    expect(result.count).toBe(1);
    expect(result.items.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("findDuplicateGroups", () => {
  test("groups items by normalized title, largest group first", () => {
    const groups = findDuplicateGroups([
      item("a", { title: "تقرير الأخبار" }),
      item("b", { title: "تقرير  الاخبار" }),
      item("c", { title: "فريد" }),
      item("d", { title: "تقرير الأخبار" })
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "b", "d"]);
  });

  test("falls back to metadata path when the title is empty", () => {
    const groups = findDuplicateGroups([
      item("a", { title: "", metadata: { path: "/clips/x.mp4" } }),
      item("b", { title: "", metadata: { path: "/clips/x.mp4" } })
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});

describe("totalsByType", () => {
  test("aggregates counts per type sorted descending", () => {
    const totals = totalsByType([
      item("a", { type: "video" }),
      item("b", { type: "audio" }),
      item("c", { type: "video" })
    ]);
    expect(totals).toEqual([
      { type: "video", count: 2 },
      { type: "audio", count: 1 }
    ]);
  });
});

describe("healthMetrics", () => {
  test("computes coverage percentages over live items", () => {
    const items = [
      item("a", { tags: ["x"], isFavorite: true }),
      item("b", { tags: [] }),
      item("c", { tags: [] }),
      item("d", { tags: [] })
    ];
    const folders = [{ id: "f1", itemIds: ["b"] }];
    const health = healthMetrics(items, folders, []);
    expect(health.total).toBe(4);
    expect(health.tagged).toBe(1);
    expect(health.taggedPct).toBe(25);
    expect(health.inCollection).toBe(1);
    expect(health.uncategorized).toBe(2);
    expect(health.favorites).toBe(1);
  });

  test("returns zero percentages for an empty archive", () => {
    const health = healthMetrics([], [], []);
    expect(health.total).toBe(0);
    expect(health.taggedPct).toBe(0);
  });
});

describe("buildArchiveAnalytics", () => {
  test("bundles every selector into one result", () => {
    const result = buildArchiveAnalytics([item("a", { tags: ["x"] })], [], []);
    expect(result).toHaveProperty("growth");
    expect(result).toHaveProperty("tags");
    expect(result).toHaveProperty("uncategorized");
    expect(result).toHaveProperty("duplicates");
    expect(result).toHaveProperty("types");
    expect(result).toHaveProperty("health");
  });
});
