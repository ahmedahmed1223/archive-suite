// @ts-nocheck
import { describe, expect, test } from "vitest";
import {
  createSyncPolicy,
  isItemIncluded,
  filterSyncableItems,
  shouldSyncNow,
  summarizePolicy,
  DEFAULT_RECENT_DAYS,
} from "./selectiveSyncPolicy.js";

const NOW = new Date("2025-01-15T12:00:00Z").getTime();
const RECENT = new Date("2025-01-10T12:00:00Z").toISOString();
const OLD = new Date("2024-01-01T12:00:00Z").toISOString();

describe("createSyncPolicy", () => {
  test("defaults when called with no args", () => {
    const p = createSyncPolicy();
    expect(p.mode).toBe("all");
    expect(p.bandwidth).toBe("unlimited");
    expect(p.cachePolicy).toBe("full");
    expect(p.recentDays).toBe(DEFAULT_RECENT_DAYS);
    expect(p.includedFolderIds).toEqual([]);
    expect(p.includedCollectionIds).toEqual([]);
  });

  test("invalid mode falls back to all", () => {
    const p = createSyncPolicy({ mode: "bogus" });
    expect(p.mode).toBe("all");
  });

  test("valid mode is preserved", () => {
    expect(createSyncPolicy({ mode: "selective" }).mode).toBe("selective");
  });

  test("invalid bandwidth falls back to unlimited", () => {
    const p = createSyncPolicy({ bandwidth: "superfast" });
    expect(p.bandwidth).toBe("unlimited");
  });

  test("invalid cachePolicy falls back to full", () => {
    const p = createSyncPolicy({ cachePolicy: "none" });
    expect(p.cachePolicy).toBe("full");
  });

  test("recentDays is clamped and floored", () => {
    expect(createSyncPolicy({ recentDays: 7.9 }).recentDays).toBe(7);
    expect(createSyncPolicy({ recentDays: 99999 }).recentDays).toBe(3650);
    expect(createSyncPolicy({ recentDays: -5 }).recentDays).toBe(DEFAULT_RECENT_DAYS);
    expect(createSyncPolicy({ recentDays: 0 }).recentDays).toBe(DEFAULT_RECENT_DAYS);
    expect(createSyncPolicy({ recentDays: "abc" }).recentDays).toBe(DEFAULT_RECENT_DAYS);
  });

  test("dedup in includedFolderIds", () => {
    const p = createSyncPolicy({ includedFolderIds: ["a", "b", "a", "c", "b"] });
    expect(p.includedFolderIds).toEqual(["a", "b", "c"]);
  });

  test("dedup in includedCollectionIds", () => {
    const p = createSyncPolicy({ includedCollectionIds: ["x", "x", "y"] });
    expect(p.includedCollectionIds).toEqual(["x", "y"]);
  });

  test("null/undefined values in id arrays are skipped", () => {
    const p = createSyncPolicy({ includedFolderIds: [null, "a", undefined, "b"] });
    expect(p.includedFolderIds).toEqual(["a", "b"]);
  });
});

describe("isItemIncluded", () => {
  test("mode=all: always true for valid item with cachePolicy=full", () => {
    const policy = createSyncPolicy({ mode: "all", cachePolicy: "full" });
    expect(isItemIncluded({ id: "1", updatedAt: OLD }, policy, { now: NOW })).toBe(true);
  });

  test("mode=all: returns false for item with no id", () => {
    const policy = createSyncPolicy({ mode: "all" });
    expect(isItemIncluded({ updatedAt: RECENT }, policy, { now: NOW })).toBe(false);
  });

  test("mode=all with cachePolicy=recent prunes old items", () => {
    const policy = createSyncPolicy({ mode: "all", cachePolicy: "recent", recentDays: 7 });
    expect(isItemIncluded({ id: "1", updatedAt: OLD }, policy, { now: NOW })).toBe(false);
    expect(isItemIncluded({ id: "1", updatedAt: RECENT }, policy, { now: NOW })).toBe(true);
  });

  test("mode=selective: includes item reachable through included folder", () => {
    const policy = createSyncPolicy({ mode: "selective", includedFolderIds: ["f1"] });
    const ctx = { now: NOW, folders: [{ id: "f1", itemIds: ["item1"] }] };
    expect(isItemIncluded({ id: "item1" }, policy, ctx)).toBe(true);
    expect(isItemIncluded({ id: "item2" }, policy, ctx)).toBe(false);
  });

  test("mode=selective: includes item reachable through included collection", () => {
    const policy = createSyncPolicy({ mode: "selective", includedCollectionIds: ["c1"] });
    const ctx = { now: NOW, collections: [{ id: "c1", itemIds: ["item3"] }] };
    expect(isItemIncluded({ id: "item3" }, policy, ctx)).toBe(true);
  });

  test("mode=selective with cachePolicy=recent prunes old items even if in scope", () => {
    const policy = createSyncPolicy({
      mode: "selective",
      includedFolderIds: ["f1"],
      cachePolicy: "recent",
      recentDays: 7,
    });
    const ctx = { now: NOW, folders: [{ id: "f1", itemIds: ["item1"] }] };
    expect(isItemIncluded({ id: "item1", updatedAt: OLD }, policy, ctx)).toBe(false);
  });
});

