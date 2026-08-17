export interface Cue {
  index: number;
  start: number;
  end: number;
  text: string;
}

export function parseTimecode(raw: string | number | null | undefined): number {
  const value = String(raw || "").trim().replace(",", ".");
  const match = value.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)$/);
  if (!match) return NaN;

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) return NaN;

  return hours * 3600 + minutes * 60 + seconds;
}

const TIMECODE_LINE =
  /(\d{1,2}:\d{1,2}:\d{1,2}[.,]\d{1,3}|\d{1,2}:\d{1,2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{1,2}:\d{1,2}[.,]\d{1,3}|\d{1,2}:\d{1,2}[.,]\d{1,3})/;

export function parseSubtitles(text: string | null | undefined): Cue[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) return [];

  const cues: Cue[] = [];
  for (const block of raw.split(/\n{2,}/)) {
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
    const cueText = lines.slice(timeLineIndex + 1).join("\n").trim();
    if (Number.isNaN(start) || Number.isNaN(end) || !cueText) continue;

    cues.push({ index: cues.length + 1, start, end, text: cueText });
  }

  return cues.sort((a, b) => a.start - b.start).map((cue, index) => ({ ...cue, index: index + 1 }));
}

export function getActiveCue(cues: Cue[] | null | undefined, time: number | string | null | undefined): Cue | null {
  const timestamp = Number(time) || 0;
  let active: Cue | null = null;

  for (const cue of Array.isArray(cues) ? cues : []) {
    if (timestamp >= cue.start && timestamp < cue.end) {
      active = cue;
    }
  }

  return active;
}

export function formatCueTime(seconds: number): string {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = Math.floor(safe % 60);

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatTimecode(totalSeconds: number, millisSeparator: "," | "."): string {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  let seconds = Math.floor(safe % 60);
  let millis = Math.round((safe - Math.floor(safe)) * 1000);
  if (millis === 1000) {
    millis = 0;
    seconds += 1;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${millisSeparator}${String(millis).padStart(3, "0")}`;
}

/** Serializes a cue list to SRT text. Mirrors SubtitleCueCodec::toSrt on the backend. */
export function serializeSrt(cues: Cue[]): string {
  return cues
    .map((cue, index) => `${index + 1}\n${formatTimecode(cue.start, ",")} --> ${formatTimecode(cue.end, ",")}\n${cue.text}`)
    .join("\n\n")
    .concat("\n");
}

/** Serializes a cue list to WebVTT text. Mirrors SubtitleCueCodec::toVtt on the backend. */
export function serializeVtt(cues: Cue[]): string {
  const blocks = ["WEBVTT", ...cues.map((cue) => `${formatTimecode(cue.start, ".")} --> ${formatTimecode(cue.end, ".")}\n${cue.text}`)];
  return blocks.join("\n\n").concat("\n");
}

export interface CueOrderError {
  cueIndex: number;
  otherCueIndex?: number;
  kind: "inverted" | "out-of-order" | "overlap";
}

/**
 * Client-side mirror of the backend's CueValidator: cues must be
 * chronologically ordered and must not overlap. Runs on every edit so the
 * user sees the problem before a save round-trip rejects it. Returns
 * structured errors (no message strings) so callers render them through
 * their own i18n dictionary.
 */
export function validateCueOrder(cues: Cue[]): CueOrderError[] {
  const errors: CueOrderError[] = [];
  let previous: { start: number; end: number; index: number } | null = null;

  cues.forEach((cue, position) => {
    const index = position + 1;

    if (cue.end <= cue.start) {
      errors.push({ cueIndex: index, kind: "inverted" });
    }

    if (previous) {
      if (cue.start < previous.start) {
        errors.push({ cueIndex: index, otherCueIndex: previous.index, kind: "out-of-order" });
      } else if (cue.start < previous.end) {
        errors.push({ cueIndex: index, otherCueIndex: previous.index, kind: "overlap" });
      }
    }

    previous = { start: cue.start, end: cue.end, index };
  });

  return errors;
}
