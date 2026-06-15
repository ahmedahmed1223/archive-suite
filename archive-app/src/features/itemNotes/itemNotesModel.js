// §1319 — Pure model for time/region-anchored personal item notes.
// No React/DOM dependency: just normalization, sorting, filtering and
// human-readable (Arabic) anchor description for archived-item notes.

function newNoteId() {
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

function normalizeRegion(region) {
  if (!region || typeof region !== "object") return null;
  const x = Number(region.x);
  const y = Number(region.y);
  const w = Number(region.w);
  const h = Number(region.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/**
 * Normalizes a partial note into a complete value object.
 * @param {Object} partial
 * @returns {{ id: string, itemId: string, body: string, timestamp: number|null,
 *   region: {x:number,y:number,w:number,h:number}|null, authorId: string,
 *   authorName: string, createdAt: string, updatedAt: string }}
 */
export function createItemNote(partial = {}) {
  const createdAt = partial.createdAt || new Date().toISOString();
  return {
    id: partial.id || newNoteId(),
    itemId: partial.itemId ? String(partial.itemId) : "",
    body: String(partial.body || "").trim(),
    timestamp: normalizeTimestamp(partial.timestamp),
    region: normalizeRegion(partial.region),
    authorId: partial.authorId ? String(partial.authorId) : "",
    authorName: String(partial.authorName || "مجهول"),
    createdAt,
    updatedAt: partial.updatedAt || createdAt
  };
}

/**
 * Sorts notes by anchor timestamp (ascending, anchored before general),
 * then by createdAt ascending. Returns a new array; does not mutate input.
 */
export function sortNotes(notes = []) {
  const list = Array.isArray(notes) ? [...notes] : [];
  return list.sort((a, b) => {
    const at = a?.timestamp;
    const bt = b?.timestamp;
    if (at !== null && at !== undefined && bt !== null && bt !== undefined) {
      if (at !== bt) return at - bt;
    } else if (at !== null && at !== undefined) {
      return -1;
    } else if (bt !== null && bt !== undefined) {
      return 1;
    }
    const ac = new Date(a?.createdAt || 0).getTime();
    const bc = new Date(b?.createdAt || 0).getTime();
    return ac - bc;
  });
}

/**
 * Returns only the notes belonging to the given item.
 */
export function filterNotesForItem(notes = [], itemId = "") {
  const target = String(itemId || "");
  if (!target) return [];
  return (Array.isArray(notes) ? notes : []).filter(
    (note) => note && String(note.itemId) === target
  );
}

/**
 * Formats a number of seconds as mm:ss (or h:mm:ss past one hour).
 */
export function formatNoteTime(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const whole = Math.floor(total);
  const hrs = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (value) => String(value).padStart(2, "0");
  if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)}`;
  return `${mins}:${pad(secs)}`;
}

/**
 * Returns an Arabic anchor description for a note:
 *  - "عند 1:23" for a time-anchored note
 *  - "منطقة محددة" for a region-anchored note
 *  - "ملاحظة عامة" otherwise
 */
export function describeNoteAnchor(note) {
  if (!note) return "ملاحظة عامة";
  if (note.timestamp !== null && note.timestamp !== undefined) {
    return `عند ${formatNoteTime(note.timestamp)}`;
  }
  if (note.region) return "منطقة محددة";
  return "ملاحظة عامة";
}
