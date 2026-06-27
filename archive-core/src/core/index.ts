// Public surface of the storage-agnostic core — the future @archive/core package.
// Kept Node-safe (no JSX/CSS imports) so the verify harness can import it directly.

export {
  getStorageProvider,
  registerStorageProvider,
  getFileStore,
  registerFileStore,
  getAuthProvider,
  registerAuthProvider,
  getSessionProvider,
  registerSessionProvider,
  getSyncProvider,
  registerSyncProvider,
  getAiProvider,
  registerAiProvider
} from "../storage/index.js";

export { STORAGE_PROVIDER_METHODS, isStorageProvider } from "../storage/ports/StorageProvider.js";
export { FILE_STORE_METHODS, isFileStore } from "../storage/ports/FileStore.js";
export { AUTH_PROVIDER_METHODS, isAuthProvider } from "../storage/ports/AuthProvider.js";
export { SESSION_PROVIDER_METHODS, isSessionProvider } from "../storage/ports/SessionProvider.js";
export { SYNC_PROVIDER_METHODS, isSyncProvider } from "../storage/ports/SyncProvider.js";
export { AI_PROVIDER_METHODS, isAiProvider } from "../storage/ports/AiProvider.js";

export { normalizeArabic } from "../utils/arabicNormalize.js";
