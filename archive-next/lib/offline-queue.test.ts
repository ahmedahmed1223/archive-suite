import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOfflineQueue,
  getOfflineQueue,
  loadOfflineQueue,
  queueMutation,
  removeMutationFromQueue,
  updateMutationRetry,
  type QueuedMutation
} from "./offline-queue";

const STORAGE_KEY = "archive-offline-queue";

function createStorage() {
  const entries = new Map<string, string>();

  return {
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    removeItem: vi.fn((key: string) => entries.delete(key)),
    setItem: vi.fn((key: string, value: string) => entries.set(key, value))
  };
}

describe("offline queue", () => {
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", storage);
    clearOfflineQueue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a mutation and persists its initial state", () => {
    const id = queueMutation("/records/123", "PATCH", { title: "Updated" });
    const queue = getOfflineQueue();

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id,
      endpoint: "/records/123",
      method: "PATCH",
      body: { title: "Updated" },
      retryCount: 0
    });
    expect(storage.setItem).toHaveBeenLastCalledWith(
      STORAGE_KEY,
      expect.stringContaining(id)
    );
  });

  it("removes only the requested mutation", () => {
    const firstId = queueMutation("/records/1", "POST", {});
    const secondId = queueMutation("/records/2", "POST", {});

    removeMutationFromQueue(firstId);

    expect(getOfflineQueue()).toMatchObject([{ id: secondId }]);
  });

  it("increments retry information without changing other queued mutations", () => {
    const retryId = queueMutation("/records/1", "POST", {});
    const untouchedId = queueMutation("/records/2", "POST", {});

    updateMutationRetry(retryId, "Connection timeout");
    updateMutationRetry(retryId, "Still offline");

    expect(getOfflineQueue()).toMatchObject([
      { id: retryId, retryCount: 2, lastError: "Still offline" },
      { id: untouchedId, retryCount: 0 }
    ]);
  });

  it("clears the queue and its persisted items", () => {
    queueMutation("/records/1", "POST", {});
    queueMutation("/records/2", "PATCH", {});

    clearOfflineQueue();

    expect(getOfflineQueue()).toEqual([]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}") as {
      items: QueuedMutation[];
    }).toEqual({ version: 1, items: [] });
  });

  it("restores compatible persisted queue entries", () => {
    const persisted: QueuedMutation = {
      id: "persisted-mutation",
      endpoint: "/records/42",
      method: "PUT",
      body: { status: "reviewed" },
      createdAt: 1,
      retryCount: 1,
      lastError: "Timed out"
    };
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items: [persisted] }));

    loadOfflineQueue();

    expect(getOfflineQueue()).toEqual([persisted]);
  });

  it("ignores persisted entries from an incompatible storage version", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 99, items: [{ id: "obsolete" }] })
    );

    loadOfflineQueue();

    expect(getOfflineQueue()).toEqual([]);
  });
});
