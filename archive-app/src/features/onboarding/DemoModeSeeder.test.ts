// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { clearDemoData, DEMO_FLAG, isDemoItem, seedDemoData } from "./DemoModeSeeder.js";

describe("isDemoItem", () => {
  it("returns true for demo items", () => {
    expect(isDemoItem({ [DEMO_FLAG]: true })).toBe(true);
  });

  it("returns false for regular items", () => {
    expect(isDemoItem({ id: "abc", title: "test" })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isDemoItem(null)).toBe(false);
    expect(isDemoItem(undefined)).toBe(false);
  });
});

describe("seedDemoData", () => {
  it("calls addVideoItem for each demo item and returns ids", async () => {
    let callCount = 0;
    const addVideoItem = vi.fn(async () => {
      callCount++;
      return { id: `demo-${callCount}` };
    });

    const ids = await seedDemoData(addVideoItem);

    expect(addVideoItem).toHaveBeenCalledTimes(5);
    expect(ids).toHaveLength(5);
    ids.forEach((id, i) => expect(id).toBe(`demo-${i + 1}`));
  });

  it("sets _isDemo flag on every seeded item", async () => {
    const seeded = [];
    const addVideoItem = vi.fn(async (item) => {
      seeded.push(item);
      return { id: "x" };
    });

    await seedDemoData(addVideoItem);

    seeded.forEach((item) => expect(item[DEMO_FLAG]).toBe(true));
  });

  it("returns empty array when addVideoItem is not provided", async () => {
    expect(await seedDemoData(null)).toEqual([]);
    expect(await seedDemoData(undefined)).toEqual([]);
  });

  it("skips failed items without throwing", async () => {
    let callCount = 0;
    const addVideoItem = vi.fn(async () => {
      callCount++;
      if (callCount === 2) throw new Error("network error");
      return { id: `demo-${callCount}` };
    });

    const ids = await seedDemoData(addVideoItem);

    expect(addVideoItem).toHaveBeenCalledTimes(5);
    expect(ids).toHaveLength(4);
  });

  it("skips items where addVideoItem returns no id", async () => {
    const addVideoItem = vi.fn(async () => ({}));
    const ids = await seedDemoData(addVideoItem);
    expect(ids).toHaveLength(0);
  });
});

describe("clearDemoData", () => {
  it("removes all demo items and returns count", async () => {
    const items = [
      { id: "1", [DEMO_FLAG]: true },
      { id: "2" },
      { id: "3", [DEMO_FLAG]: true },
    ];
    const deleteFn = vi.fn(async () => {});

    const count = await clearDemoData(items, deleteFn);

    expect(deleteFn).toHaveBeenCalledTimes(2);
    expect(deleteFn).toHaveBeenCalledWith("1");
    expect(deleteFn).toHaveBeenCalledWith("3");
    expect(count).toBe(2);
  });

  it("returns 0 when there are no demo items", async () => {
    const deleteFn = vi.fn();
    const count = await clearDemoData([{ id: "1" }], deleteFn);
    expect(count).toBe(0);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("returns 0 when deleteVideoItemPermanently is not provided", async () => {
    const items = [{ id: "1", [DEMO_FLAG]: true }];
    expect(await clearDemoData(items, null)).toBe(0);
  });

  it("continues removing remaining items when one delete fails", async () => {
    const items = [
      { id: "1", [DEMO_FLAG]: true },
      { id: "2", [DEMO_FLAG]: true },
    ];
    const deleteFn = vi.fn(async (id) => {
      if (id === "1") throw new Error("delete failed");
    });

    const count = await clearDemoData(items, deleteFn);

    expect(deleteFn).toHaveBeenCalledTimes(2);
    expect(count).toBe(2);
  });
});

