import { test } from "node:test";
import assert from "node:assert/strict";
import { createWindowsHostEffects } from "./windows-host-effects.mjs";

const INSTALL_ROOT = "C:\\Program Files\\ArchiveSuite";

function fakeRun() {
  const calls = [];
  const run = (args) => { calls.push(args); return { status: 0, stdout: "", stderr: "" }; };
  return { run, calls };
}

test("serviceControl.install writes the service XML and calls <id>.exe install", () => {
  const { run, calls } = fakeRun();
  const written = [];
  const writeFile = (path, content) => written.push({ path, content });
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile });
  const result = effects.serviceControl.install({ id: "archive-http", description: "d", executable: "runtime\\caddy\\caddy.exe", arguments: "run" });
  assert.equal(result.status, 0);
  assert.equal(written[0].path, "C:\\Program Files\\ArchiveSuite\\services\\archive-http.xml");
  assert.deepEqual(calls[0], ["C:\\Program Files\\ArchiveSuite\\services\\archive-http.exe", "install"]);
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

test("applyAcls grants read/execute on the tree and modify on storage/logs, per service", () => {
  const { run, calls } = fakeRun();
  const services = [{ id: "svc-a" }, { id: "svc-b" }];
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {}, services });
  const result = effects.applyAcls();
  assert.equal(result.status, 0);
  assert.equal(calls.length, 6);
  assert.deepEqual(calls[0], ["icacls", INSTALL_ROOT, "/grant", "NT SERVICE\\svc-a:(OI)(CI)RX"]);
  assert.deepEqual(calls[1], ["icacls", "C:\\Program Files\\ArchiveSuite\\storage", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
  assert.deepEqual(calls[2], ["icacls", "C:\\Program Files\\ArchiveSuite\\logs", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
});

test("applyAcls surfaces the first failing icacls call, not the last", () => {
  let call = 0;
  const run = () => { call += 1; return call === 2 ? { status: 5, stdout: "", stderr: "denied" } : { status: 0 }; };
  const services = [{ id: "svc-a" }];
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {}, services });
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
