#!/usr/bin/env node
/**
 * Archive Suite — Interactive Setup Wizard
 * Run: node scripts/setup.mjs
 *
 * Language (§19.6): English by default (terminals render Arabic unreliably).
 * Switch to Arabic with --lang=ar, ARCHIVE_WIZARD_LANG=ar, or the first prompt.
 *
 * Steps:
 *  1. Check Node.js version
 *  2. Check Docker + Docker Compose
 *  3. Choose deployment mode (dev/production)
 *  4. Configure .env (admin credentials, JWT secrets, SMTP)
 *  5. Start Docker containers
 *  6. Wait for health check
 *  7. Open browser
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";
import { platform } from "node:os";
import { resolveWizardLang, hasExplicitLang, createTranslator } from "./wizard-i18n.mjs";
import { isSupportedNodeVersion } from "./node-version.mjs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const ROOT = resolve(__dirname, "..");
const INFRA_DIR = join(ROOT, "infra");

const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

function log(msg)    { console.log(`  ${msg}`); }
function ok(msg)     { console.log(`  ${GREEN}✓${RESET}  ${msg}`); }
function warn(msg)   { console.log(`  ${YELLOW}⚠${RESET}  ${msg}`); }
function err(msg)    { console.error(`  ${RED}✗${RESET}  ${msg}`); }
function step(n, msg){ console.log(`\n${BOLD}${CYAN}[${n}]${RESET}${BOLD} ${msg}${RESET}\n`); }
function hr()        { console.log(`\n${"─".repeat(60)}\n`); }

// ─── Language (§19.6) — English default; Arabic via --lang=ar / env / prompt ──
const ARGV = process.argv.slice(2);
let LANG = resolveWizardLang(ARGV, process.env);
let t = createTranslator(LANG);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def = "") => new Promise(res =>
  rl.question(`  ${CYAN}?${RESET} ${q}${def ? ` ${YELLOW}(${def})${RESET}` : ""}: `, a => res(a.trim() || def))
);
const askSecret = (q) => new Promise(res =>
  rl.question(`  ${CYAN}?${RESET} ${q} ${YELLOW}(${t("autoGenerateHint")})${RESET}: `, a => res(a.trim() || randomBytes(32).toString("hex"))
));
const confirm = async (q) => { const a = await ask(`${q} (y/n)`, "y"); return a.toLowerCase() === "y"; };

// First-prompt language picker (ASCII-safe), skipped when explicit lang given.
async function promptLanguage() {
  if (hasExplicitLang(ARGV, process.env)) return;
  const answer = await new Promise(res =>
    rl.question(`  ${CYAN}?${RESET} ${t("langPrompt")}: `, a => res(a.trim().toLowerCase()))
  );
  if (answer.startsWith("a") || answer === "2" || answer === "ع") {
    LANG = "ar";
    t = createTranslator(LANG);
  }
}

function genSecret() { return randomBytes(32).toString("hex"); }

// ─── Step 1: Node.js version ──────────────────────────────────────────────────
async function checkNode() {
  step(1, t("setupStep1"));
  const v = process.version;
  if (!isSupportedNodeVersion(v)) {
    err(t("nodeTooOld", { version: v }));
    process.exit(1);
  }
  ok(`Node.js ${v}`);
}

// ─── Step 2: Docker ───────────────────────────────────────────────────────────
async function checkDocker() {
  step(2, t("setupStep2"));

  let dockerOk = false;
  let composeOk = false;

  try { execSync("docker --version", { stdio: "pipe" }); dockerOk = true; ok(t("dockerInstalled")); }
  catch { warn(t("dockerNotInstalled")); }

  try { execSync("docker compose version", { stdio: "pipe" }); composeOk = true; ok(t("composeInstalled")); }
  catch {
    try { execSync("docker-compose --version", { stdio: "pipe" }); composeOk = true; ok(t("composeInstalled")); }
    catch { warn(t("composeNotInstalled")); }
  }

  if (!dockerOk || !composeOk) {
    const os = platform();
    log("");
    log(`${BOLD}${t("toInstallDocker")}${RESET}`);
    if (os === "win32")  log("  Windows: https://docs.docker.com/desktop/install/windows-install/");
    else if (os === "darwin") log("  macOS:   https://docs.docker.com/desktop/install/mac-install/");
    else                 log("  Linux:   https://docs.docker.com/engine/install/");
    log("");
    log(t("afterInstallRerun"));
    log("");
    const go = await confirm(t("dockerDoneContinue"));
    if (!go) { log(t("finished")); rl.close(); process.exit(0); }
    // Re-check
    try { execSync("docker --version", { stdio: "pipe" }); ok(t("dockerReady")); }
    catch { err(t("dockerNotDetected")); rl.close(); process.exit(1); }
  }
}

// ─── Step 3: Mode selection ───────────────────────────────────────────────────
async function chooseMode() {
  step(3, t("setupStep3"));
  log(`  ${CYAN}${t("modeDev")}${RESET}`);
  log(`  ${CYAN}${t("modeProd")}${RESET}`);
  log("");
  const choice = await ask(t("promptChoose"), "1");
  return choice === "2" ? "postgres" : "pocketbase";
}

// ─── Step 4: Configure .env ───────────────────────────────────────────────────
async function configureEnv(mode) {
  step(4, t("setupStep4"));

  const envPath = join(INFRA_DIR, ".env");
  const examplePath = join(INFRA_DIR, ".env.example");

  // Read example as base
  let envContent = existsSync(examplePath) ? readFileSync(examplePath, "utf-8") : "";

  function setVar(content, key, value) {
    const re = new RegExp(`^(${key}=).*`, "m");
    return re.test(content)
      ? content.replace(re, `$1${value}`)
      : content + `\n${key}=${value}`;
  }

  log(t("enterSettings"));
  log("");

  // Admin credentials
  const adminUser  = await ask(t("promptAdminUser"), "admin");
  const adminEmail = await ask(t("promptAdminEmail"), "admin@example.com");
  const adminPass  = await askSecret(t("promptAdminPass"));

  // JWT secrets
  const jwtSecret   = genSecret();
  const shareSecret = genSecret();
  const oauthSecret = genSecret();

  // Port
  const port = await ask(t("promptPort"), "8787");

  // SMTP (optional)
  const wantSmtp = await confirm(t("smtpQuestion"));
  let smtpHost = "", smtpUser = "", smtpPass = "", smtpFrom = "";
  if (wantSmtp) {
    smtpHost = await ask("SMTP Host", "smtp.gmail.com");
    smtpUser = await ask(t("promptSmtpUser"));
    smtpPass = await askSecret("SMTP Password");
    smtpFrom = await ask(t("promptSmtpFrom"), smtpUser);
  }

  // Apply values
  envContent = setVar(envContent, "BACKEND",         mode === "postgres" ? "postgres" : "pocketbase");
  envContent = setVar(envContent, "API_PORT",        port);
  envContent = setVar(envContent, "JWT_AUTH_SECRET",  jwtSecret);
  envContent = setVar(envContent, "JWT_SHARE_SECRET", shareSecret);
  envContent = setVar(envContent, "OAUTH_STATE_SECRET", oauthSecret);
  envContent = setVar(envContent, "ADMIN_USERNAME",   adminUser);
  envContent = setVar(envContent, "ADMIN_EMAIL",      adminEmail);
  envContent = setVar(envContent, "ADMIN_PASSWORD",   adminPass);
  if (wantSmtp) {
    envContent = setVar(envContent, "SMTP_HOST", smtpHost);
    envContent = setVar(envContent, "SMTP_USER", smtpUser);
    envContent = setVar(envContent, "SMTP_PASS", smtpPass);
    envContent = setVar(envContent, "SMTP_FROM", smtpFrom);
  }

  writeFileSync(envPath, envContent, "utf-8");
  ok(t("envCreated", { path: envPath }));

  return port;
}

// ─── Step 5: Start Docker ─────────────────────────────────────────────────────
async function startDocker(mode) {
  step(5, t("setupStep5"));

  // Find the right compose file
  const deployDir = join(INFRA_DIR, "deploy");
  const composeFile = mode === "postgres"
    ? join(deployDir, "docker-compose.postgres.yml")
    : join(deployDir, "docker-compose.yml");

  const useFallback = !existsSync(composeFile);
  const finalFile = useFallback ? join(INFRA_DIR, "docker-compose.yml") : composeFile;

  if (!existsSync(finalFile)) {
    err(t("composeNotFound", { path: finalFile }));
    rl.close(); process.exit(1);
  }

  log(`docker compose -f ${finalFile} up -d`);
  log("");

  await new Promise((resolve, reject) => {
    const child = spawn("docker", ["compose", "-f", finalFile, "up", "-d", "--build"], {
      cwd: INFRA_DIR, stdio: "inherit",
    });
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`Docker exited ${code}`)));
  });
  ok(t("containersUp"));
}

// ─── Step 6: Health check ─────────────────────────────────────────────────────
async function waitForHealth(port = "8787", timeoutMs = 120_000) {
  step(6, t("setupStep6"));
  const url = `http://localhost:${port}/api/health`;
  const deadline = Date.now() + timeoutMs;
  let dots = 0;
  process.stdout.write(`  ${t("waiting")}`);
  while (Date.now() < deadline) {
    try {
      const { default: http } = await import("node:http");
      await new Promise((res, rej) => {
        const req = http.get(url, r => { r.resume(); res(r.statusCode); });
        req.on("error", rej);
        req.setTimeout(2000, () => { req.destroy(); rej(new Error("timeout")); });
      }).then(code => { if (code !== 200) throw new Error(`status ${code}`); });
      process.stdout.write("\n");
      ok(t("systemReadyAt", { url }));
      return;
    } catch { /* retry */ }
    process.stdout.write(".");
    dots++;
    if (dots % 30 === 0) process.stdout.write("\n  ");
    await new Promise(r => setTimeout(r, 2000));
  }
  process.stdout.write("\n");
  warn(t("healthTimeoutSetup"));
}

