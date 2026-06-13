#!/usr/bin/env node
/**
 * Archive Suite — Guided Production Deployment Wizard
 * Run: node scripts/deploy-wizard.mjs   (or: pnpm deploy / Setup-Archive.bat / bash setup.sh)
 *
 * One cross-platform (Linux + Windows) wizard that takes an operator from a
 * fresh checkout to a running, hardened PostgreSQL production stack:
 *
 *   1. Detect environment (OS, Node, Docker, Compose)
 *   2. Choose access mode: internal (intranet) or public (domain + HTTPS)
 *   3. Configure the admin account
 *   4. Generate strong secrets (or reuse an existing .env)
 *   5. Optional integrations (SMTP, AI, file storage, backups, heavy services)
 *   6. Write archive-server/.env idempotently (backs up any existing file)
 *   7. Readiness gate (pnpm security:baseline)
 *   8. Bring up the stack (full or --lite) via docker compose
 *   9. Wait for health (migrations + admin seed happen automatically)
 *  10. Print the summary (URLs, one-time credentials, next steps)
 *
 * Non-interactive (CI/automation):
 *   node scripts/deploy-wizard.mjs --non-interactive [--public --domain=d --acme-email=e] [--lite] [--skip-gate]
 *
 * Reuses the colour/prompt/secret helpers and overall shape of scripts/setup.mjs.
 */

import { execSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";
import { platform } from "node:os";

// ─── Paths ──────────────────────────────────────────────────────────────────
const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const ROOT = resolve(__dirname, "..");
const SERVER_DIR = join(ROOT, "archive-server");
// ARCHIVE_ENV_PATH lets CI / tests target a throwaway file instead of the real .env.
const ENV_PATH = process.env.ARCHIVE_ENV_PATH || join(SERVER_DIR, ".env");
const EXAMPLE_PATH = join(SERVER_DIR, ".env.example");
const COMPOSE_BASE = join(SERVER_DIR, "docker-compose.postgres.yml");
const COMPOSE_INTRANET = join(SERVER_DIR, "docker-compose.intranet.yml");
const COMPOSE_LITE = join(SERVER_DIR, "docker-compose.lite.yml");

// ─── Colours / logging ──────────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const log = (m) => console.log(`  ${m}`);
const ok = (m) => console.log(`  ${GREEN}✓${RESET}  ${m}`);
const warn = (m) => console.log(`  ${YELLOW}⚠${RESET}  ${m}`);
const err = (m) => console.error(`  ${RED}✗${RESET}  ${m}`);
const step = (n, m) => console.log(`\n${BOLD}${CYAN}[${n}]${RESET}${BOLD} ${m}${RESET}\n`);
const hr = () => console.log(`\n${DIM}${"─".repeat(64)}${RESET}\n`);

// ─── CLI flags ──────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
const hasFlag = (name) => ARGV.includes(`--${name}`);
const flagValue = (name) => {
  const pre = `--${name}=`;
  const found = ARGV.find((a) => a.startsWith(pre));
  return found ? found.slice(pre.length) : null;
};

const NON_INTERACTIVE = hasFlag("non-interactive") || hasFlag("yes");
const FLAG_PUBLIC = hasFlag("public");
const FLAG_INTRANET = hasFlag("intranet");
const FLAG_LITE = hasFlag("lite");
const FLAG_SKIP_GATE = hasFlag("skip-gate");
const FLAG_ENV_ONLY = hasFlag("env-only");
const FLAG_DOMAIN = flagValue("domain");
const FLAG_ACME_EMAIL = flagValue("acme-email");

// ─── Prompt helpers (no-op in non-interactive mode) ─────────────────────────
const rl = NON_INTERACTIVE
  ? null
  : createInterface({ input: process.stdin, output: process.stdout });

const ask = (q, def = "") =>
  NON_INTERACTIVE
    ? Promise.resolve(def)
    : new Promise((res) =>
        rl.question(
          `  ${CYAN}?${RESET} ${q}${def ? ` ${YELLOW}(${def})${RESET}` : ""}: `,
          (a) => res(a.trim() || def)
        )
      );

const askSecret = (q) =>
  NON_INTERACTIVE
    ? Promise.resolve(genSecret())
    : new Promise((res) =>
        rl.question(
          `  ${CYAN}?${RESET} ${q} ${YELLOW}(Enter = توليد تلقائي)${RESET}: `,
          (a) => res(a.trim() || genSecret())
        )
      );

const confirm = async (q, def = "y") => {
  if (NON_INTERACTIVE) return def === "y";
  const a = await ask(`${q} (y/n)`, def);
  return a.toLowerCase().startsWith("y");
};

function genSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}
function genPassword(bytes = 18) {
  // URL-safe-ish strong password for human-facing accounts (admin, pgAdmin…).
  return randomBytes(bytes).toString("base64").replace(/[+/=]/g, "").slice(0, 24);
}

