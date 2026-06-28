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

export type ArchiveTableColumnId =
  | "title"
  | "status"
  | "type"
  | "file"
  | "tags"
  | "size"
  | "created"
  | "updated"
  | "viewed"
  | "completeness"
  | "actions";

export interface ArchiveTableColumnMeta {
  id: ArchiveTableColumnId;
  label: string;
  default: boolean;
  width: number;
  minWidth: number;
  locked?: boolean;
}

export interface ArchiveTableColumnState {
  id: ArchiveTableColumnId;
  visible: boolean;
  width: number;
}

export const ARCHIVE_TABLE_COLUMNS: ArchiveTableColumnMeta[] = [
  { id: "title", label: "العنوان", default: true, width: 280, minWidth: 180 },
  { id: "status", label: "الحالة", default: true, width: 130, minWidth: 100 },
  { id: "type", label: "النوع", default: true, width: 160, minWidth: 100 },
  { id: "file", label: "الملف", default: true, width: 200, minWidth: 120 },
  { id: "tags", label: "الوسوم", default: true, width: 180, minWidth: 120 },
  { id: "size", label: "الحجم", default: false, width: 100, minWidth: 80 },
  { id: "created", label: "تاريخ الإنشاء", default: false, width: 160, minWidth: 120 },
  { id: "updated", label: "آخر تحديث", default: true, width: 160, minWidth: 120 },
  { id: "viewed", label: "آخر مشاهدة", default: false, width: 160, minWidth: 120 },
  { id: "completeness", label: "الاكتمال", default: false, width: 100, minWidth: 80 },
  { id: "actions", label: "إجراءات", default: true, width: 180, minWidth: 140, locked: true }
];

const COLUMN_ID_SET = new Set<ArchiveTableColumnId>(ARCHIVE_TABLE_COLUMNS.map((column) => column.id));

export function getDefaultArchiveTableColumns(): ArchiveTableColumnState[] {
  return ARCHIVE_TABLE_COLUMNS.map((column) => ({
    id: column.id,
    visible: column.default,
    width: column.width
  }));
}

export function normalizeArchiveTableColumns(stored: Array<Partial<ArchiveTableColumnState> & { id?: unknown }> | null | undefined): ArchiveTableColumnState[] {
  const fallback = getDefaultArchiveTableColumns();
  if (!Array.isArray(stored) || stored.length === 0) return fallback;
  const seen = new Set<ArchiveTableColumnId>();
  const ordered: ArchiveTableColumnState[] = [];
  for (const entry of stored) {
    if (!entry || typeof entry.id !== "string") continue;
    if (!COLUMN_ID_SET.has(entry.id as ArchiveTableColumnId) || seen.has(entry.id as ArchiveTableColumnId)) continue;
    const id = entry.id as ArchiveTableColumnId;
    seen.add(id);
    const meta = ARCHIVE_TABLE_COLUMNS.find((column) => column.id === id);
    ordered.push({
      id,
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

function clampWidth(meta: ArchiveTableColumnMeta | null | undefined, width: unknown): number {
  const fallback = meta?.width || 160;
  const value = Number(width);
  if (!Number.isFinite(value)) return fallback;
  const min = meta?.minWidth || 80;
  const max = 720;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function getColumnMeta(id: string): ArchiveTableColumnMeta | null {
  return ARCHIVE_TABLE_COLUMNS.find((column) => column.id === id) || null;
}

export function getVisibleColumns(stored: Array<Partial<ArchiveTableColumnState> & { id?: unknown }> | null | undefined): ArchiveTableColumnState[] {
  return normalizeArchiveTableColumns(stored).filter((column) => column.visible);
}

export function moveColumn(stored: Array<Partial<ArchiveTableColumnState> & { id?: unknown }> | null | undefined, columnId: string, direction: "up" | "down"): ArchiveTableColumnState[] {
  const list = normalizeArchiveTableColumns(stored);
  const index = list.findIndex((column) => column.id === columnId);
  if (index < 0) return list;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return list;
  const next = list.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function toggleColumnVisibility(stored: Array<Partial<ArchiveTableColumnState> & { id?: unknown }> | null | undefined, columnId: string): ArchiveTableColumnState[] {
  return normalizeArchiveTableColumns(stored).map((column) => {
    if (column.id !== columnId) return column;
    const meta = getColumnMeta(columnId);
    if (meta?.locked) return column;
    return { ...column, visible: !column.visible };
  });
}

export function setColumnWidth(stored: Array<Partial<ArchiveTableColumnState> & { id?: unknown }> | null | undefined, columnId: string, width: unknown): ArchiveTableColumnState[] {
  return normalizeArchiveTableColumns(stored).map((column) => {
    if (column.id !== columnId) return column;
    return { ...column, width: clampWidth(getColumnMeta(columnId), width) };
  });
}

export function resetArchiveTableColumns(): ArchiveTableColumnState[] {
  return getDefaultArchiveTableColumns();
}
