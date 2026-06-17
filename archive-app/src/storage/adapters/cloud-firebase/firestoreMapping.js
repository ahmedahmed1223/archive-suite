// Pure mapping helpers for the Firebase/Firestore storage adapter (§2166 Phase B).
//
// These helpers contain ZERO firebase-SDK references so they run in vitest
// without the SDK installed. The adapter (./index.js) lazy-imports firebase and
// delegates all naming/shape decisions here, keeping the SDK-bound code thin.
//
// Mapping model (mirrors local-sqlite/index.js):
//   - Each STORE name → a Firestore collection of the SAME name (1:1).
//   - Each record    → a doc whose id is the sanitized record key.
//   - Doc body       → the record object itself (plain JSON fields). No binary
//                      blob fields exist in records today; Firebase Storage for
//                      blobs is deferred to Phase C.

import { STORES } from "../../../services/storage/schema.js";

// Settings is keyed by "key"; every other store is keyed by "id" (same as
// local-sqlite STORE_KEY_PATHS).
const STORE_KEY_PATHS = Object.freeze({
  [STORES.SETTINGS]: "key"
});

// Stores cleared on a full replaceAll (mirrors local-sqlite DATA_STORES). USERS
// is handled conditionally by the caller, matching the existing adapter.
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

// snapshot()/replaceAll() payload-key → STORE map (mirrors local-sqlite
// SNAPSHOT_STORES, same ordering).
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
});

// Firestore forbids "/" in doc ids and rejects empty ids. Optional prefix
// namespaces every collection per workspace/user so one project can host many
// archives without collisions.
const DOC_ID_SLASH = /\//g;

/** Key path used to derive a record's doc id for a given store. */
export function keyPathForStore(storeName) {
  return STORE_KEY_PATHS[storeName] || "id";
}

/**
 * Firestore collection name for a store, with an optional namespace prefix.
 * @param {string} storeName
 * @param {string} [prefix] e.g. "ws_alice"
 * @returns {string}
 */
export function collectionNameForStore(storeName, prefix = "") {
  if (typeof storeName !== "string" || storeName === "") {
    throw new Error("اسم المخزن مطلوب لتحديد مجموعة Firestore.");
  }
  return prefix ? `${prefix}__${storeName}` : storeName;
}

/**
 * Firestore-safe doc id from an arbitrary key. Slashes (path separators) are
 * replaced so nested-looking ids stay flat documents.
 * @param {string|number} key
 * @returns {string}
 */
export function sanitizeDocId(key) {
  const value = String(key ?? "");
  if (value === "") {
    throw new Error("مفتاح المستند لا يمكن أن يكون فارغاً في Firestore.");
  }
  return value.replace(DOC_ID_SLASH, "__");
}

/**
 * Derives the (sanitized) Firestore doc id for a record in a store.
 * @param {string} storeName
 * @param {Record<string, unknown>} record
 * @returns {string}
 */
export function recordKey(storeName, record) {
  const keyPath = keyPathForStore(storeName);
  const raw = record?.[keyPath];
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(`السجل في ${storeName} يحتاج المفتاح "${keyPath}".`);
  }
  return sanitizeDocId(raw);
}

/**
 * Record → Firestore doc body. Drops `undefined` fields (Firestore rejects
 * them) while preserving `null`. Returns a NEW object (immutable).
 * @param {Record<string, unknown>} record
 * @returns {Record<string, unknown>}
 */
export function recordToDoc(record) {
  if (!record || typeof record !== "object") {
    throw new Error("السجل يجب أن يكون كائناً لتخزينه في Firestore.");
  }
  const doc = {};
  for (const [field, value] of Object.entries(record)) {
    if (value !== undefined) doc[field] = value;
  }
  return doc;
}

/**
 * Firestore doc data → record. Returns the data as-is when present, else
 * undefined (matching local-sqlite's missing-record contract).
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {Record<string, unknown>|undefined}
 */
export function docToRecord(data) {
  if (!data || typeof data !== "object") return undefined;
  return { ...data };
}
