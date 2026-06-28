// @ts-nocheck
import { describe, expect, test, beforeEach } from "vitest";
import {
  recordAccess,
  getAccessScore,
  rankForEviction,
  evictToFitQuota,
  resetAccessMap,
} from "./smartCacheManager.js";

beforeEach(() => resetAccessMap());

const NOW = new Date("2025-01-15T12:00:00Z").getTime();
const OLD = new Date("2024-01-01T12:00:00Z").toISOString();
const RECENT = new Date("2025-01-10T12:00:00Z").toISOString();

describe("recordAccess / getAccessScore", () => {
  test("returns 0 for unknown item", () => {
    expect(getAccessScore("unknown")).toBe(0);
  });

  test("increments count on each call", () => {
    recordAccess("item1", NOW);
    recordAccess("item1", NOW + 1000);
    expect(getAccessScore("item1")).toBe(2);
  });

  test("tracks different items independently", () => {
    recordAccess("a", NOW);
    recordAccess("b", NOW);
    recordAccess("b", NOW);
    expect(getAccessScore("a")).toBe(1);
    expect(getAccessScore("b")).toBe(2);
  });
});

describe("rankForEviction", () => {
  test("excluded items (not in policy scope) come first", () => {
    const policy = { mode: "selective", includedFolderIds: ["f1"] };
    const ctx = { now: NOW, folders: [{ id: "f1", itemIds: ["included"] }] };
    const items = [
      { id: "included", updatedAt: OLD },
      { id: "excluded", updatedAt: OLD },
    ];
    const ranked = rankForEviction(items, policy, ctx);
    expect(ranked[0].id).toBe("excluded");
    expect(ranked[1].id).toBe("included");
  });

  test("within same exclusion group, least-accessed comes first", () => {
    const policy = { mode: "all" };
    const items = [{ id: "a", updatedAt: OLD }, { id: "b", updatedAt: OLD }];
    recordAccess("a", NOW);
    recordAccess("a", NOW);
    recordAccess("b", NOW);
    const ranked = rankForEviction(items, policy, {});
    expect(ranked[0].id).toBe("b");
  });

  test("within same access count, oldest comes first", () => {
    const policy = { mode: "all" };
    const items = [
      { id: "new", updatedAt: RECENT },
      { id: "old", updatedAt: OLD },
    ];
    const ranked = rankForEviction(items, policy, {});
    expect(ranked[0].id).toBe("old");
  });

  test("non-array input returns empty array", () => {
    expect(rankForEviction(null, {}, {})).toEqual([]);
  });
});

describe("evictToFitQuota", () => {
  test("keeps up to quota items and evicts the rest", () => {
    const policy = { mode: "all" };
    const items = [
      { id: "a", updatedAt: OLD },
      { id: "b", updatedAt: OLD },
      { id: "c", updatedAt: RECENT },
    ];
    const { keep, evict } = evictToFitQuota(items, policy, 2, { now: NOW });
    expect(keep.length).toBe(2);
    expect(evict.length).toBe(1);
  });

  test("quota >= items length evicts nothing", () => {
    const policy = { mode: "all" };
    const items = [{ id: "a" }, { id: "b" }];
    const { keep, evict } = evictToFitQuota(items, policy, 10, { now: NOW });
    expect(evict).toEqual([]);
    expect(keep.length).toBe(2);
  });

  test("non-array input returns empty keep and evict", () => {
    const { keep, evict } = evictToFitQuota(null, {}, 5, {});
    expect(keep).toEqual([]);
    expect(evict).toEqual([]);
  });
});

