import assert from "node:assert/strict";
import { isStorageProvider, STORAGE_PROVIDER_METHODS } from "@archive/core";
import { createPocketBaseStorageProvider } from "../src/adapters/cloud-pocketbase/storage.js";
import {
  toPbRecord,
  fromPbRecord,
  uidFilter,
  defaultKeyPathFor,
  SNAPSHOT_COLLECTION_BY_DOMAIN_KEY,
  SETTINGS_COLLECTION,
  SETTINGS_RECORD_KEY
} from "../src/adapters/cloud-pocketbase/mapping.js";

// Deterministic, offline tests: an in-memory fake PocketBase client lets us
// assert collection routing, uid mapping, JSON round-trips, and upsert
// emulation without a live server.

let failures = 0;
function run(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

function createFakePocketBase() {
  const collections = new Map();
  let seq = 0;
  const coll = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  return {
    __collections: collections,
    collection(name) {
      const store = coll(name);
      return {
        async getFullList() { return [...store.values()]; },
        async getFirstListItem(filter) {
          const m = /uid="((?:[^"\\]|\\.)*)"/.exec(filter);
          const uid = m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : null;
          for (const rec of store.values()) if (rec.uid === uid) return rec;
          const err = new Error("not found"); err.status = 404; throw err;
        },
        async create(payload) {
          const id = `pb_${++seq}`;
          const rec = { id, ...payload };
          store.set(id, rec);
          return rec;
        },
        async update(id, payload) {
          const rec = { ...(store.get(id) || {}), ...payload, id };
          store.set(id, rec);
          return rec;
        },
        async delete(id) { store.delete(id); }
      };
    }
  };
}

run("mapping round-trip + keyPath + filter", () => {
  assert.equal(defaultKeyPathFor("video_items"), "id");
  assert.equal(defaultKeyPathFor("app_settings"), "key");
  const domain = { id: "v1", title: "مادة", syncVersion: 3, lastModifiedBy: { deviceId: "d" } };
  const pb = toPbRecord(domain, "id");
  assert.equal(pb.uid, "v1");
  assert.equal(pb.syncVersion, 3);
  assert.deepEqual(pb.data, domain);
  assert.deepEqual(fromPbRecord(pb), domain);
  assert.equal(uidFilter('a"b'), 'uid="a\\"b"');
});

run("adapter satisfies StorageProvider port", () => {
  const provider = createPocketBaseStorageProvider(createFakePocketBase());
  // The core port is now 11 methods (added snapshot/replaceAll in v1.1.0).
  assert.equal(STORAGE_PROVIDER_METHODS.length, 11);
  assert.equal(isStorageProvider(provider), true);
});

run("snapshot/replaceAll mapping covers every domain key", () => {
  const expected = [
    "contentTypes", "videoItems", "changeHistory", "bookmarks", "relations",
    "virtualCollections", "vocabulary", "hierarchicalTags", "users", "auditLogs", "projects",
    "fileIngestQueue"
  ];
  assert.deepEqual(Object.keys(SNAPSHOT_COLLECTION_BY_DOMAIN_KEY).sort(), expected.sort());
  assert.equal(SETTINGS_COLLECTION, "app_settings");
  assert.equal(SETTINGS_RECORD_KEY, "app_settings");
});

run("add + get + getAll round-trip", async () => {
  const provider = createPocketBaseStorageProvider(createFakePocketBase());
  await provider.add("video_items", { id: "v1", title: "A" });
  assert.deepEqual(await provider.get("video_items", "v1"), { id: "v1", title: "A" });
  assert.deepEqual(await provider.getAll("video_items"), [{ id: "v1", title: "A" }]);
  assert.equal(await provider.get("video_items", "missing"), undefined);
});

run("put emulates upsert (no duplicates)", async () => {
  const fake = createFakePocketBase();
  const provider = createPocketBaseStorageProvider(fake);
  await provider.put("video_items", { id: "v1", title: "A" });
  await provider.put("video_items", { id: "v1", title: "B" });
  const all = await provider.getAll("video_items");
  assert.equal(all.length, 1);
  assert.equal(all[0].title, "B");
  // PB row promoted uid (one physical record).
  assert.equal(fake.__collections.get("video_items").size, 1);
});

run("app_settings keyed by `key`", async () => {
  const provider = createPocketBaseStorageProvider(createFakePocketBase());
  await provider.put("app_settings", { key: "app_settings", theme: "dark" });
  assert.deepEqual(await provider.get("app_settings", "app_settings"), { key: "app_settings", theme: "dark" });
});

run("delete + clear", async () => {
  const provider = createPocketBaseStorageProvider(createFakePocketBase());
  await provider.add("bookmarks", { id: "b1" });
  await provider.add("bookmarks", { id: "b2" });
  await provider.delete("bookmarks", "b1");
  assert.deepEqual((await provider.getAll("bookmarks")).map((r) => r.id), ["b2"]);
  await provider.clear("bookmarks");
  assert.deepEqual(await provider.getAll("bookmarks"), []);
});

