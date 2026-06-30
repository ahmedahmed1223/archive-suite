export const BACKEND_CHOICES = Object.freeze(["local", "pocketbase", "postgres", "sqlserver", "firebase"] as const);
export const LOCAL_ENGINES = Object.freeze(["indexeddb", "sqlite"] as const);
export const DEFAULT_BACKEND = "local";
export const DEFAULT_CLOUD_BACKEND = "postgres";
export const DEFAULT_LOCAL_ENGINE = "indexeddb";
const STORAGE_KEY = "va.backendChoice.v1";

export type BackendChoice = (typeof BACKEND_CHOICES)[number];
export type LocalEngine = (typeof LOCAL_ENGINES)[number];

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

interface BackendChoiceRecord {
  backend?: unknown;
  url?: unknown;
  localEngine?: unknown;
  firebaseConfig?: unknown;
}

function safeLocalStorage(): StorageLike | null {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage as unknown as StorageLike;
    }
  } catch {
    // ignored
  }
  return null;
}

export function getBackendChoice({ storage = safeLocalStorage() }: { storage?: StorageLike | null } = {}): BackendChoice {
  const fallback = getDefaultBackend();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as BackendChoiceRecord;
    return normalizeBackendChoice(parsed?.backend, fallback);
  } catch {
    return fallback;
  }
}

export function getBackendUrl({ storage = safeLocalStorage() }: { storage?: StorageLike | null } = {}): string {
  if (!storage) return "";
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as BackendChoiceRecord;
    return typeof parsed?.url === "string" ? parsed.url : "";
  } catch {
    return "";
  }
}

export function getFirebaseConfig({ storage = safeLocalStorage() }: { storage?: StorageLike | null } = {}): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BackendChoiceRecord;
    const config = parsed?.firebaseConfig;
    return config && typeof config === "object" ? config : null;
  } catch {
    return null;
  }
}

export function getLocalEngine({ storage = safeLocalStorage() }: { storage?: StorageLike | null } = {}): LocalEngine {
  if (!storage) return DEFAULT_LOCAL_ENGINE;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_ENGINE;
    const parsed = JSON.parse(raw) as BackendChoiceRecord;
    return normalizeLocalEngine(parsed?.localEngine);
  } catch {
    return DEFAULT_LOCAL_ENGINE;
  }
}

export function setBackendChoice(
  backend: unknown,
  url = "",
  {
    storage = safeLocalStorage(),
    localEngine = DEFAULT_LOCAL_ENGINE,
    firebaseConfig = null
  }: { storage?: StorageLike | null; localEngine?: unknown; firebaseConfig?: unknown } = {}
): boolean {
  if (!storage) return false;
  const normalized = normalizeBackendChoice(backend);
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        backend: normalized,
        url: normalized === "local" ? "" : String(url || ""),
        localEngine: normalizeLocalEngine(localEngine),
        firebaseConfig: normalized === "firebase" && firebaseConfig && typeof firebaseConfig === "object" ? firebaseConfig : null
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function normalizeBackendChoice(value: unknown, fallback: BackendChoice = getDefaultBackend()): BackendChoice {
  return BACKEND_CHOICES.includes(value as BackendChoice) ? (value as BackendChoice) : fallback;
}

export function normalizeLocalEngine(value: unknown): LocalEngine {
  const normalized = String(value || "").toLowerCase();
  return LOCAL_ENGINES.includes(normalized as LocalEngine) ? (normalized as LocalEngine) : DEFAULT_LOCAL_ENGINE;
}

export function shouldForceLocalBackend(): boolean {
  return false;
}

export function getDefaultBackend(): BackendChoice {
  if (getBuildTarget() === "cloud") return DEFAULT_CLOUD_BACKEND;
  return DEFAULT_BACKEND;
}

function getBuildTarget(): string {
  try {
    const globalTarget = globalThis as typeof globalThis & { __VITE_TARGET__?: string };
    if (typeof globalTarget.__VITE_TARGET__ !== "undefined") return globalTarget.__VITE_TARGET__ as string;
  } catch {
    // ignored
  }
  try {
    const globalTarget = globalThis as typeof globalThis & { __VITE_TARGET__?: string };
    if (typeof globalTarget.__VITE_TARGET__ === "string") {
      return globalTarget.__VITE_TARGET__;
    }
  } catch {
    // ignored
  }
  return "spa";
}

export function resolveBackendChoice(options: { storage?: StorageLike | null } = {}): {
  backend: BackendChoice;
  url: string;
  localEngine: LocalEngine;
  firebaseConfig: unknown;
  forced: boolean;
} {
  if (shouldForceLocalBackend()) {
    const backend = getBackendChoice(options);
    const firebaseConfig = getFirebaseConfig(options);
    if (backend === "firebase" && isFirebaseConfigUsable(firebaseConfig)) {
      return { backend: "firebase", url: "", localEngine: getLocalEngine(options), firebaseConfig, forced: true };
    }
    return { backend: "local", url: "", localEngine: getLocalEngine(options), forced: true, firebaseConfig: null };
  }
  return {
    backend: getBackendChoice(options),
    url: getBackendUrl(options),
    localEngine: getLocalEngine(options),
    firebaseConfig: getFirebaseConfig(options),
    forced: false
  };
}

function isFirebaseConfigUsable(config: unknown): boolean {
  return Boolean(
    config &&
      typeof config === "object" &&
      String((config as Record<string, unknown>).apiKey || "").trim() &&
      String((config as Record<string, unknown>).projectId || "").trim() &&
      String((config as Record<string, unknown>).appId || "").trim()
  );
}
