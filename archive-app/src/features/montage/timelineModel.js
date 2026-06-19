/**
 * timelineModel — pure positioning math for the visual montage timeline (§793).
 *
 * The persisted project model (`features/projects/viewModel.js`) stores clips as
 * "rough cuts": ordered references to a source item with `inSec`/`outSec` on the
 * source. On the project timeline those clips play back-to-back (sequential), so
 * each clip's timeline start = sum of the durations of the clips before it.
 *
 * These helpers turn that ordered list into a pixel-positioned layout for the
 * TimelineTrack component, and provide immutable, clamped edits (`moveClip` to
 * reorder, `trimClip` to adjust source in/out). All functions are pure, take and
 * return the EXISTING clip field names, and never mutate inputs — so the math is
 * unit-tested independently of the (browser-only) rendering and drag wiring.
 */

const MIN_PX_PER_SECOND = 0.0001;

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizePxPerSecond(pxPerSecond) {
  const n = Number(pxPerSecond);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Source length of one clip (outSec - inSec), clamped to >= 0. */
export function clipDuration(clip) {
  return Math.max(0, toNum(clip?.outSec) - toNum(clip?.inSec));
}

/** Clips sorted by their `order` field (defensive copy; never mutates). */
function orderedClips(clips) {
  return [...(Array.isArray(clips) ? clips : [])].sort(
    (a, b) => (a?.order || 0) - (b?.order || 0)
  );
}

/** Total timeline duration in seconds (sum of clip source lengths). */
export function totalDuration(clips) {
  return orderedClips(clips).reduce((sum, clip) => sum + clipDuration(clip), 0);
}

/** Seconds → pixels at the given scale. */
export function timeToPx(sec, pxPerSecond) {
  return toNum(sec) * normalizePxPerSecond(pxPerSecond);
}

/** Pixels → seconds at the given scale (inverse of timeToPx). */
export function pxToTime(px, pxPerSecond) {
  const scale = normalizePxPerSecond(pxPerSecond);
  const n = Number(px);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / scale;
}

/**
 * Build a positioned timeline layout from ordered clips.
 * @param {Array} clips - project rough cuts.
 * @param {{ pxPerSecond?: number }} [opts]
 * @returns {Array<{ id, itemId, label, order, inSec, outSec, startSec, durationSec, startPx, widthPx }>}
 */
export function buildClipLayout(clips, { pxPerSecond = 10 } = {}) {
  const scale = normalizePxPerSecond(pxPerSecond);
  let startSec = 0;
  return orderedClips(clips).map((clip, index) => {
    const durationSec = clipDuration(clip);
    const layout = {
      id: clip.id,
      itemId: clip.itemId,
      label: clip.label || "",
      order: Number.isInteger(clip.order) ? clip.order : index,
      inSec: toNum(clip.inSec),
      outSec: toNum(clip.outSec),
      startSec,
      durationSec,
      startPx: startSec * scale,
      widthPx: durationSec * scale
    };
    startSec += durationSec;
    return layout;
  });
}

/**
 * Move a clip to the timeline position that contains `newStartSec`, reordering
 * the sequential clip list immutably. Because clips play back-to-back, a "move"
 * is a reorder: the clip is inserted before whichever clip currently occupies
 * that second. Returns a new array with re-sequenced `order`; the source array
 * and clip objects are never mutated. Unknown id → input is returned unchanged
 * (defensive copy by order).
 */
export function moveClip(clips, id, newStartSec) {
  const ordered = orderedClips(clips);
  const fromIndex = ordered.findIndex((clip) => clip?.id === id);
  if (fromIndex < 0) return ordered;
  if (ordered[fromIndex]?.locked) return ordered;

  const target = toNum(newStartSec);
  let acc = 0;
  let toIndex = ordered.length;
  for (let i = 0; i < ordered.length; i += 1) {
    if (i === fromIndex) continue;
    const dur = clipDuration(ordered[i]);
    if (target < acc + dur / 2) {
      toIndex = i;
      break;
    }
    acc += dur;
  }

  const without = ordered.filter((_, i) => i !== fromIndex);
  const clamped = Math.max(0, Math.min(toIndex, without.length));
  const next = [...without];
  next.splice(clamped, 0, ordered[fromIndex]);
  return next.map((clip, i) => ({ ...clip, order: i }));
}

/**
 * Trim a clip's source in/out points immutably, clamped so that
 * 0 <= startSec <= endSec. Either bound is optional; omitted bounds keep the
 * current value. Returns a new array; the source clip object is never mutated.
 * Unknown id → defensive copy of the input list.
 */
export function trimClip(clips, id, { startSec, endSec } = {}) {
  const list = Array.isArray(clips) ? clips : [];
  return list.map((clip) => {
    if (clip?.id !== id) return clip;
    if (clip.locked) return clip;
    let nextIn = startSec === undefined ? toNum(clip.inSec) : Math.max(0, toNum(startSec));
    let nextOut = endSec === undefined ? toNum(clip.outSec) : Math.max(0, toNum(endSec));
    if (nextOut < nextIn) {
      // Keep the bound the caller explicitly set; clamp the other to it.
      if (endSec === undefined) nextOut = nextIn;
      else nextIn = nextOut;
    }
    return { ...clip, inSec: nextIn, outSec: nextOut };
  });
}
