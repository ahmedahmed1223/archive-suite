import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  __resetSyncStatusStoreForTests,
  getSyncSnapshot,
  getConnectionState,
  setConnectionState,
  enqueueSyncOp,
  removeSyncOp,
  updateSyncOpStatus,
  listSyncOps,
  addConflict,
  listConflicts,
  resolveConflictInStore,
  clearConflicts,
  subscribeSync
} from "./syncStatusStore.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key)
  };
}

let storage;
beforeEach(() => {
  __resetSyncStatusStoreForTests();
  storage = memoryStorage();
});

describe("connection state", () => {
  test("defaults to online and updates on valid value", () => {
    expect(getConnectionState()).toBe("online");
    setConnectionState("offline");
    expect(getConnectionState()).toBe("offline");
  });

  test("ignores invalid connection values", () => {
    setConnectionState("teleporting");
    expect(getConnectionState()).toBe("online");
  });
});

describe("sync op queue", () => {
  test("enqueues and summarizes ops", () => {
    enqueueSyncOp({ entityId: "v1", action: "create" }, storage);
    enqueueSyncOp({ entityId: "v2", action: "update" }, storage);
    const snapshot = getSyncSnapshot();
    expect(snapshot.ops).toHaveLength(2);
    expect(snapshot.summary.pending).toBe(2);
  });

  test("transitions an op via the model and rejects illegal moves", () => {
    const op = enqueueSyncOp({ entityId: "v1" }, storage);
    const inFlight = updateSyncOpStatus(op.id, "inFlight", { storage });
    expect(inFlight.status).toBe("inFlight");
    expect(inFlight.attempts).toBe(1);
    // pending -> done is illegal; returns null and leaves state intact
    const op2 = enqueueSyncOp({ entityId: "v2" }, storage);
    expect(updateSyncOpStatus(op2.id, "done", { storage })).toBeNull();
    expect(listSyncOps().find((o) => o.id === op2.id).status).toBe("pending");
  });

  test("removes an op", () => {
    const op = enqueueSyncOp({ entityId: "v1" }, storage);
    expect(removeSyncOp(op.id, storage)).toBe(true);
    expect(listSyncOps()).toHaveLength(0);
  });
});

describe("conflicts", () => {
  const conflict = {
    id: "v1",
    type: "both-modified",
    local: { id: "v1", title: "محلي", syncVersion: 2, updatedAt: "2026-06-15T10:00:00.000Z" },
    remote: { id: "v1", title: "وارد", syncVersion: 3, updatedAt: "2026-06-15T12:00:00.000Z" }
  };

  test("adds and lists a conflict, de-duped by id", () => {
    addConflict(conflict);
    addConflict({ ...conflict, type: "version-clash" });
    expect(listConflicts()).toHaveLength(1);
    expect(listConflicts()[0].type).toBe("version-clash");
  });

  test("resolveConflictInStore returns chosen record and removes it", () => {
    addConflict(conflict);
    const chosen = resolveConflictInStore("v1", "newest");
    expect(chosen.title).toBe("وارد");
    expect(listConflicts()).toHaveLength(0);
  });

  test("resolveConflictInStore returns null for unknown id", () => {
    expect(resolveConflictInStore("missing", "keepLocal")).toBeNull();
  });

  test("clearConflicts empties the list", () => {
    addConflict(conflict);
    clearConflicts();
    expect(listConflicts()).toHaveLength(0);
  });
});

describe("subscribeSync", () => {
  test("notifies subscribers on change and unsubscribes cleanly", () => {
    const spy = vi.fn();
    const unsubscribe = subscribeSync(spy);
    enqueueSyncOp({ entityId: "v1" }, storage);
    expect(spy).toHaveBeenCalled();
    const callsBefore = spy.mock.calls.length;
    unsubscribe();
    setConnectionState("offline");
    expect(spy.mock.calls.length).toBe(callsBefore);
  });
});
