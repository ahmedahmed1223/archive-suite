import { test } from "node:test";
import assert from "node:assert/strict";
import { createWindowsHostEffects } from "./windows-host-effects.mjs";

const INSTALL_ROOT = "C:\\Program Files\\ArchiveSuite";

function fakeRun() {
  const calls = [];
  const run = (args) => { calls.push(args); return { status: 0, stdout: "", stderr: "" }; };
  return { run, calls };
}

test("serviceControl.install writes the service XML, calls <id>.exe install, then assigns the virtual account via sc config", () => {
  const { run, calls } = fakeRun();
  const written = [];
  const writeFile = (path, content) => written.push({ path, content });
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile });
  const result = effects.serviceControl.install({ id: "archive-http", description: "d", executable: "runtime\\caddy\\caddy.exe", arguments: "run" });
  assert.equal(result.status, 0);
  assert.equal(written[0].path, "C:\\Program Files\\ArchiveSuite\\services\\archive-http.xml");
  assert.deepEqual(calls[0], ["C:\\Program Files\\ArchiveSuite\\services\\archive-http.exe", "install"]);
  // WinSW's own account validation cannot resolve NT SERVICE\<id> before the
  // service exists (real error confirmed: "Failed to find the account. No
  // mapping between account names and security IDs was done."), so the
  // virtual account is assigned as a separate step after the service is
  // created -- Microsoft's documented two-step pattern.
  assert.deepEqual(calls[1], ["sc", "config", "archive-http", "obj=", "NT SERVICE\\archive-http"]);
});

test("serviceControl.install does not attempt sc config when the WinSW install itself fails", () => {
  const calls = [];
  const run = (args) => { calls.push(args); return args[1] === "install" ? { status: 1 } : { status: 0 }; };
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  const result = effects.serviceControl.install({ id: "archive-http", description: "d", executable: "runtime\\caddy\\caddy.exe", arguments: "run" });
  assert.equal(result.status, 1);
  assert.equal(calls.length, 1, "a failed WinSW install must not attempt to configure the account");
});

test("serviceControl start/stop/restart/remove/query call the right WinSW verb", () => {
  const { run, calls } = fakeRun();
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  const exe = "C:\\Program Files\\ArchiveSuite\\services\\archive-next.exe";
  effects.serviceControl.start("archive-next");
  effects.serviceControl.stop("archive-next");
  effects.serviceControl.restart("archive-next");
  effects.serviceControl.remove("archive-next");
  effects.serviceControl.query("archive-next");
  assert.deepEqual(calls, [
    [exe, "start"], [exe, "stop"], [exe, "restart"], [exe, "uninstall"], [exe, "status"],
  ]);
});

test("managed PostgreSQL removal deletes the service without issuing a duplicate stop", () => {
  const calls = [];
  const effects = createWindowsHostEffects({
    installRoot: INSTALL_ROOT,
    run: (args) => {
      calls.push(args);
      return args[1] === "stop" ? { status: 1061 } : { status: 0 };
    },
    writeFile: () => {},
  });

  const result = effects.serviceControl.remove("archive-postgres");

  assert.equal(result.status, 0);
  assert.deepEqual(calls, [["sc", "delete", "archive-postgres"]]);
});