// ─── .env read/write helpers (immutable string transforms) ──────────────────
function setVar(content, key, value) {
  const re = new RegExp(`^(${key}=).*`, "m");
  return re.test(content) ? content.replace(re, `$1${value}`) : `${content}\n${key}=${value}`;
}
function getVar(content, key) {
  const m = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}
function ensureSecret(content, key, gen = genSecret) {
  // Treat empty or CHANGE_ME placeholders as "needs generating".
  const current = getVar(content, key);
  if (!current || /CHANGE_ME/i.test(current)) return setVar(content, key, gen());
  return content;
}

// ─── Step 1: environment detection ──────────────────────────────────────────
function detectEnvironment() {
  step(1, "فحص البيئة");
  const os = platform();
  ok(`نظام التشغيل: ${os === "win32" ? "Windows" : os === "darwin" ? "macOS" : "Linux"}`);

  const nodeMajor = parseInt(process.version.slice(1), 10);
  if (nodeMajor < 22) {
    err(`يتطلب Node.js 22+. الحالي: ${process.version} — حمّل من https://nodejs.org`);
    process.exit(1);
  }
  ok(`Node.js ${process.version}`);

  try {
    execSync("docker --version", { stdio: "pipe" });
    execSync("docker info", { stdio: "pipe" });
    ok("Docker يعمل");
  } catch {
    err("Docker غير مثبّت أو لا يعمل.");
    if (os === "win32") log("  شغّل Docker Desktop ثم أعد المحاولة: https://docs.docker.com/desktop/install/windows-install/");
    else if (os === "darwin") log("  شغّل Docker Desktop: https://docs.docker.com/desktop/install/mac-install/");
    else log("  ثبّت/شغّل Docker Engine: https://docs.docker.com/engine/install/");
    process.exit(1);
  }

  try {
    execSync("docker compose version", { stdio: "pipe" });
    ok("Docker Compose متاح");
  } catch {
    err("Docker Compose (v2 plugin) غير متاح. حدّث Docker.");
    process.exit(1);
  }
  return { os };
}

// ─── Step 2: access mode ────────────────────────────────────────────────────
async function chooseAccessMode() {
  step(2, "وضع الوصول");
  if (FLAG_PUBLIC) {
    const domain = FLAG_DOMAIN || (await ask("النطاق (DOMAIN)", "example.com"));
    const acmeEmail = FLAG_ACME_EMAIL || (await ask("بريد ACME (لتجديد الشهادة)", "admin@" + domain));
    ok(`وضع عام: https://${domain}`);
    return { mode: "public", domain, acmeEmail };
  }
  if (FLAG_INTRANET || NON_INTERACTIVE) {
    ok("وضع داخلي: http://SERVER_IP:8080");
    return { mode: "internal" };
  }
  log(`  ${CYAN}1${RESET}) داخلي (intranet) — وصول عبر الشبكة المحلية على المنفذ 8080، بلا نطاق/HTTPS`);
  log(`  ${CYAN}2${RESET}) عام (public) — نطاق حقيقي + HTTPS تلقائي (Let's Encrypt عبر Caddy)`);
  log("");
  const choice = await ask("اختر", "1");
  if (choice === "2") {
    const domain = await ask("النطاق (DOMAIN) — يجب أن يشير DNS إليه", "example.com");
    const acmeEmail = await ask("بريد ACME (تنبيهات تجديد الشهادة)", "admin@" + domain);
    const dnsReady = await confirm(`هل يشير سجل DNS لـ ${domain} إلى هذا الخادم بالفعل؟`, "n");
    if (!dnsReady) warn("بدون DNS صحيح لن تُصدَر شهادة Let's Encrypt. يمكنك المتابعة وإصلاح DNS لاحقاً.");
    return { mode: "public", domain, acmeEmail };
  }
  ok("وضع داخلي مُختار");
  return { mode: "internal" };
}

