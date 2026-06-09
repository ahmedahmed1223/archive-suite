#!/usr/bin/env node
/**
 * Archive Suite — Interactive Setup Wizard
 * Run: node scripts/setup.mjs
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const ROOT = resolve(__dirname, "..");
const SERVER_DIR = join(ROOT, "archive-server");

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

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def = "") => new Promise(res =>
  rl.question(`  ${CYAN}?${RESET} ${q}${def ? ` ${YELLOW}(${def})${RESET}` : ""}: `, a => res(a.trim() || def))
);
const askSecret = (q) => new Promise(res =>
  rl.question(`  ${CYAN}?${RESET} ${q} ${YELLOW}(اضغط Enter لتوليد تلقائي)${RESET}: `, a => res(a.trim() || randomBytes(32).toString("hex"))
));
const confirm = async (q) => { const a = await ask(`${q} (y/n)`, "y"); return a.toLowerCase() === "y"; };

function genSecret() { return randomBytes(32).toString("hex"); }

// ─── Step 1: Node.js version ──────────────────────────────────────────────────
async function checkNode() {
  step(1, "فحص إصدار Node.js");
  const v = process.version;
  const major = parseInt(v.slice(1), 10);
  if (major < 18) {
    err(`يتطلب النظام Node.js 18 أو أحدث. الإصدار الحالي: ${v}`);
    err("قم بتحميل Node.js من: https://nodejs.org");
    process.exit(1);
  }
  ok(`Node.js ${v}`);
}

// ─── Step 2: Docker ───────────────────────────────────────────────────────────
async function checkDocker() {
  step(2, "فحص Docker");

  let dockerOk = false;
  let composeOk = false;

  try { execSync("docker --version", { stdio: "pipe" }); dockerOk = true; ok("Docker مثبّت"); }
  catch { warn("Docker غير مثبّت"); }

  try { execSync("docker compose version", { stdio: "pipe" }); composeOk = true; ok("Docker Compose مثبّت"); }
  catch {
    try { execSync("docker-compose --version", { stdio: "pipe" }); composeOk = true; ok("Docker Compose مثبّت"); }
    catch { warn("Docker Compose غير مثبّت"); }
  }

  if (!dockerOk || !composeOk) {
    const os = platform();
    log("");
    log(`${BOLD}لتثبيت Docker:${RESET}`);
    if (os === "win32")  log("  Windows: https://docs.docker.com/desktop/install/windows-install/");
    else if (os === "darwin") log("  macOS:   https://docs.docker.com/desktop/install/mac-install/");
    else                 log("  Linux:   https://docs.docker.com/engine/install/");
    log("");
    log("بعد التثبيت أعد تشغيل الطرفية ثم شغّل هذا السكريبت مرة أخرى.");
    log("");
    const go = await confirm("هل أكملت تثبيت Docker وتريد الاستمرار؟");
    if (!go) { log("تم الإنهاء."); rl.close(); process.exit(0); }
    // Re-check
    try { execSync("docker --version", { stdio: "pipe" }); ok("Docker جاهز"); }
    catch { err("لم يُكتشف Docker. أعد التثبيت وحاول مجدداً."); rl.close(); process.exit(1); }
  }
}

// ─── Step 3: Mode selection ───────────────────────────────────────────────────
async function chooseMode() {
  step(3, "اختيار وضع التشغيل");
  log(`  ${CYAN}1${RESET}) وضع التطوير  — PocketBase (خفيف، بدون قاعدة بيانات خارجية)`);
  log(`  ${CYAN}2${RESET}) وضع الإنتاج — PostgreSQL + Caddy (موصى به للنشر)`);
  log("");
  const choice = await ask("اختر", "1");
  return choice === "2" ? "postgres" : "pocketbase";
}

// ─── Step 4: Configure .env ───────────────────────────────────────────────────
async function configureEnv(mode) {
  step(4, "إعداد متغيرات البيئة (.env)");

  const envPath = join(SERVER_DIR, ".env");
  const examplePath = join(SERVER_DIR, ".env.example");

  // Read example as base
  let envContent = existsSync(examplePath) ? readFileSync(examplePath, "utf-8") : "";

  function setVar(content, key, value) {
    const re = new RegExp(`^(${key}=).*`, "m");
    return re.test(content)
      ? content.replace(re, `$1${value}`)
      : content + `\n${key}=${value}`;
  }

  log("أدخل إعدادات النظام (اضغط Enter لقبول القيمة الافتراضية):");
  log("");

  // Admin credentials
  const adminUser  = await ask("اسم المشرف (username)", "admin");
  const adminEmail = await ask("بريد المشرف", "admin@example.com");
  const adminPass  = await askSecret("كلمة مرور المشرف");

  // JWT secrets
  const jwtSecret   = genSecret();
  const shareSecret = genSecret();
  const oauthSecret = genSecret();

  // Port
  const port = await ask("منفذ الخادم", "8787");

  // SMTP (optional)
  const wantSmtp = await confirm("هل تريد إعداد البريد الإلكتروني (SMTP) الآن؟");
  let smtpHost = "", smtpUser = "", smtpPass = "", smtpFrom = "";
  if (wantSmtp) {
    smtpHost = await ask("SMTP Host", "smtp.gmail.com");
    smtpUser = await ask("SMTP User (بريدك)");
    smtpPass = await askSecret("SMTP Password");
    smtpFrom = await ask("From address", smtpUser);
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
  ok(`.env تم إنشاؤه في ${envPath}`);

  return port;
}

// ─── Step 5: Start Docker ─────────────────────────────────────────────────────
async function startDocker(mode) {
  step(5, "تشغيل حاويات Docker");

  // Find the right compose file
  const deployDir = join(SERVER_DIR, "deploy");
  const composeFile = mode === "postgres"
    ? join(deployDir, "docker-compose.postgres.yml")
    : join(deployDir, "docker-compose.yml");

  const useFallback = !existsSync(composeFile);
  const finalFile = useFallback ? join(SERVER_DIR, "docker-compose.yml") : composeFile;

  if (!existsSync(finalFile)) {
    err(`لم يُعثر على ملف docker-compose في: ${finalFile}`);
    rl.close(); process.exit(1);
  }

  log(`تشغيل: docker compose -f ${finalFile} up -d`);
  log("");

  await new Promise((resolve, reject) => {
    const child = spawn("docker", ["compose", "-f", finalFile, "up", "-d", "--build"], {
      cwd: SERVER_DIR, stdio: "inherit",
    });
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`Docker exited ${code}`)));
  });
  ok("الحاويات تعمل");
}

// ─── Step 6: Health check ─────────────────────────────────────────────────────
async function waitForHealth(port = "8787", timeoutMs = 120_000) {
  step(6, "انتظار جاهزية النظام");
  const url = `http://localhost:${port}/api/health`;
  const deadline = Date.now() + timeoutMs;
  let dots = 0;
  process.stdout.write("  انتظار");
  while (Date.now() < deadline) {
    try {
      const { default: http } = await import("node:http");
      await new Promise((res, rej) => {
        const req = http.get(url, r => { r.resume(); res(r.statusCode); });
        req.on("error", rej);
        req.setTimeout(2000, () => { req.destroy(); rej(new Error("timeout")); });
      }).then(code => { if (code !== 200) throw new Error(`status ${code}`); });
      process.stdout.write("\n");
      ok(`النظام جاهز على ${url}`);
      return;
    } catch { /* retry */ }
    process.stdout.write(".");
    dots++;
    if (dots % 30 === 0) process.stdout.write("\n  ");
    await new Promise(r => setTimeout(r, 2000));
  }
  process.stdout.write("\n");
  warn("لم يستجب النظام خلال المهلة المحددة. تحقق من: docker compose logs");
}

