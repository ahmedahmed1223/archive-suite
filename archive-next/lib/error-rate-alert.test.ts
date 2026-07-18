import { describe, expect, it } from "vitest";
import type { ClientErrorLogEntry } from "./client-error-log";
import { getErrorWave } from "./error-rate-alert";

const now = new Date("2026-07-18T16:00:00.000Z");

function entry(overrides: Partial<ClientErrorLogEntry> = {}): ClientErrorLogEntry {
  return {
    id: "error-1",
    name: "TypeError",
    message: "failed",
    page: "/archive",
    severity: "error",
    source: "window-error",
    count: 1,
    firstSeenAt: "2026-07-18T15:58:00.000Z",
    lastSeenAt: "2026-07-18T15:59:00.000Z",
    ...overrides,
  };
}

describe("getErrorWave", () => {
  it("activates when five recent error occurrences are recorded", () => {
    expect(getErrorWave([entry({ count: 3 }), entry({ id: "error-2", count: 2 })], now)).toEqual({
      active: true,
      count: 5,
      windowMinutes: 5,
    });
  });

  it("excludes non-errors and events outside the rolling window", () => {
    const result = getErrorWave([
      entry({ count: 4, severity: "warning" }),
      entry({ id: "old", count: 9, lastSeenAt: "2026-07-18T15:54:59.000Z" }),
      entry({ id: "recent", count: 2 }),
    ], now);

    expect(result).toEqual({ active: false, count: 2, windowMinutes: 5 });
  });
});
