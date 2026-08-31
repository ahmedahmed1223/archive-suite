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

test("a managed installer failure returns a bounded diagnostic without credentials", async () => {
  const provision = createManagedDataProvisioner({
    platform: "linux-native",
    effects: {
      ...effects([]),
      installPostgres: async () => ({ status: 1, stderr: "initdb: failed with password owner-secret" }),
    },
    probes: readyProbes,
    secrets: { dbOwnerPassword: "owner-secret", dbAppPassword: "app-secret", redisPassword: "cache-secret" },
  });

  const result = await provision(managedPlan());

  assert.equal(result.ok, false);
  assert.equal(result.code, "MANAGED_POSTGRES_INSTALL_FAILED");
  assert.equal(result.details.step, "installPostgres");
  assert.match(result.details.installerDiagnostic, /initdb: failed/);
  assert.doesNotMatch(result.details.installerDiagnostic, /owner-secret|app-secret|cache-secret/);
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

test("a deferred secret supplier is not invoked for an external data plan", async () => {
  const calls = [];
  const provision = createManagedDataProvisioner({
    platform: "windows-native",
    effects: effects(calls),
    probes: readyProbes,
    secrets: () => { throw new Error("managed secrets must not be created for external data"); },
  });

  const result = await provision({ postgres: { kind: "external" }, redis: { enabled: false }, pgAdmin: false });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, []);
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
