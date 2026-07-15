import assert from "node:assert/strict";
import test from "node:test";

import { createWindowsDataGate, resolveWindowsDataPlan } from "./windows-data-services.mjs";

const okProbe = (code) => async () => ({ ok: true, code });
const badProbe = (code) => async () => ({ ok: false, code });

test("data plan resolves local-managed and external choices onto the database queue/cache baseline", () => {
  const local = resolveWindowsDataPlan({ postgres: { kind: "local-managed" } });
  assert.equal(local.ok, true);
  assert.deepEqual(local.plan, { postgres: { kind: "local-managed" }, queue: "database", cache: "database", redis: { enabled: false } });

  const external = resolveWindowsDataPlan({ postgres: { kind: "external", host: "db.example.internal", port: 5432, database: "archive" }, redis: { enabled: true, host: "cache.example.internal", port: 6379 } });
  assert.equal(external.ok, true);
  assert.equal(external.plan.postgres.host, "db.example.internal");
  assert.equal(external.plan.redis.enabled, true);
});

test("data plan rejects a missing choice and endpoints carrying credentials or URLs", () => {
  assert.equal(resolveWindowsDataPlan({}).code, "DATA_POSTGRES_CHOICE_REQUIRED");
  assert.equal(resolveWindowsDataPlan({ postgres: { kind: "external", host: "user:pw@db", port: 5432, database: "archive" } }).code, "DATA_POSTGRES_ENDPOINT_INVALID");
  assert.equal(resolveWindowsDataPlan({ postgres: { kind: "external", host: "db.example.internal", port: 0, database: "archive" } }).code, "DATA_POSTGRES_ENDPOINT_INVALID");
  assert.equal(resolveWindowsDataPlan({ postgres: { kind: "local-managed" }, redis: { enabled: true, host: "redis://cache", port: 6379 } }).code, "DATA_REDIS_ENDPOINT_INVALID");
});

test("switching between local and external is a pure re-resolve of the new configuration", () => {
  const before = resolveWindowsDataPlan({ postgres: { kind: "local-managed" } });
  const after = resolveWindowsDataPlan({ postgres: { kind: "external", host: "db.example.internal", port: 5432, database: "archive" } });
  assert.equal(before.plan.postgres.kind, "local-managed");
  assert.equal(after.plan.postgres.kind, "external");
  assert.equal(after.plan.queue, "database");
});

test("gate blocks the install on an unhealthy PostgreSQL endpoint before anything is created", async () => {
  const gate = createWindowsDataGate({ probes: { postgres: badProbe("POSTGRES_UNAVAILABLE"), redis: okProbe("REDIS_READY") } });
  const { plan } = resolveWindowsDataPlan({ postgres: { kind: "external", host: "db.example.internal", port: 5432, database: "archive" } });
  const verdict = await gate(plan);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "DATA_ENDPOINT_UNHEALTHY");
  assert.equal(verdict.details.probe, "POSTGRES_UNAVAILABLE");
});

test("gate accepts redis only after its probe succeeds and blocks it otherwise", async () => {
  const { plan } = resolveWindowsDataPlan({ postgres: { kind: "external", host: "db.example.internal", port: 5432, database: "archive" }, redis: { enabled: true, host: "cache.example.internal", port: 6379 } });

  const blocked = await createWindowsDataGate({ probes: { postgres: okProbe("POSTGRES_READY"), redis: badProbe("REDIS_TIMEOUT") } })(plan);
  assert.equal(blocked.code, "REDIS_ENDPOINT_UNHEALTHY");

  const ready = await createWindowsDataGate({ probes: { postgres: okProbe("POSTGRES_READY"), redis: okProbe("REDIS_READY") } })(plan);
  assert.equal(ready.ok, true);
  assert.deepEqual(ready.details, { postgres: "external", queue: "database", cache: "database", redis: true });
});

test("gate starts the managed instance when chosen and reports a start failure with a stable code", async () => {
  const calls = [];
  const { plan } = resolveWindowsDataPlan({ postgres: { kind: "local-managed" } });

  const ready = await createWindowsDataGate({ probes: { postgres: okProbe("POSTGRES_READY"), redis: okProbe("REDIS_READY") }, startLocalPostgres: async () => calls.push("start") })(plan);
  assert.equal(ready.ok, true);
  assert.deepEqual(calls, ["start"]);

  const failed = await createWindowsDataGate({ probes: { postgres: okProbe("POSTGRES_READY"), redis: okProbe("REDIS_READY") }, startLocalPostgres: async () => { throw new Error("no data dir"); } })(plan);
  assert.equal(failed.code, "LOCAL_POSTGRES_START_FAILED");

  const unwired = await createWindowsDataGate({ probes: { postgres: okProbe("POSTGRES_READY"), redis: okProbe("REDIS_READY") } })(plan);
  assert.equal(unwired.code, "LOCAL_POSTGRES_UNAVAILABLE");
});
