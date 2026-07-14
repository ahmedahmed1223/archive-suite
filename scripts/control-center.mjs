#!/usr/bin/env node
/**
 * Masar — Control Center
 *
 * One English-first console to install, operate, configure, and maintain the
 * CANONICAL stack (Laravel API + Next.js, infra/docker-compose.yml)
 * on Windows (Setup-Archive.bat) and Linux/macOS (setup.sh).
 *
 * Interactive:     node scripts/control-center.mjs        (or: pnpm control)
 * Non-interactive: node scripts/control-center.mjs <command>
 *   server:   status | start | stop | restart | logs | health
 *   maintain: diagnostics | update
 *   config:   config | set-url
 *   security: rotate-secrets
 *   database: migrate-status | migrate | seed-demo
 *   backups:  backup | backups | restore
 *   deploy:   deploy   ·   help
 *
 * Cross-platform Node core; the .bat / .sh are thin launchers. English-first.
 * Any write to .env first backs it up to .env.bak-<timestamp>.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, statSync, statfsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";
import { formatPlatformContractReport, loadPlatformContract, resolveComposeProfiles, selectPlatforms } from "./platform-contract.mjs";
import { buildOperatorReport, buildReadinessContract, collectOperatorSnapshot, createSupportBundle } from "./observability.mjs";
import { createCli, createConsoleUi } from "./control-center/cli.mjs";
import { createConfiguration, validateAdminPassword } from "./control-center/configuration.mjs";
import { createDockerCompose } from "./control-center/docker-compose.mjs";
import { createDockerRuntimeAdapter } from "./control-center/runtime-adapter.mjs";
import { createControlOperations, createHealthProbe } from "./control-center/operations.mjs";
import { createSetupConfiguration } from "./control-center/setup-config.mjs";
import * as installationManifest from "./control-center/installation-manifest.mjs";
import { ReleaseDescriptorError, resolveRelease } from "./control-center/release-descriptor.mjs";

// ─── Paths ──────────────────────────────────────────────────────────────────
const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ROOT = resolve(__dirname, "..");
const INFRA_DIR = join(ROOT, "infra");
const ENV_PATH = process.env.ARCHIVE_ENV_PATH || join(INFRA_DIR, ".env");
const ENV_EXAMPLE = join(INFRA_DIR, ".env.example");
const INSTALLATION_MANIFEST_PATH = process.env.ARCHIVE_INSTALLATION_MANIFEST_PATH || join(INFRA_DIR, "setup", "installation-manifest.json");
// Canonical stack: Laravel API + Next.js (postgres/redis/laravel/worker/reverb/next/caddy).
const COMPOSE_FILE = join(INFRA_DIR, "docker-compose.yml");
const RELEASE_COMPOSE_FILE = join(INFRA_DIR, "docker-compose.release.yml");
const BACKUP_DIR = join(INFRA_DIR, "backups");

// ─── CLI display and prompt ─────────────────────────────────────────────────
const ui = createConsoleUi();
const { C, log, ok, warn, err, titleLine, hr, ask, confirm, close, printBanner, printMenu } = ui;
const output = { log, ok, warn, err, titleLine };

// ─── CLI and configuration ──────────────────────────────────────────────────
const { args: ARGS, hasFlag, flagValue, command: cliCommand } = createCli(process.argv);
const configuration = createConfiguration({ envPath: ENV_PATH, output });
const { readEnvRaw, readEnv, writeEnv, maskValue, genSecret, genPassword, isPlaceholder } = configuration;
const setupConfiguration = createSetupConfiguration({ loadPlatformContract });

function renderSetupResult(result) {
  if (hasFlag("json")) {
    console.log(JSON.stringify(result));
  } else {
    (result.ok ? ok : err)(result.message);
    if (result.details && Object.keys(result.details).length) log(JSON.stringify(result.details, null, 2));
    for (const action of result.nextActions || []) log(`Next: ${action}`);
  }
  return result.ok ? 0 : 1;
}

function setupPlan() { return renderSetupResult(setupConfiguration.plan(flagValue("config"))); }
function setupImportConfig() { return renderSetupResult(setupConfiguration.importConfig(flagValue("config"))); }
function setupExportConfig() {
  try {
    return renderSetupResult(setupConfiguration.exportConfig({ envPath: ENV_PATH, env: readEnv() }));
  } catch {
    return renderSetupResult(setupConfiguration.errorResult("CONFIG_READ_FAILED", "Unable to read the current configuration."));
  }
}

function manifestInput(configuration, release) {
  return {
    version: release.descriptor.version,
    source: configuration.source,
    mode: configuration.mode,
    platform: configuration.platform,
    runtimeProfiles: configuration.runtimeProfiles,
    capabilities: configuration.capabilities,
    artifacts: release.artifacts,
    services: release.images.map((image) => image.service),
    dataPaths: { storage: configuration.storage.path },
  };
}

function setupInstallOrRepair(operation) {
  const imported = setupConfiguration.importConfig(flagValue("config"));
  if (!imported.ok) return renderSetupResult(imported);
  const configuration = imported.details;
  if (configuration.mode !== "docker") {
    return renderSetupResult(setupConfiguration.errorResult("MODE_UNSUPPORTED", "Install and repair are currently available for Docker mode only.", { mode: configuration.mode }));
  }
  let release;
  try { release = resolveRelease({ configuration }); }
  catch (error) {
    const code = error instanceof ReleaseDescriptorError ? error.code : "RELEASE_DESCRIPTOR_INVALID";
    return renderSetupResult({ ok: false, code, message: error.message || "Release descriptor validation failed.", details: {}, nextActions: error.nextActions || ["Correct the release configuration and run repair."] });
  }
  const request = { path: INSTALLATION_MANIFEST_PATH, input: manifestInput(configuration, release) };
  try {
    if (process.env.ARCHIVE_CONTROL_CENTER_SKIP_DOCKER === "1") {
      installationManifest.beginInstallationOperation({ ...request, operation });
      installationManifest.updateLastSuccessfulStep({ ...request, step: "docker-compose-skipped" });
    } else {
      const runtime = createDockerRuntimeAdapter({
        compose: (args, options = {}) => releaseCompose(args, { ...options, env: { ...release.environment, ...(options.env || {}) } }),
        health: healthProbe,
        manifestStore: installationManifest,
      });
      const result = operation === "install" ? runtime.install(request) : runtime.repair(request);
      if (!result.ok) {
        return renderSetupResult({ ok: false, code: "INSTALL_FAILED", message: "Docker Compose did not complete the requested operation.", details: { status: result.status }, nextActions: ["Review Docker Compose output and run repair after correcting the failure."] });
      }
    }
    const manifest = installationManifest.readInstallationManifest(INSTALLATION_MANIFEST_PATH);
    return renderSetupResult({ ok: true, code: operation === "install" ? "INSTALL_RECORDED" : "REPAIR_RECORDED", message: `${operation === "install" ? "Installation" : "Repair"} completed and recorded safely.`, details: { manifest }, nextActions: ["Run setup health to verify the running stack."] });
  } catch (error) {
    if (error?.controlCenterOperation === "compose") {
      return renderSetupResult({ ok: false, code: "INSTALL_FAILED", message: "Docker Compose did not complete the requested operation.", details: {}, nextActions: ["Review Docker Compose output and run repair after correcting the failure."] });
    }
    return renderSetupResult({ ok: false, code: "MANIFEST_WRITE_FAILED", message: "Installation state could not be recorded safely.", details: {}, nextActions: ["Correct the local filesystem issue and run repair."] });
  }
}

// ─── Process helpers ──────────────────────────────────────────────────────────
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
function quoteCmdArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}
function runPnpm(args, cwd = ROOT, options = {}) {
  const env = options.env ? { ...process.env, ...options.env } : process.env;
  if (process.platform !== "win32") return spawnSync(PNPM, args, { cwd, stdio: "inherit", env });
  const command = [PNPM, ...args].map(quoteCmdArg).join(" ");
  return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], { cwd, stdio: "inherit", env });
}
const runNode = (file, args = [], cwd = ROOT) => spawnSync(process.execPath, [file, ...args], { cwd, stdio: "inherit" });
const checkPnpm = () => {
  if (process.platform !== "win32") return spawnSync(PNPM, ["--version"], { stdio: "pipe", encoding: "utf8" });
  return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `${PNPM} --version`], { stdio: "pipe", encoding: "utf8" });
};

// ─── Docker compose ─────────────────────────────────────────────────────────
// V1-208A policy remains here through the shared platform contract: `core` is
// always enabled, while `media`/`edge` are explicit optional Compose profiles.
const { dockerComposeCmd, compose } = createDockerCompose({
  composeFile: COMPOSE_FILE,
  infraDir: INFRA_DIR,
  envPath: ENV_PATH,
  readEnv,
  output,
  loadPlatformContract,
  resolveComposeProfiles,
});
const { compose: releaseCompose } = createDockerCompose({
  composeFile: RELEASE_COMPOSE_FILE,
  infraDir: INFRA_DIR,
  envPath: ENV_PATH,
  readEnv,
  output,
  loadPlatformContract,
  resolveComposeProfiles,
});
// The laravel service publishes no host port; Next (:3000) rewrites /api/v1/*
// to it (archive-next/next.config.mjs), so probe Laravel's health through Next.
function defaultHealthUrl(env = readEnv()) {
  if (env.HEALTH_URL) return env.HEALTH_URL;
  return `http://127.0.0.1:${env.NEXT_PUBLIC_PORT || "3000"}/api/v1/health`;
}
function appUrl(env = readEnv()) {
  if (env.APP_BASE_URL && /^https?:\/\//.test(env.APP_BASE_URL)) return env.APP_BASE_URL.replace(/\/+$/, "");
  return `http://localhost:${env.NEXT_PUBLIC_PORT || "3000"}`;
}

// ─── Runtime adapter and service operations ──────────────────────────────────
const healthProbe = createHealthProbe({ readEnv, defaultHealthUrl, output });
const dockerRuntime = createDockerRuntimeAdapter({ compose, health: healthProbe, manifestStore: installationManifest });
const operations = createControlOperations({
  adapter: dockerRuntime,
  composeFile: COMPOSE_FILE,
  backupDir: BACKUP_DIR,
  readEnv,
  output,
  ask,
  confirm,
  runPnpm,
  root: ROOT,
});
const {
  serverStatus,
  serverStart,
  serverStop,
  serverRestart,
  serverLogs,
  healthCheck,
  migrateStatus,
  migrateDeploy,
  seedDemoData,
  listBackupFiles,
  backupNow,
  listBackups,
  restoreBackup,
  runDiagnostics,
  updateAndRebuild,
} = operations;

async function localObservabilityCheck() {
  titleLine("Local operator checks");
  const expectedServices = ["postgres", "redis", "laravel", "laravel-fpm", "laravel-worker", "ocr", "laravel-reverb", "next", "caddy"];
  const ps = compose(["ps", "--all", "--format", "json"], { inherit: false });
  const recent = compose(["logs", "--tail=500", "--no-color", "--no-log-prefix", "laravel", "laravel-fpm", "laravel-worker", "laravel-reverb", "next", "caddy"], { inherit: false });
  const queue = compose(["exec", "-T", "redis", "sh", "-c", "redis-cli -a \"$REDIS_PASSWORD\" LLEN queues:default"], { inherit: false });
  const disk = statfsSync(ROOT);
  const diskUsedPercent = disk.blocks ? Math.round((1 - Number(disk.bavail) / Number(disk.blocks)) * 100) : 0;
  const backups = listBackupFiles().map((name) => statSync(join(BACKUP_DIR, name)).mtimeMs);
  const backupAgeHours = backups.length ? (Date.now() - Math.max(...backups)) / 3_600_000 : null;
  const env = readEnv();
  const snapshot = collectOperatorSnapshot({ expectedServices, composePs: ps, redis: queue, logs: recent, diskUsedPercent, backupAgeHours, errorWindowMinutes: Number(env.OBS_ERROR_WINDOW_MINUTES || 60) });
  const thresholds = { queueDepth: Number(env.OBS_QUEUE_DEPTH_THRESHOLD || 100), diskUsedPercent: Number(env.OBS_DISK_USED_PERCENT_THRESHOLD || 85), backupAgeHours: Number(env.OBS_BACKUP_AGE_HOURS_THRESHOLD || 24), repeatedErrors: Number(env.OBS_REPEATED_ERRORS_THRESHOLD || 5) };
  let deepHealth = { ok: false, error: "unavailable" };
  try { const response = await fetch(defaultHealthUrl(env), { signal: AbortSignal.timeout(5000) }); deepHealth = await response.json(); } catch { snapshot.unknown.push("deep_health"); }
  const readiness = buildReadinessContract({ deepHealth, services: snapshot.services, unknown: snapshot.unknown });
  const report = buildOperatorReport(snapshot, thresholds);
  console.log(JSON.stringify({ ...report, readiness }, null, 2));
  return report.ok && readiness.ok ? 0 : 1;
}

async function supportBundle() {
  titleLine("Sanitized support bundle");
  const healthUrl = defaultHealthUrl();
  let health = { ok: false, error: "unavailable" };
  try { const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) }); health = await response.json(); } catch { /* bounded diagnostic */ }
  const logs = compose(["logs", "--tail=200", "--no-color"], { inherit: false });
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const result = createSupportBundle({
    outputDir: join(ROOT, "support-bundles"),
    versions: { archiveSuite: pkg.version, node: process.version, platform: process.platform },
    config: readEnvRaw(), health,
    manifests: { "docker-compose.yml": readFileSync(COMPOSE_FILE, "utf8") },
    logs: { canonical: String(logs.stdout || logs.stderr || "") },
  });
  ok(`Created ${result.path} (${result.bytes} bytes). Archive content and user files are excluded.`);
  return 0;
}