describe("filterSyncableItems", () => {
  test("filters correctly in selective mode", () => {
    const policy = createSyncPolicy({ mode: "selective", includedFolderIds: ["f1"] });
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const ctx = { now: NOW, folders: [{ id: "f1", itemIds: ["a", "c"] }] };
    const result = filterSyncableItems(items, policy, ctx);
    expect(result.map((i) => i.id)).toEqual(["a", "c"]);
  });

  test("empty input returns empty array", () => {
    const policy = createSyncPolicy();
    expect(filterSyncableItems([], policy, { now: NOW })).toEqual([]);
  });

  test("non-array input returns empty array", () => {
    const policy = createSyncPolicy();
    expect(filterSyncableItems(null, policy, { now: NOW })).toEqual([]);
    expect(filterSyncableItems("string", policy, { now: NOW })).toEqual([]);
  });
});

describe("shouldSyncNow", () => {
  test("offline always returns false", () => {
    expect(shouldSyncNow({}, { online: false })).toBe(false);
    expect(shouldSyncNow({ bandwidth: "unlimited" }, { online: false })).toBe(false);
  });

  test("wifi-only blocks metered/cellular connections", () => {
    const policy = createSyncPolicy({ bandwidth: "wifi-only" });
    expect(shouldSyncNow(policy, { online: true, connectionType: "cellular" })).toBe(false);
    expect(shouldSyncNow(policy, { online: true, connectionType: "4g" })).toBe(false);
    expect(shouldSyncNow(policy, { online: true, connectionType: "metered" })).toBe(false);
  });

  test("wifi-only allows wifi/ethernet", () => {
    const policy = createSyncPolicy({ bandwidth: "wifi-only" });
    expect(shouldSyncNow(policy, { online: true, connectionType: "wifi" })).toBe(true);
    expect(shouldSyncNow(policy, { online: true, connectionType: "" })).toBe(true);
  });

  test("unlimited allows any connection type", () => {
    const policy = createSyncPolicy({ bandwidth: "unlimited" });
    expect(shouldSyncNow(policy, { online: true, connectionType: "cellular" })).toBe(true);
  });

  test("metered bandwidth allows metered connections", () => {
    const policy = createSyncPolicy({ bandwidth: "metered" });
    expect(shouldSyncNow(policy, { online: true, connectionType: "4g" })).toBe(true);
  });
});

describe("summarizePolicy", () => {
  test("mode=all text format", () => {
    const result = summarizePolicy(createSyncPolicy({ mode: "all", bandwidth: "unlimited", cachePolicy: "full" }));
    expect(result.text).toContain("مزامنة كل العناصر");
    expect(result.text).toContain("بلا حدود");
    expect(result.text).toContain("تخزين كامل");
    expect(result.mode).toBe("all");
  });

  test("mode=selective text includes folder/collection counts", () => {
    const policy = createSyncPolicy({
      mode: "selective",
      includedFolderIds: ["f1", "f2"],
      includedCollectionIds: ["c1"],
    });
    const result = summarizePolicy(policy);
    expect(result.text).toContain("مزامنة انتقائية");
    expect(result.text).toContain("2 مجلد");
    expect(result.text).toContain("1 مجموعة");
    expect(result.folderCount).toBe(2);
    expect(result.collectionCount).toBe(1);
  });

  test("syncableCount is null when no items supplied", () => {
    const result = summarizePolicy(createSyncPolicy());
    expect(result.syncableCount).toBeNull();
  });

  test("syncableCount is computed when items supplied", () => {
    const policy = createSyncPolicy({ mode: "all", cachePolicy: "full" });
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const result = summarizePolicy(policy, { items, now: NOW });
    expect(result.syncableCount).toBe(3);
  });

  test("recent cache policy adds days to text", () => {
    const policy = createSyncPolicy({ cachePolicy: "recent", recentDays: 14 });
    const result = summarizePolicy(policy);
    expect(result.text).toContain("آخر 14 يوم");
  });
});

