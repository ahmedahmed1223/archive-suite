import assert from "node:assert/strict";
import {
  DEFAULT_THEME_VERSION,
  THEME_VERSION_STORAGE_KEY,
  getStoredThemeVersion,
  normalizeThemeVersion,
  storeThemeVersion
} from "../src/theme/themeVersionStorage.js";

// Polyfill localStorage on Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

function run(name, fn) {
  try { fn(); console.log("ok -", name); }
  catch (error) { console.error("FAIL -", name, "\n", error); process.exitCode = 1; }
}

run("default version is v4", () => {
  store.clear();
  assert.equal(DEFAULT_THEME_VERSION, "v4");
  assert.equal(getStoredThemeVersion(), "v4");
});

run("normalize accepts v1, v2, v3, and v4, defaults to v4", () => {
  assert.equal(normalizeThemeVersion("v1"), "v1");
  assert.equal(normalizeThemeVersion("v2"), "v2");
  assert.equal(normalizeThemeVersion("v3"), "v3");
  assert.equal(normalizeThemeVersion("v4"), "v4");
  assert.equal(normalizeThemeVersion(null), "v4");
  assert.equal(normalizeThemeVersion(undefined), "v4");
  assert.equal(normalizeThemeVersion(""), "v4");
});

run("explicit v1 choice is preserved (existing users keep classic)", () => {
  store.clear();
  storeThemeVersion("v1");
  assert.equal(getStoredThemeVersion(), "v1");
});

run("explicit v2 choice is preserved (existing users keep modern)", () => {
  store.clear();
  storeThemeVersion("v2");
  assert.equal(getStoredThemeVersion(), "v2");
});

run("storeThemeVersion writes to localStorage", () => {
  store.clear();
  storeThemeVersion("v3");
  assert.equal(store.get(THEME_VERSION_STORAGE_KEY), "v3");
  assert.equal(getStoredThemeVersion(), "v3");
});

run("storeThemeVersion ignores invalid values", () => {
  store.clear();
  storeThemeVersion("v1");
  storeThemeVersion("nonsense");
  // last write should have been a no-op
  assert.equal(store.get(THEME_VERSION_STORAGE_KEY), "v1");
});

run("storage key is namespaced", () => {
  assert.equal(THEME_VERSION_STORAGE_KEY, "videoArchive:themeVersion");
});
