/**
 * Count-up animation math (§17.4) — pure, no React, unit-testable.
 *
 * Used by `components/ui/AnimatedNumber.jsx` to animate a stat from 0 to its
 * target value. Kept separate so the easing/interpolation can be tested
 * without a DOM or animation frames.
 */

/** Default count-up duration (ms). */
export const COUNT_UP_DURATION_MS = 650;

/**
 * Ease-out cubic — fast start, gentle settle. Clamped to [0, 1].
 * @param {number} t progress in [0, 1]
 * @returns {number}
 */
export function easeOutCubic(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/**
 * Interpolated, rounded value for a given animation progress.
 * @param {number} target final value
 * @param {number} progress elapsed / duration, in [0, 1] (values outside are clamped)
 * @returns {number}
 */
export function countUpValue(target, progress) {
  const safeTarget = Number(target) || 0;
  return Math.round(safeTarget * easeOutCubic(progress));
}
