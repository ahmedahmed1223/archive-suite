import assert from "node:assert/strict";
import test from "node:test";

import { createNativeDataGate, resolveNativeDataPlan } from "./native-data-services.mjs";
import { RUNTIME_OPERATIONS } from "./runtime-adapter.mjs";
import { LINUX_INSTALL_STEPS, createLinuxNativeRuntimeAdapter, createLinuxServiceRemover } from "./linux-runtime-adapter.mjs";
import { LINUX_SERVICES } from "./linux-services.mjs";

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

test("Linux adapter implements every operation of the shared runtime contract", () => {
  const adapter = createLinuxNativeRuntimeAdapter({ serviceControl: okControl(), health: async () => ({ status: 0 }), logs: () => ({ status: 0 }), exec: () => ({ status: 0 }) });
  for (const operation of RUNTIME_OPERATIONS) assert.equal(typeof adapter[operation], "function", operation);
});

test("install runs ownership, logrotate, optional firewall, then systemd units in order", async () => {
  const calls = [];
  const adapter = createLinuxNativeRuntimeAdapter({
    serviceControl: okControl(calls),
    applyOwnership: () => { calls.push(["ownership"]); return { status: 0 }; },
    applyLogrotate: () => { calls.push(["logrotate"]); return { status: 0 }; },
    applyFirewallRules: () => { calls.push(["firewall"]); return { status: 0 }; },
    dataGate: async () => ({ ok: true }),
    manifestStore: recordingStore(calls),
    manifestRequest,
  });

  const result = await adapter.install();
  assert.deepEqual(result, { ok: true, supported: true, status: 0 });
  const steps = calls.filter(([kind]) => kind === "success").map(([, step]) => step);
  assert.deepEqual(steps, LINUX_INSTALL_STEPS);
  assert.equal(calls.filter(([kind]) => kind === "install").length, LINUX_SERVICES.length);
});

test("firewall is optional: install completes without an injected firewall effect", async () => {
  const calls = [];
  const adapter = createLinuxNativeRuntimeAdapter({ serviceControl: okControl(calls), manifestStore: recordingStore(calls), manifestRequest });
  const result = await adapter.install();
  assert.equal(result.ok, true);
  assert.ok(calls.some(([kind, step]) => kind === "success" && step === "firewall-applied"));
});

test("V1-211C: an unreachable PostgreSQL blocks the install, and the same gate passes after recovery", async () => {
  let healthy = false;
  const probes = { postgres: async () => (healthy ? { ok: true, code: "POSTGRES_READY" } : { ok: false, code: "POSTGRES_UNAVAILABLE" }), redis: async () => ({ ok: true, code: "REDIS_READY" }) };
  const { plan } = resolveNativeDataPlan({ postgres: { kind: "external", host: "db.example.internal", port: 5432, database: "archive" } });
  const calls = [];
  const adapter = createLinuxNativeRuntimeAdapter({
    serviceControl: okControl(calls),
    dataGate: createNativeDataGate({ probes }),
    dataPlan: plan,
    manifestStore: recordingStore(calls),
    manifestRequest,
  });

  const blocked = await adapter.install();
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "DATA_ENDPOINT_UNHEALTHY");
  assert.ok(calls.some(([kind, step]) => kind === "failed" && step === "data-services-ready"));
  assert.equal(calls.filter(([kind]) => kind === "install").length, 0);

  healthy = true; // the endpoint recovers; repair resumes the same lifecycle
  const recovered = await adapter.repair();
  assert.equal(recovered.ok, true);
  assert.equal(calls.filter(([kind]) => kind === "install").length, LINUX_SERVICES.length);
});

test("V1-211C: service restart fans out over every systemd unit and surfaces a unit failure", () => {
  const calls = [];
  const adapter = createLinuxNativeRuntimeAdapter({ serviceControl: okControl(calls) });
  assert.equal(adapter.restart().ok, true);
  assert.equal(calls.filter(([kind]) => kind === "restart").length, LINUX_SERVICES.length);

  const failing = okControl();
  failing.restart = (id) => ({ status: id === "archive-worker" ? 1 : 0 });
  assert.equal(createLinuxNativeRuntimeAdapter({ serviceControl: failing }).restart().ok, false);
});

test("a failing unit start marks exactly that step failed for resumable repair", async () => {
  const calls = [];
  const control = okControl(calls);
  control.start = (id) => (id === "archive-reverb" ? { status: 1 } : { status: 0 });
  const adapter = createLinuxNativeRuntimeAdapter({ serviceControl: control, manifestStore: recordingStore(calls), manifestRequest });
  const result = await adapter.install();
  assert.equal(result.ok, false);
  assert.deepEqual(calls.at(-1), ["failed", "services-started"]);
});

test("service remover removes only manifest-owned units and their firewall rules", async () => {
  const calls = [];
  const remover = createLinuxServiceRemover({
    serviceControl: okControl(calls),
    removeFirewallRules: (services) => { calls.push(["firewall-remove", services]); return { status: 0 }; },
  });
  const manifest = { services: ["archive-http", "archive-next"] };
  assert.deepEqual(await remover({ manifest }), { ok: true });
  assert.deepEqual(calls.filter(([kind]) => kind === "remove").map(([, id]) => id), ["archive-http", "archive-next"]);
});

test("update, rollback, and uninstall stay programmatically unsupported until injected", () => {
  const adapter = createLinuxNativeRuntimeAdapter({ serviceControl: okControl() });
  for (const operation of ["update", "rollback", "uninstall"]) {
    assert.deepEqual(adapter[operation](), { ok: false, supported: false, operation, reason: "unsupported" });
  }
});
