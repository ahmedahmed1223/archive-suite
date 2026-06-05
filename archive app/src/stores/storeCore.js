import * as React from "react";

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