// ─── Step 7: Open browser ─────────────────────────────────────────────────────
async function openBrowser(port = "8787") {
  step(7, "فتح المتصفح");
  const url = `http://localhost:${port}`;
  const os = platform();
  try {
    if (os === "win32")       execSync(`start ${url}`);
    else if (os === "darwin") execSync(`open ${url}`);
    else                      execSync(`xdg-open ${url}`);
    ok(`تم فتح ${url}`);
  } catch {
    log(`افتح المتصفح يدوياً على: ${BOLD}${url}${RESET}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`\n${BOLD}${CYAN}╔═══════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║     Archive Suite — معالج التثبيت     ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚═══════════════════════════════════════╝${RESET}\n`);
  log("هذا المعالج سيُرشدك خطوة بخطوة لتشغيل النظام.\n");

  try {
    await checkNode();
    await checkDocker();
    const mode = await chooseMode();
    const port = await configureEnv(mode);

    const doStart = await confirm("هل تريد تشغيل الحاويات الآن؟");
    if (doStart) {
      await startDocker(mode);
      // Read port from .env (may have been updated by user)
      const envPath = join(SERVER_DIR, ".env");
      let resolvedPort = port || "8787";
      if (existsSync(envPath)) {
        const m = readFileSync(envPath, "utf-8").match(/^API_PORT=(\d+)/m);
        if (m) resolvedPort = m[1];
      }
      await waitForHealth(resolvedPort);

      // Auto-init PocketBase schema when pocketbase backend was chosen
      if (mode === "pocketbase") {
        const pbUrl      = `http://localhost:${resolvedPort}`;
        const pbEmail    = process.env.PB_EMAIL    || "admin@archive.local";
        const pbPassword = process.env.PB_PASSWORD || "";
        if (pbPassword) {
          step("6b", "تهيئة مخطط PocketBase تلقائياً");
          const { spawnSync } = await import("node:child_process");
          const result = spawnSync(process.execPath, [
            join(__dirname, "pb-init.mjs"),
            `--url=${pbUrl}`,
            `--email=${pbEmail}`,
            `--password=${pbPassword}`,
          ], { stdio: "inherit" });
          if (result.status !== 0) warn("تعذّر تهيئة PocketBase تلقائياً — شغّل يدوياً: node scripts/pb-init.mjs");
        } else {
          log(`💡 لتهيئة PocketBase تلقائياً: ${CYAN}node scripts/pb-init.mjs --url=${pbUrl}${RESET}`);
        }
      }

      await openBrowser(resolvedPort);
    }

    hr();
    console.log(`${BOLD}${GREEN}✓ اكتمل الإعداد!${RESET}\n`);
    log(`الخادم: ${CYAN}http://localhost:${port || "8787"}${RESET}`);
    log(`المستندات: ${CYAN}INSTALL.md${RESET}`);
    log(`الوقف: ${CYAN}docker compose down${RESET}\n`);
  } catch (e) {
    err(e.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
