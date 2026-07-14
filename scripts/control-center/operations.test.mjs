import assert from "node:assert/strict";
import test from "node:test";

import { createControlOperations } from "./operations.mjs";

// V1-208H: backupNow/listBackups/restoreBackup/verifyBackup now drive
// `php artisan archive:backup-* --json` in the laravel container (via
// adapter.exec) instead of raw pg_dump/psql, and parse the single JSON
// line each command prints on stdout. These tests mock adapter.exec the
// same way runtime-adapter.test.mjs mocks compose().

function createOutputSpy() {
  const calls = { log: [], ok: [], warn: [], err: [], titleLine: [] };
  const output = {
    log: (m) => calls.log.push(m),
    ok: (m) => calls.ok.push(m),
    warn: (m) => calls.warn.push(m),
    err: (m) => calls.err.push(m),
    titleLine: (m) => calls.titleLine.push(m),
  };
  return { output, calls };
}

function jsonResult(payload, status = 0) {
  return { status, stdout: JSON.stringify(payload) + "\n", stderr: "" };
}

function buildOperations({ execImpl, output, ask, confirm } = {}) {
  const execCalls = [];
  const adapter = {
    exec: (args, options) => {
      execCalls.push({ args, options });
      return execImpl ? execImpl(args, options) : { status: 0, stdout: "", stderr: "" };
    },
  };
  const spy = output ?? createOutputSpy();
  const ops = createControlOperations({
    adapter,
    composeFile: "/nonexistent/docker-compose.yml",
    output: spy.output ?? spy,
    ask: ask ?? (async () => ""),
    confirm: confirm ?? (async () => false),
    runPnpm: () => ({ status: 0 }),
    root: "/repo",
  });
  return { ops, execCalls, spy };
}

test("backupNow runs archive:backup-run --json against the laravel container and reports success", () => {
  const backup = { name: "backup-2026-01-01T00-00-00-000000.json.gz", sizeBytes: 1234, checksum: "a".repeat(64) };
  const { ops, execCalls, spy } = buildOperations({
    execImpl: () => jsonResult({ ok: true, code: "BACKUP_CREATED", message: "Backup created: " + backup.name, details: { backup } }),
  });

  const status = ops.backupNow();

  assert.equal(status, 0);
  assert.equal(execCalls.length, 1);
  assert.deepEqual(execCalls[0].args, ["php", "artisan", "archive:backup-run", "--json"]);
  assert.equal(execCalls[0].options.inherit, false);
  assert.equal(spy.calls.ok.length, 1);
  assert.match(spy.calls.ok[0], /Backup created/);
});

test("backupNow reports failure without throwing when the command errors", () => {
  const { ops, spy } = buildOperations({
    execImpl: () => jsonResult({ ok: false, code: "BACKUP_FAILED", message: "Disk full.", details: {} }),
  });

  const status = ops.backupNow();

  assert.equal(status, 1);
  assert.equal(spy.calls.err.length, 1);
  assert.match(spy.calls.err[0], /Disk full/);
});

test("backupNow degrades gracefully to a structured failure when the container is unreachable", () => {
  const { ops, spy } = buildOperations({
    execImpl: () => ({ status: 127, stdout: "", stderr: "no such service" }),
  });

  const status = ops.backupNow();

  assert.equal(status, 1);
  assert.match(spy.calls.err[0], /no such service|artisan archive:backup-run/);
});

test("listBackups runs archive:backup-list --json and renders each backup", () => {
  const backups = [
    { name: "backup-b.json.gz", createdAt: "2026-01-02T00:00:00Z", checksum: "x" },
    { name: "backup-a.json.gz", createdAt: "2026-01-01T00:00:00Z", checksum: null },
  ];
  const { ops, execCalls, spy } = buildOperations({
    execImpl: () => jsonResult({ ok: true, code: "BACKUP_LIST", message: "2 backup(s) found.", details: { backups } }),
  });

  const status = ops.listBackups();

  assert.equal(status, 0);
  assert.deepEqual(execCalls[0].args, ["php", "artisan", "archive:backup-list", "--json"]);
  assert.equal(spy.calls.log.filter((line) => line.includes("backup-")).length, 2);
});

test("listBackupFiles returns [] instead of throwing when listing fails", () => {
  const { ops } = buildOperations({ execImpl: () => ({ status: 1, stdout: "", stderr: "boom" }) });

  assert.deepEqual(ops.listBackupFiles(), []);
});

