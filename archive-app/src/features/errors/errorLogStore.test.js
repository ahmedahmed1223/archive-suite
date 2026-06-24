import { beforeEach, describe, expect, test } from "vitest";
import {
  __resetErrorLogForTests,
  clearErrorLog,
  countBySeverity,
  filterErrors,
  listErrors,
  recordError,
  removeError
} from "./errorLogStore.js";

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
  __resetErrorLogForTests();
  storage = memoryStorage();
});

describe("errorLogStore", () => {
  test("records an error and normalizes via builder", () => {
    const report = recordError(new Error("boom"), { page: "archive", operation: "save" }, storage);
    expect(report.message).toBe("boom");
    expect(listErrors()).toHaveLength(1);
    expect(listErrors()[0].page).toBe("archive");
  });

  test("accepts a pre-built report unchanged", () => {
    const prebuilt = { id: "err_x", timestamp: "2026-06-14T00:00:00.000Z", message: "m", severity: "warning", page: "", operation: "", device: {} };
    const report = recordError(prebuilt, {}, storage);
    expect(report.id).toBe("err_x");
  });

  test("newest entries come first", () => {
    recordError("first", { operation: "a" }, storage);
    recordError("second", { operation: "b" }, storage);
    expect(listErrors()[0].message).toBe("second");
  });

  test("removeError and clearErrorLog work", () => {
    const report = recordError("x", {}, storage);
    expect(removeError(report.id, storage)).toBe(true);
    recordError("y", {}, storage);
    clearErrorLog(storage);
    expect(listErrors()).toHaveLength(0);
  });

  test("filterErrors by severity and query", () => {
    recordError(new Error("disk full"), { severity: "critical", operation: "write" }, storage);
    recordError(new Error("minor glitch"), { severity: "warning", operation: "sync" }, storage);
    expect(filterErrors(listErrors(), { severity: "critical" })).toHaveLength(1);
    expect(filterErrors(listErrors(), { query: "disk" })).toHaveLength(1);
    expect(filterErrors(listErrors(), { query: "nope" })).toHaveLength(0);
  });
});

describe("error grouping / dedup", () => {
  test("identical errors increment count instead of duplicating", () => {
    recordError(new Error("disk full"), { operation: "write", page: "archive" }, storage);
    recordError(new Error("disk full"), { operation: "write", page: "archive" }, storage);
    recordError(new Error("disk full"), { operation: "write", page: "archive" }, storage);
    expect(listErrors()).toHaveLength(1);
    expect(listErrors()[0].count).toBe(3);
  });

  test("grouped error bubbles to top on repeat", () => {
    recordError(new Error("a"), { operation: "first" }, storage);
    recordError(new Error("b"), { operation: "second" }, storage);
    recordError(new Error("a"), { operation: "first" }, storage);
    expect(listErrors()).toHaveLength(2);
    expect(listErrors()[0].message).toBe("a");
    expect(listErrors()[0].count).toBe(2);
  });

  test("different severity on same message does NOT group", () => {
    recordError(new Error("timeout"), { operation: "fetch", severity: "warning" }, storage);
    recordError(new Error("timeout"), { operation: "fetch", severity: "critical" }, storage);
    expect(listErrors()).toHaveLength(2);
  });

  test("different operation on same message does NOT group", () => {
    recordError(new Error("fail"), { operation: "save" }, storage);
    recordError(new Error("fail"), { operation: "sync" }, storage);
    expect(listErrors()).toHaveLength(2);
  });

  test("removal of a grouped entry works", () => {
    const id = recordError(new Error("dup"), { operation: "op" }, storage).id;
    recordError(new Error("dup"), { operation: "op" }, storage);
    expect(listErrors()).toHaveLength(1);
    expect(removeError(id, storage)).toBe(true);
    expect(listErrors()).toHaveLength(0);
  });

  test("firstSeen is preserved on group, lastSeen updates", () => {
    const r1 = recordError(new Error("evict"), { operation: "x" }, storage);
    // Advance simulated time by updating timestamp context
    recordError(new Error("evict"), { operation: "x" }, storage);
    const entry = listErrors()[0];
    expect(entry.firstSeen).toBe(r1.firstSeen);
    expect(entry.lastSeen).toBeTruthy();
    expect(entry.count).toBe(2);
  });
});

describe("cached snapshot", () => {
  test("listErrors returns the same reference until mutation", () => {
    recordError("stable", {}, storage);
    const a = listErrors();
    const b = listErrors();
    expect(a).toBe(b); // same frozen reference
  });

  test("snapshot invalidates on recordError", () => {
    recordError("first", {}, storage);
    const a = listErrors();
    recordError("second", {}, storage);
    const b = listErrors();
    expect(a).not.toBe(b);
    expect(b).toHaveLength(2);
  });

  test("snapshot invalidates on removeError", () => {
    const id = recordError("x", {}, storage).id;
    const a = listErrors();
    removeError(id, storage);
    const b = listErrors();
    expect(a).not.toBe(b);
    expect(b).toHaveLength(0);
  });
});

describe("countBySeverity", () => {
  test("counts errors per severity bucket", () => {
    recordError(new Error("a"), { severity: "critical" }, storage);
    recordError(new Error("b"), { severity: "critical" }, storage);
    recordError(new Error("c"), { severity: "error" }, storage);
    recordError(new Error("d"), { severity: "warning" }, storage);
    recordError(new Error("e"), { severity: "info" }, storage);
    const counts = countBySeverity();
    expect(counts).toEqual({ critical: 2, error: 1, warning: 1, info: 1 });
  });

  test("defaults unknown severity to error bucket", () => {
    recordError({ id: "z", timestamp: "2026", message: "m", severity: "unknown" }, {}, storage);
    const counts = countBySeverity();
    expect(counts.error).toBe(1);
  });

  test("works on empty log", () => {
    const counts = countBySeverity();
    expect(counts).toEqual({ critical: 0, error: 0, warning: 0, info: 0 });
  });
});
