/**
 * Unit tests for drDrill.js and healthProbe.js
 * node:test style — 5 tests.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createDrDrillScheduler } from "../backup/enterprise/drDrill.js";
import { createHealthProbe } from "../backup/enterprise/healthProbe.js";

// ── Shared helpers ─────────────────────────────────────────────────────────

function makeEntry(overrides = {}) {
  return {
    backupId: "unit-test-entry",
    createdAt: new Date().toISOString(),
    sizeBytes: 512,
    sha256: "c".repeat(64),
    region: "us-east-1",
    bucket: "unit-bucket",
    key: "backups/unit.json.gz",
    encryption: "none",
    ...overrides,
  };
}

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

// ── Test 1 ─────────────────────────────────────────────────────────────────

await test("drDrill: runDrillNow returns passed:true for successful smoke run", async () => {
  const entry = makeEntry();
  const scheduler = createDrDrillScheduler({
    restoreSmokeRunner: async () => ({ ok: true, errors: [], durationMs: 10 }),
    manifest: { getEntries: () => [entry] },
    config: { backup: { replication: { drillIntervalHours: 24, encryptionKey: "" } } },
    logger: silentLogger,
  });

  const result = await scheduler.runDrillNow();
  assert.equal(result.passed, true);
  assert.equal(result.replicaId, entry.backupId);
  assert.ok(typeof result.durationMs === "number");
});

// ── Test 2 ─────────────────────────────────────────────────────────────────

await test("drDrill: runDrillNow returns passed:false when smoke returns ok:false", async () => {
  const entry = makeEntry({ backupId: "bad-entry" });
  const scheduler = createDrDrillScheduler({
    restoreSmokeRunner: async () => ({ ok: false, errors: ["SHA-256 mismatch"], durationMs: 5 }),
    manifest: { getEntries: () => [entry] },
    config: { backup: { replication: { drillIntervalHours: 24, encryptionKey: "" } } },
    logger: silentLogger,
  });

  const result = await scheduler.runDrillNow();
  assert.equal(result.passed, false);
  assert.ok(result.error.includes("SHA-256 mismatch"));
});

// ── Test 3 ─────────────────────────────────────────────────────────────────

await test("drDrill: runDrillNow returns passed:false with error message when smoke throws", async () => {
  const entry = makeEntry({ backupId: "throw-entry" });
  const scheduler = createDrDrillScheduler({
    restoreSmokeRunner: async () => { throw new Error("Network timeout"); },
    manifest: { getEntries: () => [entry] },
    config: { backup: { replication: { drillIntervalHours: 24, encryptionKey: "" } } },
    logger: silentLogger,
  });

  const result = await scheduler.runDrillNow();
  assert.equal(result.passed, false);
  assert.ok(typeof result.error === "string");
  assert.ok(result.error.includes("Network timeout"));
});

// ── Test 4 ─────────────────────────────────────────────────────────────────

await test("drDrill: runDrillNow returns passed:false when manifest is empty", async () => {
  const scheduler = createDrDrillScheduler({
    restoreSmokeRunner: async () => { throw new Error("Should not be called"); },
    manifest: { getEntries: () => [] },
    config: { backup: { replication: { drillIntervalHours: 24, encryptionKey: "" } } },
    logger: silentLogger,
  });

  const result = await scheduler.runDrillNow();
  assert.equal(result.passed, false);
  assert.equal(result.replicaId, null);
  assert.ok(result.error.includes("No restorable replica"));
});

// ── Test 5 ─────────────────────────────────────────────────────────────────

await test("drDrill: getHistory stores results and is bounded to 100 entries", async () => {
  const entry = makeEntry({ backupId: "history-entry" });
  const scheduler = createDrDrillScheduler({
    restoreSmokeRunner: async () => ({ ok: true, errors: [], durationMs: 1 }),
    manifest: { getEntries: () => [entry] },
    config: { backup: { replication: { drillIntervalHours: 24, encryptionKey: "" } } },
    logger: silentLogger,
  });

  // Run 3 drills
  await scheduler.runDrillNow();
  await scheduler.runDrillNow();
  await scheduler.runDrillNow();

  const history = scheduler.getHistory();
  assert.ok(history.length === 3, `expected 3 history entries, got ${history.length}`);
  assert.equal(history[0].passed, true);
  // Each history entry should have a ranAt field
  assert.ok(typeof history[0].ranAt === "string", "history entries should have ranAt timestamp");
});
