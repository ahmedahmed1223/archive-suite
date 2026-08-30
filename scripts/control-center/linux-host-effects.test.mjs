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
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, storagePath: "/srv/archive", run, writeFile });

  const result = effects.serviceControl.install({ id: "archive-http", unit: "archive-http.service", description: "d", command: "/opt/archive-suite/runtime/caddy/caddy run" });

  assert.equal(result.status, 0);
  assert.equal(written[0].path, "/etc/systemd/system/archive-http.service");
  assert.match(written[0].content, /ReadWritePaths=.*\/srv\/archive/);
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

test("applyOwnership chowns the install root and configured storage to the service user", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, storagePath: "/srv/archive", run, writeFile: () => {} });
  effects.applyOwnership();
  assert.deepEqual(calls, [
    ["chown", "-R", "archive:archive", INSTALL_ROOT],
    ["chown", "-R", "archive:archive", "/srv/archive"],
  ]);
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

test("managed Linux data effects stage the verified payload and register PostgreSQL and Redis systemd units", () => {
  const { run, calls } = fakeRun();
  const written = [];
  const copied = [];
  const effects = createLinuxHostEffects({
    installRoot: INSTALL_ROOT,
    storagePath: "/srv/archive",
    run,
    writeFile: (path, content) => written.push({ path, content }),
    ensureDirectory: () => {},
    copyFile: (source, destination) => copied.push({ source, destination }),
    chmodFile: () => {},
    readDataPackage: () => ({
      postgresFiles: [
        { path: "postgres/bin/initdb", absolute: "/bundle/data-services/postgres/bin/initdb" },
        { path: "postgres/bin/pg_ctl", absolute: "/bundle/data-services/postgres/bin/pg_ctl" },
        { path: "postgres/bin/psql", absolute: "/bundle/data-services/postgres/bin/psql" },
      ],
      initdb: "/bundle/data-services/postgres/bin/initdb",
      pgCtl: "/bundle/data-services/postgres/bin/pg_ctl",
      psql: "/bundle/data-services/postgres/bin/psql",
      pgvectorFiles: ["/bundle/data-services/pgvector/vector.so", "/bundle/data-services/pgvector/vector.control"],
      redisServer: "/bundle/data-services/redis/bin/redis-server",
    }),
  });

  assert.equal(effects.installPostgres({ secrets: { dbOwnerPassword: "owner" } }).status, 0);
  assert.equal(effects.installPgvector().status, 0);
  assert.equal(effects.createArchiveRoles({ secrets: { dbOwnerPassword: "owner", dbAppPassword: "app" } }).status, 0);
  assert.equal(effects.installRedisCompatible({ secrets: { redisPassword: "cache" } }).status, 0);
  assert.ok(copied.some(({ destination }) => destination.endsWith("runtime\\postgres\\bin\\initdb") || destination.endsWith("runtime/postgres/bin/initdb")));
  assert.ok(written.some(({ path, content }) => path === "/etc/systemd/system/archive-postgres.service" && content.includes("bundled PostgreSQL")));
  assert.ok(written.some(({ path, content }) => path === "/etc/systemd/system/archive-redis.service" && content.includes("redis-server")));
  assert.ok(calls.some(([command, name]) => command === "systemctl" && name === "start"));
});

test("managed PostgreSQL initializes as the archive service user", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({
    installRoot: INSTALL_ROOT,
    storagePath: "/srv/archive",
    run,
    writeFile: () => {},
    ensureDirectory: () => {},
    copyFile: () => {},
    chmodFile: () => {},
    readDataPackage: () => ({
      postgresFiles: [
        { path: "postgres/bin/initdb", absolute: "/bundle/data-services/postgres/bin/initdb" },
        { path: "postgres/bin/pg_ctl", absolute: "/bundle/data-services/postgres/bin/pg_ctl" },
        { path: "postgres/bin/psql", absolute: "/bundle/data-services/postgres/bin/psql" },
      ],
      initdb: "/bundle/data-services/postgres/bin/initdb",
      pgCtl: "/bundle/data-services/postgres/bin/pg_ctl",
      psql: "/bundle/data-services/postgres/bin/psql",
    }),
  });

  assert.equal(effects.installPostgres({ secrets: { dbOwnerPassword: "owner" } }).status, 0);
  const initdbIndex = calls.findIndex(([command]) => command === "runuser");
  const ownershipIndex = calls.findIndex(([command, , , path]) => command === "chown" && path === "/srv/archive/postgresql");
  assert.ok(ownershipIndex >= 0 && ownershipIndex < initdbIndex);
  assert.deepEqual(calls[initdbIndex], [
    "runuser", "--user", "archive", "--", "/opt/archive-suite/runtime/postgres/bin/initdb",
    "-D", "/srv/archive/postgresql", "-U", "archive_owner", "--pwfile=/opt/archive-suite/config/postgresql-password", "--auth-host=scram-sha-256",
  ]);
});
