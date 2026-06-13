/**
 * Per-field 3-way diff helpers for the conflict resolution UI.
 *
 * For each editable field on a video item we want to surface:
 *   - local value
 *   - incoming value
 *   - whether they're identical, only-local-changed, only-incoming-
 *     changed, or both-changed (the actual conflict)
 *
 * Tags are merged as a union by default; text fields and scalars
 * surface both options for the user to pick. Arrays of strings
 * (like tags) get a richer view that shows added vs removed entries
 * on each side.
 */

const DIFFABLE_FIELDS = [
  { key: "title", label: "العنوان", kind: "text" },
  { key: "path", label: "المسار / الرابط", kind: "text" },
  { key: "thumbnail", label: "الصورة المصغرة", kind: "text" },
  { key: "notes", label: "الملاحظات", kind: "text" },
  { key: "type", label: "النوع", kind: "scalar" },
  { key: "subtype", label: "الفرع", kind: "scalar" },
  { key: "isFavorite", label: "مفضّل", kind: "boolean" },
  { key: "isDeleted", label: "محذوف", kind: "boolean" },
  { key: "tags", label: "الوسوم", kind: "stringArray" },
  { key: "metadata", label: "الحقول المخصصة", kind: "object" }
];

function readField(entity, key) {
  if (!entity) return undefined;
  return entity[key];
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function diffStringArrays(local = [], incoming = []) {
  const localSet = new Set(Array.isArray(local) ? local : []);
  const incomingSet = new Set(Array.isArray(incoming) ? incoming : []);
  const onlyLocal = [...localSet].filter((value) => !incomingSet.has(value));
  const onlyIncoming = [...incomingSet].filter((value) => !localSet.has(value));
  const shared = [...localSet].filter((value) => incomingSet.has(value));
  const union = [...new Set([...localSet, ...incomingSet])];
  return { onlyLocal, onlyIncoming, shared, union };
}

/**
 * Build a diff entry per diffable field. status is one of:
 *   "identical" | "local-only" | "incoming-only" | "both-changed"
 *
 * `base` is optional — when present we can tell "only local
 * changed" vs "only incoming changed". Without it we can still
 * tell "identical" vs "different" but the change-attribution
 * falls back to: any difference → "both-changed" so the user
 * picks consciously.
 */
export function buildFieldDiff({ local, incoming, base = null } = {}) {
  if (!local || !incoming) return [];
  const rows = [];

  for (const field of DIFFABLE_FIELDS) {
    const localValue = readField(local, field.key);
    const incomingValue = readField(incoming, field.key);
    const baseValue = base ? readField(base, field.key) : undefined;

    const equalSides = deepEqual(localValue, incomingValue);
    if (equalSides) {
      rows.push({ ...field, status: "identical", local: localValue, incoming: incomingValue });
      continue;
    }

    let status = "both-changed";
    if (base) {
      const localMoved = !deepEqual(localValue, baseValue);
      const incomingMoved = !deepEqual(incomingValue, baseValue);
      if (localMoved && !incomingMoved) status = "local-only";
      else if (!localMoved && incomingMoved) status = "incoming-only";
      else status = "both-changed";
    }

    const row = { ...field, status, local: localValue, incoming: incomingValue, base: baseValue };
    if (field.kind === "stringArray") {
      row.arrayDiff = diffStringArrays(localValue, incomingValue);
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Default automatic resolution per field kind. The conflict UI uses
 * these as starting points which the user can override:
 *   - boolean / scalar / text → prefer incoming (the explicit choice)
 *   - stringArray (tags)      → take the union (lossless)
 *   - object (metadata)       → shallow merge with incoming winning
 *     on overlapping keys
 */
export function autoResolveField(row) {
  if (!row) return undefined;
  if (row.status === "identical") return row.local;
  if (row.kind === "stringArray") return row.arrayDiff?.union ?? row.incoming ?? row.local ?? [];
  if (row.kind === "object") return { ...(row.local || {}), ...(row.incoming || {}) };
  return row.incoming !== undefined ? row.incoming : row.local;
}

/**
 * Apply the user's choices map ({ [fieldKey]: "local" | "incoming"
 * | "merge" | customValue }) to produce a final entity.
 */
export function applyFieldChoices({ local, incoming, choices = {} }) {
  if (!local || !incoming) return incoming || local;
  const merged = { ...local };
  for (const field of DIFFABLE_FIELDS) {
    const decision = choices[field.key];
    if (decision === "local") merged[field.key] = local[field.key];
    else if (decision === "incoming") merged[field.key] = incoming[field.key];
    else if (decision === "merge" && field.kind === "stringArray") {
      const localValue = Array.isArray(local[field.key]) ? local[field.key] : [];
      const incomingValue = Array.isArray(incoming[field.key]) ? incoming[field.key] : [];
      merged[field.key] = [...new Set([...localValue, ...incomingValue])];
    } else if (decision === "merge" && field.kind === "object") {
      merged[field.key] = { ...(local[field.key] || {}), ...(incoming[field.key] || {}) };
    } else if (decision !== undefined) {
      // Custom value
      merged[field.key] = decision;
    } else {
      // No explicit choice — fall back to autoResolveField semantics.
      const row = { ...field, status: "both-changed", local: local[field.key], incoming: incoming[field.key] };
      if (field.kind === "stringArray") row.arrayDiff = diffStringArrays(local[field.key], incoming[field.key]);
      merged[field.key] = autoResolveField(row);
    }
  }
  return merged;
}

export { DIFFABLE_FIELDS };
