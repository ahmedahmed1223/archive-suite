import { test } from "node:test";
import assert from "node:assert/strict";
import { createExternalOnlyProbes, createManagedNativeProbes } from "./native-probes.mjs";

test("postgres probe reports ok:true when a TCP connection to the endpoint succeeds", async () => {
  const fakeConnect = async (host, port) => { assert.equal(host, "db.example.internal"); assert.equal(port, 5432); return true; };
  const probes = createExternalOnlyProbes({ tcpConnect: fakeConnect });
  const result = await probes.postgres({ host: "db.example.internal", port: 5432 });
  assert.equal(result.ok, true);
});

test("postgres probe reports a clear failure when the endpoint is unreachable", async () => {
  const fakeConnect = async () => { throw new Error("ECONNREFUSED"); };
  const probes = createExternalOnlyProbes({ tcpConnect: fakeConnect });
  const result = await probes.postgres({ host: "db.example.internal", port: 5432 });
  assert.equal(result.ok, false);
  assert.match(result.message, /ECONNREFUSED|unreachable/i);
});

test("local-managed postgres plan is rejected with the documented not-bundled message", async () => {
  const probes = createExternalOnlyProbes({ tcpConnect: async () => true });
  const result = await probes.postgres({ kind: "local-managed" });
  assert.equal(result.ok, false);
  assert.match(result.code, /LOCAL_POSTGRES_UNAVAILABLE/);
});

test("managed Linux PostgreSQL probes preserve the bundled library path", async () => {
  const calls = [];
  const probes = createManagedNativeProbes({
    platform: "linux-native",
    installRoot: "/opt/archive-suite",
    secrets: { dbOwnerPassword: "owner" },
    run: (args, options) => {
      calls.push({ args, options });
      return { status: 0, stdout: "0.8.6\n" };
    },
  });

  assert.equal((await probes.postgres()).ok, true);
  assert.equal((await probes.pgvector()).ok, true);
  assert.deepEqual(calls.map(({ args }) => args[0]), [
    "/opt/archive-suite/runtime/postgres/bin/psql",
    "/opt/archive-suite/runtime/postgres/bin/psql",
  ]);
  assert.deepEqual(calls.map(({ options }) => options.env), [
    { PGPASSWORD: "owner", LD_LIBRARY_PATH: "/opt/archive-suite/runtime/postgres/lib" },
    { PGPASSWORD: "owner", LD_LIBRARY_PATH: "/opt/archive-suite/runtime/postgres/lib" },
  ]);
});
