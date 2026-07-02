export type WaveformSamples = ArrayLike<number> | null | undefined;

export interface WaveformClip {
  id?: string;
  outSec?: number;
}

function toCount(value: number): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function toData(samples: WaveformSamples): ArrayLike<number> {
  return samples && typeof samples.length === "number" ? samples : [];
}

export function downsamplePeaks(samples: WaveformSamples, buckets: number): number[] {
  const data = toData(samples);
  const count = toCount(buckets);
  if (data.length === 0 || count === 0) return [];

  const windowSize = data.length / count;
  const peaks = new Array<number>(count).fill(0);
  let globalPeak = 0;

  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index * windowSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * windowSize));
    let localPeak = 0;

    for (let sampleIndex = start; sampleIndex < end && sampleIndex < data.length; sampleIndex += 1) {
      const value = Math.abs(Number(data[sampleIndex]) || 0);
      if (value > localPeak) localPeak = value;
    }

    peaks[index] = localPeak;
    if (localPeak > globalPeak) globalPeak = localPeak;
  }

  return globalPeak <= 0 ? peaks : peaks.map((peak) => peak / globalPeak);
}

export function peaksToBars(peaks: number[] | null | undefined, height: number): number[] {
  const list = Array.isArray(peaks) ? peaks : [];
  const maxHeight = Math.max(0, Number(height) || 0);
  if (maxHeight === 0) return list.map(() => 0);

  const floor = Math.min(maxHeight, 1);
  return list.map((peak) => Math.max(floor, Math.min(1, Math.max(0, Number(peak) || 0)) * maxHeight));
}

export function placeholderPeaks(clip: WaveformClip | null | undefined, buckets: number): number[] {
  const count = toCount(buckets);
  if (count === 0) return [];

  const seedSource = `${clip?.id || ""}:${clip?.outSec ?? 0}`;
  let seed = 0;
  for (let index = 0; index < seedSource.length; index += 1) {
    seed = (seed * 31 + seedSource.charCodeAt(index)) % 100000;
  }

  return Array.from({ length: count }, (_, index) => {
    const phase = (index / count) * Math.PI * 2;
    const wobble = Math.sin(phase * 3 + seed * 0.001) * 0.5 + 0.5;
    const envelope = Math.sin((index / count) * Math.PI);
    return Math.min(1, Math.max(0.05, wobble * (0.4 + envelope * 0.6)));
  });
}
