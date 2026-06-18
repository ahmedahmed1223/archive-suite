import { setBackendChoice } from "./backendChoice.js";
import { registerByBackendChoice as defaultRegisterByBackendChoice } from "./registerByBackendChoice.js";
import { useAppStore } from "../stores/index.js";
import { getStorageProvider as defaultGetStorageProvider } from "@archive/core";

/**
 * Switch the SPA backend at runtime without a page reload.
 *
 * Sequence:
 *  1. Persist the new choice to localStorage
 *  2. Re-register all @archive/core providers with the new adapters
 *  3. Reload all data from the new backend
 *
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function switchBackendHot(backend, url = "", localEngineOrOptions = undefined) {
  const options = localEngineOrOptions && typeof localEngineOrOptions === "object"
    ? localEngineOrOptions
    : { localEngine: localEngineOrOptions };
  const {
    storage,
    localEngine,
    firebaseConfig,
    migrate = false,
    registerByBackendChoice = defaultRegisterByBackendChoice,
    getStorageProvider = defaultGetStorageProvider,
    getNewStorageProvider = defaultGetStorageProvider,
    loadAllData = useAppStore.getState().loadAllData
  } = options;

  let snapshot = null;
  if (migrate) {
    try {
      const currentProvider = getStorageProvider();
      if (typeof currentProvider?.snapshot === "function") {
        snapshot = await currentProvider.snapshot();
      }
    } catch (err) {
      return { ok: false, error: err?.message || "تعذّر أخذ لقطة من الباكند الحالي." };
    }
  }

  const saved = setBackendChoice(backend, url, {
    ...(storage ? { storage } : {}),
    ...(localEngine !== undefined ? { localEngine } : {}),
    ...(firebaseConfig ? { firebaseConfig } : {})
  });
  if (!saved) {
    return { ok: false, error: "تعذّر حفظ اختيار الباكند في localStorage." };
  }

  try {
    registerByBackendChoice(storage ? { storage } : {});
  } catch (err) {
    return { ok: false, error: err?.message || "تعذّر تسجيل مزوّد الباكند." };
  }

  if (migrate && snapshot) {
    try {
      const nextProvider = getNewStorageProvider();
      if (typeof nextProvider?.replaceAll !== "function") {
        return { ok: false, error: "الباكند الجديد لا يدعم استيراد اللقطة." };
      }
      await nextProvider.replaceAll(snapshot);
    } catch (err) {
      return { ok: false, error: err?.message || "تعذّر ترحيل البيانات إلى الباكند الجديد." };
    }
  }

  try {
    if (typeof loadAllData === "function") {
      await loadAllData();
    }
  } catch (err) {
    return { ok: false, error: err?.message || "تعذّر تحميل البيانات من الباكند الجديد." };
  }

  return { ok: true };
}
