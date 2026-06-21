#!/usr/bin/env node
/**
 * Archive Suite — Control Center
 *
 * One English-first console to install, operate, configure, and maintain the
 * whole stack on Windows (Setup-Archive.bat) and Linux (setup.sh). The one-shot
 * deployment wizard (scripts/deploy-wizard.mjs) is now the "Deploy" action here.
 *
 * Interactive:        node scripts/control-center.mjs
 * Non-interactive:    node scripts/control-center.mjs <command>
 *   commands: status | start | stop | restart | logs | health | deploy
 *             diagnostics | config | backup | help
 *
 * Cross-platform Node core — the .bat / .sh are thin launchers. English by
 * default; Arabic labels can be added later (terminals render English most reliably).
 *
 * Phase 1 (this file): shell + Server Control + Health + Diagnostics + Config
 * view + Deploy launcher + Backup. Phases 2-5 (config editor, accounts/security,
 * DB/backups scheduling, updates) extend the same menu — see the development plan.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, join } from "node:path";

// ─── Paths ──────────────────────────────────────────────────────────────────
const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const ROOT = resolve(__dirname, "..");
const SERVER_DIR = join(ROOT, "archive-server");
const ENV_PATH = process.env.ARCHIVE_ENV_PATH || join(SERVER_DIR, ".env");
const COMPOSE_FILE = join(SERVER_DIR, "docker-compose.postgres.yml");
const BACKUP_DIR = join(SERVER_DIR, "backups");

// ─── Colours / logging ──────────────────────────────────────────────────────
const C = { g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };
const log = (m = "") => console.log(`  ${m}`);
const ok = (m) => console.log(`  ${C.g}OK${C.x}  ${m}`);
const warn = (m) => console.log(`  ${C.y}!!${C.x}  ${m}`);
const err = (m) => console.error(`  ${C.r}xx${C.x}  ${m}`);
const titleLine = (m) => console.log(`\n${C.b}${C.c}${m}${C.x}\n`);
const hr = () => console.log(`${C.d}${"-".repeat(60)}${C.x}`);

// ─── .env helpers ───────────────────────────────────────────────────────────
function readEnv() {
  if (!existsSync(ENV_PATH)) return {};
  const out = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const SECRET_KEYS = /(SECRET|PASSWORD|TOKEN|KEY|DSN|URL)$/;
const maskValue = (k, v) => (SECRET_KEYS.test(k) && v ? v.slice(0, 3) + "...(hidden)" : v);

// ─── Docker compose ─────────────────────────────────────────────────────────
function dockerComposeCmd() {
  // Prefer `docker compose` (v2); fall back to `docker-compose` (v1).
  const v2 = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
  if (v2.status === 0) return { bin: "docker", pre: ["compose"] };
  const v1 = spawnSync("docker-compose", ["version"], { stdio: "ignore" });
  if (v1.status === 0) return { bin: "docker-compose", pre: [] };
  return null;
}

function compose(actionArgs, { inherit = true } = {}) {
  const dc = dockerComposeCmd();
  if (!dc) {
    err("Docker (with Compose) was not found. Install Docker Desktop / Docker Engine first.");
    return { status: 127 };
  }
  const args = [...dc.pre, "-f", COMPOSE_FILE, ...(existsSync(ENV_PATH) ? ["--env-file", ENV_PATH] : []), ...actionArgs];
  return spawnSync(dc.bin, args, { cwd: SERVER_DIR, stdio: inherit ? "inherit" : "pipe", encoding: "utf8" });
}

// ─── Actions ────────────────────────────────────────────────────────────────
function serverStatus() {
  titleLine("Server status");
  if (!existsSync(COMPOSE_FILE)) return warn("No compose file yet — run Deploy first.");
  compose(["ps"]);
}
function serverStart() {
  titleLine("Starting the stack (docker compose up -d)");
  const r = compose(["up", "-d"]);
  if (r.status === 0) ok("Stack started. Use 'Health check' to confirm it is serving.");
}
function serverStop() {
  titleLine("Stopping the stack (docker compose down)");
  const r = compose(["down"]);
  if (r.status === 0) ok("Stack stopped.");
}
function serverRestart() {
  titleLine("Restarting the stack (docker compose restart)");
  const r = compose(["restart"]);
  if (r.status === 0) ok("Stack restarted.");
}
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
    if (res.ok) ok(`Healthy (HTTP ${res.status}). ${body.slice(0, 200)}`);
    else warn(`Reachable but not healthy (HTTP ${res.status}). ${body.slice(0, 200)}`);
  } catch (e) {
    err(`No response on port ${port} — is the server running? (${e.name})`);
  }
}

function showConfig() {
  titleLine("Configuration (.env, secrets masked)");
  if (!existsSync(ENV_PATH)) return warn(`No .env yet at ${ENV_PATH} — run Deploy first.`);
  const env = readEnv();
  const order = ["ACCESS_MODE", "PUBLIC_DOMAIN", "PORT", "DATABASE_PROVIDER", "DATABASE_URL", "ADMIN_USERNAME", "APP_BASE_URL", "SMTP_HOST", "AI_PROVIDER", "FILE_STORE"];
  for (const k of order) if (k in env) log(`${C.c}${k.padEnd(18)}${C.x} ${maskValue(k, env[k])}`);
  log(`${C.d}(${Object.keys(env).length} keys total. Phase 2 adds a guided editor; edit ${ENV_PATH} directly for now.)${C.x}`);
}

function runDiagnostics() {
  titleLine("Diagnostics — running server + app verification");
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  for (const target of ["verify:server", "verify:app"]) {
    log(`\n${C.b}pnpm ${target}${C.x}`);
    const r = spawnSync(pnpm, ["run", target], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
    if (r.status === 0) ok(`${target} passed`);
    else err(`${target} reported issues (exit ${r.status})`);
  }
}

function runDeploy() {
  titleLine("Deploy / Re-provision — launching the deployment wizard");
  const r = spawnSync(process.execPath, [join(__dirname, "deploy-wizard.mjs")], { cwd: ROOT, stdio: "inherit" });
  return r.status;
}

function backupNow() {
  titleLine("Backup — pg_dump of the running database");
  const env = readEnv();
  const user = env.POSTGRES_USER || "archive";
  const db = env.POSTGRES_DB || "archive";
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = join(BACKUP_DIR, `archive-${stamp}.sql`);
  log(`Dumping database "${db}" as "${user}" -> ${outFile}`);
  const r = compose(["exec", "-T", "postgres", "pg_dump", "-U", user, db], { inherit: false });
  if (r.status === 0 && r.stdout) {
    try {
      writeFileSync(outFile, r.stdout);
      ok(`Backup written: ${outFile}`);
    } catch (e) { err(`Dump ran but could not write file: ${e.message}`); }
  } else {
    err("Backup failed — is the 'postgres' service running? Start the stack first.");
  }
}

// ─── Menu ───────────────────────────────────────────────────────────────────
const MENU = [
  ["1", "Deploy / Re-provision", runDeploy],
  ["2", "Server: status", serverStatus],
  ["3", "Server: start", serverStart],
  ["4", "Server: stop", serverStop],
  ["5", "Server: restart", serverRestart],
  ["6", "Server: logs", () => serverLogs({ follow: true })],
  ["7", "Health check", healthCheck],
  ["8", "Diagnostics (verify)", runDiagnostics],
  ["9", "View configuration", showConfig],
  ["10", "Backup database now", backupNow],
  ["0", "Exit", null],
];

function printBanner() {
  console.log(`\n${C.b}${C.c}  Archive Suite — Control Center${C.x}`);
  console.log(`${C.d}  Install · Operate · Configure · Maintain${C.x}`);
  hr();
}

function printMenu() {
  for (const [key, label] of MENU) {
    if (key === "0") log("");
    log(`${C.b}${key.padStart(2)}${C.x}) ${label}`);
  }
  hr();
}

async function interactive() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, (a) => r(a.trim())));
  printBanner();
  for (;;) {
    printMenu();
    const choice = await ask(`  ${C.c}?${C.x} Choose an option: `);
    const item = MENU.find((m) => m[0] === choice);
    if (!item) { warn("Unknown option."); continue; }
    if (item[0] === "0") break;
    try { await item[2](); } catch (e) { err(e.message); }
    log("");
  }
  rl.close();
  log("Goodbye.");
}

// ─── Non-interactive subcommands ──────────────────────────────────────────────
const COMMANDS = {
  status: serverStatus,
  start: serverStart,
  stop: serverStop,
  restart: serverRestart,
  logs: () => serverLogs({ follow: false }),
  health: healthCheck,
  deploy: runDeploy,
  diagnostics: runDiagnostics,
  config: showConfig,
  backup: backupNow,
  help: () => { printBanner(); printMenu(); },
};

const cmd = process.argv.slice(2).find((a) => !a.startsWith("-"));
if (cmd) {
  const fn = COMMANDS[cmd];
  if (!fn) { err(`Unknown command "${cmd}". Try: ${Object.keys(COMMANDS).join(", ")}`); process.exit(1); }
  await fn();
} else {
  await interactive();
}
