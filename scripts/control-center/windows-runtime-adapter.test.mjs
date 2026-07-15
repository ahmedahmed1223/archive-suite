import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_OPERATIONS } from "./runtime-adapter.mjs";
import { WINDOWS_INSTALL_STEPS, createWindowsNativeRuntimeAdapter, createWindowsServiceRemover } from "./windows-runtime-adapter.mjs";
import { WINDOWS_SERVICES } from "./windows-services.mjs";

const okControl = (calls = []) => ({
  install: (service) => { calls.push(["install", service.id]); return { status: 0 }; },
  remove: (id) => { calls.push(["remove", id]); return { status: 0 }; },
  start: (id) => { calls.push(["start", id]); return { status: 0 }; },
  stop: (id) => { calls.push(["stop", id]); return { status: 0 }; },
  restart: (id) => { calls.push(["restart", id]); return { status: 0 }; },
  query: (id) => { calls.push(["query", id]); return { status: 0 }; },
});

const manifestRequest = { path: "manifest.json", input: { version: "1.2.3" } };
const recordingStore = (calls) => ({
  beginInstallationOperation: (request) => { calls.push(["begin", request.operation]); return { decision: { action: "install" } }; },
  updateLastSuccessfulStep: (request) => calls.push(["success", request.step]),
  markInstallationFailed: (request) => calls.push(["failed", request.failedStep]),
});

test("Windows adapter implements every operation of the shared runtime contract", () => {
  const adapter = createWindowsNativeRuntimeAdapter({ serviceControl: okControl(), health: async () => ({ status: 0 }), logs: () => ({ status: 0 }), exec: () => ({ status: 0 }) });
  for (const operation of RUNTIME_OPERATIONS) assert.equal(typeof adapter[operation], "function", operation);
});

test("install runs the full step sequence in order and records each step in the manifest", async () => {
  const calls = [];
  const adapter = createWindowsNativeRuntimeAdapter({
    serviceControl: okControl(calls),
    applyAcls: () => { calls.push(["acl"]); return { status: 0 }; },
    applyFirewallRules: () => { calls.push(["firewall"]); return { status: 0 }; },
    dataGate: async () => { calls.push(["data-gate"]); return { ok: true }; },
    manifestStore: recordingStore(calls),
    manifestRequest,
  });

  const result = await adapter.install();
  assert.deepEqual(result, { ok: true, supported: true, status: 0 });
  const steps = calls.filter(([kind]) => kind === "success").map(([, step]) => step);
  assert.deepEqual(steps, WINDOWS_INSTALL_STEPS);
  assert.equal(calls.filter(([kind]) => kind === "install").length, WINDOWS_SERVICES.length);
  assert.ok(calls.findIndex(([kind]) => kind === "data-gate") < calls.findIndex(([kind]) => kind === "acl"));
});

test("a failed host preflight blocks the install before any service is touched", async () => {
  const calls = [];
  const adapter = createWindowsNativeRuntimeAdapter({
    serviceControl: okControl(calls),
    preflight: () => ({ ok: false, code: "HOST_DISK_FULL", nextActions: ["Free disk space."] }),
    manifestStore: recordingStore(calls),
    manifestRequest,
  });
  const result = await adapter.install();
  assert.equal(result.ok, false);
  assert.equal(result.code, "HOST_DISK_FULL");
  assert.deepEqual(calls, [["failed", "host-preflight"]]);
});

test("an unhealthy data endpoint blocks the install with the gate verdict and records the step", async () => {
  const calls = [];
  const adapter = createWindowsNativeRuntimeAdapter({
    serviceControl: okControl(calls),
    dataGate: async () => ({ ok: false, code: "DATA_ENDPOINT_UNHEALTHY", nextActions: ["Fix the endpoint."] }),
    manifestStore: recordingStore(calls),
    manifestRequest,
  });
  const result = await adapter.install();
  assert.equal(result.code, "DATA_ENDPOINT_UNHEALTHY");
  assert.deepEqual(calls, [["begin", "install"], ["failed", "data-services-ready"]]);
});

test("a failing service start marks exactly that step failed for resumable repair", async () => {
  const calls = [];
  const control = okControl(calls);
  control.start = (id) => (id === "archive-worker" ? { status: 1 } : { status: 0 });
  const adapter = createWindowsNativeRuntimeAdapter({ serviceControl: control, manifestStore: recordingStore(calls), manifestRequest });
  const result = await adapter.install();
  assert.equal(result.ok, false);
  assert.deepEqual(calls.at(-1), ["failed", "services-started"]);
});

test("resume with no remaining step completes without touching service control", async () => {
  const calls = [];
  const adapter = createWindowsNativeRuntimeAdapter({
    serviceControl: okControl(calls),
    manifestStore: {
      beginInstallationOperation: () => ({ decision: { action: "resume", after: "services-started", nextStep: null } }),
      updateLastSuccessfulStep: (request) => calls.push(["success", request.step]),
      markInstallationFailed: () => calls.push(["failed"]),
    },
    manifestRequest,
  });
  assert.deepEqual(await adapter.repair(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(calls, [["success", "services-started"]]);
});

test("start/stop/restart/status fan out over every owned service and surface the first failure", async () => {
  const calls = [];
  const adapter = createWindowsNativeRuntimeAdapter({ serviceControl: okControl(calls) });
  assert.equal(adapter.stop().ok, true);
  assert.equal(calls.filter(([kind]) => kind === "stop").length, WINDOWS_SERVICES.length);

  const failing = okControl();
  failing.restart = () => ({ status: 1 });
  assert.equal(createWindowsNativeRuntimeAdapter({ serviceControl: failing }).restart().ok, false);
});

test("update, rollback, and uninstall stay programmatically unsupported until injected", () => {
  const adapter = createWindowsNativeRuntimeAdapter({ serviceControl: okControl() });
  for (const operation of ["update", "rollback", "uninstall"]) {
    assert.deepEqual(adapter[operation](), { ok: false, supported: false, operation, reason: "unsupported" });
  }
});

test("service remover removes only manifest-owned services and their firewall rules", async () => {
  const calls = [];
  const remover = createWindowsServiceRemover({
    serviceControl: okControl(calls),
    removeFirewallRules: (services) => { calls.push(["firewall-remove", services]); return { status: 0 }; },
  });
  const manifest = { services: ["archive-http", "archive-next"] };
  assert.deepEqual(await remover({ manifest }), { ok: true });
  assert.deepEqual(calls.filter(([kind]) => kind === "remove").map(([, id]) => id), ["archive-http", "archive-next"]);
  assert.deepEqual(calls.at(-1), ["firewall-remove", ["archive-http", "archive-next"]]);

  const failing = okControl();
  failing.remove = () => ({ status: 1 });
  assert.deepEqual(await createWindowsServiceRemover({ serviceControl: failing })({ manifest }), { ok: false });
});
