import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Smoke tests for the Control Center CLI. They exercise the real binary through
// its non-interactive subcommand router (no module refactor needed) so the menu,
// router, and read-only commands are covered end-to-end.

const CLI = new URL("./control-center.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const run = (args, env = {}) =>
  spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

const validSetupConfig = (overrides = {}) => ({
  schemaVersion: "1.0",
  mode: "docker",
  platform: "linux-docker",
  source: "online",
  intent: "fresh",
  access: "local",
  runtimeProfiles: ["core"],
  capabilities: [],
  dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
  storage: { driver: "local", path: "/srv/archive-suite/storage" },
  ...overrides,
});

test("public setup and deployment guidance use only the canonical Control Center stack", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts.setup, "node scripts/control-center.mjs deploy");
  assert.equal(pkg.scripts.deploy, "node scripts/control-center.mjs deploy");

  const controlCenter = readFileSync(join(ROOT, "scripts/control-center.mjs"), "utf8");
  assert.doesNotMatch(controlCenter, /docker-compose\.dev\.yml/);

  for (const file of [
    "README.md",
    "INSTALL.md",
    "DEPLOYMENT.md",
    "docs/control-center.md",
    "Setup-Archive.bat",
    "setup.bat",
    "setup.sh",
    "scripts/control-center.mjs",
    "infra/deploy/setup.sh",
    "infra/deploy/hostinger-vps.md",
    "infra/.env.example",
    "infra/docker-compose.yml",
  ]) {
    const content = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(content, /deploy-legacy|PocketBase|archive-server|docker-compose\.postgres\.yml/i);
  }

  for (const file of ["README.md", "INSTALL.md", "DEPLOYMENT.md", "docs/control-center.md", "infra/deploy/hostinger-vps.md"]) {
    assert.match(readFileSync(join(ROOT, file), "utf8"), /infra\/docker-compose\.yml/);
  }

  const deployLauncher = readFileSync(join(ROOT, "infra/deploy/setup.sh"), "utf8");
  assert.match(deployLauncher, /exec bash "\$ROOT\/setup\.sh" "\$@"/);
  assert.doesNotMatch(deployLauncher, /exec sh "\$ROOT\/setup\.sh"/);
  for (const retiredOverride of [
    "infra/docker-compose.intranet.yml",
    "infra/docker-compose.lite.yml",
    "infra/docker-compose.test.local.yml",
  ]) {
    assert.equal(existsSync(join(ROOT, retiredOverride)), false, `${retiredOverride} must not remain a public deployment path`);
  }
});

test("help renders the grouped menu and every command group", () => {
  const r = run(["help"]);
  assert.equal(r.status, 0);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  for (const s of [
    "Masar",
    "— Server —", "— Configure —", "— Security —", "— Database —", "— Backups —", "— Maintain —",
    "1) Guided setup", "2) Quick start", "5) Deploy / Re-provision", "15) Generate a strong password", "16) Change admin password",
    "20) Seed demo data", "25) Update & rebuild", "0) Exit", "q) Exit",
  ]) {
    assert.ok(clean.includes(s), `help output should include "${s}"`);
  }
  assert.ok(!clean.includes("q) Quick start"), "q should be reserved for exit, not start/deploy");
  assert.ok(!clean.includes("Legacy"), "legacy Node/Vite commands were removed with the legacy packages");
});

test("unknown command exits non-zero and lists the valid commands", () => {
  const r = run(["definitely-not-a-command"]);
  assert.notEqual(r.status, 0);
  const out = r.stderr + r.stdout;
  assert.match(out, /Unknown command/);
  assert.match(out, /status, start, stop/);
});

