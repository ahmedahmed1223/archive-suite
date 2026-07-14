import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAccessModeManager, createEnvAccessStore } from "./access-mode.mjs";

const publicConfig = (overrides = {}) => ({
  access: "public",
  runtimeProfiles: ["core", "edge"],
  port: 443,
  publicDomain: "archive.example.test",
  ...overrides,
});

function probes(overrides = {}) {
  return {
    portProbe: async () => ({ ok: true }),
    dnsProbe: async () => ({ ok: true }),
    certificateProbe: async () => ({ ok: true }),
    healthProbe: async () => ({ ok: true }),
    ...overrides,
  };
}

test("local and intranet switch without edge or public probes", async () => {
  const applied = [];
  const calls = [];
  const manager = createAccessModeManager({
    store: { snapshot: () => ({ access: "local", runtimeProfiles: ["core"] }), apply: async (value) => applied.push(value), restore: async () => assert.fail("must not restore") },
    ...probes({
      portProbe: async ({ access }) => { calls.push(`port:${access}`); return { ok: true }; },
      dnsProbe: async () => assert.fail("DNS only applies to public"),
      certificateProbe: async () => assert.fail("cert only applies to public"),
    }),
  });

  for (const access of ["local", "intranet"]) {
    const result = await manager.switchAccess({ access, runtimeProfiles: ["core"], port: 3000 });
    assert.equal(result.ok, true);
    assert.equal(result.code, "ACCESS_SWITCHED");
  }
  assert.deepEqual(calls, ["port:local", "port:intranet"]);
  assert.equal(applied.length, 2);
});

test("public access requires edge before any probe or write", async () => {
  let probeCalls = 0;
  let writes = 0;
  const manager = createAccessModeManager({
    store: { snapshot: () => ({}), apply: async () => { writes++; }, restore: async () => {} },
    ...probes({ portProbe: async () => { probeCalls++; return { ok: true }; } }),
  });
  const result = await manager.switchAccess(publicConfig({ runtimeProfiles: ["core"] }));
  assert.equal(result.code, "PUBLIC_ACCESS_REQUIRES_EDGE");
  assert.equal(probeCalls, 0);
  assert.equal(writes, 0);
});

test("edge remains reserved for public access before any probe or write", async () => {
  let probeCalls = 0;
  let writes = 0;
  const manager = createAccessModeManager({
    store: { snapshot: () => ({}), apply: async () => { writes++; }, restore: async () => {} },
    ...probes({ portProbe: async () => { probeCalls++; return { ok: true }; } }),
  });
  const result = await manager.switchAccess({ access: "intranet", runtimeProfiles: ["core", "edge"], port: 3000 });
  assert.equal(result.code, "EDGE_REQUIRES_PUBLIC_ACCESS");
  assert.equal(probeCalls, 0);
  assert.equal(writes, 0);
});

test("port conflict stops before configuration write or health", async () => {
  let writes = 0;
  let healthCalls = 0;
  const manager = createAccessModeManager({
    store: { snapshot: () => ({}), apply: async () => { writes++; }, restore: async () => {} },
    ...probes({ portProbe: async () => ({ ok: false, reason: "in_use" }), healthProbe: async () => { healthCalls++; return { ok: true }; } }),
  });
  const result = await manager.switchAccess({ access: "local", runtimeProfiles: ["core"], port: 3000 });
  assert.equal(result.code, "PORT_CONFLICT");
  assert.equal(writes, 0);
  assert.equal(healthCalls, 0);
});

test("DNS and certificate failures are explicit public preflight contracts without writes", async () => {
  for (const [probe, code] of [["dnsProbe", "DNS_PROBE_FAILED"], ["certificateProbe", "CERTIFICATE_PROBE_FAILED"]]) {
    let writes = 0;
    const manager = createAccessModeManager({
      store: { snapshot: () => ({}), apply: async () => { writes++; }, restore: async () => {} },
      ...probes({ [probe]: async () => ({ ok: false, supported: false }) }),
    });
    const result = await manager.switchAccess(publicConfig());
    assert.equal(result.code, code);
    assert.equal(result.details.supported, false);
    assert.equal(writes, 0);
  }
});

test("health failure restores the atomically captured previous access configuration", async () => {
  const events = [];
  const snapshot = { access: "local", runtimeProfiles: ["core"], raw: "POSTGRES_PASSWORD=do-not-log" };
  const manager = createAccessModeManager({
    store: {
      snapshot: () => snapshot,
      apply: async () => events.push("apply"),
      restore: async (value) => { events.push("restore"); assert.equal(value, snapshot); },
    },
    ...probes({ healthProbe: async () => ({ ok: false }) }),
  });
  const result = await manager.switchAccess(publicConfig());
  assert.equal(result.code, "ACCESS_SWITCH_ROLLED_BACK");
  assert.deepEqual(events, ["apply", "restore"]);
  assert.ok(!JSON.stringify(result).includes("do-not-log"));
  assert.equal(result.details.restored, true);
});

test("environment access store uses atomic writes and never exposes unrelated secrets in its public snapshot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "access-mode-"));
  const envPath = join(dir, ".env");
  writeFileSync(envPath, "POSTGRES_PASSWORD=hidden-value\nACCESS_MODE=local\nARCHIVE_COMPOSE_PROFILES=\n");
  const store = createEnvAccessStore({ envPath });
  const snapshot = store.snapshot();
  assert.deepEqual(store.describe(snapshot), { access: "local", runtimeProfiles: ["core"] });
  await store.apply(publicConfig());
  assert.match(readFileSync(envPath, "utf8"), /ACCESS_MODE=public/);
  assert.match(readFileSync(envPath, "utf8"), /ARCHIVE_COMPOSE_PROFILES=edge/);
  await store.restore(snapshot);
  assert.equal(readFileSync(envPath, "utf8"), "POSTGRES_PASSWORD=hidden-value\nACCESS_MODE=local\nARCHIVE_COMPOSE_PROFILES=\n");
});
