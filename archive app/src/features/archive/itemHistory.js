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

const TOP_FIELD_LABELS = {
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

export function describeFieldValue(value) {
  if (Array.isArray(value)) return value.length ? value.join("، ") : "—";
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    return JSON.stringify(value);
  }
  return String(value);
}

function comparable(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function diffVideoItemFields(previous = {}, updated = {}) {
  const changes = [];
  for (const field of TOP_FIELDS) {
    if (comparable(previous[field]) !== comparable(updated[field])) {
      changes.push({ field, label: TOP_FIELD_LABELS[field], oldValue: previous[field] ?? null, newValue: updated[field] ?? null });
    }
  }
  const prevMeta = previous.metadata || {};
  const nextMeta = updated.metadata || {};
  for (const key of new Set([...Object.keys(prevMeta), ...Object.keys(nextMeta)])) {
    if (comparable(prevMeta[key]) !== comparable(nextMeta[key])) {
      changes.push({ field: `metadata.${key}`, label: key, oldValue: prevMeta[key] ?? null, newValue: nextMeta[key] ?? null });
    }
  }
  return changes;
}

/** Replay a change record's diff backwards: set each field to its oldValue. */
export function revertItemToChange(item = {}, changes = []) {
  const next = { ...item, metadata: { ...(item.metadata || {}) } };
  for (const change of changes) {
    if (typeof change.field === "string" && change.field.startsWith("metadata.")) {
      const key = change.field.slice("metadata.".length);
      if (change.oldValue === null || change.oldValue === undefined) delete next.metadata[key];
      else next.metadata[key] = change.oldValue;
    } else {
      next[change.field] = change.oldValue;
    }
  }
  return next;
}