run("putBatch + deleteBatch", async () => {
  const provider = createPocketBaseStorageProvider(createFakePocketBase());
  await provider.putBatch("vocabulary", [{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
  assert.equal((await provider.getAll("vocabulary")).length, 3);
  await provider.deleteBatch("vocabulary", ["t1", "t3"]);
  assert.deepEqual((await provider.getAll("vocabulary")).map((r) => r.id), ["t2"]);
});

run("snapshot returns stable shape across all stores", async () => {
  const provider = createPocketBaseStorageProvider(createFakePocketBase());
  // Empty server still returns every list (empty arrays) + ISO timestamp + version.
  const empty = await provider.snapshot();
  for (const domainKey of Object.keys(SNAPSHOT_COLLECTION_BY_DOMAIN_KEY)) {
    assert.deepEqual(empty[domainKey], [], `expected empty list for ${domainKey}`);
  }
  assert.equal(empty.version, "2.0");
  assert.equal(typeof empty.exportedAt, "string");
  assert.equal(empty.settings, undefined);

  // Seed a few collections + settings, then snapshot round-trip.
  await provider.put("content_types", { id: "type", name: "نوع" });
  await provider.put("video_items", { id: "video", title: "فيديو", type: "type" });
  await provider.put("app_settings", { key: "app_settings", theme: "dark" });

  const populated = await provider.snapshot();
  assert.deepEqual(populated.contentTypes, [{ id: "type", name: "نوع" }]);
  assert.deepEqual(populated.videoItems, [{ id: "video", title: "فيديو", type: "type" }]);
  assert.deepEqual(populated.settings, { key: "app_settings", theme: "dark" });
});

run("replaceAll wipes + writes + returns counts (best-effort)", async () => {
  const fake = createFakePocketBase();
  const provider = createPocketBaseStorageProvider(fake);

  // Seed existing rows that should be wiped before the new payload is written.
  await provider.put("content_types", { id: "old-type", name: "قديم" });
  await provider.put("video_items", { id: "old-video", title: "قديم" });

  const counts = await provider.replaceAll({
    contentTypes: [{ id: "t1", name: "نوع جديد" }],
    videoItems: [
      { id: "v1", title: "فيديو 1", type: "t1" },
      { id: "v2", title: "فيديو 2", type: "t1" }
    ],
    vocabulary: [{ id: "term", term: "كلمة" }],
    settings: { theme: "light", ui: { lastSettingsTab: "general" } }
  });

  // Per-store write counts cover every domain key, including those we did not
  // supply (those default to 0). users is 0 because we did not supply users.
  assert.equal(counts.contentTypes, 1);
  assert.equal(counts.videoItems, 2);
  assert.equal(counts.vocabulary, 1);
  assert.equal(counts.users, 0);
  assert.equal(counts.bookmarks, 0);

  // The previous rows are gone — replace, not merge.
  const types = await provider.getAll("content_types");
  assert.deepEqual(types.map((row) => row.id), ["t1"]);
  const videos = await provider.getAll("video_items");
  assert.deepEqual(videos.map((row) => row.id).sort(), ["v1", "v2"]);

  // Settings was upserted into the singleton bag.
  const settings = await provider.get("app_settings", "app_settings");
  assert.equal(settings.theme, "light");
  assert.equal(settings.key, "app_settings");
});

run("replaceAll preserves existing users when import omits them", async () => {
  const provider = createPocketBaseStorageProvider(createFakePocketBase());
  await provider.put("users", { id: "u1", username: "admin", role: "admin" });

  // Import payload omits `users` entirely — the SPA's IndexedDB replaceAll
  // only clears users when the payload supplies them; the PB adapter mirrors
  // that so a partial import never silently wipes accounts.
  await provider.replaceAll({
    contentTypes: [{ id: "t", name: "نوع" }]
  });

  const users = await provider.getAll("users");
  assert.deepEqual(users.map((row) => row.username), ["admin"]);
});

run("snapshot -> replaceAll round-trip preserves data", async () => {
  const source = createPocketBaseStorageProvider(createFakePocketBase());
  await source.put("content_types", { id: "type", name: "نوع" });
  await source.put("video_items", { id: "v1", title: "A", type: "type" });
  await source.put("vocabulary", { id: "t1", term: "كلمة" });
  await source.put("app_settings", { key: "app_settings", theme: "dark" });

  const snap = await source.snapshot();

  // Pour the snapshot into a fresh server — replaceAll should reproduce it.
  const dest = createPocketBaseStorageProvider(createFakePocketBase());
  await dest.replaceAll(snap);
  const reSnap = await dest.snapshot();

  assert.deepEqual(reSnap.contentTypes, snap.contentTypes);
  assert.deepEqual(reSnap.videoItems, snap.videoItems);
  assert.deepEqual(reSnap.vocabulary, snap.vocabulary);
  assert.deepEqual(reSnap.settings, snap.settings);
});

run("replaceAll rejects non-object payload", async () => {
  const provider = createPocketBaseStorageProvider(createFakePocketBase());
  await assert.rejects(() => provider.replaceAll(null), /replaceAll/);
  await assert.rejects(() => provider.replaceAll("nope"), /replaceAll/);
});

// Async tests resolve on the microtask queue; report after they settle.
process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll cloud-pocketbase adapter tests passed.");
  }
});
