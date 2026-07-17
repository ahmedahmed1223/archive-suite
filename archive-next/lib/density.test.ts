import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDensity, setDensity } from "./density";

function createStorage() {
  const entries = new Map<string, string>();

  return {
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    removeItem: vi.fn((key: string) => entries.delete(key)),
    setItem: vi.fn((key: string, value: string) => entries.set(key, value))
  };
}

describe("density preference", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to comfortable when nothing was persisted yet", () => {
    expect(getDensity("user-1")).toBe("comfortable");
  });

  it("round-trips a written density for the same user", () => {
    setDensity("compact", "user-1");
    expect(getDensity("user-1")).toBe("compact");
  });

  it("keeps density isolated per user", () => {
    setDensity("compact", "user-1");
    expect(getDensity("user-2")).toBe("comfortable");
  });

  it("falls back to comfortable for any non-compact stored value", () => {
    setDensity("compact", "user-1");
    setDensity("comfortable", "user-1");
    expect(getDensity("user-1")).toBe("comfortable");
  });
});
