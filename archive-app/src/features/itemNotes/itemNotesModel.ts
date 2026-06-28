function newNoteId(): string {
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTimestamp(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

function normalizeRegion(region: any): any {
  if (!region || typeof region !== "object") return null;
  const x = Number(region.x);
  const y = Number(region.y);
  const w = Number(region.w);
  const h = Number(region.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

export function createItemNote(partial: any = {}): any {
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

export function sortNotes(notes: any[] = []): any[] {
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

export function filterNotesForItem(notes: any[] = [], itemId = ""): any[] {
  const target = String(itemId || "");
  if (!target) return [];
  return (Array.isArray(notes) ? notes : []).filter((note) => note && String(note.itemId) === target);
}

export function formatNoteTime(seconds: any): string {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const whole = Math.floor(total);
  const hrs = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)}`;
  return `${mins}:${pad(secs)}`;
}

export function describeNoteAnchor(note: any): string {
  if (!note) return "ملاحظة عامة";
  if (note.timestamp !== null && note.timestamp !== undefined) {
    return `عند ${formatNoteTime(note.timestamp)}`;
  }
  if (note.region) return "منطقة محددة";
  return "ملاحظة عامة";
}
