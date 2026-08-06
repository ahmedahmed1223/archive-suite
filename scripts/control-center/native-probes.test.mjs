import { test } from "node:test";
import assert from "node:assert/strict";
import { createExternalOnlyProbes } from "./native-probes.mjs";

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
