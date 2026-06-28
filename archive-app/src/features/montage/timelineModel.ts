export interface TimelineClip {
  id?: string;
  itemId?: string;
  label?: string;
  order?: number;
  inSec?: number;
  outSec?: number;
  locked?: boolean;
}

export interface TimelineLayoutClip {
  id: TimelineClip["id"];
  itemId: TimelineClip["itemId"];
  label: string;
  order: number;
  inSec: number;
  outSec: number;
  startSec: number;
  durationSec: number;
  startPx: number;
  widthPx: number;
}

export interface TrimClipOptions {
  startSec?: number;
  endSec?: number;
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizePxPerSecond(pxPerSecond: unknown): number {
  const n = Number(pxPerSecond);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function clipDuration(clip: TimelineClip | null | undefined): number {
  return Math.max(0, toNum(clip?.outSec) - toNum(clip?.inSec));
}

function orderedClips(clips: TimelineClip[] | null | undefined): TimelineClip[] {
  return [...(Array.isArray(clips) ? clips : [])].sort((a, b) => (a?.order || 0) - (b?.order || 0));
}

export function totalDuration(clips: TimelineClip[] | null | undefined): number {
  return orderedClips(clips).reduce((sum, clip) => sum + clipDuration(clip), 0);
}

export function timeToPx(sec: number, pxPerSecond: number): number {
  return toNum(sec) * normalizePxPerSecond(pxPerSecond);
}

export function pxToTime(px: number, pxPerSecond: number): number {
  const scale = normalizePxPerSecond(pxPerSecond);
  const n = Number(px);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / scale;
}

export function buildClipLayout(clips: TimelineClip[] | null | undefined, { pxPerSecond = 10 }: { pxPerSecond?: number } = {}): TimelineLayoutClip[] {
  const scale = normalizePxPerSecond(pxPerSecond);
  let startSec = 0;
  return orderedClips(clips).map((clip, index) => {
    const durationSec = clipDuration(clip);
    const layout = {
      id: clip.id,
      itemId: clip.itemId,
      label: clip.label || "",
      order: Number.isInteger(Number(clip.order)) ? Number(clip.order) : index,
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

export function moveClip(clips: TimelineClip[] | null | undefined, id: string, newStartSec: number): TimelineClip[] {
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

export function trimClip(clips: TimelineClip[] | null | undefined, id: string, { startSec, endSec }: TrimClipOptions = {}): TimelineClip[] {
  const list = Array.isArray(clips) ? clips : [];
  return list.map((clip) => {
    if (clip?.id !== id) return clip;
    if (clip.locked) return clip;
    let nextIn = startSec === undefined ? toNum(clip.inSec) : Math.max(0, toNum(startSec));
    let nextOut = endSec === undefined ? toNum(clip.outSec) : Math.max(0, toNum(endSec));
    if (nextOut < nextIn) {
      if (endSec === undefined) nextOut = nextIn;
      else nextIn = nextOut;
    }
    return { ...clip, inSec: nextIn, outSec: nextOut };
  });
}
