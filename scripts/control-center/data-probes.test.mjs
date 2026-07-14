import assert from "node:assert/strict";
import test from "node:test";

const modulePath = "./data-probes.mjs";
const loadProbes = async () => import(modulePath).catch(() => null);

function namespace(value = "archive-setup-probe-fixed") {
  return () => value;
}

test("PostgreSQL probe permits only a bounded read-only connection check", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const statements = [];
  const result = await probes.createDataProbes({
    postgres: { query: async (statement) => { statements.push(statement); return { rows: [{ archive_probe: 1 }] }; } },
  }).postgres();

  assert.deepEqual(statements, ["SELECT 1 AS archive_probe"]);
  assert.deepEqual(result, {
    ok: true,
    code: "POSTGRES_READY",
    message: "PostgreSQL connection and limited read permission verified.",
    details: { backend: "postgres" },
    nextActions: [],
  });
});

test("PostgreSQL failures and timeouts have a stable redacted contract", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const failed = await probes.createDataProbes({
    postgres: { query: async () => { throw new Error("postgres://admin:topsecret@example.test/archive"); } },
  }).postgres();
  assert.equal(failed.ok, false);
  assert.equal(failed.code, "POSTGRES_UNAVAILABLE");
  assert.equal(JSON.stringify(failed).includes("topsecret"), false);
  assert.deepEqual(failed.nextActions, ["Verify the PostgreSQL endpoint and limited probe account, then retry."]);

  const timedOut = await probes.createDataProbes({
    postgres: { query: () => new Promise(() => {}) }, timeoutMs: 5,
  }).postgres();
  assert.equal(timedOut.code, "POSTGRES_TIMEOUT");
  assert.equal(timedOut.details.backend, "postgres");
});

test("Redis probe cleans up only its generated temporary key after success and failure", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const calls = [];
  const redis = {
    ping: async () => "PONG",
    set: async (key, value) => { calls.push(["set", key, value]); },
    get: async (key) => { calls.push(["get", key]); return "archive-setup-probe"; },
    del: async (key) => { calls.push(["del", key]); },
  };
  const result = await probes.createDataProbes({ redis, createNamespace: namespace() }).redis();
  assert.equal(result.code, "REDIS_READY");
  assert.deepEqual(calls.map(([operation, key]) => [operation, key]), [
    ["set", "archive-setup-probe-fixed:redis"],
    ["get", "archive-setup-probe-fixed:redis"],
    ["del", "archive-setup-probe-fixed:redis"],
  ]);

  const deleted = [];
  const failed = await probes.createDataProbes({
    redis: { ping: async () => "PONG", set: async () => { throw new Error("redis://admin:topsecret@example.test"); }, del: async (key) => deleted.push(key) },
    createNamespace: namespace(),
  }).redis();
  assert.equal(failed.code, "REDIS_UNAVAILABLE");
  assert.deepEqual(deleted, ["archive-setup-probe-fixed:redis"]);
  assert.equal(JSON.stringify(failed).includes("topsecret"), false);
});

test("Redis probe times out and still attempts generated-key cleanup", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const deleted = [];
  const result = await probes.createDataProbes({
    redis: { ping: () => new Promise(() => {}), set: async () => {}, del: async (key) => deleted.push(key) },
    createNamespace: namespace(), timeoutMs: 5,
  }).redis();
  assert.equal(result.code, "REDIS_TIMEOUT");
  assert.deepEqual(deleted, ["archive-setup-probe-fixed:redis"]);
});

test("Redis timeout aborts when supported and deletes again after a late set completes", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const calls = [];
  let aborted = false;
  const result = await probes.createDataProbes({
    redis: {
      ping: async () => "PONG",
      set: (key, _value, { signal }) => new Promise((resolve) => setTimeout(() => { aborted = signal.aborted; calls.push(["set", key]); resolve(); }, 20)),
      del: async (key) => calls.push(["del", key]),
    },
    createNamespace: namespace(), timeoutMs: 5,
  }).redis();
  assert.equal(result.code, "REDIS_TIMEOUT");
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(aborted, true);
  assert.deepEqual(calls, [
    ["del", "archive-setup-probe-fixed:redis"],
    ["set", "archive-setup-probe-fixed:redis"],
    ["del", "archive-setup-probe-fixed:redis"],
  ]);
});

