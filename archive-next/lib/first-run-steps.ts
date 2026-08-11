export function clampStepIndex(index: number, totalSteps: number): number {
  return Math.max(0, Math.min(index, totalSteps));
}
