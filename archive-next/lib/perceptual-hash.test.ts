import { describe, expect, it } from "vitest";

import {
  DHASH_HEIGHT,
  DHASH_WIDTH,
  compareSignatures,
  dHashFromLuminance,
  findNearDuplicateVideos,
  hammingDistance,
} from "./perceptual-hash";

// V1-757: near-duplicate video detection. Exact checksums miss re-encodes,
// trims, and resizes — a perceptual hash is tolerant of those but must still
// separate genuinely different footage.

/** A frame whose luminance rises left→right: every dHash comparison is "brighter next". */
function gradientFrame(offset = 0): number[] {
  const pixels: number[] = [];
  for (let y = 0; y < DHASH_HEIGHT; y += 1) {
    for (let x = 0; x < DHASH_WIDTH; x += 1) pixels.push(x * 10 + offset);
  }
  return pixels;
}

/** Same gradient with mild noise — models a re-encode of the same footage. */
function noisyGradient(): number[] {
  return gradientFrame().map((value, i) => value + (i % 3 === 0 ? 1 : 0));
}

function invertedFrame(): number[] {
  const pixels: number[] = [];
  for (let y = 0; y < DHASH_HEIGHT; y += 1) {
    for (let x = 0; x < DHASH_WIDTH; x += 1) pixels.push((DHASH_WIDTH - x) * 10);
  }
  return pixels;
}

describe("dHashFromLuminance", () => {
  it("produces a 16-character hex hash of 64 bits", () => {
    const hash = dHashFromLuminance(gradientFrame());
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is stable — the same pixels always yield the same hash", () => {
    expect(dHashFromLuminance(gradientFrame())).toBe(dHashFromLuminance(gradientFrame()));
  });

  it("ignores uniform brightness shifts, because it compares neighbours not absolutes", () => {
    // A whole-frame exposure change must not alter the hash.
    expect(dHashFromLuminance(gradientFrame(0))).toBe(dHashFromLuminance(gradientFrame(50)));
  });

  it("separates footage with opposite luminance direction", () => {
    const a = dHashFromLuminance(gradientFrame());
    const b = dHashFromLuminance(invertedFrame());
    expect(hammingDistance(a, b)).toBeGreaterThan(32);
  });

  it("rejects a pixel buffer that is not the expected sample size", () => {
    expect(() => dHashFromLuminance([1, 2, 3])).toThrow(/sample/i);
  });
});

describe("hammingDistance", () => {
  it("is zero for identical hashes and counts differing bits otherwise", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("0000000000000000", "0000000000000001")).toBe(1);
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);
    expect(hammingDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
  });

  it("refuses to compare hashes of different widths rather than guessing", () => {
    expect(() => hammingDistance("ffff", "0000000000000000")).toThrow(/length/i);
  });
});

describe("compareSignatures", () => {
  const original = [dHashFromLuminance(gradientFrame(0)), dHashFromLuminance(invertedFrame())];

  it("scores an identical signature as a perfect match", () => {
    expect(compareSignatures(original, original)).toBe(1);
  });

  it("still matches a re-encode whose frames carry mild noise", () => {
    const reencoded = [dHashFromLuminance(noisyGradient()), dHashFromLuminance(invertedFrame())];
    expect(compareSignatures(original, reencoded)).toBeGreaterThan(0.9);
  });

  it("scores a near-but-not-identical pair strictly below a perfect match", () => {
    // Two bits apart out of 64 → 0.96875: close enough to cluster by default,
    // but it must not be reported as identical.
    const similarity = compareSignatures(["0000000000000000"], ["0000000000000003"]);
    expect(similarity).toBeCloseTo(1 - 2 / 64, 5);
    expect(similarity).toBeLessThan(1);
  });

  it("matches a trimmed video against its longer original", () => {
    // A trim keeps a subset of frames; each surviving frame still has a home.
    expect(compareSignatures([original[1]], original)).toBeGreaterThan(0.9);
  });

  it("scores unrelated footage low", () => {
    const unrelated = ["0000000000000000", "0f0f0f0f0f0f0f0f"];
    expect(compareSignatures(["ffffffffffffffff"], unrelated)).toBeLessThan(0.6);
  });

  it("returns 0 when either signature has no frames, instead of dividing by zero", () => {
    expect(compareSignatures([], original)).toBe(0);
    expect(compareSignatures(original, [])).toBe(0);
    expect(compareSignatures([], [])).toBe(0);
  });
});

describe("findNearDuplicateVideos", () => {
  const gradient = dHashFromLuminance(gradientFrame());
  const noisy = dHashFromLuminance(noisyGradient());
  const inverted = dHashFromLuminance(invertedFrame());

  it("groups a video with its re-encode and leaves unrelated footage out", () => {
    const clusters = findNearDuplicateVideos([
      { id: "original", signature: [gradient] },
      { id: "reencode", signature: [noisy] },
      { id: "other", signature: [inverted] },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].ids.sort()).toEqual(["original", "reencode"]);
    expect(clusters[0].similarity).toBeGreaterThan(0.9);
  });

  it("reports no clusters when every video is distinct", () => {
    expect(findNearDuplicateVideos([
      { id: "a", signature: [gradient] },
      { id: "b", signature: [inverted] },
    ])).toEqual([]);
  });

  it("links a chain of re-encodes into one cluster", () => {
    const clusters = findNearDuplicateVideos([
      { id: "a", signature: [gradient] },
      { id: "b", signature: [noisy] },
      { id: "c", signature: [gradient] },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].ids.sort()).toEqual(["a", "b", "c"]);
  });

  it("honours a stricter threshold by refusing looser matches", () => {
    // 2 bits apart → 0.96875, which clusters by default but not at 1.0.
    const near = [{ id: "a", signature: ["0000000000000000"] }, { id: "b", signature: ["0000000000000003"] }];

    expect(findNearDuplicateVideos(near)).toHaveLength(1);
    expect(findNearDuplicateVideos(near, { minSimilarity: 1 })).toEqual([]);
  });

  it("reports the weakest link as the cluster similarity, not a flattering average", () => {
    const clusters = findNearDuplicateVideos([
      { id: "a", signature: ["0000000000000000"] },
      { id: "b", signature: ["0000000000000003"] },
    ]);

    expect(clusters[0].similarity).toBeCloseTo(1 - 2 / 64, 5);
  });

  it("skips videos with no signature rather than clustering them together", () => {
    expect(findNearDuplicateVideos([
      { id: "empty1", signature: [] },
      { id: "empty2", signature: [] },
    ])).toEqual([]);
  });

  it("handles an empty library", () => {
    expect(findNearDuplicateVideos([])).toEqual([]);
  });
});
