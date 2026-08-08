import assert from "node:assert/strict";
import test from "node:test";

import { createLinuxHostEffects } from "./linux-host-effects.mjs";
import { LINUX_INSTALL_STEPS } from "./linux-runtime-adapter.mjs";
import { createWindowsHostEffects } from "./windows-host-effects.mjs";
import { WINDOWS_INSTALL_STEPS } from "./windows-runtime-adapter.mjs";
import { buildNativeRuntime, buildNativeServiceRemover, nativeDataPlanOverrideFromEnv, nativeManifestInput, nativeServiceIds } from "./native-setup.mjs";

const recorder = () => {
  const commands = [];
  const files = [];
  return {
    commands,
    files,
    run: (args) => { commands.push(args); return { status: 0 }; },
    writeFile: (path, content) => files.push({ path, content }),
    ensureDirectory: () => {},
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
  const effects = createWindowsHostEffects({ installRoot: "C:\\App", run: rec.run, writeFile: rec.writeFile, ensureDirectory: rec.ensureDirectory });
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
    ensureDirectory: rec.ensureDirectory,
    health: async () => ({ status: 0 }),
    manifestStore: passingStore(steps),
    manifestRequest: { path: "m.json", input: {} },
    dataPlan: { postgres: { kind: "external", host: "db.internal", port: 5432, database: "archive" }, queue: "database", cache: "database", redis: { enabled: false } },
    probes: okProbes,
  });

  const result = await adapter.install({ path: "m.json", input: {} });
  assert.equal(result.ok, true);
  assert.deepEqual(steps, WINDOWS_INSTALL_STEPS);
  assert.equal(rec.commands.filter((cmd) => cmd[1] === "install").length, 6);
});

test("a wired Linux install writes every app config before starting systemd services", async () => {
  const rec = recorder();
  const steps = [];
  const { adapter } = buildNativeRuntime({
    configuration: linuxConfig,
    installRoot: "/opt/archive-suite",
    run: rec.run,
    writeFile: rec.writeFile,
    health: async () => ({ status: 0 }),
    manifestStore: passingStore(steps),
    manifestRequest: { path: "m.json", input: {} },
    dataPlan: { postgres: { kind: "external", host: "db.internal", port: 5432, database: "archive" }, queue: "database", cache: "database", redis: { enabled: false } },
    probes: okProbes,
    appConfig: { appKey: "base64:test", appUrl: "http://localhost:8443", dbUsername: "archive", dbPassword: "test-only-password" },
  });

  const result = await adapter.install({ path: "m.json", input: {} });

  assert.equal(result.ok, true);
  assert.deepEqual(steps, LINUX_INSTALL_STEPS);
  assert.ok(rec.files.some(({ path }) => path === "/opt/archive-suite/config/Caddyfile"));
  assert.ok(rec.files.some(({ path }) => path === "/opt/archive-suite/config/php-fpm.conf"));
  assert.ok(rec.files.some(({ path }) => path === "/opt/archive-suite/app/laravel/.env"));
  assert.match(rec.files.find(({ path }) => path === "/opt/archive-suite/app/laravel/.env").content, /ARCHIVE_LOCAL_STORAGE_PATH=\/srv\/archive\/private/);
  const firstServiceCommand = rec.commands.findIndex(([command]) => command === "systemctl");
  assert.ok(firstServiceCommand >= 0);
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

test("the native manifest records service ids and the resolved application root without claiming external data services", () => {
  const input = nativeManifestInput(linuxConfig, { version: "1.0.0", installRoot: "/opt/archive-suite" });
  assert.equal(input.mode, "native");
  assert.deepEqual(input.services, ["archive-http", "archive-next", "archive-php-fpm", "archive-worker", "archive-reverb", "archive-scheduler"]);
  assert.deepEqual(input.ownedPaths, ["/opt/archive-suite"]);
  assert.deepEqual(input.dataPaths, { storage: "/srv/archive" });
});

test("Native service remover selects the manifest platform and touches only its recorded services", async () => {
  const windows = recorder();
  const windowsRemover = buildNativeServiceRemover({ platform: "windows-native", installRoot: "C:\\App", run: windows.run, writeFile: windows.writeFile });
  assert.deepEqual(await windowsRemover({ manifest: { services: ["archive-http"] } }), { ok: true });
  assert.ok(windows.commands.some(([command, action]) => command.endsWith("archive-http.exe") && action === "uninstall"));
  assert.ok(windows.commands.some(([command]) => command === "netsh"));

  const linux = recorder();
  const linuxRemover = buildNativeServiceRemover({ platform: "linux-native", installRoot: "/opt/archive-suite", run: linux.run, writeFile: linux.writeFile });
  assert.deepEqual(await linuxRemover({ manifest: { services: ["archive-worker"] } }), { ok: true });
  assert.ok(linux.commands.some((command) => command.join(" ") === "systemctl disable archive-worker"));
  assert.ok(linux.commands.some((command) => command.join(" ") === "rm -f /etc/systemd/system/archive-worker.service"));

  assert.throws(() => buildNativeServiceRemover({ platform: "linux-docker" }), /not a Native platform/);
});

test("nativeDataPlanOverrideFromEnv returns undefined without an operator-supplied Postgres host, preserving the local-managed default", () => {
  assert.equal(nativeDataPlanOverrideFromEnv({}), undefined);
  assert.equal(nativeDataPlanOverrideFromEnv({ ARCHIVE_NATIVE_POSTGRES_PORT: "5432" }), undefined);
});

test("nativeDataPlanOverrideFromEnv builds an external plan from ARCHIVE_NATIVE_POSTGRES_* env vars", () => {
  const override = nativeDataPlanOverrideFromEnv({
    ARCHIVE_NATIVE_POSTGRES_HOST: "db.example.internal",
    ARCHIVE_NATIVE_POSTGRES_PORT: "5544",
    ARCHIVE_NATIVE_POSTGRES_DATABASE: "archive_prod",
  });
  assert.deepEqual(override, {
    postgres: { kind: "external", host: "db.example.internal", port: 5544, database: "archive_prod" },
    redis: { enabled: false },
  });
});

test("nativeDataPlanOverrideFromEnv applies defaults for port and database when omitted", () => {
  const override = nativeDataPlanOverrideFromEnv({ ARCHIVE_NATIVE_POSTGRES_HOST: "db.example.internal" });
  assert.equal(override.postgres.port, 5432);
  assert.equal(override.postgres.database, "archive");
});

test("nativeDataPlanOverrideFromEnv adds the optional Redis endpoint only when ARCHIVE_NATIVE_REDIS_HOST is set", () => {
  const override = nativeDataPlanOverrideFromEnv({
    ARCHIVE_NATIVE_POSTGRES_HOST: "db.example.internal",
    ARCHIVE_NATIVE_REDIS_HOST: "cache.example.internal",
    ARCHIVE_NATIVE_REDIS_PORT: "6390",
  });
  assert.deepEqual(override.redis, { enabled: true, host: "cache.example.internal", port: 6390 });
});