// ─── Step 3 + 4 + 5 + 6: build and write the .env ───────────────────────────
async function configureEnv(access) {
  step(3, "حساب المشرف والأسرار");

  // Reuse an existing .env if present, else start from the example.
  let content;
  let reused = false;
  if (existsSync(ENV_PATH)) {
    const keep = NON_INTERACTIVE ? true : await confirm("وُجد .env سابق — الإبقاء عليه وتعبئة الناقص فقط؟", "y");
    if (keep) {
      content = readFileSync(ENV_PATH, "utf-8");
      reused = true;
      const backup = `${ENV_PATH}.bak.${Date.now()}`;
      copyFileSync(ENV_PATH, backup);
      ok(`نسخة احتياطية: ${backup}`);
    } else {
      content = readFileSync(EXAMPLE_PATH, "utf-8");
    }
  } else {
    content = existsSync(EXAMPLE_PATH) ? readFileSync(EXAMPLE_PATH, "utf-8") : "";
  }

  // --- Admin account ---
  const adminUser =
    reused && getVar(content, "ADMIN_USERNAME") ? getVar(content, "ADMIN_USERNAME") : await ask("اسم المشرف (username)", "admin");
  const adminEmail = await ask("بريد المشرف", getVar(content, "ADMIN_EMAIL") || "admin@example.com");
  let adminPass = getVar(content, "ADMIN_PASSWORD");
  if (!adminPass || /CHANGE_ME/i.test(adminPass)) {
    adminPass = NON_INTERACTIVE ? genPassword() : await askSecret("كلمة مرور المشرف");
    if (adminPass.length < 12) adminPass = genPassword();
  }

  // --- Backend + access wiring ---
  content = setVar(content, "BACKEND", "postgres");
  content = setVar(content, "API_PORT", getVar(content, "API_PORT") || "8787");
  content = setVar(content, "ADMIN_USERNAME", adminUser);
  content = setVar(content, "ADMIN_EMAIL", adminEmail);
  content = setVar(content, "ADMIN_PASSWORD", adminPass);

  if (access.mode === "public") {
    content = setVar(content, "DOMAIN", access.domain);
    content = setVar(content, "ACME_EMAIL", access.acmeEmail);
    content = setVar(content, "ARCHIVE_PUBLIC_DEPLOY", "1");
    content = setVar(content, "APP_BASE_URL", `https://${access.domain}`);
  } else {
    content = setVar(content, "DOMAIN", "localhost");
    content = setVar(content, "ARCHIVE_PUBLIC_DEPLOY", "0");
  }

  // --- Step 4: generate all required secrets ---
  step(4, "توليد الأسرار القوية");
  for (const key of [
    "JWT_AUTH_SECRET",
    "JWT_SHARE_SECRET",
    "OAUTH_STATE_SECRET",
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "GRAFANA_PASSWORD",
    "BACKUP_ENCRYPTION_KEY",
  ]) {
    content = ensureSecret(content, key);
  }
  content = ensureSecret(content, "PGADMIN_PASSWORD", genPassword);
  if (!getVar(content, "PGADMIN_EMAIL") || /example\.com/.test(getVar(content, "PGADMIN_EMAIL"))) {
    content = setVar(content, "PGADMIN_EMAIL", adminEmail);
  }
  // DATABASE_URL must embed the (now generated) postgres password.
  const pgPass = getVar(content, "POSTGRES_PASSWORD");
  const pgUser = getVar(content, "POSTGRES_USER") || "archive";
  const pgDb = getVar(content, "POSTGRES_DB") || "archive";
  content = setVar(content, "POSTGRES_USER", pgUser);
  content = setVar(content, "POSTGRES_DB", pgDb);
  content = setVar(content, "DATABASE_URL", `postgresql://${pgUser}:${pgPass}@postgres:5432/${pgDb}`);
  content = setVar(content, "BACKUP_ENABLED", "true");
  ok("الأسرار جاهزة (POSTGRES/REDIS/JWT/PGADMIN/GRAFANA/BACKUP)");

  // --- Step 5: optional integrations ---
  step(5, "تكاملات اختيارية");
  if (!NON_INTERACTIVE && (await confirm("إعداد البريد (SMTP) لإعادة تعيين كلمة المرور الآن؟", "n"))) {
    const host = await ask("SMTP Host", "smtp.gmail.com");
    const user = await ask("SMTP User (بريدك)", "");
    const pass = await askSecret("SMTP Password");
    content = setVar(content, "SMTP_HOST", host);
    content = setVar(content, "SMTP_USER", user);
    content = setVar(content, "SMTP_PASS", pass);
    content = setVar(content, "SMTP_FROM", await ask("From", user));
    ok("SMTP مضبوط");
  } else {
    log("تخطّي SMTP (روابط إعادة التعيين ستُطبع في سجل الخادم).");
  }

  if (!NON_INTERACTIVE && (await confirm("تفعيل مزوّد ذكاء اصطناعي (AI) الآن؟", "n"))) {
    const provider = await ask("AI_PROVIDER (openrouter|openai|anthropic|google|groq|mistral|ollama)", "openrouter");
    content = setVar(content, "AI_PROVIDER", provider);
    if (provider !== "ollama") content = setVar(content, "AI_API_KEY", await askSecret("AI_API_KEY"));
    ok("AI مضبوط");
  } else {
    log("تخطّي AI (يمكن تفعيله لاحقاً من إعدادات الإدارة).");
  }

  // Validate: no CHANGE_ME placeholders may survive (non-comment lines).
  const leftovers = content
    .split("\n")
    .filter((line) => /CHANGE_ME/i.test(line) && !line.trimStart().startsWith("#"));
  if (leftovers.length) {
    err("بقيت قيم CHANGE_ME غير مضبوطة:");
    leftovers.forEach((l) => log(`  ${l.split("=")[0]}`));
    process.exit(1);
  }

  // --- Step 6: write .env ---
  step(6, "كتابة ملف البيئة");
  writeFileSync(ENV_PATH, content, "utf-8");
  ok(`${ENV_PATH} ${reused ? "(محدّث)" : "(جديد)"}`);

  return {
    adminUser,
    adminEmail,
    adminPass,
    pgadminEmail: getVar(content, "PGADMIN_EMAIL"),
    pgadminPass: getVar(content, "PGADMIN_PASSWORD"),
  };
}