test("restoreBackup lists, confirms, then restores with --force --json and reports completion", async () => {
  const backups = [{ name: "backup-only.json.gz", createdAt: "2026-01-01T00:00:00Z", checksum: "x" }];
  const asked = [];
  const { ops, execCalls, spy } = buildOperations({
    execImpl: (args) => {
      if (args.includes("archive:backup-list")) return jsonResult({ ok: true, code: "BACKUP_LIST", message: "1 backup(s) found.", details: { backups } });
      return jsonResult({ ok: true, code: "RESTORE_COMPLETE", message: "Restore complete: " + backups[0].name, details: { result: { name: backups[0].name, verified: true } } });
    },
    ask: async (question) => { asked.push(question); return "1"; },
    confirm: async () => true,
  });

  const status = await ops.restoreBackup();

  assert.equal(status, 0);
  const restoreCall = execCalls.find((call) => call.args.includes("archive:backup-restore"));
  assert.deepEqual(restoreCall.args, ["php", "artisan", "archive:backup-restore", "backup-only.json.gz", "--force", "--json"]);
  assert.equal(restoreCall.options.inherit, false);
  assert.equal(asked.length, 1);
  assert.match(spy.calls.ok.at(-1), /Restore complete/);
});

test("restoreBackup refuses to report success when the command rejects a corrupt backup", async () => {
  const backups = [{ name: "backup-corrupt.json.gz", createdAt: "2026-01-01T00:00:00Z", checksum: "x" }];
  const { ops, spy } = buildOperations({
    execImpl: (args) => {
      if (args.includes("archive:backup-list")) return jsonResult({ ok: true, code: "BACKUP_LIST", message: "1 backup(s) found.", details: { backups } });
      return jsonResult({
        ok: false,
        code: "RESTORE_FAILED",
        message: "Backup integrity check failed (Checksum mismatch — file may be corrupt.). Restore aborted; live data was not touched.",
        details: {},
      });
    },
    ask: async () => "1",
    confirm: async () => true,
  });

  const status = await ops.restoreBackup();

  assert.equal(status, 1);
  assert.ok(!spy.calls.ok.some((m) => /Restore complete/.test(m)), "must not report completion for a rejected restore");
  assert.match(spy.calls.err.at(-1), /live data was not touched/);
});

test("restoreBackup cancels without calling restore when the operator declines confirmation", async () => {
  const backups = [{ name: "backup-only.json.gz", createdAt: "2026-01-01T00:00:00Z", checksum: "x" }];
  const { ops, execCalls, spy } = buildOperations({
    execImpl: () => jsonResult({ ok: true, code: "BACKUP_LIST", message: "1 backup(s) found.", details: { backups } }),
    ask: async () => "1",
    confirm: async () => false,
  });

  const status = await ops.restoreBackup();

  assert.equal(status, 0);
  assert.ok(!execCalls.some((call) => call.args.includes("archive:backup-restore")));
  assert.match(spy.calls.log.at(-1), /Cancelled/);
});

test("verifyBackup with an explicit name skips listing and calls archive:backup-verify --json", async () => {
  const { ops, execCalls, spy } = buildOperations({
    execImpl: () => jsonResult({ ok: true, code: "BACKUP_VERIFIED", message: "Checksum verified.", details: { verification: { verified: true } } }),
  });

  const status = await ops.verifyBackup({ name: "backup-a.json.gz" });

  assert.equal(status, 0);
  assert.equal(execCalls.length, 1);
  assert.deepEqual(execCalls[0].args, ["php", "artisan", "archive:backup-verify", "backup-a.json.gz", "--json"]);
  assert.match(spy.calls.ok[0], /Checksum verified/);
});

test("verifyBackup without a name lists backups then verifies the selected one", async () => {
  const backups = [{ name: "backup-picked.json.gz", createdAt: "2026-01-01T00:00:00Z", checksum: "x" }];
  const { ops, execCalls } = buildOperations({
    execImpl: (args) => {
      if (args.includes("archive:backup-list")) return jsonResult({ ok: true, code: "BACKUP_LIST", message: "1 backup(s) found.", details: { backups } });
      return jsonResult({ ok: true, code: "BACKUP_VERIFIED", message: "Checksum verified.", details: { verification: { verified: true } } });
    },
    ask: async () => "1",
  });

  const status = await ops.verifyBackup();

  assert.equal(status, 0);
  const verifyCall = execCalls.find((call) => call.args.includes("archive:backup-verify"));
  assert.deepEqual(verifyCall.args, ["php", "artisan", "archive:backup-verify", "backup-picked.json.gz", "--json"]);
});

test("verifyBackup reports a corrupted backup as a failure", async () => {
  const { ops, spy } = buildOperations({
    execImpl: () => jsonResult({ ok: false, code: "BACKUP_UNVERIFIED", message: "Checksum mismatch — file may be corrupt.", details: { verification: { verified: false } } }),
  });

  const status = await ops.verifyBackup({ name: "backup-corrupt.json.gz" });

  assert.equal(status, 1);
  assert.match(spy.calls.err[0], /Checksum mismatch/);
});
