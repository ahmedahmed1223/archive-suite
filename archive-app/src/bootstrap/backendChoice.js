// Backend choice — single source of truth for which storage backend the
// SPA wires through @archive/core. Read by the boot path, written by the
// setup wizard (B3 UI integration, follow-up session).
//
// Stored in localStorage so the choice survives reloads without depending
// on the store (which itself needs a backend to load…). The offline SPA
// defaults to "local"; the cloud build defaults to "postgres" same-origin so
// skipping onboarding never silently falls back to IndexedDB.
//
// Possible values:
//   "local"      — IndexedDB via local-indexeddb adapter (default).
//   "pocketbase" — PocketBase server reached over fetch. Requires a URL.
//   "postgres"   — Postgres via a server-side REST API. Requires a URL.
//                  Not wired in the SPA yet — needs a follow-up sub-project
//                  that ships the REST API in archive-server.
//   "firebase"   — Firestore/Auth/Storage reached client-side over HTTPS.
//                  Requires a firebaseConfig (apiKey/projectId/appId/…).
//                  Works inside the AI Studio iframe because no user-owned
//                  server is involved.

export const BACKEND_CHOICES = Object.freeze(["local", "pocketbase", "postgres", "firebase"]);
export const LOCAL_ENGINES = Object.freeze(["indexeddb", "sqlite"]);
export const DEFAULT_BACKEND = "local";
export const DEFAULT_CLOUD_BACKEND = "postgres";
export const DEFAULT_LOCAL_ENGINE = "indexeddb";
const STORAGE_KEY = "va.backendChoice.v1";

/** Reads the persisted choice, with fallbacks for AI Studio and SSR. */
export function getBackendChoice({ storage = safeLocalStorage() } = {}) {
  const fallback = getDefaultBackend();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return normalizeBackendChoice(parsed?.backend, fallback);
  } catch {
    return fallback;
  }
}

/** Reads the persisted URL for backends that need one (pocketbase/postgres). */
export function getBackendUrl({ storage = safeLocalStorage() } = {}) {
  if (!storage) return "";
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return typeof parsed?.url === "string" ? parsed.url : "";
  } catch {
    return "";
  }
}

/** Reads the persisted firebaseConfig for the firebase backend (or null). */
export function getFirebaseConfig({ storage = safeLocalStorage() } = {}) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const config = parsed?.firebaseConfig;
    return config && typeof config === "object" ? config : null;
  } catch {
    return null;
  }
}

export function getLocalEngine({ storage = safeLocalStorage() } = {}) {
  if (!storage) return DEFAULT_LOCAL_ENGINE;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_ENGINE;
    const parsed = JSON.parse(raw);
    return normalizeLocalEngine(parsed?.localEngine);
  } catch {
    return DEFAULT_LOCAL_ENGINE;
  }
}

/** Persists choice + url atomically (so we don't end up with mismatched pair). */
export function setBackendChoice(backend, url = "", { storage = safeLocalStorage(), localEngine = DEFAULT_LOCAL_ENGINE, firebaseConfig = null } = {}) {
  if (!storage) return false;
  const normalized = normalizeBackendChoice(backend);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      backend: normalized,
      url: normalized === "local" ? "" : String(url || ""),
      localEngine: normalizeLocalEngine(localEngine),
      firebaseConfig: normalized === "firebase" && firebaseConfig && typeof firebaseConfig === "object"
        ? firebaseConfig
        : null
    }));
    return true;
  } catch {
    return false;
  }
}

/** Strict normalizer — any unknown value falls back to the default. */
export function normalizeBackendChoice(value, fallback = getDefaultBackend()) {
  return BACKEND_CHOICES.includes(value) ? value : fallback;
}

export function normalizeLocalEngine(value) {
  return LOCAL_ENGINES.includes(String(value || "").toLowerCase()) ? String(value).toLowerCase() : DEFAULT_LOCAL_ENGINE;
}

/**
 * Whether to *force* the local backend regardless of stored choice.
 *
 * Cloud-only direction: no build target forces local boot anymore (the AI Studio
 * target was removed), so this is always false. Kept as a stable seam in case a
 * future target needs to force local boot.
 */
export function shouldForceLocalBackend() {
  return false;
}

export function getDefaultBackend() {
  if (getBuildTarget() === "cloud") return DEFAULT_CLOUD_BACKEND;
  return DEFAULT_BACKEND;
}

function getBuildTarget() {
  try {
    if (typeof __VITE_TARGET__ !== "undefined") return __VITE_TARGET__;
  } catch {}
  try {
    if (typeof globalThis !== "undefined" && typeof globalThis.__VITE_TARGET__ === "string") {
      return globalThis.__VITE_TARGET__;
    }
  } catch {}
  return "spa";
}

/** Resolves what the boot should *actually* use, given saved + runtime context. */
export function resolveBackendChoice(options = {}) {
  if (shouldForceLocalBackend()) {
    const backend = getBackendChoice(options);
    const firebaseConfig = getFirebaseConfig(options);
    if (backend === "firebase" && isFirebaseConfigUsable(firebaseConfig)) {
      return { backend: "firebase", url: "", localEngine: getLocalEngine(options), firebaseConfig, forced: true };
    }
    return { backend: "local", url: "", localEngine: getLocalEngine(options), forced: true };
  }
  return {
    backend: getBackendChoice(options),
    url: getBackendUrl(options),
    localEngine: getLocalEngine(options),
    firebaseConfig: getFirebaseConfig(options),
    forced: false
  };
}

function isFirebaseConfigUsable(config) {
  return Boolean(
    config &&
    typeof config === "object" &&
    String(config.apiKey || "").trim() &&
    String(config.projectId || "").trim() &&
    String(config.appId || "").trim()
  );
}

function safeLocalStorage() {
  // Browsers in private mode or hostile iframes can throw on access; node
  // tests don't have localStorage at all. Return null and let callers fall
  // back to defaults.
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {}
  return null;
}
