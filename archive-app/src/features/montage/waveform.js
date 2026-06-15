/**
 * waveform — pure helpers for rendering an audio waveform strip (§793).
 *
 * Real audio decoding (Web Audio `decodeAudioData`) happens in the browser and
 * is out of scope here: these functions operate purely over numeric sample
 * arrays so they are deterministic and unit-testable. The TimelineTrack
 * component feeds them decoded PCM samples when available, or a deterministic
 * placeholder series derived from a clip when not.
 */

/**
 * Downsample a raw mono sample array into `buckets` normalized peak values in
 * [0, 1]. Each bucket's peak is the max absolute sample in its window, scaled by
 * the global peak so the loudest bucket is 1. Pure; tolerates empty/short input.
 * @param {ArrayLike<number>} samples
 * @param {number} buckets
 * @returns {number[]} length === max(0, buckets) when there is input, else [].
 */
export function downsamplePeaks(samples, buckets) {
  const data = samples && typeof samples.length === "number" ? samples : [];
  const count = Math.max(0, Math.floor(Number(buckets) || 0));
  if (data.length === 0 || count === 0) return [];

  const windowSize = data.length / count;
  const peaks = new Array(count).fill(0);
  let globalPeak = 0;

  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * windowSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * windowSize));
    let localPeak = 0;
    for (let j = start; j < end && j < data.length; j += 1) {
      const v = Math.abs(Number(data[j]) || 0);
      if (v > localPeak) localPeak = v;
    }
    peaks[i] = localPeak;
    if (localPeak > globalPeak) globalPeak = localPeak;
  }

  if (globalPeak <= 0) return peaks; // all-zero / silent input → flat zeros
  return peaks.map((p) => p / globalPeak);
}

/**
 * Map normalized peaks [0,1] to bar pixel heights for a strip of the given
 * height. A small floor keeps even silent buckets visible as a hairline.
 * @param {number[]} peaks
 * @param {number} height - strip height in px.
 * @returns {number[]} bar heights in px, clamped to [floor, height].
 */
export function peaksToBars(peaks, height) {
  const list = Array.isArray(peaks) ? peaks : [];
  const h = Math.max(0, Number(height) || 0);
  if (h === 0) return list.map(() => 0);
  const floor = Math.min(h, 1);
  return list.map((p) => {
    const ratio = Math.min(1, Math.max(0, Number(p) || 0));
    return Math.max(floor, ratio * h);
  });
}

/**
 * Deterministic placeholder peak series for a clip when no decoded audio is
 * available — a smooth pseudo-waveform seeded by the clip id + duration so the
 * same clip always renders the same shape (never random, never crashes).
 * @param {{ id?: string, inSec?: number, outSec?: number }} clip
 * @param {number} buckets
 * @returns {number[]} normalized peaks in [0,1].
 */
export function placeholderPeaks(clip, buckets) {
  const count = Math.max(0, Math.floor(Number(buckets) || 0));
  if (count === 0) return [];
  const seedStr = String(clip?.id || "") + ":" + String(clip?.outSec ?? 0);
  let seed = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) % 100000;
  }
  return Array.from({ length: count }, (_, i) => {
    const phase = (i / count) * Math.PI * 2;
    const wobble = Math.sin(phase * 3 + seed * 0.001) * 0.5 + 0.5;
    const envelope = Math.sin((i / count) * Math.PI); // fade in/out at edges
    return Math.min(1, Math.max(0.05, wobble * (0.4 + envelope * 0.6)));
  });
}
