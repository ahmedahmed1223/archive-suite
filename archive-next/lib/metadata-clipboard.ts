// ponytail: single-slot localStorage clipboard for copying descriptor fields between records (V1-852)
// Title is excluded on purpose — it identifies the record, copying it across records is not a "paste metadata" use case.
export interface ClipboardFields {
  description?: string;
  type?: string;
  tags?: string[];
}

export interface MetadataClipboard extends ClipboardFields {
  sourceId: string;
  copiedAt: string;
}

const STORAGE_KEY = "masar.metadata-clipboard";

export function copyFields(sourceId: string, fields: ClipboardFields): void {
  if (typeof window === "undefined") return;
  const entry: MetadataClipboard = { sourceId, ...fields, copiedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function getClipboard(): MetadataClipboard | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearClipboard(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silent fail
  }
}

/** يطبّق فقط الحقول المطلوبة من الحافظة على مسودة الهدف، بلا تحوّر لبقية الحقول. */
export function applyClipboard<T extends ClipboardFields>(
  target: T,
  clipboard: MetadataClipboard,
  fieldsToApply: Array<keyof ClipboardFields>
): T {
  const patch: ClipboardFields = {};
  for (const field of fieldsToApply) {
    if (clipboard[field] !== undefined) {
      (patch as Record<string, unknown>)[field] = clipboard[field];
    }
  }
  return { ...target, ...patch };
}
