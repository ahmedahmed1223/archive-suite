/**
 * Terminal-wizard i18n (§19.6).
 *
 * The deployment wizard used to print Arabic directly, which renders broken in
 * many terminals (reversed RTL, mojibake, misaligned columns on Windows
 * Console / PowerShell and some SSH terminals). This module makes **English the
 * default** and Arabic an explicit opt-in, so the wizard is readable everywhere.
 *
 * Language resolution order (first match wins):
 *   1. --lang=<en|ar> CLI flag
 *   2. ARCHIVE_WIZARD_LANG env var
 *   3. default: "en"
 * (An interactive first-prompt can additionally switch to Arabic — see
 *  promptLanguage in the wizard.)
 *
 * Messages are keyed; values are either a string or a function(params) for
 * interpolation. Every key MUST provide an English value; Arabic is optional
 * and falls back to English when missing.
 */

const SUPPORTED = ["en", "ar"];

export function resolveWizardLang(argv = process.argv.slice(2), env = process.env) {
  const flag = argv.find((a) => a.startsWith("--lang="));
  const fromFlag = flag ? flag.slice("--lang=".length) : null;
  const raw = String(fromFlag || env.ARCHIVE_WIZARD_LANG || "en").toLowerCase().trim();
  if (raw.startsWith("ar") || raw === "ع" || raw === "عربية") return "ar";
  return SUPPORTED.includes(raw) ? raw : "en";
}

export function hasExplicitLang(argv = process.argv.slice(2), env = process.env) {
  return argv.some((a) => a.startsWith("--lang=")) || Boolean(env.ARCHIVE_WIZARD_LANG);
}

