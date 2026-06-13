/**
 * scrubberPreview — pure geometry helpers for the VideoPlayer seek-bar hover
 * preview (§13.1, phase 4). Given a pointer position and the scrubber's bounding
 * rect, map it to a playback time and a clamped left-offset percentage so the
 * thumbnail/time tooltip can be positioned without leaving the bar.
 *
 * Kept storage/DOM-agnostic so the math is unit-tested independently of the
 * (browser-only) thumbnail rendering that consumes it.
 */

/** Pointer X over a rect → ratio in [0,1] along the rect width. */
function pointerRatio(clientX, rect) {
  if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) return 0;
  const ratio = (Number(clientX) - Number(rect.left || 0)) / rect.width;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * Playback time (seconds) for a pointer hovering the scrubber.
 * @param {{ clientX: number, rect: { left: number, width: number }, duration: number }} args
 * @returns {number} seconds in [0, duration], rounded to ms.
 */
export function previewTimeFromPointer({ clientX, rect, duration } = {}) {
  const total = Number(duration);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Number((pointerRatio(clientX, rect) * total).toFixed(3));
}

/**
 * Left offset (percent) for the tooltip, optionally pinned so a tooltip of a
 * given half-width stays fully inside the bar.
 * @param {{ clientX: number, rect: { left: number, width: number }, marginPercent?: number }} args
 * @returns {number} percent in [marginPercent, 100 - marginPercent].
 */
export function previewPercentFromPointer({ clientX, rect, marginPercent = 0 } = {}) {
  const raw = pointerRatio(clientX, rect) * 100;
  const margin = Math.min(50, Math.max(0, Number(marginPercent) || 0));
  return Number(Math.min(100 - margin, Math.max(margin, raw)).toFixed(3));
}
