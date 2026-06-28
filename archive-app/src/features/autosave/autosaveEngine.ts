import { createDraft } from "./viewModel.js";

const DEFAULT_INTERVAL_MS = 30000;

export type AutosaveStorage = {
  get: (key: string) => Promise<any>;
  put: (key: string, value: any) => Promise<any>;
  delete: (key: string) => Promise<any>;
};

export type AutosaveEngine = {
  start: (formDataGetter: () => any) => AutosaveEngine;
  stop: () => AutosaveEngine;
  forceSave: (data?: any) => Promise<string>;
  getStatus: () => string;
};

export function createAutosaveEngine({ storage, interval = DEFAULT_INTERVAL_MS, key }: { storage: AutosaveStorage; interval?: number; key: string }): AutosaveEngine {
  if (!storage || typeof storage.put !== "function") {
    throw new Error("autosaveEngine: storage with a put() method is required");
  }
  if (!key) {
    throw new Error("autosaveEngine: a key is required");
  }

  const tickMs = Math.max(1000, Number(interval) || DEFAULT_INTERVAL_MS);
  let status = "idle";
  let timerId: any = null;
  let getFormData: (() => any) | null = null;
  let lastSerialized: string | null = null;
  let beforeUnloadHandler: (() => void) | null = null;

  const setTimer = globalThis.window?.setInterval || globalThis.setInterval;
  const clearTimer = globalThis.window?.clearInterval || globalThis.clearInterval;

  function serialize(data: any) {
    try {
      return JSON.stringify(data ?? null);
    } catch {
      return null;
    }
  }

  async function persist(data: any) {
    const serialized = serialize(data);
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

  const engine: AutosaveEngine = {
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
      return engine;
    },
    stop() {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
      detachBeforeUnload();
      getFormData = null;
      return engine;
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

  return engine;
}
