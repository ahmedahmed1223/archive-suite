export type WaveformSamples = ArrayLike<number> | null | undefined;

export interface WaveformClip {
  id?: string;
  inSec?: number;
  outSec?: number;
}

function toCount(value: number): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function toData(samples: WaveformSamples): ArrayLike<number> {
  return samples && typeof samples.length === "number" ? samples : [];
}

/**
 * Downsample a raw mono sample array into normalized peak values in [0, 1].
 */
export function downsamplePeaks(samples: WaveformSamples, buckets: number): number[] {
  const data = toData(samples);
  const count = toCount(buckets);
  if (data.length === 0 || count === 0) return [];

  const windowSize = data.length / count;
  const peaks = new Array<number>(count).fill(0);
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

  if (globalPeak <= 0) return peaks;
  return peaks.map((peak) => peak / globalPeak);
}

/**
 * Map normalized peaks to bar heights in pixels.
 */
export function peaksToBars(peaks: number[] | null | undefined, height: number): number[] {
  const list = Array.isArray(peaks) ? peaks : [];
  const h = Math.max(0, Number(height) || 0);
  if (h === 0) return list.map(() => 0);
  const floor = Math.min(h, 1);
  return list.map((peak) => {
    const ratio = Math.min(1, Math.max(0, Number(peak) || 0));
    return Math.max(floor, ratio * h);
  });
}

/**
 * Deterministic placeholder peak series for a clip when no decoded audio is available.
 */
export function placeholderPeaks(clip: WaveformClip | null | undefined, buckets: number): number[] {
  const count = toCount(buckets);
  if (count === 0) return [];
  const seedStr = String(clip?.id || "") + ":" + String(clip?.outSec ?? 0);
  let seed = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) % 100000;
  }
  return Array.from({ length: count }, (_, i) => {
    const phase = (i / count) * Math.PI * 2;
    const wobble = Math.sin(phase * 3 + seed * 0.001) * 0.5 + 0.5;
    const envelope = Math.sin((i / count) * Math.PI);
    return Math.min(1, Math.max(0.05, wobble * (0.4 + envelope * 0.6)));
  });
}
