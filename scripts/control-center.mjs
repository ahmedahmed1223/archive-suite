#!/usr/bin/env node
/**
 * Archive Suite — Control Center
 *
 * One English-first console to install, operate, configure, and maintain the
 * whole stack on Windows (Setup-Archive.bat) and Linux/macOS (setup.sh). The
 * one-shot deployment wizard (scripts/deploy-wizard.mjs) is the "Deploy" action.
 *
 * Interactive:     node scripts/control-center.mjs        (or: pnpm control)
 * Non-interactive: node scripts/control-center.mjs <command>
 *   server:   status | start | stop | restart | logs | health
 *   maintain: diagnostics | update
 *   config:   config | set-url
 *   security: rotate-secrets | set-admin
 *   database: migrate-status | migrate | db-provider
 *   backups:  backup | backups | restore
 *   deploy:   deploy   ·   help
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
const COMPOSE_FILE = join(SERVER_DIR, "docker-compose.postgres.yml");
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
    if (m) out[m[1]] = m[2];
  }
  return out;
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
const runPnpm = (args, cwd = ROOT) => spawnSync(PNPM, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
const runNode = (file, args = [], cwd = ROOT) => spawnSync(process.execPath, [file, ...args], { cwd, stdio: "inherit" });

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

// ─── Server control ───────────────────────────────────────────────────────────
function serverStatus() {
  titleLine("Server status");
  if (!existsSync(COMPOSE_FILE)) return warn("No compose file yet — run Deploy first.");
  compose(["ps"]);
}
function serverStart() { titleLine("Starting (docker compose up -d)"); if (compose(["up", "-d"]).status === 0) ok("Stack started."); }
function serverStop() { titleLine("Stopping (docker compose down)"); if (compose(["down"]).status === 0) ok("Stack stopped."); }
function serverRestart() { titleLine("Restarting (docker compose restart)"); if (compose(["restart"]).status === 0) ok("Stack restarted."); }
function serverLogs({ follow = false } = {}) {
  titleLine("Service logs (last 200 lines)" + (follow ? " — following, Ctrl+C to stop" : ""));
  compose(["logs", "--tail=200", ...(follow ? ["-f"] : [])]);
}
async function healthCheck() {
  titleLine("Health check");
  const env = readEnv();
  const port = env.PORT || env.SERVER_PORT || "8787";
  const url = `http://127.0.0.1:${port}/api/health`;
  log(`GET ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    (res.ok ? ok : warn)(`HTTP ${res.status}. ${body.slice(0, 200)}`);
  } catch (e) { err(`No response on port ${port} — is the server running? (${e.name})`); }
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
  if (host) updates.PUBLIC_DOMAIN = host;
  writeEnv(updates);
}

// ─── Security (Phase 3) ────────────────────────────────────────────────────────
async function rotateSecrets() {
  titleLine("Rotate security secrets");
  warn("This invalidates existing sessions/share links/OAuth state. Users must sign in again.");
  if (!(await confirm("Rotate JWT_AUTH_SECRET, JWT_SHARE_SECRET, OAUTH_STATE_SECRET?"))) return log("Cancelled.");
  writeEnv({ JWT_AUTH_SECRET: genSecret(), JWT_SHARE_SECRET: genSecret(), OAUTH_STATE_SECRET: genSecret() });
}
async function setAdmin() {
  titleLine("Set admin credentials");
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
  titleLine("Database migration status (prisma migrate status)");
  runPnpm(["--filter", "archive-server", "exec", "prisma", "migrate", "status"]);
}
async function migrateDeploy() {
  titleLine("Apply pending migrations (prisma migrate deploy)");
  if (!(await confirm("Apply all pending migrations to the configured database?"))) return log("Cancelled.");
  const r = runPnpm(["--filter", "archive-server", "exec", "prisma", "migrate", "deploy"]);
  if (r.status === 0) ok("Migrations applied.");
}
async function dbProvider() {
  titleLine("Switch database provider");
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
  titleLine("Diagnostics — server + app verification");
  for (const target of ["verify:server", "verify:app"]) {
    log(`\n${C.b}pnpm ${target}${C.x}`);
    const r = runPnpm(["run", target]);
    (r.status === 0 ? ok : err)(`${target} ${r.status === 0 ? "passed" : `exit ${r.status}`}`);
  }
}
async function updateAndRebuild() {
  titleLine("Update & rebuild");
  warn("Runs: git pull → pnpm install → build:cloud → migrate deploy → restart.");
  if (!(await confirm("Proceed?"))) return log("Cancelled.");
  const steps = [
    ["git pull", () => spawnSync("git", ["pull", "--ff-only"], { cwd: ROOT, stdio: "inherit" })],
    ["pnpm install", () => runPnpm(["install"])],
    ["build:cloud", () => runPnpm(["run", "build:cloud"])],
    ["migrate deploy", () => runPnpm(["--filter", "archive-server", "exec", "prisma", "migrate", "deploy"])],
    ["restart", () => compose(["up", "-d", "--build"])],
  ];
  for (const [name, fn] of steps) {
    log(`\n${C.b}-> ${name}${C.x}`);
    const r = fn();
    if (r.status !== 0) return err(`Step "${name}" failed (exit ${r.status}). Stopping.`);
  }
  ok("Update complete.");
}

function runDeploy() {
  titleLine("Deploy / Re-provision — launching the deployment wizard");
  return runNode(join(__dirname, "deploy-wizard.mjs")).status;
}

// ─── Menu ───────────────────────────────────────────────────────────────────
const MENU = [
  ["sec", "— Deploy —"],
  ["1", "Deploy / Re-provision", runDeploy],
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
  ["11", "Set admin credentials", setAdmin],
  ["12", "Rotate secrets", rotateSecrets],
  ["sec", "— Database —"],
  ["13", "Migration status", migrateStatus],
  ["14", "Apply migrations", migrateDeploy],
  ["15", "Switch DB provider", dbProvider],
  ["sec", "— Backups —"],
  ["16", "Backup now", backupNow],
  ["17", "List backups", listBackups],
  ["18", "Restore backup", restoreBackup],
  ["sec", "— Maintain —"],
  ["19", "Diagnostics (verify)", runDiagnostics],
  ["20", "Update & rebuild", updateAndRebuild],
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

async function interactive() {
  printBanner();
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
  status: serverStatus, start: serverStart, stop: serverStop, restart: serverRestart,
  logs: () => serverLogs({ follow: false }), health: healthCheck,
  config: showConfig, "set-url": setPublicUrl,
  "rotate-secrets": rotateSecrets, "set-admin": setAdmin,
  "migrate-status": migrateStatus, migrate: migrateDeploy, "db-provider": dbProvider,
  backup: backupNow, backups: listBackups, restore: restoreBackup,
  diagnostics: runDiagnostics, update: updateAndRebuild, deploy: runDeploy,
  help: () => { printBanner(); printMenu(); },
};

const cmd = process.argv.slice(2).find((a) => !a.startsWith("-"));
if (cmd) {
  const fn = COMMANDS[cmd];
  if (!fn) { err(`Unknown command "${cmd}". Try: ${Object.keys(COMMANDS).join(", ")}`); process.exit(1); }
  await fn();
  if (_rl) _rl.close();
} else {
  await interactive();
}
