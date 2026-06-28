import { describe, it, expect, beforeEach } from "vitest";

import { STORES } from "../../../services/storage/schema.js";
import { createFirestoreProvider, isFirebaseConfigValid } from "./index.js";

function createFakeFirestore() {
  const store = new Map<string, Record<string, unknown>>();

  function key(path: string, id: string) {
    return `${path}/${id}`;
  }

  const fs = {
    getFirestore: () => ({ store }),
    doc: (_db: unknown, path: string, id: string) => ({ kind: "doc", path, id }),
    collection: (_db: unknown, path: string) => ({ kind: "collection", path }),
    async getDoc(ref: { path: string; id: string }) {
      const data = store.get(key(ref.path, ref.id));
      return {
        exists: () => data !== undefined,
        data: () => data
      };
    },
    async getDocs(ref: { path: string }) {
      const entries: Array<{ id: string; data: () => Record<string, unknown> }> = [];
      for (const [k, value] of store.entries()) {
        const [collPath, id] = splitKey(k);
        if (collPath === ref.path) entries.push({ id, data: () => value });
      }
      return { forEach: (cb: (entry: { id: string; data: () => Record<string, unknown> }) => void) => entries.forEach(cb) };
    },
    async setDoc(ref: { path: string; id: string }, data: Record<string, unknown>) {
      store.set(key(ref.path, ref.id), data);
    },
    async deleteDoc(ref: { path: string; id: string }) {
      store.delete(key(ref.path, ref.id));
    },
    writeBatch() {
      const ops: Array<() => void> = [];
      return {
        set: (ref: { path: string; id: string }, data: Record<string, unknown>) => ops.push(() => store.set(key(ref.path, ref.id), data)),
        delete: (ref: { path: string; id: string }) => ops.push(() => store.delete(key(ref.path, ref.id))),
        async commit() {
          ops.forEach((op) => op());
        }
      };
    }
  };

  return { fs, store };
}

function splitKey(k: string) {
  const idx = k.lastIndexOf("/");
  return [k.slice(0, idx), k.slice(idx + 1)];
}

const CONFIG = { apiKey: "k", projectId: "p", appId: "a" };

function makeProvider() {
  const { fs, store } = createFakeFirestore();
  const appModule = { initializeApp: (cfg: unknown) => ({ cfg }) };
  const provider = createFirestoreProvider({
    firebaseConfig: CONFIG,
    firebaseAppModule: appModule,
    firestoreModule: fs
  });
  return { provider, store };
}

describe("isFirebaseConfigValid", () => {
  it("accepts a config with apiKey, projectId and appId", () => {
    expect(isFirebaseConfigValid(CONFIG)).toBe(true);
  });

  it("rejects missing or non-object configs", () => {
    expect(isFirebaseConfigValid(null)).toBe(false);
    expect(isFirebaseConfigValid({ apiKey: "k" })).toBe(false);
    expect(isFirebaseConfigValid({ apiKey: "", projectId: "p", appId: "a" })).toBe(false);
  });
});

describe("createFirestoreProvider", () => {
  it("throws on an invalid config", () => {
    expect(() => createFirestoreProvider({ firebaseConfig: { apiKey: "k" } })).toThrow();
  });

  it("exposes the firebase engine tag", () => {
    const { provider } = makeProvider();
    expect(provider.engine).toBe("firebase");
  });
});

describe("Firestore CRUD", () => {
  let provider: ReturnType<typeof createFirestoreProvider>;
  let store: Map<string, Record<string, unknown>>;

  beforeEach(() => {
    ({ provider, store } = makeProvider());
  });

  it("put then get round-trips a record into the store-named collection", async () => {
    await provider.put(STORES.ITEMS, { id: "v-1", title: "first" });
    expect(store.get("video_items/v-1")).toEqual({ id: "v-1", title: "first" });
    expect(await provider.get(STORES.ITEMS, "v-1")).toEqual({ id: "v-1", title: "first" });
  });

  it("get returns undefined for a missing record", async () => {
    expect(await provider.get(STORES.ITEMS, "missing")).toBeUndefined();
  });

  it("add throws on a duplicate id", async () => {
    await provider.add(STORES.ITEMS, { id: "dup", title: "x" });
    await expect(provider.add(STORES.ITEMS, { id: "dup", title: "y" })).rejects.toThrow(/dup/);
  });

  it("delete removes a record", async () => {
    await provider.put(STORES.ITEMS, { id: "d-1" });
    await provider.delete(STORES.ITEMS, "d-1");
    expect(await provider.get(STORES.ITEMS, "d-1")).toBeUndefined();
  });

  it("putBatch writes many records and getAll reads them back", async () => {
    await provider.putBatch(STORES.ITEMS, [{ id: "a" }, { id: "b" }, null]);
    const all = await provider.getAll(STORES.ITEMS);
    expect(all.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("clear empties a collection", async () => {
    await provider.putBatch(STORES.ITEMS, [{ id: "a" }, { id: "b" }]);
    await provider.clear(STORES.ITEMS);
    expect(await provider.getAll(STORES.ITEMS)).toEqual([]);
  });

  it("settings records use the key field as the doc id", async () => {
    await provider.put(STORES.SETTINGS, { key: "app_settings", theme: "dark" });
    expect(store.get("app_settings/app_settings")).toEqual({ key: "app_settings", theme: "dark" });
  });
});

describe("snapshot and replaceAll", () => {
  it("replaceAll then snapshot preserves data and settings", async () => {
    const { provider } = makeProvider();
    await provider.replaceAll({
      videoItems: [{ id: "v-1" }, { id: "v-2" }],
      contentTypes: [{ id: "t-1" }],
      settings: { theme: "light" }
    });

    const snap = await provider.snapshot();
    expect((snap.videoItems as Array<{ id: string }>).map((r) => r.id).sort()).toEqual(["v-1", "v-2"]);
    expect((snap.contentTypes as Array<unknown>)).toHaveLength(1);
    expect((snap.settings as { theme: string }).theme).toBe("light");
    expect(snap.version).toBe("2.0");
  });

  it("replaceAll clears prior data first", async () => {
    const { provider } = makeProvider();
    await provider.put(STORES.ITEMS, { id: "old" });
    await provider.replaceAll({ videoItems: [{ id: "new" }] });
    const all = await provider.getAll(STORES.ITEMS);
    expect(all.map((r) => r.id)).toEqual(["new"]);
  });
});