test("applyAcls grants read/execute on the tree and modify on every runtime and external storage path", () => {
  const { run, calls } = fakeRun();
  const services = [{ id: "svc-a" }, { id: "svc-b" }];
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, storagePath: "D:\\ArchiveData", run, writeFile: () => {}, ensureDirectory: () => {}, services });
  const result = effects.applyAcls();
  assert.equal(result.status, 0);
  assert.equal(calls.length, 12);
  assert.deepEqual(calls[0], ["icacls", INSTALL_ROOT, "/grant", "NT SERVICE\\svc-a:(OI)(CI)RX"]);
  assert.deepEqual(calls[1], ["icacls", "C:\\Program Files\\ArchiveSuite\\storage", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
  assert.deepEqual(calls[2], ["icacls", "C:\\Program Files\\ArchiveSuite\\logs", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
  assert.deepEqual(calls[3], ["icacls", "C:\\Program Files\\ArchiveSuite\\app\\laravel\\storage", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
  assert.deepEqual(calls[4], ["icacls", "C:\\Program Files\\ArchiveSuite\\app\\laravel\\bootstrap\\cache", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
  assert.deepEqual(calls[5], ["icacls", "D:\\ArchiveData", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
});

test("applyAcls creates every writable directory before granting modify access", () => {
  const { run, calls } = fakeRun();
  const directories = [];
  const effects = createWindowsHostEffects({
    installRoot: INSTALL_ROOT,
    storagePath: "D:\\ArchiveData",
    run,
    writeFile: () => {},
    ensureDirectory: (path) => directories.push(path),
    services: [{ id: "svc-a" }],
  });

  effects.applyAcls();
  assert.deepEqual(directories, [
    "C:\\Program Files\\ArchiveSuite\\storage",
    "C:\\Program Files\\ArchiveSuite\\logs",
    "C:\\Program Files\\ArchiveSuite\\app\\laravel\\storage",
    "C:\\Program Files\\ArchiveSuite\\app\\laravel\\bootstrap\\cache",
    "D:\\ArchiveData",
  ]);
  assert.equal(calls.length, 6);
});

test("applyAcls surfaces the first failing icacls call, not the last", () => {
  let call = 0;
  const run = () => { call += 1; return call === 2 ? { status: 5, stdout: "", stderr: "denied" } : { status: 0 }; };
  const services = [{ id: "svc-a" }];
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {}, ensureDirectory: () => {}, services });
  const result = effects.applyAcls();
  assert.equal(result.status, 5);
});

test("applyFirewallRules opens inbound TCP 443 for the archive-http rule only", () => {
  const { run, calls } = fakeRun();
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.applyFirewallRules();
  assert.deepEqual(calls[0], ["netsh", "advfirewall", "firewall", "add", "rule", "name=archive-http", "dir=in", "action=allow", "protocol=TCP", "localport=443"]);
});

test("removeFirewallRules deletes the same named rule", () => {
  const { run, calls } = fakeRun();
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.removeFirewallRules();
  assert.deepEqual(calls[0], ["netsh", "advfirewall", "firewall", "delete", "rule", "name=archive-http"]);
});

test("removeFirewallRules accepts a non-zero delete only after proving the rule is absent", () => {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    return { status: args.includes("delete") ? 1 : 1, stdout: "", stderr: "" };
  };
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  const result = effects.removeFirewallRules();
  assert.equal(result.status, 0);
  assert.deepEqual(calls[1], ["netsh", "advfirewall", "firewall", "show", "rule", "name=archive-http"]);
});

test("exec invokes the staged php.exe with artisan and the given arguments", () => {
  const { run, calls } = fakeRun();
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.exec(["queue:work", "--once"]);
  assert.deepEqual(calls[0], [
    "C:\\Program Files\\ArchiveSuite\\runtime\\php\\php.exe",
    "C:\\Program Files\\ArchiveSuite\\app\\laravel\\artisan",
    "queue:work", "--once",
  ]);
});

test("createWindowsHostEffects throws without a non-empty installRoot", () => {
  assert.throws(() => createWindowsHostEffects({ installRoot: "" }), /install root/i);
  assert.throws(() => createWindowsHostEffects({}), /install root/i);
});

test("installRedisCompatible writes a protected config and registers the bundled Redis service without putting the password in XML", () => {
  const { run, calls } = fakeRun();
  const written = [];
  const copied = [];
  const effects = createWindowsHostEffects({
    installRoot: INSTALL_ROOT,
    run,
    writeFile: (path, content) => written.push({ path, content }),
    ensureDirectory: () => {},
    copyFile: (source, destination) => copied.push({ source, destination }),
    pathExists: () => true,
    readDataPackage: () => ({ redisServer: "C:\\App\\data-services\\redis\\redis-server.exe" }),
  });

  const result = effects.installRedisCompatible({ secrets: { redisPassword: "cache-secret" } });

  assert.equal(result.status, 0);
  assert.match(written.find(({ path }) => path.endsWith("redis.conf")).content, /requirepass cache-secret/);
  assert.doesNotMatch(written.find(({ path }) => path.endsWith("archive-redis.xml")).content, /cache-secret/);
  assert.deepEqual(copied[0], { source: `${INSTALL_ROOT}\\services\\archive-http.exe`, destination: `${INSTALL_ROOT}\\services\\archive-redis.exe` });
  assert.ok(calls.some(([command, verb]) => command.endsWith("archive-redis.exe") && verb === "install"));
  assert.ok(calls.some(([command, verb, id]) => command === "sc" && verb === "config" && id === "archive-redis"));
});
