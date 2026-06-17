import { describe, it, expect } from "vitest";

import { STORES } from "../../../services/storage/schema.js";
import {
  collectionNameForStore,
  keyPathForStore,
  recordKey,
  recordToDoc,
  docToRecord,
  sanitizeDocId,
  DATA_STORES,
  SNAPSHOT_STORES
} from "./firestoreMapping.js";

describe("keyPathForStore", () => {
  it("uses 'key' for the settings store", () => {
    expect(keyPathForStore(STORES.SETTINGS)).toBe("key");
  });

  it("defaults to 'id' for data stores", () => {
    expect(keyPathForStore(STORES.ITEMS)).toBe("id");
    expect(keyPathForStore("anything_else")).toBe("id");
  });
});

describe("collectionNameForStore", () => {
  it("maps a store name 1:1 to a collection name", () => {
    expect(collectionNameForStore(STORES.ITEMS)).toBe("video_items");
  });

  it("prefixes the collection when a namespace is supplied", () => {
    expect(collectionNameForStore(STORES.ITEMS, "ws_alice")).toBe("ws_alice__video_items");
  });

  it("throws on an empty store name", () => {
    expect(() => collectionNameForStore("")).toThrow();
  });
});

describe("sanitizeDocId", () => {
  it("replaces slashes so ids stay flat", () => {
    expect(sanitizeDocId("a/b/c")).toBe("a__b__c");
  });

  it("stringifies non-string keys", () => {
    expect(sanitizeDocId(42)).toBe("42");
  });

  it("throws on an empty id", () => {
    expect(() => sanitizeDocId("")).toThrow();
    expect(() => sanitizeDocId(null)).toThrow();
  });
});

describe("recordKey", () => {
  it("derives the id-based key for data stores", () => {
    expect(recordKey(STORES.ITEMS, { id: "v-1" })).toBe("v-1");
  });

  it("derives the key-based key for the settings store", () => {
    expect(recordKey(STORES.SETTINGS, { key: "app_settings" })).toBe("app_settings");
  });

  it("sanitizes slashes in the derived key", () => {
    expect(recordKey(STORES.ITEMS, { id: "a/b" })).toBe("a__b");
  });

  it("throws when the key field is missing", () => {
    expect(() => recordKey(STORES.ITEMS, {})).toThrow(/video_items/);
    expect(() => recordKey(STORES.ITEMS, { id: "" })).toThrow();
  });
});

describe("recordToDoc", () => {
  it("returns a new object preserving fields", () => {
    const record = { id: "x", title: "t", tags: ["a"] };
    const doc = recordToDoc(record);
    expect(doc).toEqual(record);
    expect(doc).not.toBe(record);
  });

  it("drops undefined fields but keeps null", () => {
    const doc = recordToDoc({ id: "x", a: undefined, b: null, c: 0 });
    expect(doc).toEqual({ id: "x", b: null, c: 0 });
    expect("a" in doc).toBe(false);
  });

  it("throws on a non-object record", () => {
    expect(() => recordToDoc(null)).toThrow();
    expect(() => recordToDoc("nope")).toThrow();
  });
});

describe("docToRecord", () => {
  it("clones doc data into a record", () => {
    const data = { id: "x", title: "t" };
    const record = docToRecord(data);
    expect(record).toEqual(data);
    expect(record).not.toBe(data);
  });

  it("returns undefined for missing data", () => {
    expect(docToRecord(null)).toBeUndefined();
    expect(docToRecord(undefined)).toBeUndefined();
  });
});

describe("store constants", () => {
  it("DATA_STORES are all real store names", () => {
    const known = new Set(Object.values(STORES));
    for (const store of DATA_STORES) expect(known.has(store)).toBe(true);
  });

  it("SNAPSHOT_STORES map payload keys to real stores", () => {
    const known = new Set(Object.values(STORES));
    for (const store of Object.values(SNAPSHOT_STORES)) expect(known.has(store)).toBe(true);
    expect(SNAPSHOT_STORES.videoItems).toBe(STORES.ITEMS);
    expect(SNAPSHOT_STORES.users).toBe(STORES.USERS);
  });
});
