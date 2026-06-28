import * as React from "react";

type StorePatch<TState> = Partial<TState> | ((state: TState) => Partial<TState> | TState | null | undefined);

export type StoreGetter<TState> = () => TState;
export type StoreSetter<TState> = (partial: StorePatch<TState>) => void;
export type StoreSubscriber = () => void;

export type StoreHook<TState> = {
  (selector?: (state: TState) => any): any;
  getState: StoreGetter<TState>;
  setState: StoreSetter<TState>;
  subscribe: (listener: StoreSubscriber) => () => void;
};

/**
 * Shallow-merge setState (Zustand-style): top-level keys are merged, nested
 * objects are REPLACED in full. When you need to patch a nested field without
 * clobbering its siblings use deepMerge() or spread manually:
 *   setState(s => ({ settings: { ...s.settings, theme: "dark" } }))
 * or:
 *   setState(deepMerge({ settings: { theme: "dark" } }))
 */
export function createStore<TState extends Record<string, any>>(
  initializer: (set: StoreSetter<TState>, get: StoreGetter<TState>) => TState
): StoreHook<TState> {
  let state: TState;
  const listeners = new Set<StoreSubscriber>();

  const setState: StoreSetter<TState> = (partial) => {
    const patch = typeof partial === "function" ? partial(state) : partial;
    if (!patch || typeof patch !== "object") return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const getState: StoreGetter<TState> = () => state;
  const subscribe = (listener: StoreSubscriber) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const useStore = ((selector = (value: TState) => value) => {
    const snapshot = React.useSyncExternalStore(subscribe, getState, getState);
    return selector(snapshot);
  }) as StoreHook<TState>;

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

export function pickStoreActions<TState extends Record<string, any>>(state: TState, keys: readonly string[]) {
  return keys.reduce<Record<string, any>>((actions, key) => {
    if (typeof state?.[key] === "function") actions[key] = state[key];
    return actions;
  }, {});
}

/**
 * Returns a setState-compatible updater that deep-merges `patch` into the
 * current store state, preserving sibling keys at every nesting level.
 */
export function deepMerge<TPatch extends Record<string, any>>(patch: TPatch) {
  return <TState extends Record<string, any>>(state: TState) => _deepMergeObjects(state, patch);
}

function isPlainObject(val: unknown): val is Record<string, any> {
  if (val === null || typeof val !== "object") return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

function _deepMergeObjects<TTarget extends Record<string, any>, TSource extends Record<string, any>>(
  target: TTarget,
  source: TSource
): TTarget & TSource {
  const result: Record<string, any> = { ...target };
  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      result[key] = _deepMergeObjects(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result as TTarget & TSource;
}
