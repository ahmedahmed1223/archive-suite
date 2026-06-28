import { STORES } from "../../../services/storage/schema.js";

const STORE_KEY_PATHS = Object.freeze({
  [STORES.SETTINGS]: "key"
} as const);

export const DATA_STORES = Object.freeze([
  STORES.TYPES,
  STORES.ITEMS,
  STORES.HISTORY,
  STORES.BOOKMARKS,
  STORES.RELATIONS,
  STORES.COLLECTIONS,
  STORES.VOCABULARY,
  STORES.HTAGS,
  STORES.AUDIT_LOGS,
  STORES.PROJECTS,
  STORES.ACTIVITY_LOG
]);

export const SNAPSHOT_STORES = Object.freeze({
  contentTypes: STORES.TYPES,
  videoItems: STORES.ITEMS,
  changeHistory: STORES.HISTORY,
  bookmarks: STORES.BOOKMARKS,
  relations: STORES.RELATIONS,
  virtualCollections: STORES.COLLECTIONS,
  vocabulary: STORES.VOCABULARY,
  hierarchicalTags: STORES.HTAGS,
  users: STORES.USERS,
  auditLogs: STORES.AUDIT_LOGS,
  projects: STORES.PROJECTS,
  activityLog: STORES.ACTIVITY_LOG
} as const);

const DOC_ID_SLASH = /\//g;

export function keyPathForStore(storeName: string) {
  return STORE_KEY_PATHS[storeName as keyof typeof STORE_KEY_PATHS] || "id";
}

export function collectionNameForStore(storeName: string, prefix = "") {
  if (typeof storeName !== "string" || storeName === "") {
    throw new Error("اسم المخزن مطلوب لتحديد مجموعة Firestore.");
  }
  return prefix ? `${prefix}__${storeName}` : storeName;
}

export function sanitizeDocId(key: string | number) {
  const value = String(key ?? "");
  if (value === "") {
    throw new Error("مفتاح المستند لا يمكن أن يكون فارغاً في Firestore.");
  }
  return value.replace(DOC_ID_SLASH, "__");
}

export function recordKey(storeName: string, record: Record<string, unknown>) {
  const keyPath = keyPathForStore(storeName);
  const raw = record?.[keyPath];
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(`السجل في ${storeName} يحتاج المفتاح "${keyPath}".`);
  }
  return sanitizeDocId(raw as string | number);
}

export function recordToDoc(record: Record<string, unknown>) {
  if (!record || typeof record !== "object") {
    throw new Error("السجل يجب أن يكون كائناً لتخزينه في Firestore.");
  }
  const doc: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(record)) {
    if (value !== undefined) doc[field] = value;
  }
  return doc;
}

export function docToRecord(data: Record<string, unknown> | null | undefined) {
  if (!data || typeof data !== "object") return undefined;
  return { ...data };
}