// ─── Step 7: readiness gate ─────────────────────────────────────────────────
async function readinessGate() {
  step(7, "بوابة الجاهزية");
  if (FLAG_SKIP_GATE) {
    warn("تم تخطّي البوابة (--skip-gate).");
    return;
  }
  const run = NON_INTERACTIVE ? false : await confirm("تشغيل فحص الأساس الأمني (pnpm security:baseline)؟", "y");
  if (!run) {
    log("تخطّي البوابة.");
    return;
  }
  const res = spawnSync("pnpm", ["security:baseline"], { cwd: ROOT, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    warn("فشل فحص الأساس الأمني — راجع المخرجات أعلاه.");
    if (!NON_INTERACTIVE && !(await confirm("المتابعة رغم ذلك؟", "n"))) process.exit(1);
  } else {
    ok("الأساس الأمني سليم");
  }
}

// ─── Step 8: compose up ─────────────────────────────────────────────────────
function composeFiles(access, lite) {
  const files = ["-f", COMPOSE_BASE];
  if (access.mode === "internal") files.push("-f", COMPOSE_INTRANET);
  if (lite) files.push("-f", COMPOSE_LITE);
  return files;
}

async function bringUp(access, lite) {
  step(8, "تشغيل الحزمة");
  const files = composeFiles(access, lite);
  log(`docker compose ${files.join(" ")} up -d --build`);
  log("");
  await new Promise((res, rej) => {
    const child = spawn("docker", ["compose", ...files, "up", "-d", "--build"], {
      cwd: SERVER_DIR,
      stdio: "inherit",
    });
    child.on("close", (code) => (code === 0 ? res() : rej(new Error(`docker compose خرج بالرمز ${code}`))));
  });
  ok("الحاويات تعمل");
  return files;
}

// ─── Step 9: health wait ────────────────────────────────────────────────────
async function waitForHealth(access, files, timeoutMs = 240_000) {
  step(9, "انتظار جاهزية النظام (ترحيلات + بذر المشرف تلقائياً)");
  const deadline = Date.now() + timeoutMs;
  const pollHttp = access.mode === "internal";
  process.stdout.write("  انتظار");
  let dots = 0;
  while (Date.now() < deadline) {
    try {
      if (pollHttp) {
        const { default: http } = await import("node:http");
        const code = await new Promise((res, rej) => {
          const req = http.get("http://127.0.0.1:8080/api/health", (r) => {
            r.resume();
            res(r.statusCode);
          });
          req.on("error", rej);
          req.setTimeout(2500, () => {
            req.destroy();
            rej(new Error("timeout"));
          });
        });
        if (code === 200) {
          process.stdout.write("\n");
          ok("النظام جاهز على http://localhost:8080");
          return true;
        }
      } else {
        const out = execSync(`docker compose ${files.join(" ")} ps --format "{{.Service}} {{.Health}}"`, {
          cwd: SERVER_DIR,
          encoding: "utf-8",
        });
        if (/server\s+healthy/.test(out)) {
          process.stdout.write("\n");
          ok("خدمة الخادم سليمة");
          return true;
        }
      }
    } catch {
      /* retry */
    }
    process.stdout.write(".");
    if (++dots % 30 === 0) process.stdout.write("\n  ");
    await new Promise((r) => setTimeout(r, 3000));
  }
  process.stdout.write("\n");
  warn("لم يجتَز فحص الصحة ضمن المهلة. افحص السجلات: docker compose logs server");
  return false;
}

// ─── Step 10: summary + open ────────────────────────────────────────────────
function openBrowser(url) {
  if (NON_INTERACTIVE) return;
  const os = platform();
  try {
    if (os === "win32") execSync(`start "" "${url}"`, { stdio: "ignore" });
    else if (os === "darwin") execSync(`open "${url}"`, { stdio: "ignore" });
    else if (process.env.DISPLAY) execSync(`xdg-open "${url}"`, { stdio: "ignore" });
  } catch {
    /* headless / no browser — fine */
  }
}

function summary(access, creds, lite) {
  hr();
  console.log(`${BOLD}${GREEN}✓ اكتمل النشر!${RESET}\n`);
  const appUrl = access.mode === "public" ? `https://${access.domain}` : "http://localhost:8080 (أو http://SERVER_IP:8080)";
  log(`${BOLD}التطبيق:${RESET} ${CYAN}${appUrl}${RESET}`);
  log(`${BOLD}تسجيل الدخول:${RESET} ${creds.adminUser} / ${YELLOW}${creds.adminPass}${RESET}  ${DIM}(احفظها الآن — لن تُعرض ثانية)${RESET}`);
  log("");
  log(`${BOLD}إدارة SQL (pgAdmin):${RESET} ${CYAN}http://127.0.0.1:5050${RESET}  ${DIM}(محلي فقط — للوصول البعيد استخدم نفق SSH)${RESET}`);
  log(`  pgAdmin: ${creds.pgadminEmail} / ${YELLOW}${creds.pgadminPass}${RESET}`);
  log(`  Postgres مباشرة (DBeaver…): host=localhost port=15432 db=archive`);
  if (!lite) log(`${BOLD}Grafana:${RESET} ${CYAN}http://127.0.0.1:3000${RESET} ${DIM}(محلي فقط)${RESET}`);
  hr();
  log(`${BOLD}الخطوات التالية:${RESET}`);
  log(`  • ثبّت التطبيق كـ PWA من المتصفح (نافذة مستقلة).`);
  if (access.mode === "internal") log(`  • للتحويل للعام لاحقاً: أعد تشغيل المعالج بوضع "عام" مع نطاق + DNS.`);
  log(`  • الإيقاف: docker compose ${composeFiles(access, lite).join(" ")} down`);
  log(`  • النسخ الاحتياطي مُفعّل (مشفّر) — راجع BACKUP_DIR.`);
  console.log("");
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}${CYAN}╔════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║   Archive Suite — معالج النشر الإنتاجي     ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚════════════════════════════════════════════╝${RESET}\n`);

  try {
    detectEnvironment();
    const access = await chooseAccessMode();
    const creds = await configureEnv(access);

    if (FLAG_ENV_ONLY) {
      ok(`تم إنشاء/تحديث ${ENV_PATH} فقط (--env-only). ارفع الحزمة لاحقاً عبر docker compose up.`);
      void creds;
      return;
    }

    await readinessGate();

    const lite =
      FLAG_LITE ||
      (!NON_INTERACTIVE && (await confirm("جهاز محدود الموارد؟ تشغيل النسخة الخفيفة (بلا OCR/Whisper/مراقبة)؟", "n")));

    const goUp = NON_INTERACTIVE ? true : await confirm("تشغيل الحزمة الآن؟", "y");
    if (!goUp) {
      log("تم إعداد .env فقط. شغّل لاحقاً عبر docker compose up.");
      return;
    }

    const files = await bringUp(access, lite);
    await waitForHealth(access, files);
    summary(access, creds, lite);
    openBrowser(access.mode === "public" ? `https://${access.domain}` : "http://localhost:8080");
  } catch (e) {
    err(e.message);
    process.exitCode = 1;
  } finally {
    rl?.close();
  }
}

main();
