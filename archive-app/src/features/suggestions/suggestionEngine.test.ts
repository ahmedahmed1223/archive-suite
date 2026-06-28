// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  buildSuggestions,
  duplicateTitleItems,
  neverViewedItems,
  noSmartCollections,
  staleItems,
  uncategorizedItems,
  untaggedItems
} from "./suggestionEngine.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeItems(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    title: `مادة ${index}`,
    type: "video",
    tags: ["وسم"],
    createdAt: "2026-01-01T00:00:00.000Z",
    lastViewedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  }));
}

describe("untaggedItems", () => {
  it("returns null below the threshold", () => {
    const items = makeItems(3, { tags: [] });
    expect(untaggedItems({ items })).toBeNull();
  });

  it("flags untagged items and escalates severity at scale", () => {
    const low = untaggedItems({ items: makeItems(6, { tags: [] }) });
    expect(low).toMatchObject({ id: "untagged-items", severity: "medium", actionPage: "archive", count: 6 });

    const high = untaggedItems({ items: makeItems(20, { tags: [] }) });
    expect(high.severity).toBe("high");
  });

  it("ignores items that already have tags", () => {
    expect(untaggedItems({ items: makeItems(10, { tags: ["x"] }) })).toBeNull();
  });
});

describe("uncategorizedItems", () => {
  it("flags items without a type", () => {
    const result = uncategorizedItems({ items: makeItems(6, { type: undefined }) });
    expect(result).toMatchObject({ id: "uncategorized-items", actionPage: "archive", count: 6 });
  });

  it("returns null when all items are categorized", () => {
    expect(uncategorizedItems({ items: makeItems(10, { type: "audio" }) })).toBeNull();
  });
});

describe("duplicateTitleItems", () => {
  it("detects items sharing the same normalized title", () => {
    const items = [
      { id: "a", title: "اجتماع" },
      { id: "b", title: " اجتماع " },
      { id: "c", title: "Other" }
    ];
    const result = duplicateTitleItems({ items });
    expect(result).toMatchObject({ id: "duplicate-titles", actionPage: "duplicates", count: 2 });
  });

  it("returns null when titles are unique", () => {
    const items = [{ id: "a", title: "x" }, { id: "b", title: "y" }];
    expect(duplicateTitleItems({ items })).toBeNull();
  });

  it("ignores blank titles", () => {
    const items = [{ id: "a", title: "" }, { id: "b", title: "  " }];
    expect(duplicateTitleItems({ items })).toBeNull();
  });
});

describe("noSmartCollections", () => {
  it("suggests smart collections when archive is large and none exist", () => {
    const result = noSmartCollections({ items: makeItems(15), virtualCollections: [{ id: "c" }] });
    expect(result).toMatchObject({ id: "no-smart-collections", actionPage: "collections" });
  });

  it("stays quiet when a smart collection already exists", () => {
    const virtualCollections = [{ id: "c", filterRules: { kind: "rules" } }];
    expect(noSmartCollections({ items: makeItems(15), virtualCollections })).toBeNull();
  });

  it("stays quiet for small archives", () => {
    expect(noSmartCollections({ items: makeItems(4), virtualCollections: [] })).toBeNull();
  });
});

describe("staleItems", () => {
  it("flags items not viewed within the staleness window", () => {
    const now = Date.parse("2026-06-14T00:00:00.000Z");
    const oldStamp = new Date(now - 120 * DAY_MS).toISOString();
    const items = makeItems(6, { lastViewedAt: oldStamp });
    const result = staleItems({ items, now });
    expect(result).toMatchObject({ id: "stale-items", actionPage: "archive", count: 6 });
  });

  it("returns null when items are recent", () => {
    const now = Date.parse("2026-06-14T00:00:00.000Z");
    const recent = new Date(now - 2 * DAY_MS).toISOString();
    expect(staleItems({ items: makeItems(10, { lastViewedAt: recent }), now })).toBeNull();
  });
});

describe("neverViewedItems", () => {
  it("flags items that were never opened", () => {
    const result = neverViewedItems({ items: makeItems(10, { lastViewedAt: null }) });
    expect(result).toMatchObject({ id: "never-viewed-items", actionPage: "archive", count: 10 });
  });

  it("returns null when most items have been viewed", () => {
    expect(neverViewedItems({ items: makeItems(10, { lastViewedAt: "2026-06-01T00:00:00.000Z" }) })).toBeNull();
  });
});

describe("buildSuggestions", () => {
  it("excludes soft-deleted items from detection", () => {
    const videoItems = makeItems(10, { tags: [], isDeleted: true });
    expect(buildSuggestions({ videoItems })).toEqual([]);
  });

  it("filters dismissed suggestions by id", () => {
    const videoItems = makeItems(20, { tags: [], type: undefined });
    const all = buildSuggestions({ videoItems });
    expect(all.some((s) => s.id === "untagged-items")).toBe(true);

    const filtered = buildSuggestions({ videoItems }, { dismissed: ["untagged-items"] });
    expect(filtered.some((s) => s.id === "untagged-items")).toBe(false);
  });

  it("sorts high severity before lower severity", () => {
    // 20 untagged+uncategorized (high) plus a large archive with no smart collections (low).
    const videoItems = makeItems(20, { tags: [], type: undefined });
    const result = buildSuggestions({ videoItems, virtualCollections: [] }, { limit: 10 });
    expect(result[0].severity).toBe("high");
    const weights = result.map((s) => ({ high: 3, medium: 2, low: 1 })[s.severity]);
    const sorted = [...weights].sort((a, b) => b - a);
    expect(weights).toEqual(sorted);
  });

  it("respects the limit", () => {
    const videoItems = makeItems(20, { tags: [], type: undefined, lastViewedAt: null });
    const result = buildSuggestions({ videoItems, virtualCollections: [] }, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it("returns an empty list for a healthy archive", () => {
    const videoItems = makeItems(3);
    expect(buildSuggestions({ videoItems, virtualCollections: [] })).toEqual([]);
  });
});

