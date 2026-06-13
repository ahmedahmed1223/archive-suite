import {
  STORES,
  dbPut,
  dbPutBatch
} from "../services/storageAccess.js";
import { createPortableArchivePayload } from "../services/data-portability/payload.js";

export async function persistSettings(settings) {
  await dbPut(STORES.SETTINGS, { ...settings, key: "app_settings" });
}

export async function persistList(storeName, records) {
  await dbPutBatch(storeName, records);
}

export function makeExportPayload(state, options = {}) {
  let videoItems = state.videoItems || [];
  if (options.typeFilter && options.typeFilter !== "all") {
    videoItems = videoItems.filter((item) => item.type === options.typeFilter);
  }
  if (options.collectionFilter && options.collectionFilter !== "all") {
    const collection = state.virtualCollections.find((item) => item.id === options.collectionFilter);
    const ids = new Set(collection?.itemIds || []);
    videoItems = videoItems.filter((item) => ids.has(item.id));
  }
  if (options.favoritesOnly) videoItems = videoItems.filter((item) => item.isFavorite);
  return createPortableArchivePayload({ ...state, videoItems });
}
