import { describe, it, expect, beforeEach } from "vitest";

import { STORES } from "../../../services/storage/schema.js";
import { createFirestoreProvider, isFirebaseConfigValid } from "./index.js";

// Minimal in-memory Firestore double. Docs live in a flat Map keyed by
// `${collectionPath}/${docId}`. Refs are plain { path, id } objects; the module
// functions (doc/collection/getDoc/...) operate on that Map. This lets us
// exercise the whole adapter without the real firebase SDK.
function createFakeFirestore() {
  const store = new Map();

  function key(path, id) {
    return `${path}/${id}`;
  }

  const fs = {
    getFirestore: () => ({ store }),
    doc: (_db, path, id) => ({ kind: "doc", path, id }),
    collection: (_db, path) => ({ kind: "collection", path }),
    async getDoc(ref) {
      const data = store.get(key(ref.path, ref.id));
      return {
        exists: () => data !== undefined,
        data: () => data
      };
    },
    async getDocs(ref) {
      const entries = [];
      for (const [k, value] of store.entries()) {
        const [collPath, id] = splitKey(k);
        if (collPath === ref.path) entries.push({ id, data: () => value });
      }
      return { forEach: (cb) => entries.forEach(cb) };
    },
    async setDoc(ref, data) {
      store.set(key(ref.path, ref.id), data);
    },
    async deleteDoc(ref) {
      store.delete(key(ref.path, ref.id));
    },
    writeBatch() {
      const ops = [];
      return {
        set: (ref, data) => ops.push(() => store.set(key(ref.path, ref.id), data)),
        delete: (ref) => ops.push(() => store.delete(key(ref.path, ref.id))),
        async commit() {
          ops.forEach((op) => op());
        }
      };
    }
  };

  return { fs, store };
}

function splitKey(k) {
  const idx = k.lastIndexOf("/");
  return [k.slice(0, idx), k.slice(idx + 1)];
}

const CONFIG = { apiKey: "k", projectId: "p", appId: "a" };

function makeProvider() {
  const { fs, store } = createFakeFirestore();
  const appModule = { initializeApp: (cfg) => ({ cfg }) };
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
  let provider;
  let store;

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
    expect(snap.videoItems.map((r) => r.id).sort()).toEqual(["v-1", "v-2"]);
    expect(snap.contentTypes).toHaveLength(1);
    expect(snap.settings.theme).toBe("light");
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
