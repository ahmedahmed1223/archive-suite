// V1-757: near-duplicate video detection via perceptual hashing.
//
// Exact checksums (intake-journey's findDuplicateFiles) only catch byte-identical
// files, so a re-encode, a trim, or a resize of the same footage slips through as
// "new". A difference hash (dHash) compares each pixel with its right-hand
// neighbour, so it survives exposure and compression changes while still
// separating genuinely different footage.
//
// Frame extraction is deliberately NOT here: the caller supplies decoded
// grayscale samples (ffmpeg server-side, canvas client-side), which keeps every
// rule below testable without a media pipeline.

/** dHash samples one pixel wider than tall: each row yields WIDTH-1 comparisons. */
export const DHASH_HEIGHT = 8;
export const DHASH_WIDTH = 9;
const HASH_BITS = DHASH_HEIGHT * (DHASH_WIDTH - 1); // 64
const HASH_HEX_LENGTH = HASH_BITS / 4; // 16

const DEFAULT_MIN_SIMILARITY = 0.9;

export type FrameHash = string;

export interface VideoFingerprint {
  id: string;
  signature: FrameHash[];
}

export interface NearDuplicateCluster {
  ids: string[];
  similarity: number;
}

/**
 * Difference hash of one grayscale frame sampled to DHASH_WIDTH x DHASH_HEIGHT
 * (row-major luminance). Returns 64 bits as 16 hex characters.
 *
 * Because every bit is a comparison between neighbours, a uniform brightness
 * change moves both sides equally and the hash does not move at all.
 */
export function dHashFromLuminance(pixels: number[]): FrameHash {
  const expected = DHASH_WIDTH * DHASH_HEIGHT;
  if (!Array.isArray(pixels) || pixels.length !== expected) {
    throw new Error(`Perceptual hash needs a ${DHASH_WIDTH}x${DHASH_HEIGHT} luminance sample (${expected} values), received ${pixels?.length ?? 0}.`);
  }

  let bits = "";
  for (let y = 0; y < DHASH_HEIGHT; y += 1) {
    for (let x = 0; x < DHASH_WIDTH - 1; x += 1) {
      const left = pixels[y * DHASH_WIDTH + x];
      const right = pixels[y * DHASH_WIDTH + x + 1];
      bits += left < right ? "1" : "0";
    }
  }

  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex.padStart(HASH_HEX_LENGTH, "0");
}

const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Number of differing bits between two equal-width hex hashes. */
export function hammingDistance(a: FrameHash, b: FrameHash): number {
  if (a.length !== b.length) {
    throw new Error(`Perceptual hashes must be the same length to compare (${a.length} vs ${b.length}).`);
  }
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    distance += NIBBLE_BITS[(parseInt(a[i], 16) ^ parseInt(b[i], 16)) & 0xf];
  }
  return distance;
}

/** Per-frame similarity in 0..1, where 1 is an identical hash. */
function frameSimilarity(a: FrameHash, b: FrameHash): number {
  return 1 - hammingDistance(a, b) / HASH_BITS;
}

/**
 * Similarity of two frame signatures in 0..1.
 *
 * Each frame of the SHORTER signature is scored against its best match anywhere
 * in the other — not position-by-position — so a trim or a re-ordered sample
 * still recognises its original. Averaging over the shorter side is what makes
 * a 10-second cut of a 10-minute source score high rather than near zero.
 */
export function compareSignatures(a: FrameHash[], b: FrameHash[]): number {
  if (!a.length || !b.length) return 0;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];

  let total = 0;
  for (const frame of shorter) {
    let best = 0;
    for (const candidate of longer) {
      best = Math.max(best, frameSimilarity(frame, candidate));
      if (best === 1) break;
    }
    total += best;
  }
  return total / shorter.length;
}

/**
 * Groups videos whose signatures match at or above `minSimilarity`.
 *
 * Uses single-linkage (union-find) clustering: if A matches B and B matches C,
 * all three land in one cluster even when A and C drifted past the threshold.
 * That is the right call for re-encode chains — the alternative reports the
 * same footage as two overlapping "duplicate pairs" for a human to reconcile.
 */
export function findNearDuplicateVideos(
  videos: VideoFingerprint[],
  { minSimilarity = DEFAULT_MIN_SIMILARITY }: { minSimilarity?: number } = {},
): NearDuplicateCluster[] {
  // A video without frames carries no evidence; clustering them by their shared
  // emptiness would report every unprocessed record as a duplicate of the rest.
  const usable = videos.filter((video) => video.signature.length > 0);
  if (usable.length < 2) return [];

  const parent = usable.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    return root;
  };

  const pairScores: Array<{ i: number; j: number; similarity: number }> = [];
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      const similarity = compareSignatures(usable[i].signature, usable[j].signature);
      if (similarity < minSimilarity) continue;
      pairScores.push({ i, j, similarity });
      const [rootI, rootJ] = [find(i), find(j)];
      if (rootI !== rootJ) parent[rootJ] = rootI;
    }
  }

  const clusters = new Map<number, string[]>();
  usable.forEach((video, index) => {
    const root = find(index);
    clusters.set(root, [...(clusters.get(root) ?? []), video.id]);
  });

  // Resolve every pair against its FINAL root: unions made later can move a
  // pair's root, so scores must be bucketed after all merging is done.
  const scores = new Map<number, number[]>();
  for (const { i, similarity } of pairScores) {
    const root = find(i);
    scores.set(root, [...(scores.get(root) ?? []), similarity]);
  }

  return [...clusters.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([root, ids]) => {
      const values = scores.get(root) ?? [];
      // The weakest link is the honest headline: it is the reason the cluster
      // holds together at all, and an average would hide the loosest match.
      return { ids, similarity: values.length ? Math.min(...values) : 0 };
    });
}
