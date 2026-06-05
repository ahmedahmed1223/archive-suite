/**
 * Details view (table) column registry.
 *
 * Each column declares:
 *   id      stable identifier (used for persistence + reordering)
 *   label   header text shown to the user
 *   default visible by default?
 *   width   default width in pixels (used as min-width on the cell)
 *
 * The user can toggle visibility, reorder, and resize. Their choices
 * are stored in settings.ui.archiveTableColumns as an ordered array
 * of { id, visible, width } so the order is meaningful.
 */
export const ARCHIVE_TABLE_COLUMNS = [
  { id: "title", label: "العنوان", default: true, width: 280, minWidth: 180 },
  { id: "type", label: "النوع", default: true, width: 160, minWidth: 100 },
  { id: "file", label: "الملف", default: true, width: 200, minWidth: 120 },
  { id: "tags", label: "الوسوم", default: true, width: 180, minWidth: 120 },
  { id: "size", label: "الحجم", default: false, width: 100, minWidth: 80 },
  { id: "created", label: "تاريخ الإنشاء", default: false, width: 160, minWidth: 120 },
  { id: "updated", label: "آخر تحديث", default: true, width: 160, minWidth: 120 },
  { id: "viewed", label: "آخر مشاهدة", default: false, width: 160, minWidth: 120 },
  { id: "actions", label: "إجراءات", default: true, width: 180, minWidth: 140, locked: true }
];

const COLUMN_ID_SET = new Set(ARCHIVE_TABLE_COLUMNS.map((column) => column.id));

export function getDefaultArchiveTableColumns() {
  return ARCHIVE_TABLE_COLUMNS.map((column) => ({
    id: column.id,
    visible: column.default,
    width: column.width
  }));
}

export function normalizeArchiveTableColumns(stored) {
  const fallback = getDefaultArchiveTableColumns();
  if (!Array.isArray(stored) || stored.length === 0) return fallback;
  const seen = new Set();
  const ordered = [];
  for (const entry of stored) {
    if (!entry || typeof entry.id !== "string") continue;
    if (!COLUMN_ID_SET.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const meta = ARCHIVE_TABLE_COLUMNS.find((column) => column.id === entry.id);
    ordered.push({
      id: entry.id,
      visible: meta?.locked ? true : entry.visible !== false,
      width: clampWidth(meta, entry.width)
    });
  }
  // Append any columns missing from the stored payload at their default position.
  for (const meta of ARCHIVE_TABLE_COLUMNS) {
    if (seen.has(meta.id)) continue;
    ordered.push({ id: meta.id, visible: meta.default, width: meta.width });
  }
  return ordered;
}

function clampWidth(meta, width) {
  const fallback = meta?.width || 160;
  const value = Number(width);
  if (!Number.isFinite(value)) return fallback;
  const min = meta?.minWidth || 80;
  const max = 720;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function getColumnMeta(id) {
  return ARCHIVE_TABLE_COLUMNS.find((column) => column.id === id) || null;
}

export function getVisibleColumns(stored) {
  return normalizeArchiveTableColumns(stored).filter((column) => column.visible);
}

export function moveColumn(stored, columnId, direction) {
  const list = normalizeArchiveTableColumns(stored);
  const index = list.findIndex((column) => column.id === columnId);
  if (index < 0) return list;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return list;
  const next = list.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function toggleColumnVisibility(stored, columnId) {
  return normalizeArchiveTableColumns(stored).map((column) => {
    if (column.id !== columnId) return column;
    const meta = getColumnMeta(columnId);
    if (meta?.locked) return column;
    return { ...column, visible: !column.visible };
  });
}

export function setColumnWidth(stored, columnId, width) {
  return normalizeArchiveTableColumns(stored).map((column) => {
    if (column.id !== columnId) return column;
    return { ...column, width: clampWidth(getColumnMeta(columnId), width) };
  });
}

export function resetArchiveTableColumns() {
  return getDefaultArchiveTableColumns();
}
