import * as React from "react";

/**
 * Shallow-merge setState (Zustand-style): top-level keys are merged, nested
 * objects are REPLACED in full.  When you need to patch a nested field without
 * clobbering its siblings use deepMerge() or spread manually:
 *   setState(s => ({ settings: { ...s.settings, theme: "dark" } }))
 * or:
 *   setState(deepMerge({ settings: { theme: "dark" } }))
 */
export function createStore(initializer) {
  let state;
  const listeners = new Set();

  const setState = (partial) => {
    const patch = typeof partial === "function" ? partial(state) : partial;
    if (!patch || typeof patch !== "object") return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const getState = () => state;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const useStore = (selector = (value) => value) => {
    const snapshot = React.useSyncExternalStore(subscribe, getState, getState);
    return selector(snapshot);
  };

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;
  state = initializer(setState, getState);
  return useStore;
}

export function generateId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function pickStoreActions(state, keys) {
  return keys.reduce((actions, key) => {
    if (typeof state?.[key] === "function") actions[key] = state[key];
    return actions;
  }, {});
}

/**
 * Returns a setState-compatible updater that deep-merges `patch` into the
 * current store state, preserving sibling keys at every nesting level.
 *
 * Only plain objects are merged; arrays, Dates, class instances, and primitives
 * are replaced wholesale (same semantics as Object.assign for non-plain values).
 *
 * Usage:
 *   store.setState(deepMerge({ settings: { theme: "dark" } }))
 *   // → { ...prevState, settings: { ...prevState.settings, theme: "dark" } }
 *
 * @param {object} patch
 * @returns {(state: object) => object}
 */
export function deepMerge(patch) {
  return (state) => _deepMergeObjects(state, patch);
}

function isPlainObject(val) {
  if (val === null || typeof val !== "object") return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

function _deepMergeObjects(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      result[key] = _deepMergeObjects(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
