import { createDraft } from "./viewModel.js";

const DEFAULT_INTERVAL_MS = 30000;

/**
 * @typedef {Object} AutosaveStorage
 * @property {(key: string) => Promise<any>} get
 * @property {(key: string, value: any) => Promise<any>} put
 * @property {(key: string) => Promise<any>} delete
 */

/**
 * Creates an autosave engine that periodically persists form state to a
 * storage adapter. The engine is framework-agnostic (pure JS) so it can be
 * driven by a React hook or any other caller.
 *
 * @param {Object} opts
 * @param {AutosaveStorage} opts.storage
 * @param {number} [opts.interval]
 * @param {string} opts.key
 * @returns {{ start: Function, stop: Function, forceSave: Function, getStatus: Function }}
 */
export function createAutosaveEngine({ storage, interval = DEFAULT_INTERVAL_MS, key }) {
  if (!storage || typeof storage.put !== "function") {
    throw new Error("autosaveEngine: storage with a put() method is required");
  }
  if (!key) {
    throw new Error("autosaveEngine: a key is required");
  }

  const tickMs = Math.max(1000, Number(interval) || DEFAULT_INTERVAL_MS);
  let status = "idle";
  let timerId = null;
  let getFormData = null;
  let lastSerialized = null;
  let beforeUnloadHandler = null;

  const setTimer = globalThis.window?.setInterval || globalThis.setInterval;
  const clearTimer = globalThis.window?.clearInterval || globalThis.clearInterval;

  function serialize(data) {
    try {
      return JSON.stringify(data ?? null);
    } catch {
      return null;
    }
  }

  async function persist(data) {
    const serialized = serialize(data);
    // Skip no-op saves so we don't write identical drafts repeatedly.
    if (serialized !== null && serialized === lastSerialized) return;
    status = "saving";
    try {
      const draft = createDraft({ key, formKey: key, data: data && typeof data === "object" ? data : { value: data } });
      await storage.put(key, draft);
      lastSerialized = serialized;
      status = "saved";
    } catch {
      status = "error";
    }
  }

  function attachBeforeUnload() {
    if (typeof globalThis.window?.addEventListener !== "function") return;
    beforeUnloadHandler = () => {
      if (typeof getFormData !== "function") return;
      try {
        const data = getFormData();
        const draft = createDraft({ key, formKey: key, data: data && typeof data === "object" ? data : { value: data } });
        // Fire-and-forget; browsers do not await async work in beforeunload.
        storage.put(key, draft);
      } catch {
        /* swallow: nothing we can surface during unload */
      }
    };
    globalThis.window.addEventListener("beforeunload", beforeUnloadHandler);
  }

  function detachBeforeUnload() {
    if (beforeUnloadHandler && typeof globalThis.window?.removeEventListener === "function") {
      globalThis.window.removeEventListener("beforeunload", beforeUnloadHandler);
    }
    beforeUnloadHandler = null;
  }

  return {
    start(formDataGetter) {
      if (typeof formDataGetter !== "function") {
        throw new Error("autosaveEngine.start: a getFormData function is required");
      }
      getFormData = formDataGetter;
      if (timerId !== null) clearTimer(timerId);
      timerId = setTimer(() => {
        if (typeof getFormData === "function") persist(getFormData());
      }, tickMs);
      attachBeforeUnload();
      status = status === "idle" ? "idle" : status;
      return this;
    },
    stop() {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
      detachBeforeUnload();
      getFormData = null;
      return this;
    },
    async forceSave(data) {
      const payload = data !== undefined ? data : (typeof getFormData === "function" ? getFormData() : null);
      await persist(payload);
      return status;
    },
    getStatus() {
      return status;
    }
  };
}
