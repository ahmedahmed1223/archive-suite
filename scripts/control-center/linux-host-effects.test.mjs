import { test } from "node:test";
import assert from "node:assert/strict";
import { createLinuxHostEffects } from "./linux-host-effects.mjs";

const INSTALL_ROOT = "/opt/archive-suite";

function fakeRun() {
  const calls = [];
  const run = (args) => { calls.push(args); return { status: 0, stdout: "", stderr: "" }; };
  return { run, calls };
}

test("serviceControl.install writes the systemd unit and enables it", () => {
  const { run, calls } = fakeRun();
  const written = [];
  const writeFile = (path, content) => written.push({ path, content });
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile });

  const result = effects.serviceControl.install({ id: "archive-http", unit: "archive-http.service", description: "d", command: "/opt/archive-suite/runtime/caddy/caddy run" });

  assert.equal(result.status, 0);
  assert.equal(written[0].path, "/etc/systemd/system/archive-http.service");
  assert.deepEqual(calls[0], ["systemctl", "daemon-reload"]);
  assert.deepEqual(calls[1], ["systemctl", "enable", "archive-http"]);
});

test("serviceControl start/stop/restart/query call the right systemctl verb", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.serviceControl.start("archive-next");
  effects.serviceControl.stop("archive-next");
  effects.serviceControl.restart("archive-next");
  effects.serviceControl.query("archive-next");
  assert.deepEqual(calls, [
    ["systemctl", "start", "archive-next"],
    ["systemctl", "stop", "archive-next"],
    ["systemctl", "restart", "archive-next"],
    ["systemctl", "status", "--no-pager", "archive-next"],
  ]);
});

test("serviceControl.remove disables, deletes the unit file, and reloads", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.serviceControl.remove("archive-next");
  assert.deepEqual(calls, [
    ["systemctl", "disable", "archive-next"],
    ["rm", "-f", "/etc/systemd/system/archive-next.service"],
    ["systemctl", "daemon-reload"],
  ]);
});

test("applyOwnership chowns the install root to the service user", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.applyOwnership();
  assert.deepEqual(calls[0], ["chown", "-R", "archive:archive", INSTALL_ROOT]);
});

test("applyLogrotate writes a weekly, 8-rotation policy for the install root's logs", () => {
  const written = [];
  const writeFile = (path, content) => written.push({ path, content });
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run: () => ({ status: 0 }), writeFile });
  const result = effects.applyLogrotate();
  assert.equal(result.status, 0);
  assert.equal(written[0].path, "/etc/logrotate.d/archive-suite");
  assert.match(written[0].content, /weekly/);
  assert.match(written[0].content, /rotate 8/);
  assert.match(written[0].content, /su archive archive/);
});

test("writeAppConfig writes Caddy, PHP-FPM, and Laravel configuration inside the install root", () => {
  const written = [];
  const effects = createLinuxHostEffects({
    installRoot: INSTALL_ROOT,
    run: () => ({ status: 0 }),
    writeFile: (path, content) => written.push({ path, content }),
  });

  const result = effects.writeAppConfig({
    access: "local",
    appKey: "base64:test",
    appUrl: "http://localhost:8443",
    dataPlan: {
      postgres: { kind: "external", host: "db.internal", port: 5432, database: "archive" },
      queue: "database",
      cache: "database",
      redis: { enabled: false },
    },
    storagePath: "/srv/archive",
    dbUsername: "archive",
    dbPassword: "test-only-password",
  });

  assert.equal(result.status, 0);
  assert.deepEqual(written.map(({ path }) => path), [
    "/opt/archive-suite/config/Caddyfile",
    "/opt/archive-suite/config/php-fpm.conf",
    "/opt/archive-suite/app/laravel/.env",
  ]);
  assert.match(written[2].content, /DB_HOST=db\.internal/);
  assert.match(written[2].content, /ARCHIVE_LOCAL_STORAGE_PATH=\/srv\/archive\/private/);
});

test("logs reads journalctl for every service unit", () => {
  const { run, calls } = fakeRun();
  const services = [{ id: "archive-http" }, { id: "archive-next" }];
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {}, services });
  effects.logs();
  assert.deepEqual(calls[0], ["journalctl", "--no-pager", "-n", "200", "-u", "archive-http", "-u", "archive-next"]);
});

test("exec invokes the staged php binary with artisan and the given arguments", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.exec(["queue:work", "--once"]);
  assert.deepEqual(calls[0], [
    "/opt/archive-suite/runtime/php/bin/php",
    "/opt/archive-suite/app/laravel/artisan",
    "queue:work", "--once",
  ]);
});
