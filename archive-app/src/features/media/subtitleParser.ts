// Parse SRT/VTT subtitle text into cues and resolve the active cue for a
// playback time. Pure functions, no DOM, fully unit-testable.

export interface Cue {
  index: number;
  start: number;
  end: number;
  text: string;
}

export interface SubtitleSegment {
  start?: number | string | null;
  end?: number | string | null;
  text?: string | null;
}

/** Parse a single subtitle timecode into seconds, or NaN when unparseable. */
export function parseTimecode(raw: string | number | null | undefined): number {
  const value = String(raw || "").trim().replace(",", ".");
  const match = value.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)$/);
  if (!match) return NaN;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return NaN;
  return hours * 3600 + minutes * 60 + seconds;
}

const TIMECODE_LINE =
  /(\d{1,2}:\d{1,2}:\d{1,2}[.,]\d{1,3}|\d{1,2}:\d{1,2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{1,2}:\d{1,2}[.,]\d{1,3}|\d{1,2}:\d{1,2}[.,]\d{1,3})/;

/**
 * Parse SRT or WebVTT text into a sorted array of cues. Lenient: ignores cue
 * numbers, WEBVTT headers, NOTE/STYLE blocks, and malformed blocks.
 */
export function parseSubtitles(text: string | null | undefined): Cue[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) return [];
  const blocks = raw.split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const firstLine = lines[0] || "";
    if (/^WEBVTT/i.test(firstLine) || /^NOTE\b/i.test(firstLine) || /^STYLE\b/i.test(firstLine)) {
      continue;
    }
    const timeLineIndex = lines.findIndex((line) => TIMECODE_LINE.test(line));
    if (timeLineIndex === -1) continue;
    const match = lines[timeLineIndex]?.match(TIMECODE_LINE);
    if (!match) continue;
    const start = parseTimecode(match[1]);
    const end = parseTimecode(match[2]);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const cueText = lines.slice(timeLineIndex + 1).join("\n").trim();
    if (!cueText) continue;
    cues.push({ index: cues.length + 1, start, end, text: cueText });
  }
  return cues.sort((a, b) => a.start - b.start).map((cue, i) => ({ ...cue, index: i + 1 }));
}

/** Alias kept for clarity at call sites that know the format. */
export const parseSrt = parseSubtitles;
export const parseVtt = parseSubtitles;

/** Convert transcription segments into cues without an intermediate SRT string. */
export function segmentsToCues(segments: SubtitleSegment[] | null | undefined): Cue[] {
  const list = Array.isArray(segments) ? segments : [];
  const cues: Cue[] = [];
  for (const seg of list) {
    const start = Number(seg?.start);
    const text = String(seg?.text || "").trim();
    if (Number.isNaN(start) || !text) continue;
    const end = Number.isFinite(Number(seg?.end)) ? Number(seg?.end) : start + 3;
    cues.push({ index: cues.length + 1, start, end, text });
  }
  return cues.sort((a, b) => a.start - b.start).map((cue, i) => ({ ...cue, index: i + 1 }));
}

/** Return the cue active at the given playback time, or null. */
export function getActiveCue(cues: Cue[] | null | undefined, time: number | string | null | undefined): Cue | null {
  const list = Array.isArray(cues) ? cues : [];
  const t = Number(time) || 0;
  let active: Cue | null = null;
  for (const cue of list) {
    if (t >= cue.start && t < cue.end) {
      if (!active || cue.start >= active.start) active = cue;
    }
  }
  return active;
}
