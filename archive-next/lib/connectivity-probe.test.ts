// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

describe("connectivity probe", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not declare offline after a single transient health failure", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("warming up")));
    const probe = await import("./connectivity-probe");
    const observed: string[] = [];
    probe.subscribeToConnectivity((status) => observed.push(status));

    probe.startConnectivityProbe();
    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    expect(observed).not.toContain("offline");
    probe.stopConnectivityProbe();
  });
});
