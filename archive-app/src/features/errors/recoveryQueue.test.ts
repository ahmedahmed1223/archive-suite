import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  __resetRecoveryQueueForTests,
  createRecoveryEntry,
  enqueueRecovery,
  listRecovery,
  pendingRecoveryCount,
  removeRecovery,
  registerRecoveryRunner,
  retryRecovery,
  retryAllRecovery,
  subscribeRecovery
} from "./recoveryQueue.js";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key) : null),
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key)
  };
}

let storage: any;
beforeEach(() => {
  __resetRecoveryQueueForTests();
  storage = memoryStorage();
});

describe("recoveryQueue basics", () => {
  test("createRecoveryEntry normalizes fields", () => {
    const entry = createRecoveryEntry({ operation: "item.write", payload: { id: "x" } });
    expect(entry.operation).toBe("item.write");
    expect(entry.attempts).toBe(0);
    expect(entry.id).toMatch(/^rec_/);
  });

  test("enqueue adds to front and dedupes by id", () => {
    enqueueRecovery({ id: "a", operation: "op" }, storage);
    enqueueRecovery({ id: "b", operation: "op" }, storage);
    enqueueRecovery({ id: "a", operation: "op", label: "again" }, storage);
    const ids = listRecovery().map((entry) => entry.id);
    expect(ids).toEqual(["a", "b"]);
    expect(pendingRecoveryCount()).toBe(2);
  });

  test("remove drops a single entry", () => {
    enqueueRecovery({ id: "a", operation: "op" }, storage);
    expect(removeRecovery("a", storage)).toBe(true);
    expect(pendingRecoveryCount()).toBe(0);
  });

  test("subscribe is notified on changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRecovery(listener);
    enqueueRecovery({ id: "a", operation: "op" }, storage);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

describe("retry", () => {
  test("successful retry removes the entry", async () => {
    enqueueRecovery({ id: "a", operation: "op", payload: { v: 1 } }, storage);
    const runner = vi.fn().mockResolvedValue(undefined);
    const result = await retryRecovery("a", { runner, storage });
    expect(result.ok).toBe(true);
    expect(runner).toHaveBeenCalledWith({ v: 1 }, expect.objectContaining({ id: "a" }));
    expect(pendingRecoveryCount()).toBe(0);
  });

  test("failed retry increments attempts and keeps entry", async () => {
    enqueueRecovery({ id: "a", operation: "op" }, storage);
    const runner = vi.fn().mockRejectedValue(new Error("boom"));
    const result = await retryRecovery("a", { runner, storage });
    expect(result.ok).toBe(false);
    expect(listRecovery()[0].attempts).toBe(1);
    expect(listRecovery()[0].lastError).toBe("boom");
  });

  test("entry is dropped after exhausting attempts", async () => {
    enqueueRecovery({ id: "a", operation: "op", attempts: 4 }, storage);
    const runner = vi.fn().mockRejectedValue(new Error("boom"));
    const result = await retryRecovery("a", { runner, storage });
    expect(result.exhausted).toBe(true);
    expect(pendingRecoveryCount()).toBe(0);
  });

  test("uses registered runner when none is passed", async () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    registerRecoveryRunner("item.write", runner);
    enqueueRecovery({ id: "a", operation: "item.write" }, storage);
    const result = await retryRecovery("a", { storage });
    expect(result.ok).toBe(true);
    expect(runner).toHaveBeenCalled();
  });

  test("retryAll reports succeeded and failed counts", async () => {
    enqueueRecovery({ id: "ok", operation: "op" }, storage);
    enqueueRecovery({ id: "bad", operation: "op" }, storage);
    const runner = vi.fn((payload, entry) =>
      entry.id === "ok" ? Promise.resolve() : Promise.reject(new Error("no"))
    );
    const result = await retryAllRecovery({ runner, storage });
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });
});