test("Redis cleanup failure is returned safely instead of a ready or timeout result", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const result = await probes.createDataProbes({
    redis: { ping: async () => "PONG", set: async () => {}, get: async () => "archive-setup-probe", del: async () => { throw new Error("redis://admin:topsecret@example.test"); } },
    createNamespace: namespace(),
  }).redis();
  assert.deepEqual(result, {
    ok: false,
    code: "REDIS_CLEANUP_FAILED",
    message: "Redis probe cleanup could not be confirmed.",
    details: { backend: "redis" },
    nextActions: ["Remove the generated Redis probe namespace before retrying."],
  });
  assert.equal(JSON.stringify(result).includes("topsecret"), false);
});

test("storage probe uses an isolated generated namespace and removes it after verification", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const calls = [];
  const storage = {
    write: async (path, value) => calls.push(["write", path, value]),
    read: async (path) => { calls.push(["read", path]); return "archive-setup-probe"; },
    remove: async (path) => calls.push(["remove", path]),
  };
  const result = await probes.createDataProbes({ storage, createNamespace: namespace() }).storage();
  assert.equal(result.code, "STORAGE_READY");
  assert.deepEqual(calls.map(([operation, path]) => [operation, path]), [
    ["write", "archive-setup-probe-fixed/storage-probe.txt"],
    ["read", "archive-setup-probe-fixed/storage-probe.txt"],
    ["remove", "archive-setup-probe-fixed/storage-probe.txt"],
  ]);
});

test("storage probe cleans its generated object after failure or timeout without touching user paths", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const removedAfterFailure = [];
  const failed = await probes.createDataProbes({
    storage: { write: async () => {}, read: async () => { throw new Error("s3://access:topsecret@example.test/user-file"); }, remove: async (path) => removedAfterFailure.push(path) },
    createNamespace: namespace(),
  }).storage();
  assert.equal(failed.code, "STORAGE_UNAVAILABLE");
  assert.deepEqual(removedAfterFailure, ["archive-setup-probe-fixed/storage-probe.txt"]);
  assert.equal(JSON.stringify(failed).includes("topsecret"), false);

  const removedAfterTimeout = [];
  const timedOut = await probes.createDataProbes({
    storage: { write: () => new Promise(() => {}), remove: async (path) => removedAfterTimeout.push(path) },
    createNamespace: namespace(), timeoutMs: 5,
  }).storage();
  assert.equal(timedOut.code, "STORAGE_TIMEOUT");
  assert.deepEqual(removedAfterTimeout, ["archive-setup-probe-fixed/storage-probe.txt"]);
});

test("storage timeout aborts when supported and removes a late write after it completes", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const calls = [];
  let aborted = false;
  const result = await probes.createDataProbes({
    storage: {
      write: (path, _value, { signal }) => new Promise((resolve) => setTimeout(() => { aborted = signal.aborted; calls.push(["write", path]); resolve(); }, 20)),
      remove: async (path) => calls.push(["remove", path]),
    },
    createNamespace: namespace(), timeoutMs: 5,
  }).storage();
  assert.equal(result.code, "STORAGE_TIMEOUT");
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(aborted, true);
  assert.deepEqual(calls, [
    ["remove", "archive-setup-probe-fixed/storage-probe.txt"],
    ["write", "archive-setup-probe-fixed/storage-probe.txt"],
    ["remove", "archive-setup-probe-fixed/storage-probe.txt"],
  ]);
});

test("storage cleanup failure is returned safely instead of a ready or unavailable result", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const result = await probes.createDataProbes({
    storage: { write: async () => {}, read: async () => "archive-setup-probe", remove: async () => { throw new Error("s3://access:topsecret@example.test"); } },
    createNamespace: namespace(),
  }).storage();
  assert.deepEqual(result, {
    ok: false,
    code: "STORAGE_CLEANUP_FAILED",
    message: "Storage probe cleanup could not be confirmed.",
    details: { backend: "storage" },
    nextActions: ["Remove the generated Storage probe namespace before retrying."],
  });
  assert.equal(JSON.stringify(result).includes("topsecret"), false);
});

test("probeAll preserves a machine-readable result per backend", async () => {
  const probes = await loadProbes();
  assert.ok(probes, "data probes module must exist");
  const result = await probes.createDataProbes({
    postgres: { query: async () => ({ rows: [{ archive_probe: 1 }] }) },
    redis: { ping: async () => "PONG", set: async () => {}, get: async () => "archive-setup-probe", del: async () => {} },
    storage: { write: async () => {}, read: async () => "archive-setup-probe", remove: async () => {} },
    createNamespace: namespace(),
  }).all();
  assert.deepEqual(Object.keys(result), ["postgres", "redis", "storage"]);
  assert.equal(result.postgres.ok && result.redis.ok && result.storage.ok, true);
});
