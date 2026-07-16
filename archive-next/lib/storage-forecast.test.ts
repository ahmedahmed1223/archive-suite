import { describe, expect, it } from "vitest";

import { forecastStorageGrowth, type StorageSample } from "./storage-forecast";

// V1-756: storage growth prediction. The dangerous failure here is a
// confident-looking forecast built from data that cannot support one, so most
// of these tests are about REFUSING to predict rather than predicting.

const DAY = 86_400_000;
const GB = 1_000_000_000;
const START = Date.parse("2026-07-01T00:00:00.000Z");

/** Samples growing by a fixed number of bytes per day. */
function linearSamples(days: number, perDay: number, from = 0): StorageSample[] {
  return Array.from({ length: days }, (_, i) => ({
    at: new Date(START + i * DAY).toISOString(),
    usedBytes: from + i * perDay,
  }));
}

describe("forecastStorageGrowth", () => {
  it("recovers a clean linear growth rate", () => {
    const result = forecastStorageGrowth(linearSamples(10, 2 * GB, 100 * GB));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bytesPerDay).toBeCloseTo(2 * GB, -6);
    expect(result.confidence).toBeCloseTo(1, 3);
  });

  it("projects a future total from the fitted trend", () => {
    const result = forecastStorageGrowth(linearSamples(10, 1 * GB, 50 * GB));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Day 9 is the last sample at 59 GB; 30 more days at 1 GB/day ≈ 89 GB.
    expect(result.projectedBytes(30)).toBeCloseTo(89 * GB, -9);
  });

  it("predicts the quota exhaustion date when a capacity is supplied", () => {
    // 60 GB used, 2 GB/day, 100 GB capacity → 20 days of headroom.
    const result = forecastStorageGrowth(linearSamples(10, 2 * GB, 42 * GB), { capacityBytes: 100 * GB });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.daysUntilFull).not.toBeNull();
    expect(result.daysUntilFull!).toBeCloseTo(20, 0);
    expect(result.exhaustionAt).toMatch(/^2026-07/);
  });

  it("reports no exhaustion when storage is flat or shrinking", () => {
    const flat = forecastStorageGrowth(linearSamples(10, 0, 50 * GB), { capacityBytes: 100 * GB });
    expect(flat.ok).toBe(true);
    if (flat.ok) expect(flat.daysUntilFull).toBeNull();

    const shrinking = forecastStorageGrowth(linearSamples(10, -1 * GB, 90 * GB), { capacityBytes: 100 * GB });
    expect(shrinking.ok).toBe(true);
    if (shrinking.ok) {
      expect(shrinking.bytesPerDay).toBeLessThan(0);
      expect(shrinking.daysUntilFull).toBeNull();
    }
  });

  it("reports zero days when capacity is already exceeded rather than a negative countdown", () => {
    const result = forecastStorageGrowth(linearSamples(10, 1 * GB, 120 * GB), { capacityBytes: 100 * GB });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.daysUntilFull).toBe(0);
  });

  it("refuses to forecast from a single sample", () => {
    const result = forecastStorageGrowth(linearSamples(1, GB));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INSUFFICIENT_SAMPLES");
  });

  it("refuses to forecast from an empty series", () => {
    const result = forecastStorageGrowth([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INSUFFICIENT_SAMPLES");
  });

  it("refuses to forecast when every sample shares one timestamp", () => {
    // Zero elapsed time cannot yield a per-day rate — the slope would divide by zero.
    const sameInstant: StorageSample[] = [
      { at: "2026-07-01T00:00:00.000Z", usedBytes: 10 },
      { at: "2026-07-01T00:00:00.000Z", usedBytes: 20 },
    ];

    const result = forecastStorageGrowth(sameInstant);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_TIME_SPAN");
  });

  it("rejects unparseable timestamps instead of silently treating them as epoch zero", () => {
    const result = forecastStorageGrowth([
      { at: "not-a-date", usedBytes: 10 },
      { at: "2026-07-02T00:00:00.000Z", usedBytes: 20 },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SAMPLE_INVALID");
  });

  it("rejects negative byte counts, which cannot describe used storage", () => {
    const result = forecastStorageGrowth([
      { at: "2026-07-01T00:00:00.000Z", usedBytes: -5 },
      { at: "2026-07-02T00:00:00.000Z", usedBytes: 20 },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SAMPLE_INVALID");
  });

  it("sorts unordered samples before fitting, so input order cannot flip the trend", () => {
    const ordered = linearSamples(6, GB, 10 * GB);
    const shuffled = [ordered[3], ordered[0], ordered[5], ordered[1], ordered[4], ordered[2]];

    const a = forecastStorageGrowth(ordered);
    const b = forecastStorageGrowth(shuffled);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.bytesPerDay).toBeCloseTo(a.bytesPerDay, 3);
    expect(b.bytesPerDay).toBeGreaterThan(0);
  });

  it("lowers confidence for erratic data so a noisy trend cannot masquerade as certain", () => {
    const erratic: StorageSample[] = [
      { at: new Date(START).toISOString(), usedBytes: 10 * GB },
      { at: new Date(START + DAY).toISOString(), usedBytes: 80 * GB },
      { at: new Date(START + 2 * DAY).toISOString(), usedBytes: 15 * GB },
      { at: new Date(START + 3 * DAY).toISOString(), usedBytes: 90 * GB },
      { at: new Date(START + 4 * DAY).toISOString(), usedBytes: 20 * GB },
    ];

    const noisy = forecastStorageGrowth(erratic);
    const clean = forecastStorageGrowth(linearSamples(5, GB));
    expect(noisy.ok && clean.ok).toBe(true);
    if (!noisy.ok || !clean.ok) return;
    expect(noisy.confidence).toBeLessThan(0.5);
    expect(clean.confidence).toBeGreaterThan(noisy.confidence);
  });

  it("never projects a negative total, because used storage has a floor of zero", () => {
    const result = forecastStorageGrowth(linearSamples(5, -10 * GB, 40 * GB));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projectedBytes(365)).toBe(0);
  });

  it("treats a projection into the past as the current total", () => {
    const result = forecastStorageGrowth(linearSamples(5, GB, 10 * GB));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projectedBytes(-10)).toBe(result.currentBytes);
  });
});
