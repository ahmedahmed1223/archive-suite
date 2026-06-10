import assert from "node:assert/strict";

import { dispatchRpc, RPC_METHODS } from "../src/api/rpcHandler.js";
import { createApiServer } from "../src/api/server.js";
import { validateRpcArgs } from "../src/api/validate.js";
import { createRateLimiter } from "../src/api/rateLimit.js";
import { signJwt } from "../src/auth/jwt.js";

// Tests the RPC dispatcher (pure) and the HTTP server (real listen on an
// ephemeral port) against a fake StorageProvider — no real backend needed.

let failures = 0;
function run(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

function createFakeProvider() {
  const stores = new Map();
  const keyFor = (store) => (store === "app_settings" ? "key" : "id");
  const of = (store) => {
    if (!stores.has(store)) stores.set(store, new Map());
    return stores.get(store);
  };
  return {
    async open() { return undefined; },
    async get(store, key) { return of(store).get(String(key)); },
    async getAll(store) { return [...of(store).values()]; },
    async put(store, record) { of(store).set(String(record[keyFor(store)]), record); return record; },
    async add(store, record) { of(store).set(String(record[keyFor(store)]), record); return record; },
    async delete(store, key) { of(store).delete(String(key)); },
    async clear(store) { of(store).clear(); },
    async putBatch(store, items = []) { for (const it of items) of(store).set(String(it[keyFor(store)]), it); return items; },
    async deleteBatch(store, keys = []) { for (const k of keys) of(store).delete(String(k)); return keys; },
    async snapshot() { return { videoItems: [...of("video_items").values()], version: "2.0" }; },
    async replaceAll(payload) {
      of("video_items").clear();
      for (const it of payload.videoItems || []) of("video_items").set(String(it.id), it);
      return { videoItems: (payload.videoItems || []).length };
    }
  };
}

function createFakeFileStore() {
  const files = new Map();
  return {
    describe() {
      return {
        kind: "dropbox",
        label: "Dropbox",
        rootPath: "/archive",
        configured: true,
        auth: "access-token",
        secret: "must-not-leak"
      };
    },
    async putBlob(key, blob) {
      const bytes = Buffer.isBuffer(blob) ? blob : Buffer.from(await blob.arrayBuffer());
      files.set(key, bytes);
      return { key, url: `/api/files/${encodeURIComponent(key)}` };
    },
    async getBlob(key) {
      return files.get(key) || null;
    },
    async getUrl(key) {
      return files.has(key) ? `/api/files/${encodeURIComponent(key)}` : null;
    },
    async remove(key) {
      files.delete(key);
    },
    async list(prefix = "") {
      return [...files.keys()].filter((key) => key.startsWith(prefix));
    }
  };
}

function createFakeSyncProvider() {
  const items = new Map();
  return {
    stampMetadata: (entity) => entity,
    planIncoming: () => ({}),
    mergeIntoLocal: () => [],
    detectConflicts: () => ({ newItems: [], updates: [], conflicts: [], deletes: [] }),
    buildFieldDiff: () => [],
    summarizeConflictPlan: () => ({}),
    filterDelta: (records = [], cursor = 0) => records.filter((record) => Number(record.syncVersion) > Number(cursor || 0)),
    buildSyncFloor: () => ({}),
    subscribe() { return () => {}; },
    async pushChange(change = {}) {
      const record = change.record || change.item || change;
      items.set(record.id, record);
      return { pushed: true, cursor: Number(record.syncVersion) || 0 };
    },
    async pullSince(cursor = 0) {
      const floor = Number(cursor) || 0;
      const changed = [...items.values()].filter((item) => Number(item.syncVersion) > floor);
      const nextCursor = changed.reduce((max, item) => Math.max(max, Number(item.syncVersion) || 0), floor);
      return { items: changed, cursor: nextCursor };
    }
  };
}

function bearer(secret = "sync-secret") {
  return `Bearer ${signJwt({ sub: "u1", username: "admin", role: "admin" }, secret)}`;
}

run("RPC method allow-list matches the port methods + getByField", () => {
  assert.deepEqual([...RPC_METHODS].sort(), [
    "add", "clear", "delete", "deleteBatch", "get", "getAll",
    "getByField", "open", "put", "putBatch", "replaceAll", "snapshot"
  ].sort());
  assert.equal(RPC_METHODS.length, 12);
});

run("dispatchRpc rejects unknown methods", async () => {
  const provider = createFakeProvider();
  await assert.rejects(
    () => dispatchRpc({ method: "drop", args: [] }, { resolveProvider: () => provider }),
    /Unknown RPC method/
  );
  await assert.rejects(
    () => dispatchRpc({ method: "__proto__", args: [] }, { resolveProvider: () => provider }),
    /Unknown RPC method/
  );
});

run("dispatchRpc round-trips a put then get", async () => {
  const provider = createFakeProvider();
  const resolveProvider = () => provider;
  await dispatchRpc({ method: "put", args: ["video_items", { id: "v1", title: "A" }] }, { resolveProvider });
  const got = await dispatchRpc({ method: "get", args: ["video_items", "v1"] }, { resolveProvider });
  assert.deepEqual(got, { id: "v1", title: "A" });
});

run("HTTP server: health + rpc round-trip over the wire", async () => {
  const provider = createFakeProvider();
  const server = createApiServer({
    backend: "test",
    resolveStorage: () => provider,
    dispatch: (body) => dispatchRpc(body, { resolveProvider: () => provider })
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    // health
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.equal(health.backend, "test");
    assert.equal(health.engine, "postgresql");
    assert.equal(health.db.ok, true);
    assert.equal(typeof health.db.latencyMs, "number");
    assert.equal(typeof health.uptimeSec, "number");
    assert.equal(typeof health.version, "string");

    // put
    const putRes = await fetch(`${base}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "put", args: ["video_items", { id: "v9", title: "عبر HTTP" }] })
    }).then((r) => r.json());
    assert.equal(putRes.ok, true);
    assert.deepEqual(putRes.result, { id: "v9", title: "عبر HTTP" });

    // getAll
    const allRes = await fetch(`${base}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "getAll", args: ["video_items"] })
    }).then((r) => r.json());
    assert.equal(allRes.ok, true);
    assert.deepEqual(allRes.result.map((r) => r.id), ["v9"]);

    // unknown method → ok:false + 400
    const badRes = await fetch(`${base}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "nope", args: [] })
    });
    assert.equal(badRes.status, 400);
    const badJson = await badRes.json();
    assert.equal(badJson.ok, false);

    // 404 for unknown path
    const notFound = await fetch(`${base}/whatever`);
    assert.equal(notFound.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("HTTP server: snapshot → replaceAll round-trip", async () => {
  const provider = createFakeProvider();
  const server = createApiServer({
    backend: "test",
    dispatch: (body) => dispatchRpc(body, { resolveProvider: () => provider })
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const rpc = (method, args) => fetch(`${base}/api/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, args })
  }).then((r) => r.json());

  try {
    await rpc("replaceAll", [{ videoItems: [{ id: "a" }, { id: "b" }] }]);
    const snap = await rpc("snapshot", []);
    assert.equal(snap.ok, true);
    assert.deepEqual(snap.result.videoItems.map((r) => r.id).sort(), ["a", "b"]);
    assert.equal(snap.result.version, "2.0");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("validateRpcArgs rejects malformed args", () => {
  // Valid shapes pass.
  validateRpcArgs("get", ["video_items", "v1"]);
  validateRpcArgs("put", ["video_items", { id: "v1" }]);
  validateRpcArgs("putBatch", ["vocabulary", [{ id: "t1" }]]);
  validateRpcArgs("replaceAll", [{ videoItems: [] }]);
  validateRpcArgs("snapshot", []);
  // Bad store name.
  assert.throws(() => validateRpcArgs("getAll", ["Bad-Store!"]), /Invalid store/);
  assert.throws(() => validateRpcArgs("getAll", [123]), /Invalid store/);
  // Record must be an object (not array/primitive).
  assert.throws(() => validateRpcArgs("put", ["video_items", [1, 2]]), /must be an object/);
  assert.throws(() => validateRpcArgs("put", ["video_items", "x"]), /must be an object/);
  // Batch must be an array.
  assert.throws(() => validateRpcArgs("putBatch", ["vocabulary", { not: "array" }]), /must be an array/);
  // Key required.
  assert.throws(() => validateRpcArgs("get", ["video_items"]), /Key must be/);
});

run("dispatchRpc surfaces validation as a 400", async () => {
  const provider = createFakeProvider();
  await assert.rejects(
    () => dispatchRpc({ method: "getAll", args: ["BAD!"] }, { resolveProvider: () => provider }),
    (err) => { assert.equal(err.statusCode, 400); return true; }
  );
});

run("rate limiter allows up to max then blocks", () => {
  const rl = createRateLimiter({ max: 3, windowMs: 10_000 });
  assert.equal(rl.check("ip1"), true);
  assert.equal(rl.check("ip1"), true);
  assert.equal(rl.check("ip1"), true);
  assert.equal(rl.check("ip1"), false); // 4th over limit
  // a different key has its own bucket
  assert.equal(rl.check("ip2"), true);
});

run("HTTP: login endpoint returns 429 after the strict limit", async () => {
  const provider = createFakeProvider();
  const server = createApiServer({
    backend: "test",
    authSecret: "s",
    login: async () => { const e = new Error("bad"); e.statusCode = 401; throw e; },
    dispatch: (body) => dispatchRpc(body, { resolveProvider: () => provider }),
    rateLimit: { loginMax: 2, rpcMax: 100, windowMs: 10_000 }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = () => fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "x", password: "y" })
  });
  try {
    assert.equal((await post()).status, 401); // 1 — bad creds
    assert.equal((await post()).status, 401); // 2 — bad creds
    assert.equal((await post()).status, 429); // 3 — rate limited
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("HTTP: file routes upload, download, list, and delete behind auth", async () => {
  const secret = "files-secret";
  const fileStore = createFakeFileStore();
  const server = createApiServer({
    backend: "test",
    authSecret: secret,
    resolveFileStore: () => fileStore,
    rateLimit: null
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: bearer(secret) };

  try {
    const noAuth = await fetch(`${base}/api/files/folder/a.txt`, { method: "PUT", body: "blocked" });
    assert.equal(noAuth.status, 401);

    const put = await fetch(`${base}/api/files/folder/a.txt`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "text/plain" },
      body: "hello cloud file"
    });
    assert.equal(put.status, 200);
    assert.deepEqual(await put.json(), { ok: true, result: { key: "folder/a.txt", url: "/api/files/folder%2Fa.txt" } });

    const list = await fetch(`${base}/api/files?prefix=folder/`, { headers: auth });
    assert.equal(list.status, 200);
    assert.deepEqual((await list.json()).result, ["folder/a.txt"]);

    const url = await fetch(`${base}/api/files/url?key=${encodeURIComponent("folder/a.txt")}`, { headers: auth });
    assert.equal(url.status, 200);
    assert.equal((await url.json()).result, "/api/files/folder%2Fa.txt");

    const get = await fetch(`${base}/api/files/folder/a.txt`, { headers: auth });
    assert.equal(get.status, 200);
    assert.equal(await get.text(), "hello cloud file");

    const del = await fetch(`${base}/api/files/folder/a.txt`, { method: "DELETE", headers: auth });
    assert.equal(del.status, 200);
    const missing = await fetch(`${base}/api/files/folder/a.txt`, { headers: auth });
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("HTTP server: health reports degraded DB ping without failing the server", async () => {
  const provider = {
    ...createFakeProvider(),
    async ping() { throw new Error("postgresql://u:secret@db.example.com/archive failed"); }
  };
  const server = createApiServer({
    backend: "test",
    resolveStorage: () => provider,
    dispatch: (body) => dispatchRpc(body, { resolveProvider: () => provider })
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.equal(health.db.ok, false);
    assert.match(health.db.error, /db\.example\.com/);
    assert.equal(health.db.error.includes("secret"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("HTTP: file status reports safe FileStore metadata behind auth", async () => {
  const secret = "files-status-secret";
  const fileStore = createFakeFileStore();
  await fileStore.putBlob("folder/a.txt", Buffer.from("a"));
  await fileStore.putBlob("folder/b.txt", Buffer.from("b"));
  const server = createApiServer({
    backend: "test",
    authSecret: secret,
    resolveFileStore: () => fileStore,
    rateLimit: null
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: bearer(secret) };

  try {
    const noAuth = await fetch(`${base}/api/files/status`);
    assert.equal(noAuth.status, 401);

    const res = await fetch(`${base}/api/files/status`, { headers: auth });
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.result, {
      kind: "dropbox",
      label: "Dropbox",
      rootPath: "/archive",
      configured: true,
      auth: "access-token",
      capabilities: { upload: true, download: true, list: true, remove: true, temporaryUrl: true },
      health: { listOk: true, listCount: 2 }
    });
    assert.equal(JSON.stringify(payload).includes("must-not-leak"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("HTTP: sync routes push and pull changed items behind auth", async () => {
  const secret = "sync-secret";
  const syncProvider = createFakeSyncProvider();
  const server = createApiServer({
    backend: "test",
    authSecret: secret,
    resolveSyncProvider: () => syncProvider,
    rateLimit: null
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: bearer(secret), "Content-Type": "application/json" };

  try {
    const noAuth = await fetch(`${base}/api/sync/pull?cursor=0`);
    assert.equal(noAuth.status, 401);

    const pushed = await fetch(`${base}/api/sync/push`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ store: "video_items", record: { id: "v1", title: "Cloud", syncVersion: 3 } })
    });
    assert.equal(pushed.status, 200);
    assert.deepEqual(await pushed.json(), { ok: true, result: { pushed: true, cursor: 3 } });

    const pullOld = await fetch(`${base}/api/sync/pull?cursor=2`, { headers: { Authorization: bearer(secret) } });
    assert.equal(pullOld.status, 200);
    assert.deepEqual((await pullOld.json()).result.items.map((item) => item.id), ["v1"]);

    const pullFresh = await fetch(`${base}/api/sync/pull?cursor=3`, { headers: { Authorization: bearer(secret) } });
    assert.equal(pullFresh.status, 200);
    assert.deepEqual((await pullFresh.json()).result.items, []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll RPC API tests passed.");
  }
});
