import { validateBackupData } from "./validation.js";
import { sanitizePlainData } from "./json.js";
import {
  STORES,
  dbGet,
  dbPut,
  dbPutBatch,
  getDataSnapshot,
  replaceAllData,
  writeStorageManifest
} from "../storageAccess.js";

function normalizeArray(value: any): any[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeContentType(type: any = {}): any {
  return {
    ...type,
    id: String(type.id || `type_${Date.now().toString(36)}`),
    name: String(type.name || type.label || "نوع محتوى").trim(),
    fields: Array.isArray(type.fields) ? type.fields : [],
    subtypes: Array.isArray(type.subtypes) ? type.subtypes : [],
    status: type.status || "active",
    iconSpec: type.iconSpec || undefined,
    coverImage: type.coverImage || ""
  };
}

function normalizeVideoItem(item: any = {}): any {
  const now = new Date().toISOString();
  return {
    ...item,
    id: String(item.id || `video_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    type: String(item.type || ""),
    subtype: String(item.subtype || ""),
    title: String(item.title || "بدون عنوان").trim(),
    path: String(item.path || item.filePath || item.url || "").trim(),
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {},
    tags: Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean) : [],
    isFavorite: !!item.isFavorite,
    isDeleted: !!item.isDeleted,
    version: Number(item.version || 1),
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || item.createdAt || now
  };
}

function normalizePortableUser(user: any = {}): any {
  return {
    ...user,
    id: String(user.id || `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    username: String(user.username || "imported-user").trim(),
    displayName: String(user.displayName || user.username || "مستخدم مستورد").trim(),
    passwordHash: "",
    role: user.role === "admin" ? "viewer" : user.role || "viewer",
    customPermissions: undefined,
    isActive: false,
    mustChangePassword: true,
    updatedAt: new Date().toISOString()
  };
}

export function normalizeBackupData(data: any = {}): any {
  const plain = (sanitizePlainData(data) || {}) as Record<string, any>;
  return {
    contentTypes: normalizeArray(plain.contentTypes).map(normalizeContentType),
    videoItems: normalizeArray(plain.videoItems).map(normalizeVideoItem),
    settings: plain.settings && typeof plain.settings === "object"
      ? { ...plain.settings, masterPasswordHash: undefined, initialAdminPassword: undefined, key: "app_settings" }
      : undefined,
    changeHistory: normalizeArray(plain.changeHistory),
    bookmarks: normalizeArray(plain.bookmarks),
    relations: normalizeArray(plain.relations),
    virtualCollections: normalizeArray(plain.virtualCollections),
    vocabulary: normalizeArray(plain.vocabulary),
    hierarchicalTags: normalizeArray(plain.hierarchicalTags),
    users: normalizeArray(plain.users).map(normalizePortableUser),
    auditLogs: normalizeArray(plain.auditLogs),
    exportedAt: plain.exportedAt || new Date().toISOString(),
    version: "2.0"
  };
}

async function mergeNormalizedPayload(data: any): Promise<any> {
  await dbPutBatch(STORES.TYPES, data.contentTypes);
  await dbPutBatch(STORES.ITEMS, data.videoItems);
  await dbPutBatch(STORES.HISTORY, data.changeHistory);
  await dbPutBatch(STORES.BOOKMARKS, data.bookmarks);
  await dbPutBatch(STORES.RELATIONS, data.relations);
  await dbPutBatch(STORES.COLLECTIONS, data.virtualCollections);
  await dbPutBatch(STORES.VOCABULARY, data.vocabulary);
  await dbPutBatch(STORES.HTAGS, data.hierarchicalTags);
  await dbPutBatch(STORES.AUDIT_LOGS, data.auditLogs);

  if (data.users.length) {
    await dbPutBatch(STORES.USERS, data.users);
  }

  if (data.settings) {
    const currentSettingsPromise = dbGet(STORES.SETTINGS, "app_settings") as Promise<Record<string, any> | null | undefined>;
    const current = (await currentSettingsPromise.catch(() => ({ key: "app_settings" }))) as Record<string, any>;
    await dbPut(STORES.SETTINGS, {
      ...(current || { key: "app_settings" }),
      ...data.settings,
      key: "app_settings",
      masterPasswordHash: current?.masterPasswordHash,
      initialAdminPassword: undefined
    });
  }

  const snapshot = await getDataSnapshot() as Record<string, any>;
  await writeStorageManifest("دمج ملف مستورد", snapshot);
  return snapshot;
}

export async function importNormalizedPayload(payload: any, mode = "merge"): Promise<any> {
  const normalizedPayload = normalizeBackupData(payload);
  const validation = validateBackupData(normalizedPayload);
  if (!validation.valid) return { success: false, errors: validation.errors };

  const previousSnapshot = await getDataSnapshot() as Record<string, any>;

  try {
    let writeCounts = null;
    if (mode === "replace") {
      writeCounts = await replaceAllData(normalizedPayload);
      await writeStorageManifest("استبدال كامل للبيانات", normalizedPayload);
    } else {
      await mergeNormalizedPayload(normalizedPayload);
    }

    if (mode === "replace" && writeCounts) {
      const expected = {
        contentTypes: normalizedPayload.contentTypes?.length || 0,
        videoItems: normalizedPayload.videoItems?.length || 0,
        virtualCollections: normalizedPayload.virtualCollections?.length || 0,
        vocabulary: normalizedPayload.vocabulary?.length || 0,
        hierarchicalTags: normalizedPayload.hierarchicalTags?.length || 0
      };
      const mismatches = Object.keys(expected)
        .filter((key) => (writeCounts as any)[key] !== (expected as any)[key])
        .map((key) => `${key}: متوقع ${(expected as any)[key]}، مكتوب ${(writeCounts as any)[key]}`);
      if (mismatches.length > 0) {
        throw new Error(`تعارض في عدد السجلات بعد الكتابة (${mismatches.join("، ")})`);
      }
    }

    return { success: true, errors: [], data: normalizedPayload, counts: writeCounts };
  } catch (error: any) {
    try {
      await replaceAllData(previousSnapshot);
      await writeStorageManifest("استرجاع قبل فشل الاستيراد", previousSnapshot);
    } catch {
      // Keep the original import failure visible to the caller.
    }
    return { success: false, errors: [error?.message || "فشل استيراد البيانات وتمت محاولة التراجع"] };
  }
}
