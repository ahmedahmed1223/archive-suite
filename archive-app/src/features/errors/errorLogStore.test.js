import { beforeEach, describe, expect, test } from "vitest";
import {
  __resetErrorLogForTests,
  clearErrorLog,
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
