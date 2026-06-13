import { setBackendChoice } from "./backendChoice.js";
import { registerByBackendChoice } from "./registerByBackendChoice.js";
import { useAppStore } from "../stores/index.js";

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
export async function switchBackendHot(backend, url = "", localEngine = undefined) {
  const saved = setBackendChoice(backend, url, localEngine !== undefined ? { localEngine } : {});
  if (!saved) {
    return { ok: false, error: "تعذّر حفظ اختيار الباكند في localStorage." };
  }

  try {
    registerByBackendChoice();
  } catch (err) {
    return { ok: false, error: err?.message || "تعذّر تسجيل مزوّد الباكند." };
  }

  try {
    const loadAllData = useAppStore.getState().loadAllData;
    if (typeof loadAllData === "function") {
      await loadAllData();
    }
  } catch (err) {
    return { ok: false, error: err?.message || "تعذّر تحميل البيانات من الباكند الجديد." };
  }

  return { ok: true };
}
