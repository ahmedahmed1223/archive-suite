import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  appendHistory,
  createHistoryActions,
  historyInitialState,
  MAX_HISTORY_ENTRIES
} from "./historySlice.js";

vi.mock("../../services/storageAccess.js", () => ({
  STORES: { HISTORY: "change_history" },
  dbClear: vi.fn()
}));

import * as storage from "../../services/storageAccess.js";

function makeStore(extra = {}) {
  let state = { ...historyInitialState, ...extra };
  const get = () => state;
  const set = (patch) => {
    state = typeof patch === "function" ? { ...state, ...patch(state) } : { ...state, ...patch };
  };
  const actions = createHistoryActions({ set, get });
  return { get, set, actions };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.dbClear.mockResolvedValue(undefined);
});

// ── appendHistory unit tests ────────────────────────────────────────────────

describe("appendHistory", () => {
  it("prepends the new record", () => {
    const existing = [{ id: "a" }];
    const result = appendHistory(existing, { id: "b" });
    expect(result[0]).toEqual({ id: "b" });
    expect(result[1]).toEqual({ id: "a" });
  });

  it("caps at MAX_HISTORY_ENTRIES when more are pushed", () => {
    const existing = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) => ({ id: `old_${i}` }));
    const result = appendHistory(existing, { id: "newest" });
    expect(result).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(result[0]).toEqual({ id: "newest" });
  });

  it("evicts oldest entries FIFO when cap is exceeded", () => {
    // Fill to exactly MAX_HISTORY_ENTRIES entries, newest first
    const existing = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) => ({ id: `entry_${i}` }));
    const result = appendHistory(existing, { id: "new" });
    // The last entry in `existing` (index MAX-1, the oldest) must be gone
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain(`entry_${MAX_HISTORY_ENTRIES - 1}`);
    expect(ids[0]).toBe("new");
  });

  it("does not truncate when length is below cap", () => {
    const existing = [{ id: "x" }, { id: "y" }];
    const result = appendHistory(existing, { id: "z" });
    expect(result).toHaveLength(3);
  });

  it("works on an empty array", () => {
    const result = appendHistory([], { id: "first" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: "first" });
  });
});

// ── clearHistory action tests ────────────────────────────────────────────────

describe("clearHistory", () => {
  it("empties the in-memory changeHistory array", async () => {
    const records = Array.from({ length: 10 }, (_, i) => ({ id: `r_${i}` }));
    const { get, actions } = makeStore({ changeHistory: records });
    await actions.clearHistory();
    expect(get().changeHistory).toEqual([]);
  });

  it("calls dbClear on the HISTORY store", async () => {
    const { actions } = makeStore({ changeHistory: [{ id: "r1" }] });
    await actions.clearHistory();
    expect(storage.dbClear).toHaveBeenCalledOnce();
    expect(storage.dbClear).toHaveBeenCalledWith("change_history");
  });

  it("leaves changeHistory empty when called on an already-empty store", async () => {
    const { get, actions } = makeStore();
    await actions.clearHistory();
    expect(get().changeHistory).toEqual([]);
    expect(storage.dbClear).toHaveBeenCalledOnce();
  });
});

// ── cap stress test ──────────────────────────────────────────────────────────

describe("MAX_HISTORY_ENTRIES cap (stress)", () => {
  it(`stays at ${MAX_HISTORY_ENTRIES} after pushing ${MAX_HISTORY_ENTRIES + 100} records`, () => {
    let history = [];
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 100; i++) {
      history = appendHistory(history, { id: `r_${i}` });
    }
    expect(history).toHaveLength(MAX_HISTORY_ENTRIES);
    // Newest record is always at index 0
    expect(history[0].id).toBe(`r_${MAX_HISTORY_ENTRIES + 99}`);
    // The very first records pushed (oldest) must have been evicted
    expect(history.map((r) => r.id)).not.toContain("r_0");
  });
});
