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
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";
import { formatPlatformContractReport, loadPlatformContract, selectPlatforms } from "./platform-contract.mjs";
import { buildOperatorReport, buildReadinessContract, collectOperatorSnapshot, createSupportBundle } from "./observability.mjs";

// ─── Paths ──────────────────────────────────────────────────────────────────
const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const ROOT = resolve(__dirname, "..");
const INFRA_DIR = join(ROOT, "infra");
const ENV_PATH = process.env.ARCHIVE_ENV_PATH || join(INFRA_DIR, ".env");
const ENV_EXAMPLE = join(INFRA_DIR, ".env.example");
// Canonical stack: Laravel API + Next.js (postgres/redis/laravel/worker/reverb/next/caddy).
const COMPOSE_FILE = join(INFRA_DIR, "docker-compose.yml");
const BACKUP_DIR = join(INFRA_DIR, "backups");

// ─── Colours / logging ──────────────────────────────────────────────────────
const C = { g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };
const log = (m = "") => console.log(`  ${m}`);
const ok = (m) => console.log(`  ${C.g}OK${C.x}  ${m}`);
const warn = (m) => console.log(`  ${C.y}!!${C.x}  ${m}`);
const err = (m) => console.error(`  ${C.r}xx${C.x}  ${m}`);
const titleLine = (m) => console.log(`\n${C.b}${C.c}${m}${C.x}\n`);
const hr = () => console.log(`${C.d}${"-".repeat(60)}${C.x}`);

// ─── Prompt (lazily-created shared readline) ─────────────────────────────────
let _rl = null;
function rl() {
  if (!_rl) _rl = createInterface({ input: process.stdin, output: process.stdout });
  return _rl;
}
const ask = (q, def = "") =>
  new Promise((res) => rl().question(`  ${C.c}?${C.x} ${q}${def ? ` ${C.y}(${def})${C.x}` : ""}: `, (a) => res(a.trim() || def)));
const confirm = async (q, def = "n") => {
  const a = await ask(`${q} ${C.d}(y/n)${C.x}`, def);
  return a.toLowerCase().startsWith("y");
};

// ─── CLI flags ───────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);
const hasFlag = (name) => ARGS.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
function flagValue(name) {
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  const inline = ARGS.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = ARGS.indexOf(exact);
  if (idx >= 0 && ARGS[idx + 1] && !ARGS[idx + 1].startsWith("-")) return ARGS[idx + 1];
  return null;
}

