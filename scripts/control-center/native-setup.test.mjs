import assert from "node:assert/strict";
import test from "node:test";

import { createLinuxHostEffects } from "./linux-host-effects.mjs";
import { createWindowsHostEffects } from "./windows-host-effects.mjs";
import { buildNativeRuntime, nativeManifestInput, nativeServiceIds } from "./native-setup.mjs";

const recorder = () => {
  const commands = [];
  const files = [];
  return {
    commands,
    files,
    run: (args) => { commands.push(args); return { status: 0 }; },
    writeFile: (path, content) => files.push({ path, content }),
  };
};

const winConfig = { platform: "windows-native", access: "local", source: "local", runtimeProfiles: ["core"], capabilities: [], storage: { path: "C:\\ArchiveData" } };
const linuxConfig = { platform: "linux-native", access: "local", source: "local", runtimeProfiles: ["core"], capabilities: [], storage: { path: "/srv/archive" } };
const passingStore = (steps) => ({
  beginInstallationOperation: () => ({ decision: { action: "install" } }),
  updateLastSuccessfulStep: ({ step }) => steps.push(step),
  markInstallationFailed: ({ failedStep }) => steps.push(`FAILED:${failedStep}`),
  readInstallationManifest: () => ({ services: nativeServiceIds("windows-native") }),
});
const okProbes = { postgres: async () => ({ ok: true, code: "POSTGRES_READY" }), redis: async () => ({ ok: true, code: "REDIS_READY" }) };

test("Windows host-effects issue the real winsw/icacls commands and write a WinSW definition per service", () => {
  const rec = recorder();
  const effects = createWindowsHostEffects({ installRoot: "C:\\App", run: rec.run, writeFile: rec.writeFile });
  effects.serviceControl.install({ id: "archive-next" });
  effects.applyAcls();
  effects.applyFirewallRules();

  assert.ok(rec.files.some((file) => file.path.endsWith("archive-next.xml") && file.content.includes("<id>archive-next</id>")));
  assert.ok(rec.commands.some((cmd) => cmd[0].endsWith("archive-next.exe") && cmd[1] === "install"));
  assert.ok(rec.commands.some((cmd) => cmd[0] === "icacls"));
  assert.ok(rec.commands.some((cmd) => cmd[0] === "netsh" && cmd.includes("localport=443")));
});

test("Linux host-effects issue systemctl/chown commands and write a systemd unit per service", () => {
  const rec = recorder();
  const effects = createLinuxHostEffects({ installRoot: "/opt/archive-suite", run: rec.run, writeFile: rec.writeFile });
  effects.serviceControl.install({ id: "archive-worker", unit: "archive-worker.service" });
  effects.applyOwnership();
  effects.applyLogrotate();

  assert.ok(rec.files.some((file) => file.path.endsWith("archive-worker.service")));
  assert.ok(rec.commands.some((cmd) => cmd[0] === "systemctl" && cmd[1] === "enable" && cmd[2] === "archive-worker"));
  assert.ok(rec.commands.some((cmd) => cmd[0] === "chown"));
  assert.ok(rec.files.some((file) => file.path.includes("logrotate")));
});

test("a wired Native install runs the full step sequence through real host commands (Windows)", async () => {
  const rec = recorder();
  const steps = [];
  const { adapter } = buildNativeRuntime({
    configuration: winConfig,
    installRoot: "C:\\App",
    run: rec.run,
    writeFile: rec.writeFile,
    health: async () => ({ status: 0 }),
    manifestStore: passingStore(steps),
    manifestRequest: { path: "m.json", input: {} },
    dataPlan: { postgres: { kind: "external", host: "db.internal", port: 5432, database: "archive" }, queue: "database", cache: "database", redis: { enabled: false } },
    probes: okProbes,
  });

  const result = await adapter.install({ path: "m.json", input: {} });
  assert.equal(result.ok, true);
  assert.deepEqual(steps, ["data-services-ready", "acl-applied", "firewall-applied", "services-installed", "services-started"]);
  assert.equal(rec.commands.filter((cmd) => cmd[1] === "install").length, 6);
});

test("without probes a local-managed plan is honestly blocked before any host command runs", async () => {
  const rec = recorder();
  const { adapter } = buildNativeRuntime({
    configuration: linuxConfig,
    run: rec.run,
    writeFile: rec.writeFile,
    manifestStore: passingStore([]),
    manifestRequest: { path: "m.json", input: {} },
    dataPlan: { postgres: { kind: "local-managed" }, queue: "database", cache: "database", redis: { enabled: false } },
  });
  const result = await adapter.install({ path: "m.json", input: {} });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCAL_POSTGRES_UNAVAILABLE");
  assert.equal(rec.commands.length, 0);
});

test("the native manifest records native service ids and mode so uninstall removes exactly them", () => {
  const input = nativeManifestInput(linuxConfig, { version: "1.0.0" });
  assert.equal(input.mode, "native");
  assert.deepEqual(input.services, ["archive-http", "archive-next", "archive-php-fpm", "archive-worker", "archive-reverb", "archive-scheduler"]);
});
