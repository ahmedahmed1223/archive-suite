import { setBackendChoice } from "./backendChoice.js";
import { registerByBackendChoice as defaultRegisterByBackendChoice } from "./registerByBackendChoice.js";
import { useAppStore } from "../stores/index.js";
import { getStorageProvider as defaultGetStorageProvider } from "@archive/core";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type SwitchBackendHotOptions = {
  storage?: StorageLike | null;
  localEngine?: unknown;
  firebaseConfig?: unknown;
  migrate?: boolean;
  registerByBackendChoice?: (options?: { storage?: StorageLike | null }) => unknown;
  getStorageProvider?: () => any;
  getNewStorageProvider?: () => any;
  loadAllData?: () => Promise<unknown> | unknown;
};

export async function switchBackendHot(
  backend: string,
  url = "",
  localEngineOrOptions: unknown = undefined
): Promise<{ ok: boolean; error?: string }> {
  const options =
    localEngineOrOptions && typeof localEngineOrOptions === "object"
      ? (localEngineOrOptions as SwitchBackendHotOptions)
      : { localEngine: localEngineOrOptions } as SwitchBackendHotOptions;
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
  const getStorageProviderSafe = getStorageProvider as () => any;
  const getNewStorageProviderSafe = getNewStorageProvider as () => any;

  let snapshot: unknown = null;
  if (migrate) {
    try {
      const currentProvider = getStorageProviderSafe();
      if (typeof currentProvider?.snapshot === "function") {
        snapshot = await currentProvider.snapshot();
      }
    } catch (err) {
      return { ok: false, error: (err as { message?: string } | null)?.message || "تعذّر أخذ لقطة من الباكند الحالي." };
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
    return { ok: false, error: (err as { message?: string } | null)?.message || "تعذّر تسجيل مزوّد الباكند." };
  }

  if (migrate && snapshot) {
    try {
      const nextProvider = getNewStorageProviderSafe();
      if (typeof nextProvider?.replaceAll !== "function") {
        return { ok: false, error: "الباكند الجديد لا يدعم استيراد اللقطة." };
      }
      await nextProvider.replaceAll(snapshot);
    } catch (err) {
      return { ok: false, error: (err as { message?: string } | null)?.message || "تعذّر ترحيل البيانات إلى الباكند الجديد." };
    }
  }

  try {
    if (typeof loadAllData === "function") {
      await loadAllData();
    }
  } catch (err) {
    return { ok: false, error: (err as { message?: string } | null)?.message || "تعذّر تحميل البيانات من الباكند الجديد." };
  }

  return { ok: true };
}
