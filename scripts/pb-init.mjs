#!/usr/bin/env node
/**
 * Archive Suite — PocketBase Auto-Init
 * Automates the PocketBase setup that previously required 8+ manual steps:
 *   1. Wait for PocketBase to be reachable
 *   2. Create the first admin account (open API, only works before any admin exists)
 *   3. Authenticate as that admin
 *   4. Import the collections schema from pb_schema.json
 *   5. Verify each collection was created
 *
 * Usage:
 *   node scripts/pb-init.mjs [--url=http://localhost:8090] [--email=a@b.com] [--password=secret]
 *
 * Environment variables (fallback):
 *   PB_URL       — PocketBase URL (default: http://localhost:8090)
 *   PB_EMAIL     — admin email    (default: admin@archive.local)
 *   PB_PASSWORD  — admin password (default: generated)
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";

const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

const ok   = (m) => console.log(`  ${GREEN}✓${RESET}  ${m}`);
const warn = (m) => console.log(`  ${YELLOW}⚠${RESET}  ${m}`);
const fail = (m) => { console.error(`  ${RED}✗${RESET}  ${m}`); process.exit(1); };
const step = (n, m) => console.log(`\n${BOLD}${CYAN}[${n}]${RESET}${BOLD} ${m}${RESET}\n`);

// ─── Parse CLI args ───────────────────────────────────────────────────────────

function parseArg(name) {
  const flag = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(flag));
  return arg ? arg.slice(flag.length) : null;
}

const __dir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const ROOT  = resolve(__dir, "..");

const PB_URL      = parseArg("url")      || process.env.PB_URL      || "http://localhost:8090";
const PB_EMAIL    = parseArg("email")    || process.env.PB_EMAIL    || "admin@archive.local";
const PB_PASSWORD = parseArg("password") || process.env.PB_PASSWORD || randomBytes(12).toString("hex");

const SCHEMA_PATH = join(ROOT, "archive-server", "pocketbase", "pb_schema.json");

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pbFetch(path, options = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function waitForPocketBase(maxMs = 60_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${PB_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// ─── Step 1: Wait ─────────────────────────────────────────────────────────────

step(1, "انتظار PocketBase للاستجابة…");
const alive = await waitForPocketBase();
if (!alive) fail(`PocketBase لم يستجب في الوقت المحدد على ${PB_URL}`);
ok(`PocketBase يعمل على ${PB_URL}`);

// ─── Step 2: Create first admin ───────────────────────────────────────────────

step(2, "إنشاء حساب المسؤول الأول");

// If GET /api/admins returns 401/403, admins already exist — skip creation.
const checkRes = await pbFetch("/api/admins", { method: "GET" });

if (checkRes.status === 401 || checkRes.status === 403) {
  warn("يوجد مسؤول مسبقاً — تخطّي إنشاء الحساب.");
} else {
  // No admins yet — PocketBase allows creating the first one without auth.
  const createRes = await pbFetch("/api/admins", {
    method: "POST",
    body: JSON.stringify({ email: PB_EMAIL, password: PB_PASSWORD, passwordConfirm: PB_PASSWORD }),
  });
  if (!createRes.ok) {
    const msg = createRes.body?.message || createRes.body?.data?.email?.message || "";
    if (/already|exists/i.test(msg)) {
      warn("المسؤول موجود مسبقاً.");
    } else {
      fail(`تعذّر إنشاء المسؤول: ${JSON.stringify(createRes.body)}`);
    }
  } else {
    ok(`تم إنشاء المسؤول: ${PB_EMAIL}`);
    console.log(`  ${YELLOW}كلمة المرور: ${PB_PASSWORD}${RESET}`);
    console.log(`  ${YELLOW}احفظها الآن — لن تظهر مرة أخرى.${RESET}`);
  }
}

// ─── Step 3: Authenticate ─────────────────────────────────────────────────────

step(3, "المصادقة كمسؤول");
const authRes = await pbFetch("/api/admins/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
});
if (!authRes.ok) fail(`فشلت المصادقة: ${JSON.stringify(authRes.body)}`);

const token = authRes.body?.token;
if (!token) fail("لم يُعد رمز المصادقة.");
ok("تمت المصادقة بنجاح.");

// ─── Step 4: Import schema ────────────────────────────────────────────────────

step(4, "استيراد مخطط المجموعات");

let schema;
try {
  schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
} catch (e) {
  fail(`تعذّر قراءة ${SCHEMA_PATH}: ${e.message}`);
}

const importRes = await pbFetch("/api/collections/import", {
  method: "PUT",
  headers: { Authorization: token },
  body: JSON.stringify({ collections: schema, deleteMissing: false }),
});

if (!importRes.ok) {
  fail(`فشل استيراد المخطط (HTTP ${importRes.status}): ${JSON.stringify(importRes.body)}`);
}
ok(`تم استيراد ${schema.length} مجموعة.`);

// ─── Step 5: Verify ───────────────────────────────────────────────────────────

step(5, "التحقق من المجموعات");
const listRes = await pbFetch("/api/collections?perPage=200", {
  headers: { Authorization: token },
});
if (!listRes.ok) {
  warn("تعذّر التحقق من المجموعات — تأكد يدوياً.");
} else {
  const existing = new Set((listRes.body?.items || []).map((c) => c.name));
  const missing = schema.map((c) => c.name).filter((n) => !existing.has(n));
  if (missing.length) {
    warn(`المجموعات التالية قد لا تكون أُنشئت: ${missing.join(", ")}`);
  } else {
    ok("جميع المجموعات متاحة.");
  }
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`\n${BOLD}${GREEN}✅ PocketBase جاهز للاستخدام مع Archive Suite!${RESET}\n`);
console.log(`  ${CYAN}لوحة الإدارة:${RESET} ${PB_URL}/_/`);
console.log(`  ${CYAN}البريد:${RESET}       ${PB_EMAIL}\n`);
