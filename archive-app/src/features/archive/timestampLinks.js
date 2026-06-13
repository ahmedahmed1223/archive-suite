// G7 — timestamp linking in free text. Detects `MM:SS` / `HH:MM:SS`
// (optionally bracketed `[12:45]`) inside notes/descriptions/transcripts and
// splits the text into segments so the UI can render the timestamps as
// clickable seek links. Pure + framework-free → unit-testable, no DOM.

// Matches an optionally-bracketed timecode. Groups capture the digit parts so
// we can validate ranges and compute seconds.
const TIMECODE_RE = /\[?\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\b\]?/g;

/**
 * Convert a parsed timecode to total seconds.
 * 2 parts → MM:SS (minutes may exceed 59). 3 parts → HH:MM:SS.
 * Returns null if the parts are out of range.
 */
export function timecodeToSeconds(a, b, c) {
  const n = (x) => (x === undefined || x === null || x === "" ? null : Number(x));
  const x = n(a), y = n(b), z = n(c);
  if (x === null || y === null || Number.isNaN(x) || Number.isNaN(y)) return null;
  if (z === null) {
    // MM:SS
    if (y > 59) return null;
    return x * 60 + y;
  }
  // HH:MM:SS
  if (Number.isNaN(z) || y > 59 || z > 59) return null;
  return x * 3600 + y * 60 + z;
}

/**
 * Split text into ordered segments for rendering.
 * @param {string} text
 * @returns {Array<{type:"text", value:string} | {type:"time", value:string, seconds:number}>}
 */
export function parseTimestampSegments(text) {
  const input = typeof text === "string" ? text : "";
  if (!input) return [];

  const segments = [];
  let lastIndex = 0;
  TIMECODE_RE.lastIndex = 0;
  let match;
  while ((match = TIMECODE_RE.exec(input)) !== null) {
    const [raw, h, m, s] = match;
    const seconds = timecodeToSeconds(h, m, s);
    if (seconds === null) continue; // out-of-range → treat as plain text
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }
    // Strip any surrounding brackets from the visible label, keep it clean.
    const value = raw.replace(/^\[|\]$/g, "");
    segments.push({ type: "time", value, seconds });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < input.length) {
    segments.push({ type: "text", value: input.slice(lastIndex) });
  }
  // No timecodes found → a single text segment (caller can fast-path).
  return segments.length ? segments : [{ type: "text", value: input }];
}

/** Whether the text contains at least one valid timecode. */
export function hasTimestamps(text) {
  return parseTimestampSegments(text).some((seg) => seg.type === "time");
}
