/**
 * Field-level version history for video items (PR 10).
 *
 * diffVideoItemFields(previous, updated) → [{ field, label, oldValue, newValue }]
 * captures what changed on each edit so the change-history record can store a
 * real diff (the prior record only had { itemId, action, title, timestamp }).
 * revertItemToChange(item, changes) replays a record's diff backwards to
 * restore the pre-change values — the rollback primitive.
 *
 * Pure + storage-agnostic. Rollback only works for changes recorded after
 * this ships; pre-existing history has no diff (documented limitation).
 */

export interface ItemHistoryChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ItemHistoryLike {
  [key: string]: unknown;
  metadata?: Record<string, unknown> | null;
}

const TOP_FIELD_LABELS: Record<string, string> = {
  title: "العنوان",
  path: "المسار",
  url: "الرابط",
  thumbnail: "الصورة المصغرة",
  notes: "الملاحظات",
  type: "النوع",
  subtype: "الفرع",
  tags: "الوسوم"
};

const TOP_FIELDS = Object.keys(TOP_FIELD_LABELS);

export function describeFieldValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join("، ") : "—";
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.name) return String(record.name);
    return JSON.stringify(value);
  }
  return String(value);
}

function comparable(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function diffVideoItemFields(previous: ItemHistoryLike = {}, updated: ItemHistoryLike = {}): ItemHistoryChange[] {
  const changes: ItemHistoryChange[] = [];
  for (const field of TOP_FIELDS) {
    if (comparable(previous[field]) !== comparable(updated[field])) {
      changes.push({ field, label: TOP_FIELD_LABELS[field], oldValue: previous[field] ?? null, newValue: updated[field] ?? null });
    }
  }
  const prevMeta = asRecord(previous.metadata);
  const nextMeta = asRecord(updated.metadata);
  for (const key of new Set([...Object.keys(prevMeta), ...Object.keys(nextMeta)])) {
    if (comparable(prevMeta[key]) !== comparable(nextMeta[key])) {
      changes.push({ field: `metadata.${key}`, label: key, oldValue: prevMeta[key] ?? null, newValue: nextMeta[key] ?? null });
    }
  }
  return changes;
}

/** Replay a change record's diff backwards: set each field to its oldValue. */
export function revertItemToChange(item: ItemHistoryLike = {}, changes: ItemHistoryChange[] = []): ItemHistoryLike {
  const next: ItemHistoryLike = { ...item, metadata: { ...asRecord(item.metadata) } };
  for (const change of changes) {
    if (typeof change.field === "string" && change.field.startsWith("metadata.")) {
      const key = change.field.slice("metadata.".length);
      const metadata = asRecord(next.metadata);
      if (change.oldValue === null || change.oldValue === undefined) delete metadata[key];
      else metadata[key] = change.oldValue as unknown;
      next.metadata = metadata;
    } else {
      next[change.field] = change.oldValue;
    }
  }
  return next;
}