test("q command exits successfully instead of starting deployment", () => {
  const r = run(["q"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "");
  assert.equal(r.stderr.trim(), "");
});

test("Control Center entry point composes focused modules", () => {
  const modules = ["cli.mjs", "configuration.mjs", "docker-compose.mjs", "operations.mjs", "runtime-adapter.mjs"];
  for (const file of modules) {
    assert.equal(existsSync(join(ROOT, "scripts", "control-center", file)), true, `missing focused Control Center module: ${file}`);
  }
  const entry = readFileSync(join(ROOT, "scripts", "control-center.mjs"), "utf8");
  assert.match(entry, /\.\/control-center\/cli\.mjs/);
  assert.match(entry, /createConsoleUi/);
  assert.match(entry, /\.\/control-center\/configuration\.mjs/);
  assert.match(entry, /\.\/control-center\/docker-compose\.mjs/);
  assert.match(entry, /\.\/control-center\/operations\.mjs/);
  assert.doesNotMatch(entry, /createInterface/);
  assert.doesNotMatch(entry, /function printBanner\(/);
  assert.doesNotMatch(entry, /function printMenu\(/);
});

test("server commands reject capabilities as Compose profiles before Docker access", () => {
  const r = run(["status"], { ARCHIVE_COMPOSE_PROFILES: "ocr", PATH: "", Path: "" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /capabilities cannot be enabled as Docker Compose profiles/i);
});

test("setup plan validates a declarative configuration deterministically without Docker or writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-plan-"));
  const configFile = join(dir, "setup.json");
  const envFile = join(dir, ".env");
  const config = {
    schemaVersion: "1.0",
    mode: "docker",
    platform: "linux-docker",
    source: "offline",
    intent: "fresh",
    access: "local",
    runtimeProfiles: ["core", "media"],
    capabilities: ["ocr", "observability"],
    dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
    storage: { driver: "local", path: "/srv/archive-suite/storage" },
  };
  writeFileSync(configFile, JSON.stringify(config));

  const r = run(["plan", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const result = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
  assert.equal(result.ok, true);
  assert.equal(result.code, "PLAN_READY");
  assert.deepEqual(result.details.configuration.runtimeProfiles, ["core", "media"]);
  assert.equal(existsSync(envFile), false, "plan must not create .env");

  const imported = run(["import-config", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.equal(imported.status, 0, imported.stderr + imported.stdout);
  assert.deepEqual(JSON.parse(imported.stdout).details, result.details.configuration);
  assert.equal(existsSync(envFile), false, "import-config must not create .env");
});

test("setup plan rejects a platform that does not match its mode before writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-plan-invalid-"));
  const configFile = join(dir, "setup.json");
  const envFile = join(dir, ".env");
  writeFileSync(configFile, JSON.stringify(validSetupConfig({ platform: "linux-native" })));

  const r = run(["plan", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.notEqual(r.status, 0);
  const result = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
  assert.equal(result.ok, false);
  assert.match(result.message, /does not match mode/i);
  assert.equal(existsSync(envFile), false, "invalid input must fail before writing .env");
});

for (const [name, overrides, message] of [
  ["capability used as a runtime profile", { runtimeProfiles: ["core", "ocr"] }, /capability .*runtime profile/i],
  ["illegal runtime profile", { runtimeProfiles: ["core", "not-a-profile"] }, /illegal runtime profile/i],
  ["invalid source", { source: "remote" }, /source must be one of/i],
  ["storage URL with credentials", { storage: { driver: "local", path: "https://archive:topsecret@example.test/storage" } }, /storage\.path/i],
]) {
  test(`setup plan rejects ${name} before writes`, () => {
    const dir = mkdtempSync(join(tmpdir(), "cc-plan-invalid-"));
    const configFile = join(dir, "setup.json");
    const envFile = join(dir, ".env");
    writeFileSync(configFile, JSON.stringify(validSetupConfig(overrides)));

    const r = run(["plan", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
    assert.notEqual(r.status, 0);
    const result = JSON.parse(r.stdout);
    assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
    assert.equal(result.ok, false);
    assert.match(result.message, message);
    assert.ok(!r.stdout.includes("topsecret"), "failure output must not echo credentials");
    assert.equal(existsSync(envFile), false, "invalid input must fail before writing .env");
  });
}

test("setup export-config emits a safe canonical configuration or a clear absent result", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-export-"));
  const envFile = join(dir, ".env");
  let r = run(["export-config", "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.notEqual(r.status, 0);
  assert.equal(JSON.parse(r.stdout).code, "CONFIG_NOT_FOUND");

  writeFileSync(envFile, "ARCHIVE_COMPOSE_PROFILES=media\nACCESS_MODE=local\nPOSTGRES_PASSWORD=never-export-this\nREDIS_URL=redis://:also-secret@redis:6379\n");
  r = run(["export-config", "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const result = JSON.parse(r.stdout);
  const serialized = JSON.stringify(result);
  assert.equal(result.code, "CONFIG_EXPORTED");
  assert.ok(!serialized.includes("never-export-this"));
  assert.ok(!serialized.includes("also-secret"));
  assert.ok(!/password|token|secret|_url/i.test(JSON.stringify(result.details)));
});

test("setup export-config rejects a credential-bearing storage path without exposing it", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-export-sensitive-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "ARCHIVE_STORAGE_PATH=https://archive:topsecret@example.test/storage\n");

  const r = run(["export-config", "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.notEqual(r.status, 0);
  const result = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
  assert.equal(result.ok, false);
  assert.match(result.message, /storage\.path/i);
  assert.ok(!r.stdout.includes("topsecret"));
  assert.ok(!r.stdout.includes("example.test"));
});

test("setup export-config returns structured JSON when the configured env path cannot be read", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-export-directory-"));
  const r = run(["export-config", "--json"], { ARCHIVE_ENV_PATH: dir, PATH: "", Path: "" });

  assert.notEqual(r.status, 0);
  assert.notEqual(r.stdout.trim(), "", "JSON failures must return a result object");
  const result = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
  assert.equal(result.ok, false);
  assert.equal(result.code, "CONFIG_READ_FAILED");
  assert.equal(r.stderr, "", "JSON failures must not print a stack trace");
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

test("doctor filters the platform contract and keeps native deployment explicitly planned", () => {
  const r = run(["doctor", "--mode=native", "--platform=linux-native"]);
  const out = r.stderr + r.stdout;
  assert.equal(r.status, 0, out);
  assert.match(out, /Platform compatibility contract v1\.0/);
  assert.match(out, /Linux Native \(linux-native\) — planned/);
  assert.match(out, /Native deployment is planned: no install or start action is available yet\./);
  assert.match(out, /Read-only report/);
  assert.doesNotMatch(out, /docker compose up/);
});

test("doctor rejects an unknown platform without performing deployment", () => {
  const r = run(["doctor", "--platform=not-a-platform"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /Unknown platform/);
  assert.doesNotMatch(r.stderr + r.stdout, /docker compose up/);
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

test("generate-password prints a strong password without requiring .env", () => {
  const r = run(["generate-password"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  const match = clean.match(/Generated password:\s+(\S+)/);
  assert.ok(match, "generated password should be visible once");
  assert.ok(match[1].length >= 20, "generated password should be long enough for first-login use");
});

test("change-admin-password updates duplicate ADMIN_PASSWORD values and admin email", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(
    envFile,
    [
      "ADMIN_EMAIL=old@example.test",
      "ADMIN_PASSWORD=old-password-one",
      "POSTGRES_PASSWORD=postgres-secret",
      "ADMIN_PASSWORD=old-password-two",
      "",
    ].join("\n")
  );

  const r = run(
    ["change-admin-password", "--email=owner@example.test", "--password=New-Strong-Password-123", "--env-only"],
    { ARCHIVE_ENV_PATH: envFile }
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);

  const content = readFileSync(envFile, "utf8");
  assert.match(content, /^ADMIN_EMAIL=owner@example\.test$/m);
  const matches = [...content.matchAll(/^ADMIN_PASSWORD=(.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(matches, ["New-Strong-Password-123", "New-Strong-Password-123"]);
  assert.match(r.stdout, /Updated ADMIN_EMAIL, ADMIN_PASSWORD/);
  assert.match(r.stdout, /Skipped live Laravel update/);
});

test("change-admin-password can generate and store a replacement password", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "ADMIN_EMAIL=admin@example.test\nADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD\n");

  const r = run(["change-admin-password", "--generate", "--env-only"], { ARCHIVE_ENV_PATH: envFile });
  assert.equal(r.status, 0, r.stderr + r.stdout);

  const content = readFileSync(envFile, "utf8");
  const password = content.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1] || "";
  assert.ok(password.length >= 20);
  assert.notEqual(password, "CHANGE_ME_STRONG_PASSWORD");
  assert.match(r.stdout, /Generated admin password:/);
});

test("wizard without a TTY falls back to deploy and still provisions secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(
    envFile,
    [
      "POSTGRES_PASSWORD=CHANGE_ME_POSTGRES_PASSWORD",
      "REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD",
      "ADMIN_EMAIL=admin@example.com",
      "ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD",
      "",
    ].join("\n")
  );

  const r = run(["wizard"], { ARCHIVE_ENV_PATH: envFile, ARCHIVE_CONTROL_CENTER_SKIP_DOCKER: "1" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /No interactive terminal detected/);

  const content = readFileSync(envFile, "utf8");
  assert.doesNotMatch(content, /CHANGE_ME_POSTGRES_PASSWORD/);
  assert.doesNotMatch(content, /CHANGE_ME_ADMIN_PASSWORD/);
});

test("help lists the wizard as the recommended first-run path", () => {
  const r = run(["help"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  assert.match(clean, /setup wizard/);
  assert.match(clean, /Guided setup \(wizard/);
});
