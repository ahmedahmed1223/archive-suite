#!/usr/bin/env node
/**
 * Archive Suite — Control Center
 *
 * One English-first console to install, operate, configure, and maintain the
 * CANONICAL stack (Laravel API + Next.js, archive-server/docker-compose.yml)
 * on Windows (Setup-Archive.bat) and Linux/macOS (setup.sh). The old Node/Vite
 * deployment wizard stays reachable as the explicit "deploy-legacy" command.
 *
 * Interactive:     node scripts/control-center.mjs        (or: pnpm control)
 * Non-interactive: node scripts/control-center.mjs <command>
 *   server:   status | start | stop | restart | logs | health
 *   maintain: diagnostics | update
 *   config:   config | set-url
 *   security: rotate-secrets
 *   database: migrate-status | migrate
 *   backups:  backup | backups | restore
 *   deploy:   deploy   ·   help
 *   legacy:   deploy-legacy | legacy:set-admin | legacy:migrate-status |
 *             legacy:migrate | legacy:db-provider
 *
 * Cross-platform Node core; the .bat / .sh are thin launchers. English-first.
 * Any write to .env first backs it up to .env.bak-<timestamp>.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";

// ─── Paths ──────────────────────────────────────────────────────────────────
const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const ROOT = resolve(__dirname, "..");
const SERVER_DIR = join(ROOT, "archive-server");
const ENV_PATH = process.env.ARCHIVE_ENV_PATH || join(SERVER_DIR, ".env");
const ENV_EXAMPLE = join(SERVER_DIR, ".env.example");
// Canonical stack: Laravel API + Next.js (postgres/redis/laravel/worker/reverb/next/caddy).
// ponytail: no automatic override layering — for the HTTP-only dev variant run
// `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` by hand.
const COMPOSE_FILE = join(SERVER_DIR, "docker-compose.yml");
const BACKUP_DIR = join(SERVER_DIR, "backups");
const SET_DB_PROVIDER = join(SERVER_DIR, "scripts", "set-db-provider.mjs");

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
function setVar(content, key, value) {
  const re = new RegExp(`^(${key}=).*`, "m");
  return re.test(content) ? content.replace(re, `$1${value}`) : `${content.replace(/\n?$/, "\n")}${key}=${value}`;
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
const genPassword = () => randomBytes(18).toString("base64").replace(/[+/=]/g, "").slice(0, 20);

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
function compose(actionArgs, { inherit = true, input } = {}) {
  const dc = dockerComposeCmd();
  if (!dc) { err("Docker (with Compose) was not found. Install Docker first."); return { status: 127 }; }
  const args = [...dc.pre, "-f", COMPOSE_FILE, ...(existsSync(ENV_PATH) ? ["--env-file", ENV_PATH] : []), ...actionArgs];
  return spawnSync(dc.bin, args, { cwd: SERVER_DIR, stdio: inherit ? "inherit" : "pipe", encoding: "utf8", input });
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
async function setAdmin() {
  titleLine("Set admin credentials (legacy Node stack)");
  warn("Seeds ADMIN_USERNAME/ADMIN_PASSWORD for the legacy Node server only; the Laravel stack manages users in-app.");
  const env = readEnv();
  const username = await ask("Admin username", env.ADMIN_USERNAME || "admin");
  const choice = await ask("Password — type one, or blank to auto-generate", "");
  const password = choice || genPassword();
  writeEnv({ ADMIN_USERNAME: username, ADMIN_PASSWORD: password });
  if (!choice) log(`${C.b}Generated password:${C.x} ${password}  ${C.d}(store it now — shown once)${C.x}`);
  warn("Applied on the next stack start/seed. For an already-seeded admin, restart the stack.");
}

// ─── Database (Phase 4) ────────────────────────────────────────────────────────
function migrateStatus() {
  titleLine("Database migration status (php artisan migrate:status)");
  return compose(["exec", "-T", "laravel", "php", "artisan", "migrate:status"]).status ?? 1;
}
async function migrateDeploy() {
  titleLine("Apply pending migrations (php artisan migrate --force)");
  if (!(await confirm("Apply all pending migrations to the configured database?"))) { log("Cancelled."); return 0; }
  const r = compose(["exec", "-T", "laravel", "php", "artisan", "migrate", "--force"]);
  if (r.status === 0) ok("Migrations applied.");
  return r.status ?? 1;
}
// Legacy Prisma actions — operate on the retired Node stack's schema/database.
function legacyMigrateStatus() {
  titleLine("Legacy: Prisma migration status");
  return runPnpm(["--filter", "archive-server", "exec", "prisma", "migrate", "status"], ROOT, { env: readEnv() }).status ?? 1;
}
async function legacyMigrateDeploy() {
  titleLine("Legacy: apply Prisma migrations (prisma migrate deploy)");
  if (!(await confirm("Apply all pending Prisma migrations to the configured database?"))) { log("Cancelled."); return 0; }
  const r = runPnpm(["--filter", "archive-server", "exec", "prisma", "migrate", "deploy"], ROOT, { env: readEnv() });
  if (r.status === 0) ok("Migrations applied.");
  return r.status ?? 1;
}
async function dbProvider() {
  titleLine("Legacy: switch database provider");
  if (!existsSync(SET_DB_PROVIDER)) return err("set-db-provider.mjs not found.");
  const p = await ask("Provider: postgres or pocketbase", "postgres");
  if (!["postgres", "pocketbase"].includes(p)) return err("Unknown provider.");
  runNode(SET_DB_PROVIDER, [p], SERVER_DIR);
  warn("Restart the stack to use the new provider.");
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
  warn("Runs: git pull → pnpm install → pnpm build → docker compose up -d --build.");
  log(`${C.d}(Migrations run automatically inside the laravel container on start.)${C.x}`);
  if (!(await confirm("Proceed?"))) return log("Cancelled.");
  const steps = [
    ["git pull", () => spawnSync("git", ["pull", "--ff-only"], { cwd: ROOT, stdio: "inherit" })],
    ["pnpm install", () => runPnpm(["install"])],
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
  log("Building and starting the stack (docker compose up -d --build) — the first run takes a while...");
  const status = compose(["up", "-d", "--build"]).status ?? 1;
  if (status !== 0) { err(`docker compose up failed (exit ${status}).`); return status; }
  const e = readEnv();
  ok("Stack is up. URLs:");
  log(`  App (Next.js):      http://localhost:${e.NEXT_PUBLIC_PORT || "3000"}`);
  log(`  API health:         http://localhost:${e.NEXT_PUBLIC_PORT || "3000"}/api/v1/health (proxied to Laravel)`);
  log(`  Realtime (Reverb):  ws://localhost:${e.REVERB_SERVER_PUBLISHED_PORT || "8080"}`);
  log(`  Caddy (80/443):     http://${e.DOMAIN || "localhost"}`);
  if (generatedAdminPassword) {
    log("");
    ok(`Login: ${e.ADMIN_EMAIL || "admin@example.com"} / ${C.b}${generatedAdminPassword}${C.x}  ${C.d}(store it now — shown once)${C.x}`);
  } else {
    log(`  Login:              ${e.ADMIN_EMAIL || "admin@example.com"} (existing password unchanged)`);
  }
  return 0;
}

function runLegacyDeploy() {
  titleLine("Legacy deploy — launching the old Node/Vite deployment wizard");
  return runNode(join(__dirname, "deploy-wizard.mjs")).status;
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

// ─── Doctor — environment pre-flight check ───────────────────────────────────
async function runDoctor() {
  titleLine("Doctor — environment pre-flight check");
  let issues = 0;

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

  // Docker
  const dockerCheck = spawnSync("docker", ["--version"], { stdio: "pipe", encoding: "utf8" });
  if (dockerCheck.status === 0) {
    ok(`Docker — ${(dockerCheck.stdout || "").trim()}`);
  } else {
    warn("Docker not found — required for the canonical Laravel + Next stack");
  }

  // Docker Compose
  const dc = dockerComposeCmd();
  if (dc) {
    ok("Docker Compose — available");
  } else {
    warn("Docker Compose not found — install Docker Desktop or docker-compose v2");
  }

  // .env file
  if (existsSync(ENV_PATH)) {
    ok(`.env found at ${ENV_PATH}`);
  } else {
    warn(`.env not found at ${ENV_PATH} — run Deploy first`);
  }

  // Server health (non-fatal if not running)
  const env = readEnv();
  const url = defaultHealthUrl(env);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    ok(`${url} — server responding (HTTP ${res.status})`);
  } catch {
    log(`  ${C.d}${url} — not responding (server may not be started yet — run 'start')${C.x}`);
  }

  // Summary
  hr();
  if (issues === 0) {
    ok("All checks passed. Run 'setup quick' to deploy and start, or 'node scripts/control-center.mjs start'.");
  } else {
    err(`${issues} critical issue(s) found — resolve them before deploying.`);
  }
  return issues === 0 ? 0 : 1;
}

// ─── Menu ───────────────────────────────────────────────────────────────────
const MENU = [
  ["sec", "— Quick Actions —"],
  ["q", "Quick start (deploy+health)", quickStart],
  ["d", "Doctor (pre-flight check)", runDoctor],
  ["sec", "— Deploy (Laravel + Next.js) —"],
  ["1", "Deploy / Re-provision", deployCanonical],
  ["sec", "— Server —"],
  ["2", "Status", serverStatus],
  ["3", "Start", serverStart],
  ["4", "Stop", serverStop],
  ["5", "Restart", serverRestart],
  ["6", "Logs", () => serverLogs({ follow: true })],
  ["7", "Health check", healthCheck],
  ["sec", "— Configure —"],
  ["8", "View configuration", showConfig],
  ["9", "Edit a setting", editSetting],
  ["10", "Set public URL", setPublicUrl],
  ["sec", "— Security —"],
  ["11", "Rotate Reverb secrets", rotateSecrets],
  ["sec", "— Database —"],
  ["12", "Migration status (artisan)", migrateStatus],
  ["13", "Apply migrations (artisan)", migrateDeploy],
  ["sec", "— Backups —"],
  ["14", "Backup now", backupNow],
  ["15", "List backups", listBackups],
  ["16", "Restore backup", restoreBackup],
  ["sec", "— Maintain —"],
  ["17", "Diagnostics (pnpm verify)", runDiagnostics],
  ["18", "Update & rebuild", updateAndRebuild],
  ["sec", "— Legacy (Node/Vite stack) —"],
  ["19", "Legacy deploy wizard", runLegacyDeploy],
  ["20", "Legacy: set admin credentials", setAdmin],
  ["21", "Legacy: Prisma migration status", legacyMigrateStatus],
  ["22", "Legacy: apply Prisma migrations", legacyMigrateDeploy],
  ["23", "Legacy: switch DB provider", dbProvider],
  ["sec", ""],
  ["0", "Exit", null],
];

function printBanner() {
  console.log(`\n${C.b}${C.c}  Archive Suite — Control Center${C.x}`);
  console.log(`${C.d}  Install · Operate · Configure · Maintain${C.x}`);
  hr();
}
function printMenu() {
  for (const row of MENU) {
    if (row[0] === "sec") { console.log(`  ${C.d}${row[1]}${C.x}`); continue; }
    log(`${C.b}${row[0].padStart(2)}${C.x}) ${row[1]}`);
  }
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
  if (!envOk) issues.push(`.env not found — run option 1 (Deploy) first`);
  if (issues.length === 0) {
    ok(`Preflight: Node ${process.version} · pnpm OK · Docker OK · .env present`);
  } else {
    warn("Preflight found issues:");
    for (const issue of issues) log(`   ${C.y}-${C.x} ${issue}`);
    log(`   ${C.d}Run option 'd' (Doctor) for the full report.${C.x}`);
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
    if (item[0] === "0") break;
    try { await item[2](); } catch (e) { err(e.message); }
    log("");
  }
  if (_rl) _rl.close();
  log("Goodbye.");
}

// ─── Non-interactive subcommands ──────────────────────────────────────────────
const COMMANDS = {
  // Quick entry points
  quick: quickStart, doctor: runDoctor,
  // Server
  status: serverStatus, start: serverStart, stop: serverStop, restart: serverRestart,
  logs: () => serverLogs({ follow: false }), health: healthCheck,
  // Config
  config: showConfig, "set-url": setPublicUrl,
  // Security
  "rotate-secrets": rotateSecrets,
  // Database
  "migrate-status": migrateStatus, migrate: migrateDeploy,
  // Backups
  backup: backupNow, backups: listBackups, restore: restoreBackup,
  // Maintenance
  diagnostics: runDiagnostics, update: updateAndRebuild, deploy: deployCanonical,
  // Legacy (Node/Vite stack)
  "deploy-legacy": runLegacyDeploy, "legacy:set-admin": setAdmin,
  "legacy:migrate-status": legacyMigrateStatus, "legacy:migrate": legacyMigrateDeploy,
  "legacy:db-provider": dbProvider,
  help: () => {
    printBanner();
    console.log(`${C.b}  Quick-start examples:${C.x}`);
    console.log(`  ${C.d}# First-time setup on this machine (deploy the Laravel+Next stack, then health):${C.x}`);
    console.log(`  ${C.c}setup quick${C.x}`);
    console.log(`  ${C.d}# Verify the environment before deploying (Node/pnpm/Docker/.env):${C.x}`);
    console.log(`  ${C.c}setup doctor${C.x}`);
    console.log(`  ${C.d}# Run the interactive menu (default when no command is given):${C.x}`);
    console.log(`  ${C.c}setup${C.x}`);
    console.log("");
    console.log(`${C.b}  Commands (canonical Laravel + Next.js stack):${C.x}`);
    console.log(`  ${C.c}quick${C.x}            Deploy + health check in one step`);
    console.log(`  ${C.c}doctor${C.x}           Check Node/pnpm/Docker/.env before deploying`);
    console.log(`  ${C.c}deploy${C.x}           Provision .env secrets + docker compose up -d --build`);
    console.log(`  ${C.c}start | stop | restart${C.x}  Manage the Docker stack (archive-server/docker-compose.yml)`);
    console.log(`  ${C.c}status | health | logs${C.x}  Monitor the running stack (health: /api/v1/health via Next)`);
    console.log(`  ${C.c}config${C.x}           View .env (secrets masked)`);
    console.log(`  ${C.c}set-url${C.x}          Set APP_BASE_URL + PUBLIC_DOMAIN + DOMAIN`);
    console.log(`  ${C.c}rotate-secrets${C.x}   Regenerate REVERB_APP_KEY/SECRET (then re-deploy)`);
    console.log(`  ${C.c}migrate-status${C.x}   php artisan migrate:status (in the laravel container)`);
    console.log(`  ${C.c}migrate${C.x}          php artisan migrate --force (in the laravel container)`);
    console.log(`  ${C.c}backup${C.x}           pg_dump the running database`);
    console.log(`  ${C.c}backups${C.x}          List available backups`);
    console.log(`  ${C.c}restore${C.x}          Restore a backup`);
    console.log(`  ${C.c}diagnostics${C.x}      Run the canonical gate: pnpm verify`);
    console.log(`  ${C.c}update${C.x}           git pull → install → build → docker compose up -d --build`);
    console.log(`\n${C.b}  Legacy (retired Node/Vite stack — reference only):${C.x}`);
    console.log(`  ${C.c}deploy-legacy${C.x}    Run the old Node/Vite deployment wizard`);
    console.log(`  ${C.c}legacy:set-admin | legacy:migrate-status | legacy:migrate | legacy:db-provider${C.x}`);
    console.log(`\n${C.b}  Tips:${C.x}`);
    console.log(`  ${C.d}- HTTP-only dev variant: docker compose -f docker-compose.yml -f docker-compose.dev.yml up (from archive-server/).${C.x}`);
    console.log(`  ${C.d}- "Stack not running" → run 'setup start' or 'setup doctor' to diagnose.${C.x}`);
    console.log(`  ${C.d}- "No .env found"     → run 'setup deploy' to provision a fresh configuration.${C.x}`);
    console.log(`\n${C.b}  Interactive menu (run 'setup' without arguments):${C.x}`);
    printMenu();
    console.log(`  ${C.d}Usage: node scripts/control-center.mjs <command>${C.x}\n`);
  },
};

const cmd = process.argv.slice(2).find((a) => !a.startsWith("-"));
if (cmd) {
  const fn = COMMANDS[cmd];
  if (!fn) { err(`Unknown command "${cmd}". Try: ${Object.keys(COMMANDS).join(", ")}`); process.exit(1); }
  const status = await fn();
  if (_rl) _rl.close();
  if (typeof status === "number" && status !== 0) process.exit(status);
} else {
  await interactive();
}
