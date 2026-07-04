import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

test("first-run guide renders quick and advanced setup paths without deploying", () => {
  const r = run(["first-run"], { ARCHIVE_CONTROL_CENTER_SKIP_DOCKER: "1" });
  assert.equal(r.status, 0);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  assert.match(clean, /First run/);
  assert.match(clean, /Quick preset/);
  assert.match(clean, /setup quick/);
  assert.match(clean, /Advanced preset/);
  assert.match(clean, /setup deploy/);
  assert.doesNotMatch(clean, /docker compose up/);
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

test("deploy replaces every duplicate ADMIN_PASSWORD placeholder with the generated password", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(
    envFile,
    [
      "POSTGRES_PASSWORD=CHANGE_ME_POSTGRES_PASSWORD",
      "REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD",
      "REVERB_APP_ID=archive-collab",
      "REVERB_APP_KEY=archive-collab-key",
      "REVERB_APP_SECRET=CHANGE_ME_REVERB_SECRET_48_CHARS_MINIMUM",
      "LARAVEL_APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      "ADMIN_EMAIL=admin@example.com",
      "ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD",
      "DATABASE_URL=postgresql://archive:CHANGE_ME_POSTGRES_PASSWORD@postgres:5432/archive",
      "ADMIN_USERNAME=admin",
      "ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD",
      "",
    ].join("\n")
  );

  const r = run(["deploy"], { ARCHIVE_ENV_PATH: envFile, ARCHIVE_CONTROL_CENTER_SKIP_DOCKER: "1" });
  assert.equal(r.status, 0, r.stderr + r.stdout);

  const content = readFileSync(envFile, "utf8");
  const matches = [...content.matchAll(/^ADMIN_PASSWORD=(.+)$/gm)].map((m) => m[1]);
  assert.equal(matches.length, 2);
  assert.equal(new Set(matches).size, 1, "duplicate ADMIN_PASSWORD entries must stay in sync");
  assert.doesNotMatch(content, /CHANGE_ME_(ADMIN|STRONG)_PASSWORD/);
});
