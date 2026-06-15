import { describe, expect, test } from "vitest";
import {
  createCollectionSource,
  normalizeSources,
  resolveMultiSourceItems,
  describeSources
} from "./collectionSources.js";

const item = (overrides = {}) => ({
  id: "v1",
  type: "video",
  subtype: "",
  title: "اجتماع الفريق",
  notes: "",
  tags: ["عمل"],
  isFavorite: false,
  isDeleted: false,
  workflowStatus: "draft",
  parentId: "",
  metadata: { size: 1000 },
  createdAt: "2026-06-10T10:00:00.000Z",
  updatedAt: "2026-06-10T10:00:00.000Z",
  ...overrides
});

const rulesSource = (tag) => ({
  kind: "rules",
  ruleset: {
    kind: "rules",
    match: "all",
    conditions: [{ field: "tags", operator: "includesAny", value: [tag] }]
  }
});

describe("createCollectionSource", () => {
  test("normalizes a manual source and drops falsy ids", () => {
    expect(createCollectionSource({ kind: "manual", itemIds: ["a", "", null, "b"] })).toEqual({
      kind: "manual",
      itemIds: ["a", "b"]
    });
  });

  test("trims a query source", () => {
    expect(createCollectionSource({ kind: "query", query: "  تقرير  " })).toEqual({
      kind: "query",
      query: "تقرير"
    });
  });

  test("returns null for unknown or invalid kinds", () => {
    expect(createCollectionSource({ kind: "folder" })).toBeNull();
    expect(createCollectionSource(null)).toBeNull();
    expect(createCollectionSource("nope")).toBeNull();
  });
});

describe("normalizeSources", () => {
  test("drops invalid entries and keeps valid ones in order", () => {
    const result = normalizeSources([
      { kind: "manual", itemIds: ["a"] },
      { kind: "bad" },
      { kind: "query", query: "x" }
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe("manual");
    expect(result[1].kind).toBe("query");
  });

  test("returns empty array for non-array input", () => {
    expect(normalizeSources(undefined)).toEqual([]);
    expect(normalizeSources({})).toEqual([]);
  });
});

describe("resolveMultiSourceItems", () => {
  const items = [
    item({ id: "v1", tags: ["عمل"], title: "تقرير سنوي" }),
    item({ id: "v2", tags: ["شخصي"], title: "رحلة" }),
    item({ id: "v3", tags: ["عمل"], title: "اجتماع" }),
    item({ id: "v4", tags: ["أرشيف"], title: "ملف قديم", isDeleted: true })
  ];

  test("returns deduplicated union across manual + rules + query", () => {
    const collection = {
      sources: [
        { kind: "manual", itemIds: ["v2"] },
        rulesSource("عمل"), // v1, v3
        { kind: "query", query: "تقرير" } // v1 again -> deduped
      ]
    };
    const result = resolveMultiSourceItems(collection, items);
    expect(result.map((i) => i.id)).toEqual(["v2", "v1", "v3"]);
  });

  test("excludes deleted items from every source", () => {
    const collection = {
      sources: [
        { kind: "manual", itemIds: ["v4"] },
        rulesSource("أرشيف"),
        { kind: "query", query: "قديم" }
      ]
    };
    expect(resolveMultiSourceItems(collection, items)).toEqual([]);
  });

  test("returns empty array for empty or invalid sources", () => {
    expect(resolveMultiSourceItems({ sources: [] }, items)).toEqual([]);
    expect(resolveMultiSourceItems({ sources: [{ kind: "bad" }] }, items)).toEqual([]);
    expect(resolveMultiSourceItems({}, items)).toEqual([]);
    expect(resolveMultiSourceItems(null, items)).toEqual([]);
  });

  test("preserves stable order across repeated resolution", () => {
    const collection = {
      sources: [rulesSource("عمل"), { kind: "manual", itemIds: ["v2"] }]
    };
    const first = resolveMultiSourceItems(collection, items).map((i) => i.id);
    const second = resolveMultiSourceItems(collection, items).map((i) => i.id);
    expect(first).toEqual(["v1", "v3", "v2"]);
    expect(second).toEqual(first);
  });

  test("tolerates a non-array videoItems argument", () => {
    expect(resolveMultiSourceItems({ sources: [rulesSource("عمل")] }, null)).toEqual([]);
  });
});

describe("describeSources", () => {
  test("summarizes each source kind in Arabic", () => {
    const summary = describeSources([
      { kind: "manual", itemIds: ["a", "b"] },
      rulesSource("عمل"),
      { kind: "query", query: "تقرير" }
    ]);
    expect(summary).toBe("عناصر مختارة (2)، قواعد ذكية، بحث: تقرير");
  });

  test("returns placeholder for empty sources", () => {
    expect(describeSources([])).toBe("بلا مصادر");
    expect(describeSources(undefined)).toBe("بلا مصادر");
  });
});
