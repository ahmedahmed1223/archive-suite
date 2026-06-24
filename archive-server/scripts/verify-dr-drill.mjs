/**
 * Verify DR Drill + Health-probe primitives (node:test style).
 *
 * Tests:
 *   1. healthProbe reports healthy when fetch returns 200
 *   2. healthProbe counts consecutive failures and calls onFailoverNeeded after threshold
 *   3. healthProbe recovers and calls onRecovered
 *   4. drDrill.runDrillNow returns { passed: true } when restoreSmoke succeeds (injectable mock)
 *   5. drDrill.runDrillNow returns { passed: false, error } when restoreSmoke throws
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createHealthProbe } from "../src/backup/enterprise/healthProbe.js";
import { createDrDrillScheduler } from "../src/backup/enterprise/drDrill.js";

// ---------------------------------------------------------------------------
// Test 1 — healthProbe reports healthy when fetch returns 200
// ---------------------------------------------------------------------------

await test("healthProbe: reports healthy when probe URL returns 200", async () => {
  const fakeFetch = async () => ({ ok: true, status: 200 });

  const probe = createHealthProbe({
    probeUrl: "http://fake-primary/api/health",
    intervalMs: 60_000,
    failThreshold: 3,
    fetchImpl: fakeFetch,
  });

  // Manually trigger a probe by calling the internal poll once via a short interval trick.
  // We do this by temporarily setting intervalMs to 1ms, letting it fire, then stopping.
  const shortProbe = createHealthProbe({
    probeUrl: "http://fake-primary/api/health",
    intervalMs: 10,
    failThreshold: 3,
    fetchImpl: fakeFetch,
  });

  shortProbe.start();
  await new Promise((resolve) => setTimeout(resolve, 50));
  shortProbe.stop();

  const status = shortProbe.getStatus();
  assert.equal(status.healthy, true, "should be healthy after 200 response");
  assert.equal(status.consecutiveFails, 0, "no consecutive fails");
  assert.ok(status.lastCheck instanceof Date, "lastCheck should be a Date");
});

// ---------------------------------------------------------------------------
// Test 2 — healthProbe counts failures and calls onFailoverNeeded after threshold
// ---------------------------------------------------------------------------

await test("healthProbe: calls onFailoverNeeded after failThreshold consecutive failures", async () => {
  const fakeFetch = async () => ({ ok: false, status: 503 });

  const failoverCalls = [];

  const probe = createHealthProbe({
    probeUrl: "http://fake-primary/api/health",
    intervalMs: 10,
    failThreshold: 3,
    fetchImpl: fakeFetch,
    onFailoverNeeded: (status) => failoverCalls.push(status),
  });

  probe.start();
  // Wait enough for 3+ polls to fire
  await new Promise((resolve) => setTimeout(resolve, 100));
  probe.stop();

  const status = probe.getStatus();
  assert.equal(status.healthy, false, "probe should be unhealthy after repeated failures");
  assert.ok(status.consecutiveFails >= 3, `consecutiveFails should be >= 3, got ${status.consecutiveFails}`);
  assert.ok(failoverCalls.length >= 1, "onFailoverNeeded should have been called");
  assert.equal(failoverCalls[0].healthy, false, "status passed to onFailoverNeeded should have healthy=false");
});

// ---------------------------------------------------------------------------
// Test 3 — healthProbe recovers and calls onRecovered
// ---------------------------------------------------------------------------

await test("healthProbe: calls onRecovered when probe recovers after failure", async () => {
  let callCount = 0;
  // First 4 calls fail, then succeed
  const fakeFetch = async () => {
    callCount++;
    if (callCount <= 4) return { ok: false, status: 503 };
    return { ok: true, status: 200 };
  };

  const failoverCalls = [];
  const recoverCalls = [];

  const probe = createHealthProbe({
    probeUrl: "http://fake-primary/api/health",
    intervalMs: 10,
    failThreshold: 3,
    fetchImpl: fakeFetch,
    onFailoverNeeded: (status) => failoverCalls.push(status),
    onRecovered: (status) => recoverCalls.push(status),
  });

  probe.start();
  // Wait enough for 5+ polls (4 fail, 1+ succeed)
  await new Promise((resolve) => setTimeout(resolve, 150));
  probe.stop();

  assert.ok(failoverCalls.length >= 1, "onFailoverNeeded should have been called");
  assert.ok(recoverCalls.length >= 1, "onRecovered should have been called");
  assert.equal(recoverCalls[0].healthy, true, "status passed to onRecovered should be healthy");
  assert.equal(probe.getStatus().healthy, true, "probe should be healthy after recovery");
});

// ---------------------------------------------------------------------------
// Test 4 — drDrill.runDrillNow returns { passed: true } when smoke succeeds
// ---------------------------------------------------------------------------

await test("drDrill: runDrillNow returns { passed: true } when restoreSmoke succeeds", async () => {
  const mockEntry = {
    backupId: "drill-test-001",
    createdAt: new Date().toISOString(),
    sizeBytes: 1024,
    sha256: "a".repeat(64),
    region: "us-east-1",
    bucket: "test-bucket",
    key: "backups/drill-test.json.gz",
    encryption: "none",
  };

  const mockManifest = {
    getEntries: () => [mockEntry],
  };

  const mockRestoreSmoke = async () => ({ ok: true, errors: [], durationMs: 42 });

  const scheduler = createDrDrillScheduler({
    restoreSmokeRunner: mockRestoreSmoke,
    manifest: mockManifest,
    config: { backup: { replication: { drillIntervalHours: 24, encryptionKey: "" } } },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  const result = await scheduler.runDrillNow();

  assert.equal(result.passed, true, "should return passed: true");
  assert.equal(result.replicaId, "drill-test-001", "replicaId should match manifest entry");
  assert.ok(typeof result.durationMs === "number", "durationMs should be a number");
  assert.ok(!result.error, "no error on success");
});

// ---------------------------------------------------------------------------
// Test 5 — drDrill.runDrillNow returns { passed: false, error } when smoke throws
// ---------------------------------------------------------------------------

await test("drDrill: runDrillNow returns { passed: false, error } when restoreSmoke throws", async () => {
  const mockEntry = {
    backupId: "drill-fail-001",
    createdAt: new Date().toISOString(),
    sizeBytes: 1024,
    sha256: "b".repeat(64),
    region: "us-east-1",
    bucket: "test-bucket",
    key: "backups/drill-fail.json.gz",
    encryption: "none",
  };

  const mockManifest = {
    getEntries: () => [mockEntry],
  };

  const mockRestoreSmoke = async () => {
    throw new Error("S3 connection refused");
  };

  const scheduler = createDrDrillScheduler({
    restoreSmokeRunner: mockRestoreSmoke,
    manifest: mockManifest,
    config: { backup: { replication: { drillIntervalHours: 24, encryptionKey: "" } } },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  const result = await scheduler.runDrillNow();

  assert.equal(result.passed, false, "should return passed: false");
  assert.equal(result.replicaId, "drill-fail-001", "replicaId should match");
  assert.ok(typeof result.error === "string", "error should be a string");
  assert.ok(result.error.includes("S3 connection refused"), `error should include the thrown message, got: ${result.error}`);
});