// ─── Step 7: Open browser ─────────────────────────────────────────────────────
async function openBrowser(port = "8787") {
  step(7, t("setupStep7"));
  const url = `http://localhost:${port}`;
  const os = platform();
  try {
    if (os === "win32")       execSync(`start ${url}`);
    else if (os === "darwin") execSync(`open ${url}`);
    else                      execSync(`xdg-open ${url}`);
    ok(t("browserOpened", { url }));
  } catch {
    log(t("openManually", { url: `${BOLD}${url}${RESET}` }));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  await promptLanguage();
  const title = t("setupBanner");
  console.log(`\n${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${"─".repeat(Math.max(20, title.length))}${RESET}\n`);
  log(`${t("setupIntro")}\n`);

  try {
    await checkNode();
    await checkDocker();
    const mode = await chooseMode();
    const port = await configureEnv(mode);

    const doStart = await confirm(t("startContainersQuestion"));
    if (doStart) {
      await startDocker(mode);
      // Read port from .env (may have been updated by user)
      const envPath = join(INFRA_DIR, ".env");
      let resolvedPort = port || "8787";
      if (existsSync(envPath)) {
        const m = readFileSync(envPath, "utf-8").match(/^API_PORT=(\d+)/m);
        if (m) resolvedPort = m[1];
      }
      await waitForHealth(resolvedPort);

      // ponytail: pb-init.mjs (auto-schema-init) was removed with the legacy
      // PocketBase-backed server; point users at the manual init hint instead.
      if (mode === "pocketbase") {
        const pbUrl = `http://localhost:${resolvedPort}`;
        log(`${CYAN}${t("pbInitHint", { url: pbUrl })}${RESET}`);
      }

      await openBrowser(resolvedPort);
    }

    hr();
    console.log(`${BOLD}${GREEN}${t("setupDone")}${RESET}\n`);
    log(t("labelServer", { url: `${CYAN}http://localhost:${port || "8787"}${RESET}` }));
    log(t("labelDocs"));
    log(t("labelStop"));
    console.log("");
  } catch (e) {
    err(e.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
