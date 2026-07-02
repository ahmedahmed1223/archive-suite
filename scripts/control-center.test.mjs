import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Smoke tests for the Control Center CLI. They exercise the real binary through
// its non-interactive subcommand router (no module refactor needed) so the menu,
// router, and read-only commands are covered end-to-end.

const CLI = new URL("./control-center.mjs", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const run = (args, env = {}) =>
  spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

test("help renders the grouped menu and every command group", () => {
  const r = run(["help"]);
  assert.equal(r.status, 0);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  for (const s of [
    "Archive Suite",
    "— Server —", "— Configure —", "— Security —", "— Database —", "— Backups —", "— Maintain —", "— Legacy (Node/Vite stack) —",
    "1) Deploy", "18) Update & rebuild", "19) Legacy deploy wizard", "0) Exit",
  ]) {
    assert.ok(clean.includes(s), `help output should include "${s}"`);
  }
});

test("unknown command exits non-zero and lists the valid commands", () => {
  const r = run(["definitely-not-a-command"]);
  assert.notEqual(r.status, 0);
  const out = r.stderr + r.stdout;
  assert.match(out, /Unknown command/);
  assert.match(out, /status, start, stop/);
});

test("config prints known keys and masks secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(
    envFile,
    "ACCESS_MODE=internal\nPORT=8787 # local port\nADMIN_USERNAME=admin\nAI_PROVIDER= # provider comment\nDATABASE_URL=postgres://u:topsecret@h:5432/db\n"
  );
  const r = run(["config"], { ARCHIVE_ENV_PATH: envFile });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /ACCESS_MODE/);
  assert.match(r.stdout, /admin/);
  assert.ok(!r.stdout.includes("local port"), "inline comments must not be treated as env values");
  assert.ok(!r.stdout.includes("provider comment"), "empty values with comments must remain empty");
  assert.ok(!r.stdout.includes("topsecret"), "DATABASE_URL must be masked, not shown in full");
});

test("config without an .env guides the operator to deploy", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const r = run(["config"], { ARCHIVE_ENV_PATH: join(dir, "missing.env") });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No .env yet/);
});

test("backups command renders without throwing", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const r = run(["backups"], { ARCHIVE_ENV_PATH: join(dir, ".env") });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Backups/);
});

test("health exits non-zero when the configured server port is not responding", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "HEALTH_URL=http://127.0.0.1:9/api/health\n");
  const r = run(["health"], { ARCHIVE_ENV_PATH: envFile });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /No response from http:\/\/127\.0\.0\.1:9\/api\/health/);
});

test("doctor uses the Windows-safe pnpm invocation and reports the environment", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "PORT=9\n");
  const r = run(["doctor"], { ARCHIVE_ENV_PATH: envFile });
  const out = r.stderr + r.stdout;
  assert.match(out, /Doctor/);
  assert.doesNotMatch(out, /pnpm not found/);
});
