import { STORES, dbPut, dbPutBatch } from "../services/storageAccess.js";
import { createPortableArchivePayload } from "../services/data-portability/payload.js";

type StoreState = Record<string, any> & {
  videoItems?: any[];
  virtualCollections?: Array<{ id: string; itemIds?: string[] }>;
};

export async function persistSettings(settings: Record<string, any>) {
  await (dbPut as any)(STORES.SETTINGS, { ...settings, key: "app_settings" });
}

export async function persistList(storeName: string, records: any[]) {
  await (dbPutBatch as any)(storeName, records);
}

export function makeExportPayload(state: StoreState, options: Record<string, any> = {}) {
  let videoItems = state.videoItems || [];
  if (options.typeFilter && options.typeFilter !== "all") {
    videoItems = videoItems.filter((item) => item.type === options.typeFilter);
  }
  if (options.collectionFilter && options.collectionFilter !== "all") {
    const collection = state.virtualCollections?.find((item) => item.id === options.collectionFilter);
    const ids = new Set(collection?.itemIds || []);
    videoItems = videoItems.filter((item) => ids.has(item.id));
  }
  if (options.favoritesOnly) videoItems = videoItems.filter((item) => item.isFavorite);
  return createPortableArchivePayload({ ...state, videoItems });
}