// ─── .env helpers ───────────────────────────────────────────────────────────
function readEnvRaw() {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
}
function readEnv() {
  const out = {};
  for (const line of readEnvRaw().split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = parseEnvValue(m[2]);
  }
  return out;
}
function parseEnvValue(value) {
  const raw = String(value ?? "").trim();
  if (raw.startsWith("#")) return "";
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) return raw.slice(1, -1);
  return raw.replace(/\s+#.*$/, "").trim();
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function setVar(content, key, value) {
  const re = new RegExp(`^(${escapeRegExp(key)}=).*`, "gm");
  return re.test(content)
    ? content.replace(re, (_line, prefix) => `${prefix}${value}`)
    : `${content.replace(/\n?$/, "\n")}${key}=${value}`;
}
/** Apply key→value updates to .env, backing up first. Returns true on success. */
function writeEnv(updates) {
  if (!existsSync(ENV_PATH)) { err(`No .env at ${ENV_PATH} — run Deploy first.`); return false; }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  copyFileSync(ENV_PATH, `${ENV_PATH}.bak-${stamp}`);
  let content = readEnvRaw();
  for (const [k, v] of Object.entries(updates)) content = setVar(content, k, v);
  writeFileSync(ENV_PATH, content);
  ok(`Updated ${Object.keys(updates).join(", ")} (backup: .env.bak-${stamp})`);
  warn("Restart the stack for changes to take effect (menu: Server: restart).");
  return true;
}
const SECRET_KEYS = /(SECRET|PASSWORD|TOKEN|KEY|DSN|URL)$/;
const maskValue = (k, v) => (SECRET_KEYS.test(k) && v ? v.slice(0, 3) + "...(hidden)" : v);
const genSecret = (bytes = 32) => randomBytes(bytes).toString("hex");
const genPassword = (length = 24) => randomBytes(length).toString("base64url").slice(0, length);
const MIN_ADMIN_PASSWORD_LENGTH = 12;
function validateAdminPassword(password) {
  if (String(password || "").length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
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
function dockerComposeCmd() {
  const v2 = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
  if (v2.status === 0) return { bin: "docker", pre: ["compose"] };
  const v1 = spawnSync("docker-compose", ["version"], { stdio: "ignore" });
  if (v1.status === 0) return { bin: "docker-compose", pre: [] };
  return null;
}
// V1-209: default is full stack (media + edge) so existing operators see no
// behavior change — native `profiles:` on ocr/caddy otherwise skips them on a
// bare `docker compose up`. ARCHIVE_COMPOSE_PROFILES="" (empty string) opts
// into core-only; a comma list picks specific profiles.
function composeProfileArgs() {
  const raw = process.env.ARCHIVE_COMPOSE_PROFILES;
  const profiles = raw === undefined ? ["media", "edge"] : raw.split(",").map((p) => p.trim()).filter(Boolean);
  return profiles.flatMap((p) => ["--profile", p]);
}
function compose(actionArgs, { inherit = true, input } = {}) {
  const dc = dockerComposeCmd();
  if (!dc) { err("Docker (with Compose) was not found. Install Docker first."); return { status: 127 }; }
  const args = [...dc.pre, "-f", COMPOSE_FILE, ...(existsSync(ENV_PATH) ? ["--env-file", ENV_PATH] : []), ...composeProfileArgs(), ...actionArgs];
  return spawnSync(dc.bin, args, { cwd: INFRA_DIR, stdio: inherit ? "inherit" : "pipe", encoding: "utf8", input });
}
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

// ─── Server control ───────────────────────────────────────────────────────────
function serverStatus() {
  titleLine("Server status");
  if (!existsSync(COMPOSE_FILE)) { warn("No compose file yet — run Deploy first."); return 1; }
  return compose(["ps"]).status ?? 1;
}
function serverStart() {
  titleLine("Starting (docker compose up -d)");
  const status = compose(["up", "-d"]).status ?? 1;
  if (status === 0) ok("Stack started."); else err(`Docker compose start failed (exit ${status}).`);
  return status;
}
function serverStop() {
  titleLine("Stopping (docker compose down)");
  const status = compose(["down"]).status ?? 1;
  if (status === 0) ok("Stack stopped."); else err(`Docker compose stop failed (exit ${status}).`);
  return status;
}
function serverRestart() {
  titleLine("Restarting (docker compose restart)");
  const status = compose(["restart"]).status ?? 1;
  if (status === 0) ok("Stack restarted."); else err(`Docker compose restart failed (exit ${status}).`);
  return status;
}
function serverLogs({ follow = false } = {}) {
  titleLine("Service logs (last 200 lines)" + (follow ? " — following, Ctrl+C to stop" : ""));
  return compose(["logs", "--tail=200", ...(follow ? ["-f"] : [])]).status ?? 1;
}
async function healthCheck() {
  titleLine("Health check");
  const env = readEnv();
  const url = defaultHealthUrl(env);
  log(`GET ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    (res.ok ? ok : warn)(`HTTP ${res.status}. ${body.slice(0, 200)}`);
    return res.ok ? 0 : 1;
  } catch (e) {
    err(`No response from ${url} — is the stack running? (${e.name})`);
    return 1;
  }
}

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
  if (!services.includes("laravel")) return { applied: false, reason: "the laravel service is not running." };
  const result = compose(
    ["exec", "-T", "laravel", "php", "artisan", "archive:admin-password", `--email=${email}`],
    { inherit: false, input: `${password}\n` }
  );
  if (result.status === 0) return { applied: true };
  const detail = String(result.stderr || result.stdout || "").trim().split(/\r?\n/)[0] || `artisan exited ${result.status}`;
  return { applied: false, reason: detail };
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
// ─── Database (Phase 4) ────────────────────────────────────────────────────────
function migrateStatus() {
  titleLine("Database migration status (php artisan migrate:status)");
  return compose(["exec", "-T", "laravel", "php", "artisan", "migrate:status"]).status ?? 1;
}
async function migrateDeploy() {
  titleLine("Apply pending migrations (php artisan archive:migrate-safe)");
  log("Preflight-checked: backs up the database first, runs in a maintenance window, and exits cleanly if nothing is pending.");
  if (!(await confirm("Apply all pending migrations to the configured database?"))) { log("Cancelled."); return 0; }
  const r = compose(["exec", "-T", "laravel", "php", "artisan", "archive:migrate-safe"]);
  if (r.status === 0) ok("Migrations applied.");
  else err("Migration failed — application left in maintenance mode. See command output above for rollback steps.");
  return r.status ?? 1;
}
async function seedDemoData() {
  titleLine("Seed demo archive data (php artisan db:seed --class=DemoArchiveSeeder)");
  log("Adds sample archive records with content types, sections, and classifications.");
  log(`${C.d}Idempotent — safe to re-run; never duplicates existing demo rows.${C.x}`);
  if (!(await confirm("Insert demo archive content into the configured database?"))) { log("Cancelled."); return 0; }
  const r = compose(["exec", "-T", "laravel", "php", "artisan", "db:seed", "--class=DemoArchiveSeeder", "--force"]);
  if (r.status === 0) ok("Demo archive data seeded — open /archive to see it.");
  else err(`Seeding failed (exit ${r.status}). Is the stack running? Try Server: start.`);
  return r.status ?? 1;
}
// ─── Backups (Phase 4) ─────────────────────────────────────────────────────────
function listBackupFiles() {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
}
function backupNow() {
  titleLine("Backup — pg_dump of the running database");
  const env = readEnv();
  const user = env.POSTGRES_USER || "archive";
  const db = env.POSTGRES_DB || "archive";
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = join(BACKUP_DIR, `archive-${stamp}.sql`);
  log(`Dumping "${db}" as "${user}" -> ${outFile}`);
  const r = compose(["exec", "-T", "postgres", "pg_dump", "-U", user, db], { inherit: false });
  if (r.status === 0 && r.stdout) {
    try { writeFileSync(outFile, r.stdout); ok(`Backup written: ${outFile}`); }
    catch (e) { err(`Dump ran but could not write file: ${e.message}`); }
  } else err("Backup failed — start the stack first (the 'postgres' service must be running).");
}
function listBackups() {
  titleLine("Backups");
  const files = listBackupFiles();
  if (!files.length) return log("No backups yet.");
  files.forEach((f, i) => log(`${C.b}${String(i + 1).padStart(2)}${C.x}) ${f}`));
}
async function restoreBackup() {
  titleLine("Restore a backup");
  const files = listBackupFiles();
  if (!files.length) return warn("No backups to restore.");
  files.forEach((f, i) => log(`${C.b}${String(i + 1).padStart(2)}${C.x}) ${f}`));
  const pick = files[Number(await ask("Restore which backup number")) - 1];
  if (!pick) return log("Cancelled.");
  warn(`This OVERWRITES the current database with ${pick}. This cannot be undone.`);
  if (!(await confirm("Type y to proceed with the destructive restore"))) return log("Cancelled.");
  const env = readEnv();
  const user = env.POSTGRES_USER || "archive";
  const db = env.POSTGRES_DB || "archive";
  const sql = readFileSync(join(BACKUP_DIR, pick), "utf8");
  const r = compose(["exec", "-T", "postgres", "psql", "-U", user, db], { inherit: false, input: sql });
  if (r.status === 0) ok("Restore complete."); else err(`Restore failed (exit ${r.status}). ${(r.stderr || "").slice(0, 200)}`);
}

// ─── Maintenance (Phase 5) ─────────────────────────────────────────────────────
function runDiagnostics() {
  titleLine("Diagnostics — canonical verify gate (pnpm verify)");
  const r = runPnpm(["run", "verify"]);
  (r.status === 0 ? ok : err)(`verify ${r.status === 0 ? "passed" : `exit ${r.status}`}`);
  return r.status ?? 1;
}
async function updateAndRebuild() {
  titleLine("Update & rebuild");
  warn("Runs: git pull → pnpm install --frozen-lockfile → pnpm build → docker compose up -d --build.");
  log(`${C.d}(Migrations run automatically inside the laravel container on start.)${C.x}`);
  if (!(await confirm("Proceed?"))) return log("Cancelled.");
  const steps = [
    ["git pull", () => spawnSync("git", ["pull", "--ff-only"], { cwd: ROOT, stdio: "inherit" })],
    ["pnpm install --frozen-lockfile", () => runPnpm(["install", "--frozen-lockfile"])],
    ["build", () => runPnpm(["run", "build"])],
    ["rebuild containers", () => compose(["up", "-d", "--build"])],
  ];
  for (const [name, fn] of steps) {
    log(`\n${C.b}-> ${name}${C.x}`);
    const r = fn();
    if (r.status !== 0) return err(`Step "${name}" failed (exit ${r.status}). Stopping.`);
  }
  ok("Update complete.");
}

// Values shipped in .env.example that must be replaced before a real deploy.
const PLACEHOLDER_VALUES = new Set(["archive-collab", "archive-collab-key", "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="]);
const isPlaceholder = (v) => !v || v.includes("CHANGE_ME") || PLACEHOLDER_VALUES.has(v);

function deployCanonical() {
  titleLine("Deploy — canonical Laravel + Next.js stack");
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
  if (generatedAdminPassword) {
    log("");
    ok(`Login email: ${e.ADMIN_EMAIL || "admin@example.com"} / ${C.b}${generatedAdminPassword}${C.x}  ${C.d}(store it now — shown once)${C.x}`);
    if (e.ADMIN_USERNAME) log(`  Legacy username:    ${e.ADMIN_USERNAME}`);
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

  log("");
  log(`${C.b}Summary${C.x}`);
  log(`  Admin email:  ${email}`);
  log(`  Password:     ${generatedPassword ? `${C.d}(generated — shown after deploy)${C.x}` : "(as typed)"}`);
  log(`  App port:     ${port}`);
  log(`  Public URL:   ${publicUrl || `${C.d}http://localhost:${port} (local)${C.x}`}`);
  if (!(await confirm("Apply this configuration and deploy?", "y"))) return log("Cancelled — nothing was changed.");

  // Step 3 — provision .env with the answers; deploy fills remaining secrets
  log(`\n${C.b}Step 3/5 — Provision configuration${C.x}`);
  if (!existsSync(ENV_PATH)) {
    if (!existsSync(ENV_EXAMPLE)) { err(`Neither ${ENV_PATH} nor ${ENV_EXAMPLE} exists.`); return 1; }
    copyFileSync(ENV_EXAMPLE, ENV_PATH);
    ok(`Created ${ENV_PATH} from .env.example`);
  }
  const updates = { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, NEXT_PUBLIC_PORT: port };
  if (publicUrl) {
    updates.APP_BASE_URL = publicUrl;
    const host = publicUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (host) { updates.PUBLIC_DOMAIN = host; updates.DOMAIN = host; }
  }
  if (!writeEnv(updates)) return 1;

  // Step 4 — deploy (generates remaining secrets, builds, starts)
  log(`\n${C.b}Step 4/5 — Build & start the stack${C.x}`);
  const deployStatus = deployCanonical();
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
  const deployStatus = deployCanonical();
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
  ["5", "Deploy / Re-provision", deployCanonical],
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
  ["25", "Update & rebuild", updateAndRebuild],
  ["sec", ""],
  ["0", "Exit", null],
  ["q", "Exit", null],
];

function printBanner() {
  const width = 48;
  const edge = (l, r) => `  ${C.c}${l}${"─".repeat(width)}${r}${C.x}`;
  const row = (text, style) => {
    const pad = Math.max(0, width - 1 - text.length);
    return `  ${C.c}│${C.x} ${style}${text}${C.x}${" ".repeat(pad)}${C.c}│${C.x}`;
  };
  console.log("");
  console.log(edge("╭", "╮"));
  console.log(row("Masar — Control Center", C.b));
  console.log(row("Install · Operate · Configure · Maintain", C.d));
  console.log(row("Laravel API + Next.js", C.d));
  console.log(edge("╰", "╯"));
  console.log("");
}
function printMenu() {
  for (const row of MENU) {
    if (row[0] === "sec") {
      if (row[1]) console.log(`\n  ${C.b}${C.c}${row[1]}${C.x}`);
      continue;
    }
    log(`${C.c}${C.b}${row[0].padStart(2)}${C.x}) ${row[1]}`);
  }
  console.log("");
  hr();
}

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
    printMenu();
    const choice = await ask("Choose an option");
    const item = MENU.find((m) => m[0] === choice && m[0] !== "sec");
    if (!item) { warn("Unknown option."); continue; }
    if (item[0] === "0" || item[0] === "q") break;
    try { await item[2](); } catch (e) { err(e.message); }
    log("");
  }
  if (_rl) _rl.close();
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
  config: showConfig, "set-url": setPublicUrl,
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
  diagnostics: runDiagnostics, observability: localObservabilityCheck, "support-bundle": supportBundle, update: updateAndRebuild, deploy: deployCanonical,
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
    printMenu();
    console.log(`  ${C.d}Usage: node scripts/control-center.mjs <command>${C.x}\n`);
  },
};

COMMANDS["0"] = () => 0;
COMMANDS.q = () => 0;

const cmd = ARGS.find((a) => !a.startsWith("-"));
if (cmd) {
  const fn = COMMANDS[cmd];
  if (!fn) { err(`Unknown command "${cmd}". Try: ${Object.keys(COMMANDS).join(", ")}`); process.exit(1); }
  const status = await fn();
  if (_rl) _rl.close();
  if (typeof status === "number" && status !== 0) process.exit(status);
} else {
  await interactive();
}