// ─── Message catalogue ──────────────────────────────────────────────────────
export const MESSAGES = {
  // language picker (always ASCII-safe)
  langPrompt: { en: "Language / اللغة — [E]nglish (default) / [A]rabic", ar: "Language / اللغة — [E]nglish (default) / [A]rabic" },

  bannerTitle: { en: "Archive Suite — Production Deployment Wizard", ar: "Archive Suite — معالج النشر الإنتاجي" },

  // steps
  step1: { en: "Environment check", ar: "فحص البيئة" },
  step2: { en: "Access mode", ar: "وضع الوصول" },
  step3: { en: "Admin account & secrets", ar: "حساب المشرف والأسرار" },
  step4: { en: "Generate strong secrets", ar: "توليد الأسرار القوية" },
  step5: { en: "Optional integrations", ar: "تكاملات اختيارية" },
  step6: { en: "Write environment file", ar: "كتابة ملف البيئة" },
  step7: { en: "Readiness gate", ar: "بوابة الجاهزية" },
  step8: { en: "Bring up the stack", ar: "تشغيل الحزمة" },
  step9: { en: "Wait for readiness (migrations + admin seed run automatically)", ar: "انتظار جاهزية النظام (ترحيلات + بذر المشرف تلقائياً)" },

  // environment detection
  osLabel: { en: ({ os }) => `Operating system: ${os}`, ar: ({ os }) => `نظام التشغيل: ${os}` },
  nodeTooOld: { en: ({ version }) => `Node.js 22.12+ required. Current: ${version} — download from https://nodejs.org`, ar: ({ version }) => `يتطلب Node.js 22.12 أو أحدث. الحالي: ${version} — حمّل من https://nodejs.org` },
  dockerRunning: { en: "Docker is running", ar: "Docker يعمل" },
  dockerMissing: { en: "Docker is not installed or not running.", ar: "Docker غير مثبّت أو لا يعمل." },
  dockerHintWin: { en: "  Start Docker Desktop then retry: https://docs.docker.com/desktop/install/windows-install/", ar: "  شغّل Docker Desktop ثم أعد المحاولة: https://docs.docker.com/desktop/install/windows-install/" },
  dockerHintMac: { en: "  Start Docker Desktop: https://docs.docker.com/desktop/install/mac-install/", ar: "  شغّل Docker Desktop: https://docs.docker.com/desktop/install/mac-install/" },
  dockerHintLinux: { en: "  Install/start Docker Engine: https://docs.docker.com/engine/install/", ar: "  ثبّت/شغّل Docker Engine: https://docs.docker.com/engine/install/" },
  composeAvailable: { en: "Docker Compose available", ar: "Docker Compose متاح" },
  composeMissing: { en: "Docker Compose (v2 plugin) not available. Update Docker.", ar: "Docker Compose (v2 plugin) غير متاح. حدّث Docker." },

  // access mode
  promptDomain: { en: "Domain (DOMAIN)", ar: "النطاق (DOMAIN)" },
  promptAcmeEmail: { en: "ACME email (for certificate renewal)", ar: "بريد ACME (لتجديد الشهادة)" },
  publicMode: { en: ({ domain }) => `Public mode: https://${domain}`, ar: ({ domain }) => `وضع عام: https://${domain}` },
  internalMode: { en: "Internal mode: http://SERVER_IP:8080", ar: "وضع داخلي: http://SERVER_IP:8080" },
  accessOption1: { en: "1) internal (intranet) — LAN access on port 8080, no domain/HTTPS", ar: "1) داخلي (intranet) — وصول عبر الشبكة المحلية على المنفذ 8080، بلا نطاق/HTTPS" },
  accessOption2: { en: "2) public — real domain + automatic HTTPS (Let's Encrypt via Caddy)", ar: "2) عام (public) — نطاق حقيقي + HTTPS تلقائي (Let's Encrypt عبر Caddy)" },
  promptChoose: { en: "Choose", ar: "اختر" },
  promptDomainDns: { en: "Domain (DOMAIN) — DNS must point to it", ar: "النطاق (DOMAIN) — يجب أن يشير DNS إليه" },
  promptAcmeAlerts: { en: "ACME email (certificate renewal alerts)", ar: "بريد ACME (تنبيهات تجديد الشهادة)" },
  dnsReadyQuestion: { en: ({ domain }) => `Does DNS for ${domain} already point to this server?`, ar: ({ domain }) => `هل يشير سجل DNS لـ ${domain} إلى هذا الخادم بالفعل؟` },
  dnsWarning: { en: "Without correct DNS, Let's Encrypt won't issue a certificate. You can continue and fix DNS later.", ar: "بدون DNS صحيح لن تُصدَر شهادة Let's Encrypt. يمكنك المتابعة وإصلاح DNS لاحقاً." },
  internalChosen: { en: "Internal mode selected", ar: "وضع داخلي مُختار" },

  // prompts
  autoGenerateHint: { en: "Enter = auto-generate", ar: "Enter = توليد تلقائي" },

  // configureEnv
  reuseEnv: { en: "Existing .env found — keep it and fill only what's missing?", ar: "وُجد .env سابق — الإبقاء عليه وتعبئة الناقص فقط؟" },
  backupWritten: { en: ({ path }) => `Backup: ${path}`, ar: ({ path }) => `نسخة احتياطية: ${path}` },
  promptAdminUser: { en: "Admin username", ar: "اسم المشرف (username)" },
  promptAdminEmail: { en: "Admin email", ar: "بريد المشرف" },
  promptAdminPass: { en: "Admin password", ar: "كلمة مرور المشرف" },
  secretsReady: { en: "Secrets ready (POSTGRES/REDIS/JWT/PGADMIN/GRAFANA/BACKUP)", ar: "الأسرار جاهزة (POSTGRES/REDIS/JWT/PGADMIN/GRAFANA/BACKUP)" },
  smtpQuestion: { en: "Configure email (SMTP) for password reset now?", ar: "إعداد البريد (SMTP) لإعادة تعيين كلمة المرور الآن؟" },
  promptSmtpUser: { en: "SMTP User (your email)", ar: "SMTP User (بريدك)" },
  smtpConfigured: { en: "SMTP configured", ar: "SMTP مضبوط" },
  smtpSkipped: { en: "Skipping SMTP (reset links will be printed to the server log).", ar: "تخطّي SMTP (روابط إعادة التعيين ستُطبع في سجل الخادم)." },
  aiQuestion: { en: "Enable an AI provider now?", ar: "تفعيل مزوّد ذكاء اصطناعي (AI) الآن؟" },
  aiConfigured: { en: "AI configured", ar: "AI مضبوط" },
  aiSkipped: { en: "Skipping AI (can be enabled later from admin settings).", ar: "تخطّي AI (يمكن تفعيله لاحقاً من إعدادات الإدارة)." },
  changeMeLeft: { en: "Unset CHANGE_ME values remain:", ar: "بقيت قيم CHANGE_ME غير مضبوطة:" },
  envWritten: { en: ({ path, reused }) => `${path} ${reused ? "(updated)" : "(new)"}`, ar: ({ path, reused }) => `${path} ${reused ? "(محدّث)" : "(جديد)"}` },

  // readiness gate
  gateSkippedFlag: { en: "Gate skipped (--skip-gate).", ar: "تم تخطّي البوابة (--skip-gate)." },
  gateQuestion: { en: "Run the security baseline check (pnpm security:baseline)?", ar: "تشغيل فحص الأساس الأمني (pnpm security:baseline)؟" },
  gateSkipped: { en: "Skipping the gate.", ar: "تخطّي البوابة." },
  gateFailed: { en: "Security baseline failed — review the output above.", ar: "فشل فحص الأساس الأمني — راجع المخرجات أعلاه." },
  continueAnyway: { en: "Continue anyway?", ar: "المتابعة رغم ذلك؟" },
  gateOk: { en: "Security baseline OK", ar: "الأساس الأمني سليم" },

  // bring up
  composeExit: { en: ({ code }) => `docker compose exited with code ${code}`, ar: ({ code }) => `docker compose خرج بالرمز ${code}` },
  containersUp: { en: "Containers are running", ar: "الحاويات تعمل" },
  controlStopping: { en: "Stopping the stack...", ar: "إيقاف الحزمة..." },
  containersStopped: { en: "Containers stopped", ar: "تم إيقاف الحاويات" },

  // post-deploy controls
  controlTitle: { en: "Runtime controls", ar: "التحكم في التشغيل" },
  controlOpen: { en: "  1) Open the app in the browser", ar: "  1) فتح التطبيق في المتصفح" },
  controlStop: { en: "  2) Stop the system now", ar: "  2) إيقاف النظام الآن" },
  controlRestart: { en: "  3) Restart the system", ar: "  3) إعادة تشغيل النظام" },
  controlExit: { en: "  4) Exit this wizard and leave the system running", ar: "  4) الخروج من المعالج وترك النظام يعمل" },
  controlPrompt: { en: "Choose an action", ar: "اختر إجراء" },
  controlStoppedHint: { en: ({ cmd }) => `System is stopped. To start it again later: ${cmd}`, ar: ({ cmd }) => `تم إيقاف النظام. لتشغيله لاحقاً: ${cmd}` },
  controlLeavingRunning: { en: "Leaving the system running. You can close this window.", ar: "سيبقى النظام يعمل. يمكنك إغلاق هذه النافذة." },

  // health
  waiting: { en: "Waiting", ar: "انتظار" },
  systemReady: { en: "System ready at http://localhost:8080", ar: "النظام جاهز على http://localhost:8080" },
  serverHealthy: { en: "Server service healthy", ar: "خدمة الخادم سليمة" },
  healthTimeout: { en: "Health check did not pass within the timeout. Check logs: docker compose logs server", ar: "لم يجتَز فحص الصحة ضمن المهلة. افحص السجلات: docker compose logs server" },

  // summary
  deployDone: { en: "✓ Deployment complete!", ar: "✓ اكتمل النشر!" },
  appUrlInternal: { en: "http://localhost:8080 (or http://SERVER_IP:8080)", ar: "http://localhost:8080 (أو http://SERVER_IP:8080)" },
  labelApp: { en: "App:", ar: "التطبيق:" },
  labelLogin: { en: "Login:", ar: "تسجيل الدخول:" },
  saveNow: { en: "(save it now — won't be shown again)", ar: "(احفظها الآن — لن تُعرض ثانية)" },
  labelPgAdmin: { en: "SQL admin (pgAdmin):", ar: "إدارة SQL (pgAdmin):" },
  pgAdminLocalOnly: { en: "(local only — use an SSH tunnel for remote access)", ar: "(محلي فقط — للوصول البعيد استخدم نفق SSH)" },
  postgresDirect: { en: "Postgres direct (DBeaver…): host=localhost port=15432 db=archive", ar: "Postgres مباشرة (DBeaver…): host=localhost port=15432 db=archive" },
  labelGrafana: { en: "Grafana:", ar: "Grafana:" },
  localOnly: { en: "(local only)", ar: "(محلي فقط)" },
  nextSteps: { en: "Next steps:", ar: "الخطوات التالية:" },
  nextInstallPwa: { en: "  • Install the app as a PWA from the browser (standalone window).", ar: "  • ثبّت التطبيق كـ PWA من المتصفح (نافذة مستقلة)." },
  nextGoPublic: { en: "  • To go public later: rerun the wizard in \"public\" mode with a domain + DNS.", ar: "  • للتحويل للعام لاحقاً: أعد تشغيل المعالج بوضع \"عام\" مع نطاق + DNS." },
  nextStop: { en: ({ cmd }) => `  • Stop: ${cmd}`, ar: ({ cmd }) => `  • الإيقاف: ${cmd}` },
  nextBackup: { en: "  • Encrypted backup is enabled — see BACKUP_DIR.", ar: "  • النسخ الاحتياطي مُفعّل (مشفّر) — راجع BACKUP_DIR." },

  // main
  envOnlyDone: { en: ({ path }) => `Created/updated ${path} only (--env-only). Bring the stack up later via docker compose up.`, ar: ({ path }) => `تم إنشاء/تحديث ${path} فقط (--env-only). ارفع الحزمة لاحقاً عبر docker compose up.` },
  liteQuestion: { en: "Resource-constrained machine? Run the lite stack (no OCR/Whisper/monitoring)?", ar: "جهاز محدود الموارد؟ تشغيل النسخة الخفيفة (بلا OCR/Whisper/مراقبة)؟" },
  goUpQuestion: { en: "Bring up the stack now?", ar: "تشغيل الحزمة الآن؟" },
  envOnlyManual: { en: "Configured .env only. Run later via docker compose up.", ar: "تم إعداد .env فقط. شغّل لاحقاً عبر docker compose up." },

  // ── scripts/setup.mjs (interactive dev/prod setup) ──
  setupBanner: { en: "Archive Suite — Setup Wizard", ar: "Archive Suite — معالج التثبيت" },
  setupIntro: { en: "This wizard will guide you step by step to run the system.", ar: "هذا المعالج سيُرشدك خطوة بخطوة لتشغيل النظام." },
  setupStep1: { en: "Check Node.js version", ar: "فحص إصدار Node.js" },
  nodeDownload: { en: "Download Node.js from: https://nodejs.org", ar: "قم بتحميل Node.js من: https://nodejs.org" },
  setupStep2: { en: "Check Docker", ar: "فحص Docker" },
  dockerInstalled: { en: "Docker installed", ar: "Docker مثبّت" },
  dockerNotInstalled: { en: "Docker not installed", ar: "Docker غير مثبّت" },
  composeInstalled: { en: "Docker Compose installed", ar: "Docker Compose مثبّت" },
  composeNotInstalled: { en: "Docker Compose not installed", ar: "Docker Compose غير مثبّت" },
  toInstallDocker: { en: "To install Docker:", ar: "لتثبيت Docker:" },
  afterInstallRerun: { en: "After installing, restart the terminal then run this script again.", ar: "بعد التثبيت أعد تشغيل الطرفية ثم شغّل هذا السكريبت مرة أخرى." },
  dockerDoneContinue: { en: "Have you finished installing Docker and want to continue?", ar: "هل أكملت تثبيت Docker وتريد الاستمرار؟" },
  finished: { en: "Finished.", ar: "تم الإنهاء." },
  dockerReady: { en: "Docker ready", ar: "Docker جاهز" },
  dockerNotDetected: { en: "Docker not detected. Reinstall and try again.", ar: "لم يُكتشف Docker. أعد التثبيت وحاول مجدداً." },
  setupStep3: { en: "Choose run mode", ar: "اختيار وضع التشغيل" },
  modeDev: { en: "1) Development — PocketBase (lightweight, no external DB)", ar: "1) وضع التطوير — PocketBase (خفيف، بدون قاعدة بيانات خارجية)" },
  modeProd: { en: "2) Production — PostgreSQL + Caddy (recommended for deployment)", ar: "2) وضع الإنتاج — PostgreSQL + Caddy (موصى به للنشر)" },
  setupStep4: { en: "Configure environment (.env)", ar: "إعداد متغيرات البيئة (.env)" },
  enterSettings: { en: "Enter system settings (press Enter to accept the default):", ar: "أدخل إعدادات النظام (اضغط Enter لقبول القيمة الافتراضية):" },
  promptPort: { en: "Server port", ar: "منفذ الخادم" },
  promptSmtpFrom: { en: "From address", ar: "From address" },
  envCreated: { en: ({ path }) => `.env created at ${path}`, ar: ({ path }) => `.env تم إنشاؤه في ${path}` },
  setupStep5: { en: "Start Docker containers", ar: "تشغيل حاويات Docker" },
  composeNotFound: { en: ({ path }) => `docker-compose file not found at: ${path}`, ar: ({ path }) => `لم يُعثر على ملف docker-compose في: ${path}` },
  setupStep6: { en: "Wait for readiness", ar: "انتظار جاهزية النظام" },
  setupStep7: { en: "Open browser", ar: "فتح المتصفح" },
  browserOpened: { en: ({ url }) => `Opened ${url}`, ar: ({ url }) => `تم فتح ${url}` },
  openManually: { en: ({ url }) => `Open the browser manually at: ${url}`, ar: ({ url }) => `افتح المتصفح يدوياً على: ${url}` },
  startContainersQuestion: { en: "Start the containers now?", ar: "هل تريد تشغيل الحاويات الآن؟" },
  pbInitStep: { en: "Auto-initialize PocketBase schema", ar: "تهيئة مخطط PocketBase تلقائياً" },
  pbInitFailed: { en: "Could not auto-init PocketBase — run manually: node scripts/pb-init.mjs", ar: "تعذّر تهيئة PocketBase تلقائياً — شغّل يدوياً: node scripts/pb-init.mjs" },
  pbInitHint: { en: ({ url }) => `To auto-init PocketBase: node scripts/pb-init.mjs --url=${url}`, ar: ({ url }) => `لتهيئة PocketBase تلقائياً: node scripts/pb-init.mjs --url=${url}` },
  systemReadyAt: { en: ({ url }) => `System ready at ${url}`, ar: ({ url }) => `النظام جاهز على ${url}` },
  healthTimeoutSetup: { en: "System did not respond within the timeout. Check: docker compose logs", ar: "لم يستجب النظام خلال المهلة المحددة. تحقق من: docker compose logs" },
  setupDone: { en: "✓ Setup complete!", ar: "✓ اكتمل الإعداد!" },
  labelServer: { en: ({ url }) => `Server: ${url}`, ar: ({ url }) => `الخادم: ${url}` },
  labelDocs: { en: "Docs: INSTALL.md", ar: "المستندات: INSTALL.md" },
  labelStop: { en: "Stop: docker compose down", ar: "الوقف: docker compose down" }
};

export function createTranslator(lang = "en") {
  const useLang = SUPPORTED.includes(lang) ? lang : "en";
  return (key, params = {}) => {
    const entry = MESSAGES[key];
    if (!entry) return key;
    const value = entry[useLang] ?? entry.en ?? key;
    return typeof value === "function" ? value(params) : value;
  };
}
