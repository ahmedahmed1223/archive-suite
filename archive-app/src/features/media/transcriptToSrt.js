// transcriptToSrt.js — convert a transcription result (Whisper-style segments)
// into SRT or WebVTT text (§13.1). Pure, unit-testable; mirrors the segment
// shape produced by features/media/viewModel.js ({ start, end, text }).

function pad(value, size = 2) {
  return String(Math.floor(value)).padStart(size, "0");
}

function splitSeconds(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  // Rounding can spill to 1000ms — carry into the next second.
  const carry = ms === 1000 ? 1 : 0;
  const whole = Math.floor(safe) + carry;
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  return { hours, minutes, seconds, ms: carry ? 0 : ms };
}

/** Seconds → "HH:MM:SS,mmm" (SRT). */
export function formatSrtTimecode(totalSeconds) {
  const { hours, minutes, seconds, ms } = splitSeconds(totalSeconds);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(ms, 3)}`;
}

/** Seconds → "HH:MM:SS.mmm" (WebVTT). */
export function formatVttTimecode(totalSeconds) {
  const { hours, minutes, seconds, ms } = splitSeconds(totalSeconds);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
}

function normalizeSegments(result) {
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  const usable = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const start = Number(seg?.start);
    const text = String(seg?.text || "").trim();
    if (Number.isNaN(start) || !text) continue;
    const next = segments[i + 1];
    const fallbackEnd = Number.isFinite(Number(next?.start)) ? Number(next.start) : start + 3;
    const end = Number.isFinite(Number(seg?.end)) ? Number(seg.end) : fallbackEnd;
    usable.push({ start, end: Math.max(end, start), text });
  }
  return usable;
}

/**
 * Build an SRT document from a transcription result. Returns "" when empty.
 * @param {{ segments?: Array<{start?: number, end?: number, text?: string}> }} result
 * @returns {string}
 */
export function transcriptToSrt(result) {
  const segments = normalizeSegments(result);
  return segments
    .map((seg, i) =>
      `${i + 1}\n${formatSrtTimecode(seg.start)} --> ${formatSrtTimecode(seg.end)}\n${seg.text}`
    )
    .join("\n\n");
}

/**
 * Build a WebVTT document from a transcription result. Returns just the
 * "WEBVTT" header when there are no segments.
 * @param {{ segments?: Array<{start?: number, end?: number, text?: string}> }} result
 * @returns {string}
 */
export function transcriptToVtt(result) {
  const segments = normalizeSegments(result);
  const body = segments
    .map((seg) =>
      `${formatVttTimecode(seg.start)} --> ${formatVttTimecode(seg.end)}\n${seg.text}`
    )
    .join("\n\n");
  return body ? `WEBVTT\n\n${body}` : "WEBVTT";
}
