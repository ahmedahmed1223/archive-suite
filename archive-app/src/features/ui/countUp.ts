export const COUNT_UP_DURATION_MS = 650;

export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export function countUpValue(target: unknown, progress: number): number {
  const safeTarget = Number(target) || 0;
  return Math.round(safeTarget * easeOutCubic(progress));
}
