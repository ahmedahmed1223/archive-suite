import assert from "node:assert/strict";
import test from "node:test";

import { createManagedDataProvisioner } from "./native-managed-data.mjs";

const readyProbes = {
  postgres: async () => ({ ok: true }),
  pgvector: async () => ({ ok: true }),
  redis: async () => ({ ok: true }),
};

const managedPlan = (overrides = {}) => ({
  postgres: { kind: "managed" },
  redis: { kind: "managed" },
  pgAdmin: false,
  ...overrides,
});

function effects(calls) {
  return Object.fromEntries(["installPostgres", "installPgvector", "createArchiveRoles", "installRedisCompatible", "installPgAdmin"].map((name) => [name, async () => {
    calls.push(name);
    return { status: 0 };
  }]));
}

test("managed Windows data installs PostgreSQL, pgvector, Redis-compatible cache, and requested pgAdmin before probing", async () => {
  const calls = [];
  const provision = createManagedDataProvisioner({
    platform: "windows-native",
    effects: effects(calls),
    probes: readyProbes,
    secrets: { dbOwnerPassword: "owner", dbAppPassword: "app", redisPassword: "cache" },
  });

  const result = await provision(managedPlan({ pgAdmin: true }));

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["installPostgres", "installPgvector", "createArchiveRoles", "installRedisCompatible", "installPgAdmin"]);
  assert.deepEqual(result.ownership, [
    { id: "postgres", ownership: "managed-owned" },
    { id: "redis", ownership: "managed-owned" },
  ]);
});

test("a failing pgvector probe blocks success after data provisioning", async () => {
  const provision = createManagedDataProvisioner({
    platform: "linux-native",
    effects: effects([]),
    probes: { ...readyProbes, pgvector: async () => ({ ok: false }) },
    secrets: { dbOwnerPassword: "owner", dbAppPassword: "app", redisPassword: "cache" },
  });

  const result = await provision(managedPlan());

  assert.equal(result.ok, false);
  assert.equal(result.code, "PGVECTOR_UNHEALTHY");
});

test("external data performs probes without installing managed dependencies", async () => {
  const calls = [];
  const provision = createManagedDataProvisioner({
    platform: "linux-native",
    effects: effects(calls),
    probes: readyProbes,
    secrets: { dbOwnerPassword: "owner", dbAppPassword: "app", redisPassword: "cache" },
  });

  const result = await provision({ postgres: { kind: "external" }, redis: { kind: "external" }, pgAdmin: false });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, []);
  assert.deepEqual(result.ownership, [
    { id: "postgres", ownership: "external" },
    { id: "redis", ownership: "external" },
  ]);
});

test("disabled Redis leaves cache services untouched while PostgreSQL, pgvector, and pgAdmin remain required", async () => {
  const calls = [];
  let redisProbed = false;
  const provision = createManagedDataProvisioner({
    platform: "windows-native",
    effects: effects(calls),
    probes: { ...readyProbes, redis: async () => { redisProbed = true; return { ok: true }; } },
    secrets: { dbOwnerPassword: "owner", dbAppPassword: "app", redisPassword: "cache" },
  });

  const result = await provision({ postgres: { kind: "managed" }, redis: { enabled: false }, pgAdmin: true });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["installPostgres", "installPgvector", "createArchiveRoles", "installPgAdmin"]);
  assert.equal(redisProbed, false);
  assert.deepEqual(result.ownership, [
    { id: "postgres", ownership: "managed-owned" },
    { id: "redis", ownership: "disabled" },
  ]);
});
