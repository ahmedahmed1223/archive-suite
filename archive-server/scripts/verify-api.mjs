import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

import { dispatchRpc, RPC_METHODS } from "../src/api/rpcHandler.js";
import { createApiServer } from "../src/api/server.js";
import { validateRpcArgs } from "../src/api/validate.js";
import { createRateLimiter } from "../src/api/rateLimit.js";
import { signJwt } from "../src/auth/jwt.js";
import { fireWebhooks } from "../src/webhooks/webhookService.js";

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

function createFakeWebhookPrisma() {
  const hooks = new Map();
  let nextId = 1;
  const matchesWhere = (hook, where = {}) => {
    if (where.ownerId !== undefined && hook.ownerId !== where.ownerId) return false;
    if (where.id !== undefined && hook.id !== where.id) return false;
    if (where.active !== undefined && hook.active !== where.active) return false;
    if (where.events?.has && !hook.events?.includes(where.events.has)) return false;
    return true;
  };
  return {
    webhook: {
      async findMany({ where = {}, orderBy } = {}) {
        const items = [...hooks.values()].filter((hook) => matchesWhere(hook, where));
        if (orderBy?.createdAt === "desc") {
          items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return items;
      },
      async create({ data }) {
        const hook = {
          id: `wh_${nextId++}`,
          createdAt: new Date(Date.now() + nextId),
          updatedAt: new Date(Date.now() + nextId),
          ...data
        };
        hooks.set(hook.id, hook);
        return hook;
      },
      async deleteMany({ where = {} }) {
        let count = 0;
        for (const [id, hook] of hooks) {
          if (matchesWhere(hook, where)) {
            hooks.delete(id);
            count += 1;
          }
        }
        return { count };
      }
    }
  };
}

function bearer(secret = "sync-secret") {
  return `Bearer ${signJwt({ sub: "u1", username: "admin", role: "admin" }, secret)}`;
}

function bearerWithRole(secret = "sync-secret", role = "admin") {
  return `Bearer ${signJwt({ sub: "u1", username: role, role }, secret)}`;
}

async function waitFor(predicate, { timeoutMs = 2500, intervalMs = 25 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  assert.fail("timed out waiting for condition");
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

run("HTTP: webhook routes list, create, and delete caller hooks behind auth", async () => {
  const secret = "webhook-secret";
  const prisma = createFakeWebhookPrisma();
  const server = createApiServer({
    backend: "test",
    authSecret: secret,
    prisma,
    rateLimit: null
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: bearer(secret), "Content-Type": "application/json" };

  try {
    const noAuth = await fetch(`${base}/api/webhooks`);
    assert.equal(noAuth.status, 401);

    await prisma.webhook.create({
      data: {
        url: "https://example.com/other",
        events: ["record.created"],
        secret: "other-secret",
        active: true,
        ownerId: "someone-else"
      }
    });

    const create = await fetch(`${base}/api/webhooks`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        url: "https://example.com/archive-hook",
        events: ["record.created", "record.deleted", "not.allowed"],
        secret: "provided-secret"
      })
    });
    assert.equal(create.status, 201);
    const created = await create.json();
    assert.equal(created.ok, true);
    assert.equal(created.hook.ownerId, "u1");
    assert.deepEqual(created.hook.events, ["record.created", "record.deleted"]);
    assert.equal(created.hook.secret, "provided-secret");

    const list = await fetch(`${base}/api/webhooks`, { headers: { Authorization: bearer(secret) } });
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.equal(listed.ok, true);
    assert.deepEqual(listed.hooks.map((hook) => hook.id), [created.hook.id]);

    const del = await fetch(`${base}/api/webhooks/${encodeURIComponent(created.hook.id)}`, {
      method: "DELETE",
      headers: { Authorization: bearer(secret) }
    });
    assert.equal(del.status, 200);
    assert.deepEqual(await del.json(), { ok: true });

    const afterDelete = await fetch(`${base}/api/webhooks`, { headers: { Authorization: bearer(secret) } });
    assert.deepEqual((await afterDelete.json()).hooks, []);
    assert.equal((await prisma.webhook.findMany({ where: { ownerId: "someone-else" } })).length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("HTTP: control center status and logs are admin-only and read-only", async () => {
  const secret = "control-secret";
  const server = createApiServer({
    backend: "test",
    authSecret: secret,
    rateLimit: null,
    controlAgent: {
      async status() {
        return {
          ok: true,
          mode: "test",
          readOnly: true,
          metrics: { cpu: { percent: 12 }, memory: { percent: 34 }, disk: { percent: 56 } },
          services: [{ id: "api", name: "API", status: "running", detail: "test mode" }]
        };
      },
      async logs({ service, limit }) {
        return {
          ok: true,
          service,
          limit,
          lines: [
            { ts: "2026-06-18T00:00:00.000Z", service, line: "started" }
          ]
        };
      },
      async unsupportedAction(action) {
        return { ok: false, action, error: "disabled" };
      }
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const admin = { Authorization: bearer(secret) };

  try {
    assert.equal((await fetch(`${base}/api/control/status`)).status, 401);
    assert.equal((await fetch(`${base}/api/control/status`, {
      headers: { Authorization: bearerWithRole(secret, "viewer") }
    })).status, 403);

    const statusRes = await fetch(`${base}/api/control/status`, { headers: admin });
    assert.equal(statusRes.status, 200);
    const status = await statusRes.json();
    assert.equal(status.ok, true);
    assert.equal(status.result.readOnly, true);
    assert.equal(status.result.metrics.cpu.percent, 12);
    assert.deepEqual(status.result.services.map((svc) => svc.id), ["api"]);

    const logsRes = await fetch(`${base}/api/control/logs?service=api&limit=1`, { headers: admin });
    assert.equal(logsRes.status, 200);
    const logs = await logsRes.json();
    assert.equal(logs.ok, true);
    assert.equal(logs.result.service, "api");
    assert.equal(logs.result.limit, 1);
    assert.equal(logs.result.lines[0].line, "started");

    const restart = await fetch(`${base}/api/control/restart`, { method: "POST", headers: admin });
    assert.equal(restart.status, 501);
    assert.deepEqual(await restart.json(), { ok: false, error: "disabled", action: "restart" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("HTTP: import preview is editor-gated and returns normalized metadata", async () => {
  const secret = "import-secret";
  const server = createApiServer({
    backend: "test",
    authSecret: secret,
    rateLimit: null,
    importPreview: async ({ urls, requestedBy }) => ({
      ok: true,
      requestedBy,
      items: urls.map((url) => ({ ok: true, url, kind: "web", title: "Preview title" }))
    })
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    assert.equal((await fetch(`${base}/api/import/preview`, { method: "POST" })).status, 401);
    assert.equal((await fetch(`${base}/api/import/preview`, {
      method: "POST",
      headers: { Authorization: bearerWithRole(secret, "viewer"), "Content-Type": "application/json" },
      body: JSON.stringify({ urls: ["https://example.com/a"] })
    })).status, 403);

    const res = await fetch(`${base}/api/import/preview`, {
      method: "POST",
      headers: { Authorization: bearerWithRole(secret, "editor"), "Content-Type": "application/json" },
      body: JSON.stringify({ urls: ["https://example.com/a"] })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.result.requestedBy.role, "editor");
    assert.equal(body.result.items[0].title, "Preview title");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

run("import preview extracts safe metadata without fetching private hosts", async () => {
  const { createImportPreviewService } = await import("../src/import/importPreview.js");
  const fetched = [];
  const preview = createImportPreviewService({
    lookupHost: async (host) => [{ address: host === "example.com" ? "93.184.216.34" : "127.0.0.1" }],
    fetchImpl: async (url) => {
      fetched.push(String(url));
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html; charset=utf-8" },
        async text() {
          return "<html><head><title>  Example Page  </title><meta name=\"description\" content=\"A useful page\"><meta property=\"og:image\" content=\"https://example.com/cover.jpg\"></head></html>";
        }
      };
    }
  });

  const result = await preview({
    urls: [
      "https://example.com/article",
      "https://youtu.be/dQw4w9WgXcQ",
      "http://127.0.0.1/admin"
    ],
    requestedBy: { sub: "u1", role: "editor" }
  });
  assert.equal(result.ok, true);
  assert.equal(result.items[0].kind, "web");
  assert.equal(result.items[0].title, "Example Page");
  assert.equal(result.items[0].description, "A useful page");
  assert.equal(result.items[0].thumbnailUrl, "https://example.com/cover.jpg");
  assert.equal(result.items[1].kind, "youtube");
  assert.equal(result.items[1].sourceId, "dQw4w9WgXcQ");
  assert.equal(result.items[2].ok, false);
  assert.equal(result.items[2].errorCode, "private_host");
  assert.deepEqual(fetched, ["https://example.com/article"]);
});

run("control agent reports safe local status without exposing secrets", async () => {
  const { createControlAgent } = await import("../src/control/controlAgent.js");
  const agent = createControlAgent({
    mode: "test",
    now: () => new Date("2026-06-18T00:00:00.000Z"),
    platform: () => "win32",
    uptime: () => 60,
    loadavg: () => [0.5, 0.25, 0.1],
    cpus: () => [{}, {}],
    totalmem: () => 100,
    freemem: () => 25,
    diskUsage: () => ({ used: 70, total: 100 }),
    services: [{ id: "api", name: "Archive API", status: "running", detail: "local" }],
    readLogs: async () => ["token=secret", "healthy"]
  });

  const status = await agent.status();
  assert.equal(status.mode, "test");
  assert.equal(status.readOnly, true);
  assert.equal(status.metrics.memory.percent, 75);
  assert.equal(status.metrics.disk.percent, 70);
  assert.equal(status.services[0].status, "running");

  const logs = await agent.logs({ service: "api", limit: 5 });
  assert.equal(logs.lines.length, 2);
  assert.equal(JSON.stringify(logs).includes("secret"), false);
});

run("control agent executes only enabled allowlisted service actions", async () => {
  const { createControlAgent } = await import("../src/control/controlAgent.js");
  const calls = [];
  const agent = createControlAgent({
    mode: "linux-native",
    actionsEnabled: true,
    services: [
      { id: "api", name: "API", systemdUnit: "archive-api.service", actions: ["restart"] }
    ],
    executor: async (command) => {
      calls.push(command);
      return { code: 0, stdout: "ok token=secret", stderr: "" };
    }
  });

  const restarted = await agent.runAction("restart", { service: "api" });
  assert.equal(restarted.ok, true);
  assert.equal(restarted.statusCode, 200);
  assert.equal(restarted.stdout, "ok token=***");
  assert.equal(calls[0].command, "systemctl");
  assert.deepEqual(calls[0].args, ["restart", "archive-api.service"]);

  const forbidden = await agent.runAction("stop", { service: "api" });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(calls.length, 1);

  const missing = await agent.runAction("restart", { service: "db" });
  assert.equal(missing.statusCode, 400);
  assert.equal(calls.length, 1);

  const disabled = createControlAgent({ actionsEnabled: false, executor: async () => { throw new Error("must not run"); } });
  assert.equal((await disabled.runAction("restart", { service: "archive-api" })).statusCode, 501);
});

run("fireWebhooks delivers matching hooks with signature and retry", async () => {
  const received = [];
  const receiver = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      received.push({ body, headers: req.headers });
      res.statusCode = received.length === 1 ? 500 : 204;
      res.end();
    });
  });
  await new Promise((resolve) => receiver.listen(0, "127.0.0.1", resolve));

  const prisma = createFakeWebhookPrisma();
  const logs = { warns: [], errors: [] };
  const logger = {
    warn: (meta, message) => logs.warns.push({ meta, message }),
    error: (meta, message) => logs.errors.push({ meta, message })
  };

  try {
    const targetUrl = `http://127.0.0.1:${receiver.address().port}/hook`;
    await prisma.webhook.create({
      data: {
        url: targetUrl,
        events: ["record.created"],
        secret: "match-secret",
        active: true,
        ownerId: "u1"
      }
    });
    await prisma.webhook.create({
      data: {
        url: targetUrl,
        events: ["record.updated"],
        secret: "wrong-event-secret",
        active: true,
        ownerId: "u1"
      }
    });
    await prisma.webhook.create({
      data: {
        url: targetUrl,
        events: ["record.created"],
        secret: "wrong-owner-secret",
        active: true,
        ownerId: "someone-else"
      }
    });

    fireWebhooks(prisma, "record.created", { id: "v1", title: "Webhook" }, "u1", logger);
    await waitFor(() => received.length === 2);

    assert.equal(received.length, 2);
    assert.equal(received[0].body, received[1].body);
    const payload = JSON.parse(received[0].body);
    assert.equal(payload.event, "record.created");
    assert.equal(payload.webhookId, "wh_1");
    assert.deepEqual(payload.data, { id: "v1", title: "Webhook" });
    const expectedSignature = createHmac("sha256", "match-secret").update(received[0].body).digest("hex");
    assert.equal(received[0].headers["x-webhook-signature"], `sha256=${expectedSignature}`);
    assert.equal(received[1].headers["x-webhook-signature"], `sha256=${expectedSignature}`);
    assert.equal(received[0].headers["user-agent"], "ArchiveSuite-Webhook/1.0");
    assert.equal(logs.warns.length, 1);
    assert.equal(logs.errors.length, 0);
  } finally {
    await new Promise((resolve) => receiver.close(resolve));
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