// ─── Configuration (Phase 2) ──────────────────────────────────────────────────
const EDITABLE_KEYS = ["ACCESS_MODE", "PUBLIC_DOMAIN", "PORT", "APP_BASE_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "AI_PROVIDER", "FILE_STORE", "ADMIN_USERNAME"];
function showConfig() {
  titleLine("Configuration (.env, secrets masked)");
  if (!existsSync(ENV_PATH)) return warn(`No .env yet at ${ENV_PATH} — run Deploy first.`);
  const env = readEnv();
  const order = ["ACCESS_MODE", "PUBLIC_DOMAIN", "PORT", "DATABASE_PROVIDER", "DATABASE_URL", "ADMIN_USERNAME", "APP_BASE_URL", "SMTP_HOST", "AI_PROVIDER", "FILE_STORE"];
  for (const k of order) if (k in env) log(`${C.c}${k.padEnd(18)}${C.x} ${maskValue(k, env[k])}`);
  log(`${C.d}(${Object.keys(env).length} keys total.)${C.x}`);
}
async function editSetting() {
  titleLine("Edit a setting");
  const env = readEnv();
  EDITABLE_KEYS.forEach((k, i) => log(`${C.b}${String(i + 1).padStart(2)}${C.x}) ${k.padEnd(16)} ${C.d}${maskValue(k, env[k] || "")}${C.x}`));
  const pick = await ask("Which setting number (or blank to cancel)");
  const key = EDITABLE_KEYS[Number(pick) - 1];
  if (!key) return log("Cancelled.");
  const value = await ask(`New value for ${key}`, env[key] || "");
  if (key === "PORT" && !/^\d+$/.test(value)) return err("PORT must be a number.");
  if (await confirm(`Set ${key}=${value}?`)) writeEnv({ [key]: value });
}
async function setPublicUrl() {
  titleLine("Set public URL");
  const env = readEnv();
  const url = await ask("APP_BASE_URL (e.g. https://archive.example.com)", env.APP_BASE_URL || "");
  if (!/^https?:\/\//.test(url)) return err("Must start with http:// or https://");
  const updates = { APP_BASE_URL: url };
  const host = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  // DOMAIN drives Caddy in the canonical compose; PUBLIC_DOMAIN is the legacy key.
  if (host) { updates.PUBLIC_DOMAIN = host; updates.DOMAIN = host; }
  writeEnv(updates);
}

// ─── Security (Phase 3) ────────────────────────────────────────────────────────
async function rotateSecrets() {
  titleLine("Rotate Reverb secrets");
  warn("This drops live realtime (Reverb) sessions; clients reconnect after a rebuild.");
  warn("REVERB_APP_KEY is baked into the Next.js image — run 'deploy' or 'update' afterwards to rebuild.");
  if (!(await confirm("Rotate REVERB_APP_KEY and REVERB_APP_SECRET?"))) return log("Cancelled.");
  writeEnv({ REVERB_APP_KEY: genSecret(16), REVERB_APP_SECRET: genSecret(32) });
  // ponytail: LARAVEL_APP_KEY deliberately excluded — rotating it invalidates
  // all data Laravel encrypted with it. Rotate manually only with a recovery plan.
  log(`${C.d}LARAVEL_APP_KEY was NOT rotated (doing so invalidates encrypted data).${C.x}`);
}
function printGeneratedPassword() {
  titleLine("Generate a strong password");
  const password = genPassword();
  log(`${C.b}Generated password:${C.x} ${password}  ${C.d}(store it now — shown once)${C.x}`);
  return 0;
}
function applyLaravelAdminPassword(email, password) {
  if (!dockerComposeCmd()) return { applied: false, reason: "Docker Compose was not found." };
  const ps = compose(["ps", "--services", "--status", "running"], { inherit: false });
  if (ps.status !== 0) return { applied: false, reason: "the stack is not running or Docker is unavailable." };
  const services = String(ps.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  // V1-202 split "laravel" into nginx (public, no app env vars) + "laravel-fpm"
  // (php-fpm, carries APP_KEY/DB_*/REDIS_* and can run artisan). Running
  // artisan against the nginx container fails immediately for lack of env.
  if (!services.includes("laravel-fpm")) return { applied: false, reason: "the laravel-fpm service is not running." };
  const result = compose(
    ["exec", "-T", "laravel-fpm", "php", "artisan", "archive:admin-password", `--email=${email}`],
    { inherit: false, input: `${password}\n` }
  );
  if (result.status === 0) return { applied: true };
  const detail = String(result.stderr || result.stdout || "").trim().split(/\r?\n/)[0] || `artisan exited ${result.status}`;
  return { applied: false, reason: detail };
}
// Poll /api/v1/health until it responds OK or the timeout elapses. Once it
// does, laravel-fpm's startup chain (chown && migrate-safe && db:seed &&
// exec php-fpm) has necessarily finished — seeding races are impossible by
// construction, since php-fpm only execs after db:seed completes.
async function waitForHealthy(env, timeoutMs = 90000) {
  const url = defaultHealthUrl(env);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}
async function changeAdminPassword() {
  titleLine("Change admin password");
  if (!existsSync(ENV_PATH)) {
    err(`No .env at ${ENV_PATH} — run Deploy first.`);
    return 1;
  }
  const env = readEnv();
  const emailArg = flagValue("email");
  const email = emailArg || (!process.stdin.isTTY ? env.ADMIN_EMAIL || "admin@example.com" : await ask("Admin email", env.ADMIN_EMAIL || "admin@example.com"));
  let password = flagValue("password");
  let generated = false;

  if (hasFlag("generate") || (!password && !process.stdin.isTTY)) {
    password = genPassword();
    generated = true;
  } else if (!password) {
    const typed = await ask("New admin password (blank to generate)", "");
    password = typed || genPassword();
    generated = !typed;
  }

  const validation = validateAdminPassword(password);
  if (validation) {
    err(validation);
    return 1;
  }

  if (!writeEnv({ ADMIN_EMAIL: email, ADMIN_PASSWORD: password })) return 1;
  if (generated) log(`${C.b}Generated admin password:${C.x} ${password}  ${C.d}(store it now — shown once)${C.x}`);

  if (hasFlag("env-only")) {
    warn("Skipped live Laravel update because --env-only was used.");
    warn("Restart the stack, or run this command again without --env-only while Laravel is running.");
    return 0;
  }

  const live = applyLaravelAdminPassword(email, password);
  if (live.applied) {
    ok(`Updated the existing Laravel user password for ${email}.`);
  } else {
    warn(`Skipped live Laravel update: ${live.reason}`);
    warn("If the user already exists, restart alone will not change its password; rerun this command while the stack is running.");
  }
  return 0;
}
// Database, backup, and maintenance commands are composed in operations.mjs.

async function deployCanonical() {
  titleLine("Deploy — canonical Laravel + Next.js stack");
  if (process.env.ARCHIVE_DEVELOPMENT_MODE !== "1") {
    err("Source deployment is a development-only command. User installations must run 'setup install --config=<file>' with a signed release descriptor.");
    return 1;
  }
  if (!existsSync(ENV_PATH)) {
    if (!existsSync(ENV_EXAMPLE)) { err(`Neither ${ENV_PATH} nor ${ENV_EXAMPLE} exists.`); return 1; }
    copyFileSync(ENV_EXAMPLE, ENV_PATH);
    ok(`Created ${ENV_PATH} from .env.example`);
  }
  const env = readEnv();
  const updates = {};
  if (isPlaceholder(env.POSTGRES_PASSWORD)) updates.POSTGRES_PASSWORD = genPassword();
  if (isPlaceholder(env.REDIS_PASSWORD)) updates.REDIS_PASSWORD = genPassword();
  if (isPlaceholder(env.REVERB_APP_ID)) updates.REVERB_APP_ID = genSecret(8);
  if (isPlaceholder(env.REVERB_APP_KEY)) updates.REVERB_APP_KEY = genSecret(16);
  if (isPlaceholder(env.REVERB_APP_SECRET)) updates.REVERB_APP_SECRET = genSecret(32);
  // Laravel expects APP_KEY as base64:<32 random bytes> (same as `php artisan key:generate`).
  if (isPlaceholder(env.LARAVEL_APP_KEY)) updates.LARAVEL_APP_KEY = `base64:${randomBytes(32).toString("base64")}`;
  const generatedAdminPassword = isPlaceholder(env.ADMIN_PASSWORD) ? genPassword() : null;
  if (generatedAdminPassword) updates.ADMIN_PASSWORD = generatedAdminPassword;
  // Keep the legacy DATABASE_URL in sync so legacy Prisma commands still connect.
  if (updates.POSTGRES_PASSWORD && (env.DATABASE_URL || "").includes("CHANGE_ME_POSTGRES_PASSWORD")) {
    updates.DATABASE_URL = env.DATABASE_URL.replaceAll("CHANGE_ME_POSTGRES_PASSWORD", updates.POSTGRES_PASSWORD);
  }
  if (Object.keys(updates).length) {
    log(`Generating secrets: ${Object.keys(updates).join(", ")}`);
    if (!writeEnv(updates)) return 1;
  } else {
    ok("All required secrets already set — leaving .env unchanged.");
  }
  const dockerSkipped = process.env.ARCHIVE_CONTROL_CENTER_SKIP_DOCKER === "1";
  if (dockerSkipped) {
    warn("Skipping docker compose because ARCHIVE_CONTROL_CENTER_SKIP_DOCKER=1.");
  } else {
    log("Building and starting the stack (docker compose up -d --build) — the first run takes a while...");
    const status = compose(["up", "-d", "--build"]).status ?? 1;
    if (status !== 0) { err(`docker compose up failed (exit ${status}).`); return status; }
  }
  const e = readEnv();
  ok(dockerSkipped ? "Provisioning complete. URLs after starting the stack:" : "Stack is up. URLs:");
  log(`  App (Next.js):      http://localhost:${e.NEXT_PUBLIC_PORT || "3000"}`);
  log(`  API health:         http://localhost:${e.NEXT_PUBLIC_PORT || "3000"}/api/v1/health (proxied to Laravel)`);
  log(`  Realtime (Reverb):  ws://localhost:${e.REVERB_SERVER_PUBLISHED_PORT || "8080"}`);
  log(`  Caddy (80/443):     http://${e.DOMAIN || "localhost"}`);
  let passwordApplyWarning = null;
  if (!dockerSkipped && generatedAdminPassword) {
    // A newly generated password only reaches the live database via db:seed's
    // firstOrCreate on a genuinely fresh install (no existing admin row yet).
    // On any redeploy over an existing volume, firstOrCreate is a silent
    // no-op — the live account keeps its OLD password while .env and this
    // printout show the new one, so the credentials shown never work. Apply
    // it explicitly once the stack is healthy so what's printed always
    // matches what actually unlocks the account.
    log("Waiting for the stack to become healthy so the new admin password can be applied...");
    const healthy = await waitForHealthy(e);
    if (healthy) {
      const live = applyLaravelAdminPassword(e.ADMIN_EMAIL || "admin@example.com", generatedAdminPassword);
      if (!live.applied) passwordApplyWarning = live.reason;
    } else {
      passwordApplyWarning = "the stack did not become healthy in time";
    }
  }
  if (generatedAdminPassword) {
    log("");
    ok(`Login email: ${e.ADMIN_EMAIL || "admin@example.com"} / ${C.b}${generatedAdminPassword}${C.x}  ${C.d}(store it now — shown once)${C.x}`);
    if (e.ADMIN_USERNAME) log(`  Legacy username:    ${e.ADMIN_USERNAME}`);
    if (passwordApplyWarning) {
      warn(`Could not confirm the password above was applied to the live account (${passwordApplyWarning}).`);
      warn(`Once the stack is healthy, run: setup change-admin-password --email=${e.ADMIN_EMAIL || "admin@example.com"} --password=<the password above>`);
    }
  } else {
    log(`  Login email:        ${e.ADMIN_EMAIL || "admin@example.com"} (existing password unchanged)`);
    if (e.ADMIN_USERNAME) log(`  Legacy username:    ${e.ADMIN_USERNAME}`);
  }
  return 0;
}

// ─── Guided setup wizard ──────────────────────────────────────────────────────
// Step-by-step first-run path: checks → questions → provision → deploy → verify.
// Non-interactive shells (CI, piped stdin) fall back to the plain deploy.
async function guidedSetup() {
  if (!process.stdin.isTTY) {
    warn("No interactive terminal detected — falling back to 'deploy' with generated defaults.");
    return deployCanonical();
  }
  titleLine("Guided setup — Masar wizard");
  log("This wizard walks you through the full first-run in 5 steps:");
  log(`  ${C.d}1) Environment check   2) Your answers   3) Provision .env${C.x}`);
  log(`  ${C.d}4) Build & start       5) Verify & next steps${C.x}`);
  log("");

  // Step 1 — environment check (read-only)
  log(`${C.b}Step 1/5 — Environment check${C.x}`);
  const doctorStatus = await runDoctor();
  if (doctorStatus !== 0) {
    err("Fix the critical issues above, then run the wizard again.");
    return doctorStatus;
  }

  // Step 2 — questions (defaults are safe; Enter accepts them)
  log(`\n${C.b}Step 2/5 — Configuration questions${C.x}`);
  const existing = readEnv();
  const email = await ask("Admin login email", existing.ADMIN_EMAIL || "admin@example.com");
  let password = await ask("Admin password (blank = generate a strong one)", "");
  let generatedPassword = false;
  if (!password) { password = genPassword(); generatedPassword = true; }
  const passwordError = validateAdminPassword(password);
  if (passwordError) { err(passwordError); return 1; }
  let port = await ask("App port (Next.js)", existing.NEXT_PUBLIC_PORT || "3000");
  if (!/^\d+$/.test(port)) { warn("Port must be a number — keeping 3000."); port = "3000"; }
  const publicUrl = await ask("Public URL (blank = local only)", existing.APP_BASE_URL && /^https?:\/\//.test(existing.APP_BASE_URL) ? existing.APP_BASE_URL : "");
  if (publicUrl && !/^https?:\/\//.test(publicUrl)) { err("Public URL must start with http:// or https://"); return 1; }
  const optionalProfiles = await ask(
    "Optional runtime profiles (blank = core only; media = media processing/OCR and extra resources; edge = public access/TLS)",
    existing.ARCHIVE_COMPOSE_PROFILES || ""
  );
  let profiles;
  try {
    profiles = resolveComposeProfiles(loadPlatformContract(), optionalProfiles);
  } catch (error) {
    err(error.message);
    return 1;
  }

  log("");
  log(`${C.b}Summary${C.x}`);
  log(`  Admin email:  ${email}`);
  log(`  Password:     ${generatedPassword ? `${C.d}(generated — shown after deploy)${C.x}` : "(as typed)"}`);
  log(`  App port:     ${port}`);
  log(`  Public URL:   ${publicUrl || `${C.d}http://localhost:${port} (local)${C.x}`}`);
  log(`  Runtime profiles: ${profiles.join(", ") || "core only"}`);
  if (!(await confirm("Apply this configuration and deploy?", "y"))) return log("Cancelled — nothing was changed.");

  // Step 3 — provision .env with the answers; deploy fills remaining secrets
  log(`\n${C.b}Step 3/5 — Provision configuration${C.x}`);
  if (!existsSync(ENV_PATH)) {
    if (!existsSync(ENV_EXAMPLE)) { err(`Neither ${ENV_PATH} nor ${ENV_EXAMPLE} exists.`); return 1; }
    copyFileSync(ENV_EXAMPLE, ENV_PATH);
    ok(`Created ${ENV_PATH} from .env.example`);
  }
  const updates = { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, NEXT_PUBLIC_PORT: port, ARCHIVE_COMPOSE_PROFILES: profiles.join(",") };
  if (publicUrl) {
    updates.APP_BASE_URL = publicUrl;
    const host = publicUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (host) { updates.PUBLIC_DOMAIN = host; updates.DOMAIN = host; }
  }
  if (!writeEnv(updates)) return 1;

  // Step 4 — deploy (generates remaining secrets, builds, starts)
  log(`\n${C.b}Step 4/5 — Build & start the stack${C.x}`);
  const deployStatus = await deployCanonical();
  if (deployStatus !== 0) { err("Deploy failed — see the messages above. Re-run the wizard after fixing them."); return deployStatus; }
  if (generatedPassword) {
    log("");
    ok(`Your admin password: ${C.b}${password}${C.x}  ${C.d}(store it now — shown once)${C.x}`);
  }

  // Step 5 — verify + next steps
  log(`\n${C.b}Step 5/5 — Verify${C.x}`);
  const healthStatus = await healthCheck();
  log("");
  log(`${C.b}Next steps${C.x}`);
  log(`  1. Open ${C.c}${publicUrl || `http://localhost:${port}`}${C.x} and sign in as ${email}.`);
  log(`  2. Optional: seed demo content — ${C.c}setup seed-demo${C.x}`);
  log(`  3. Check status any time — ${C.c}setup status${C.x} / ${C.c}setup health${C.x}`);
  if (healthStatus !== 0) warn("Health check did not pass yet — first boot can take a minute; retry with 'setup health'.");
  return healthStatus;
}

// ─── Quick start (deploy + health) ────────────────────────────────────────────
async function quickStart() {
  titleLine("Quick start — deploy → health check");
  log("Step 1/2: Deploy (builds and starts the stack)");
  const deployStatus = await deployCanonical();
  if (deployStatus !== 0) { err("Deploy failed. Aborting quick start."); return deployStatus || 1; }
  log("\nStep 2/2: Health check");
  const healthStatus = await healthCheck();
  const env = readEnv();
  if (healthStatus === 0) ok(`Stack should be reachable at ${appUrl(env)}`);
  return healthStatus;
}

function firstRunGuide() {
  titleLine("First run — Masar onboarding guide");
  log("Use this guide when preparing the canonical Laravel + Next.js stack for the first time.");
  log("");
  log(`${C.b}Recommended${C.x}`);
  log(`  ${C.c}setup wizard${C.x}   ${C.d}Guided setup: checks -> questions -> deploy -> verify.${C.x}`);
  log("");
  log(`${C.b}Quick preset${C.x}`);
  log(`  ${C.c}setup doctor${C.x}   ${C.d}Check Node.js, pnpm, Docker, and .env.${C.x}`);
  log(`  ${C.c}setup quick${C.x}    ${C.d}Deploy, start Docker, and run the health check.${C.x}`);
  log(`  ${C.c}setup change-admin-password --generate${C.x}  ${C.d}Generate and apply a new first-login password.${C.x}`);
  log(`  ${C.d}Setup defaults to core only; select media (OCR/resources) or edge (public TLS) explicitly in the wizard.${C.x}`);
  log("");
  log(`${C.b}Advanced preset${C.x}`);
  log(`  ${C.c}setup doctor${C.x}          ${C.d}Pre-flight report.${C.x}`);
  log(`  ${C.c}setup deploy${C.x}          ${C.d}Provision .env secrets and build the stack.${C.x}`);
  log(`  ${C.c}setup config${C.x}          ${C.d}Review public URL, ports, and storage/provider settings.${C.x}`);
  log(`  ${C.c}setup migrate-status${C.x}  ${C.d}Inspect Laravel migrations.${C.x}`);
  log(`  ${C.c}setup health${C.x}          ${C.d}Probe /api/v1/health through Next.js.${C.x}`);
  log("");
  warn("Store the generated admin password immediately; it is shown once during deploy.");
  log(`Open ${C.c}/first-run${C.x} in the Next.js app to track these steps from the UI.`);
  return 0;
}

// ─── Doctor — environment pre-flight check ───────────────────────────────────
async function runDoctor() {
  titleLine("Doctor — environment pre-flight check");
  let issues = 0;
  const mode = flagValue("mode");
  const platformId = flagValue("platform");
  const hasPlatformFilter = hasFlag("mode") || hasFlag("platform");
  let selectedPlatforms = null;
  if ((hasFlag("mode") && !mode) || (hasFlag("platform") && !platformId)) {
    err("Doctor filters require a value: --mode=docker|native or --platform=<id>.");
    return 1;
  }
  if (hasPlatformFilter) {
    try {
      const contract = loadPlatformContract();
      selectedPlatforms = selectPlatforms(contract, { mode, platformId });
      for (const line of formatPlatformContractReport(contract, selectedPlatforms)) log(line);
      log("");
    } catch (error) {
      err(error.message);
      return 1;
    }
  }
  const nativeOnly = selectedPlatforms?.every((platform) => platform.mode === "native") ?? false;

  // Node.js version
  const nodeMajor = Number(process.version.slice(1).split(".")[0]);
  if (nodeMajor >= 22) {
    ok(`Node.js ${process.version}`);
  } else {
    err(`Node.js ${process.version} — version 22+ required`);
    issues++;
  }

  // pnpm
  const pnpmCheck = checkPnpm();
  if (pnpmCheck.status === 0) {
    ok(`pnpm ${(pnpmCheck.stdout || "").trim()}`);
  } else {
    err("pnpm not found — install: npm i -g pnpm");
    issues++;
  }

  // Docker is a host prerequisite for the conditional Docker paths only.
  if (!nativeOnly) {
    const dockerCheck = spawnSync("docker", ["--version"], { stdio: "pipe", encoding: "utf8" });
    if (dockerCheck.status === 0) ok(`Docker — ${(dockerCheck.stdout || "").trim()}`);
    else warn("Docker not found — required for the canonical Laravel + Next stack");
    const dc = dockerComposeCmd();
    if (dc) ok("Docker Compose — available");
    else warn("Docker Compose not found — install Docker Desktop or docker-compose v2");
  } else {
    log(`${C.d}Docker checks skipped: the selected native platform is planned and no native services are installed or started.${C.x}`);
  }

  // .env file
  if (existsSync(ENV_PATH)) {
    ok(`.env found at ${ENV_PATH}`);
  } else {
    warn(`.env not found at ${ENV_PATH} — run Deploy first`);
  }

  // Health is a safe GET, but does not apply to a planned native deployment.
  if (!nativeOnly) {
    const env = readEnv();
    const url = defaultHealthUrl(env);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      ok(`${url} — server responding (HTTP ${res.status})`);
    } catch {
      log(`  ${C.d}${url} — not responding (server may not be started yet — run 'start')${C.x}`);
    }
  } else {
    log(`${C.d}Health endpoint skipped: native deployment is planned and this doctor command does not start services.${C.x}`);
  }

  // Summary
  hr();
  if (issues === 0 && nativeOnly) {
    ok("Read-only checks completed. Native deployment remains planned; no install or start action is available.");
  } else if (issues === 0) {
    ok("All checks passed. Run 'setup quick' to deploy and start, or 'node scripts/control-center.mjs start'.");
  } else {
    err(`${issues} critical issue(s) found — resolve them before deploying.`);
  }
  return issues === 0 ? 0 : 1;
}

// ─── Menu ───────────────────────────────────────────────────────────────────
const MENU = [
  ["sec", "— Quick Actions —"],
  ["1", "Guided setup (wizard — recommended first run)", guidedSetup],
  ["2", "Quick start (deploy + health)", quickStart],
  ["3", "First-run guide", firstRunGuide],
  ["4", "Doctor (pre-flight check)", runDoctor],
  ["sec", "— Deploy (Laravel + Next.js) —"],
  ["5", "Development deploy / re-provision", deployCanonical],
  ["sec", "— Server —"],
  ["6", "Status", serverStatus],
  ["7", "Start", serverStart],
  ["8", "Stop", serverStop],
  ["9", "Restart", serverRestart],
  ["10", "Logs", () => serverLogs({ follow: true })],
  ["11", "Health check", healthCheck],
  ["sec", "— Configure —"],
  ["12", "View configuration", showConfig],
  ["13", "Edit a setting", editSetting],
  ["14", "Set public URL", setPublicUrl],
  ["sec", "— Security —"],
  ["15", "Generate a strong password", printGeneratedPassword],
  ["16", "Change admin password", changeAdminPassword],
  ["17", "Rotate Reverb secrets", rotateSecrets],
  ["sec", "— Database —"],
  ["18", "Migration status (artisan)", migrateStatus],
  ["19", "Apply migrations (artisan)", migrateDeploy],
  ["20", "Seed demo data (types · sections · records)", seedDemoData],
  ["sec", "— Backups —"],
  ["21", "Backup now", backupNow],
  ["22", "List backups", listBackups],
  ["23", "Restore backup", restoreBackup],
  ["sec", "— Maintain —"],
  ["24", "Diagnostics (pnpm verify)", runDiagnostics],
  ["25", "Development update & rebuild", () => process.env.ARCHIVE_DEVELOPMENT_MODE === "1" ? updateAndRebuild() : (err("Update & rebuild is development-only; release update is not supported yet."), 1)],
  ["sec", ""],
  ["0", "Exit", null],
  ["q", "Exit", null],
];

// One-line preflight summary printed at the top of the interactive menu.
// Avoids the full Doctor wall of text but still surfaces blockers up front
// (missing Node/pnpm/Docker, missing .env) so the operator doesn't pick
// "Start" only to hit an opaque error message.
function preflightSummary() {
  const nodeMajor = Number(process.version.slice(1).split(".")[0]);
  const pnpmOk = checkPnpm().status === 0;
  const dockerOk = spawnSync("docker", ["--version"], { stdio: "pipe", encoding: "utf8" }).status === 0;
  const envOk = existsSync(ENV_PATH);
  const issues = [];
  if (nodeMajor < 22) issues.push(`Node ${process.version} (need ≥22)`);
  if (!pnpmOk) issues.push("pnpm missing — run: npm i -g pnpm");
  if (!dockerOk) issues.push("Docker missing — required for the canonical Laravel + Next stack");
  if (!envOk) issues.push(`.env not found — run option 1 (Guided setup) or 5 (Deploy) first`);
  if (issues.length === 0) {
    ok(`Preflight: Node ${process.version} · pnpm OK · Docker OK · .env present`);
  } else {
    warn("Preflight found issues:");
    for (const issue of issues) log(`   ${C.y}-${C.x} ${issue}`);
    log(`   ${C.d}Run option 4 (Doctor) for the full report.${C.x}`);
  }
}

async function interactive() {
  printBanner();
  preflightSummary();
  for (;;) {
    printMenu(MENU);
    const choice = await ask("Choose an option");
    const item = MENU.find((m) => m[0] === choice && m[0] !== "sec");
    if (!item) { warn("Unknown option."); continue; }
    if (item[0] === "0" || item[0] === "q") break;
    try { await item[2](); } catch (e) { err(e.message); }
    log("");
  }
  close();
  log("Goodbye.");
}

// ─── Non-interactive subcommands ──────────────────────────────────────────────
const COMMANDS = {
  // Quick entry points
  wizard: guidedSetup, "guided-setup": guidedSetup,
  quick: quickStart, "first-run": firstRunGuide, doctor: runDoctor,
  // Server
  status: serverStatus, start: serverStart, stop: serverStop, restart: serverRestart,
  logs: () => serverLogs({ follow: false }), health: healthCheck,
  // Config
  config: showConfig, "set-url": setPublicUrl, plan: setupPlan, "import-config": setupImportConfig, "export-config": setupExportConfig,
  install: () => setupInstallOrRepair("install"), repair: () => setupInstallOrRepair("repair"),
  // Security
  "generate-password": printGeneratedPassword, password: printGeneratedPassword,
  "change-admin-password": changeAdminPassword, "set-admin-password": changeAdminPassword, "admin-password": changeAdminPassword,
  "rotate-secrets": rotateSecrets,
  // Database
  "migrate-status": migrateStatus, migrate: migrateDeploy,
  "seed-demo": seedDemoData, "demo-data": seedDemoData,
  // Backups
  backup: backupNow, backups: listBackups, restore: restoreBackup,
  // Maintenance
  diagnostics: runDiagnostics, observability: localObservabilityCheck, "support-bundle": supportBundle,
  update: () => process.env.ARCHIVE_DEVELOPMENT_MODE === "1" ? updateAndRebuild() : (err("Update & rebuild is development-only; release update is not supported yet."), 1),
  deploy: deployCanonical,
  help: () => {
    printBanner();
    console.log(`${C.b}  Quick-start examples:${C.x}`);
    console.log(`  ${C.d}# Review the first-run paths without changing anything:${C.x}`);
    console.log(`  ${C.c}setup first-run${C.x}`);
    console.log(`  ${C.d}# Recommended first-time setup — guided, question by question:${C.x}`);
    console.log(`  ${C.c}setup wizard${C.x}`);
    console.log(`  ${C.d}# First-time setup on this machine (deploy the Laravel+Next stack, then health):${C.x}`);
    console.log(`  ${C.c}setup quick${C.x}`);
    console.log(`  ${C.d}# Verify the environment before deploying (Node/pnpm/Docker/.env):${C.x}`);
    console.log(`  ${C.c}setup doctor${C.x}`);
    console.log(`  ${C.d}# Run the interactive menu (default when no command is given):${C.x}`);
    console.log(`  ${C.c}setup${C.x}`);
    console.log(`  ${C.d}# Generate or change the first-login admin password:${C.x}`);
    console.log(`  ${C.c}setup generate-password${C.x}`);
    console.log(`  ${C.c}setup change-admin-password --generate${C.x}`);
    console.log("");
    console.log(`${C.b}  Commands (canonical Laravel + Next.js stack):${C.x}`);
    console.log(`  ${C.c}wizard${C.x}           Guided first-run setup (checks -> questions -> deploy -> verify)`);
    console.log(`  ${C.c}quick${C.x}            Deploy + health check in one step`);
    console.log(`  ${C.c}first-run${C.x}        Show the quick/advanced first-run guide`);
    console.log(`  ${C.c}doctor [--mode=docker|native] [--platform=<id>]${C.x}  Read-only platform contract + pre-flight checks`);
    console.log(`  ${C.c}deploy${C.x}           Provision .env secrets + docker compose up -d --build`);
    console.log(`  ${C.c}start | stop | restart${C.x}  Manage the Docker stack (infra/docker-compose.yml)`);
    console.log(`  ${C.c}status | health | logs${C.x}  Monitor the running stack (health: /api/v1/health via Next)`);
    console.log(`  ${C.c}config${C.x}           View .env (secrets masked)`);
    console.log(`  ${C.c}plan --config=<file>${C.x}  Validate a setup config and print a read-only deterministic plan`);
    console.log(`  ${C.c}import-config --config=<file>${C.x}  Validate and print normalized setup configuration (no writes)`);
    console.log(`  ${C.c}export-config${C.x}    Export current non-secret setup choices from .env`);
    console.log(`  ${C.c}install --config=<file>${C.x} Run the Docker install and write its safe resumable manifest`);
    console.log(`  ${C.c}repair --config=<file>${C.x} Resume or repair the Docker install using its manifest`);
    console.log(`  ${C.c}set-url${C.x}          Set APP_BASE_URL + PUBLIC_DOMAIN + DOMAIN`);
    console.log(`  ${C.c}generate-password${C.x}  Print a strong password without changing .env`);
    console.log(`  ${C.c}change-admin-password${C.x}  Update ADMIN_EMAIL/PASSWORD and apply to Laravel when running`);
    console.log(`  ${C.c}rotate-secrets${C.x}   Regenerate REVERB_APP_KEY/SECRET (then re-deploy)`);
    console.log(`  ${C.c}migrate-status${C.x}   php artisan migrate:status (in the laravel container)`);
    console.log(`  ${C.c}migrate${C.x}          php artisan archive:migrate-safe (backup + maintenance window, in the laravel container)`);
    console.log(`  ${C.c}seed-demo${C.x}        Seed demo archive data (types, sections, classifications)`);
    console.log(`  ${C.c}backup${C.x}           pg_dump the running database`);
    console.log(`  ${C.c}backups${C.x}          List available backups`);
    console.log(`  ${C.c}restore${C.x}          Restore a backup`);
    console.log(`  ${C.c}diagnostics${C.x}      Run the canonical gate: pnpm verify`);
    console.log(`  ${C.c}observability${C.x}    Local service/error/backup alert checks (JSON)`);
    console.log(`  ${C.c}support-bundle${C.x}   Create a bounded, redacted local diagnostics bundle`);
    console.log(`  ${C.c}update${C.x}           git pull → install → build → docker compose up -d --build`);
    console.log(`\n${C.b}  Tips:${C.x}`);
    console.log(`  ${C.d}- In the interactive menu, option 1 is the single quick-start path; q and 0 both exit.${C.x}`);
    console.log(`  ${C.d}- "Stack not running" → run 'setup start' or 'setup doctor' to diagnose.${C.x}`);
    console.log(`  ${C.d}- "No .env found"     → run 'setup deploy' to provision a fresh configuration.${C.x}`);
    console.log(`\n${C.b}  Interactive menu (run 'setup' without arguments):${C.x}`);
    printMenu(MENU);
    console.log(`  ${C.d}Usage: node scripts/control-center.mjs <command>${C.x}\n`);
  },
};

COMMANDS["0"] = () => 0;
COMMANDS.q = () => 0;

const cmd = cliCommand;
if (cmd) {
  const fn = COMMANDS[cmd];
  if (!fn) { err(`Unknown command "${cmd}". Try: ${Object.keys(COMMANDS).join(", ")}`); process.exit(1); }
  const status = await fn();
  close();
  if (typeof status === "number" && status !== 0) process.exit(status);
} else {
  await interactive();
}
