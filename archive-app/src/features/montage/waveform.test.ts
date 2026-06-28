import { describe, expect, it } from "vitest";
import { downsamplePeaks, peaksToBars, placeholderPeaks } from "./waveform.js";

describe("downsamplePeaks", () => {
  it("returns `buckets` normalized peaks for a sample array", () => {
    const samples = [0, 0.5, -1, 0.25, 0.1, -0.2, 0.9, -0.3];
    const peaks = downsamplePeaks(samples, 4);
    expect(peaks).toHaveLength(4);
    peaks.forEach((peak) => {
      expect(peak).toBeGreaterThanOrEqual(0);
      expect(peak).toBeLessThanOrEqual(1);
    });
    expect(Math.max(...peaks)).toBe(1);
  });

  it("uses absolute value so negative peaks count", () => {
    const peaks = downsamplePeaks([-1, -1], 1);
    expect(peaks).toEqual([1]);
  });

  it("returns flat zeros for an all-silent input", () => {
    expect(downsamplePeaks([0, 0, 0, 0], 2)).toEqual([0, 0]);
  });

  it("handles empty and invalid input without throwing", () => {
    expect(downsamplePeaks([], 8)).toEqual([]);
    expect(downsamplePeaks(undefined, 8)).toEqual([]);
    expect(downsamplePeaks([1, 2, 3], 0)).toEqual([]);
    expect(downsamplePeaks([1, 2, 3], -4)).toEqual([]);
  });

  it("handles more buckets than samples without crashing", () => {
    const peaks = downsamplePeaks([1, 0.5], 6);
    expect(peaks).toHaveLength(6);
    expect(Math.max(...peaks)).toBe(1);
  });
});

describe("peaksToBars", () => {
  it("scales normalized peaks to pixel heights", () => {
    const bars = peaksToBars([0, 0.5, 1], 100);
    expect(bars[1]).toBe(50);
    expect(bars[2]).toBe(100);
  });

  it("applies a visible floor for silent buckets", () => {
    const bars = peaksToBars([0, 0], 40);
    bars.forEach((bar) => expect(bar).toBeGreaterThan(0));
  });

  it("clamps out-of-range peaks", () => {
    const bars = peaksToBars([-1, 2], 50);
    expect(bars[0]).toBeGreaterThanOrEqual(0);
    expect(bars[1]).toBe(50);
  });

  it("returns zeros for zero height and handles empty input", () => {
    expect(peaksToBars([0.5], 0)).toEqual([0]);
    expect(peaksToBars([], 100)).toEqual([]);
  });
});

describe("placeholderPeaks", () => {
  it("is deterministic for the same clip", () => {
    const clip = { id: "abc", inSec: 0, outSec: 12 };
    expect(placeholderPeaks(clip, 16)).toEqual(placeholderPeaks(clip, 16));
  });

  it("produces normalized values in [0,1]", () => {
    const peaks = placeholderPeaks({ id: "x", outSec: 9 }, 32);
    expect(peaks).toHaveLength(32);
    peaks.forEach((peak) => {
      expect(peak).toBeGreaterThanOrEqual(0);
      expect(peak).toBeLessThanOrEqual(1);
    });
  });

  it("differs between distinct clips", () => {
    const a = placeholderPeaks({ id: "a", outSec: 5 }, 24);
    const b = placeholderPeaks({ id: "b", outSec: 20 }, 24);
    expect(a).not.toEqual(b);
  });

  it("handles zero buckets and missing clip", () => {
    expect(placeholderPeaks({ id: "a" }, 0)).toEqual([]);
    expect(placeholderPeaks(undefined, 4)).toHaveLength(4);
  });
});
