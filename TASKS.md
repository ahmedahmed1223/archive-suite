# مهام Archive Suite — قائمة مُصالَحة من تقارير الفحص

> **المصدر:** 9 تقارير فحص (HTML) في `D:\archiveaq\Reports`.
> **المنهجية:** كل بند في التقارير تم التحقق منه مقابل الكود الفعلي في هذا المستودع. أُبقيت فقط المهام الحقيقية المتبقية؛ والبنود المُنفّذة بالفعل أو غير الدقيقة في التقارير وُثّقت في [القسم 8 (ملحق)](#8-ملحق--بنود-أُسقطت-مُنفّذة-بالفعل-أو-غير-دقيقة-في-التقارير).
> **آخر تحديث:** 7 يونيو 2026.

## مفتاح الأولويات

| الوسم | المعنى | الأفق الزمني |
|---|---|---|
| `[P0]` | حرج — يحجب النشر الإنتاجي الآمن | 1–2 أسبوع |
| `[P1]` | عالٍ — مخاطرة أو فجوة وظيفية مهمة | 2–6 أسابيع |
| `[P2]` | متوسط — تحسين جوهري | 1–2 شهر |
| `[P3]` | مستقبلي — توسّع أو تحسين اختياري | 3–6 أشهر |

**تقدير الجهد:** ⏱️S (<يوم) · ⏱️M (1–3 أيام) · ⏱️L (أسبوع) · ⏱️XL (أسابيع).

---

## 1. الأمان (Security)

- [ ] `[P0]` ⏱️M **إضافة رأس CSP صارم** (`Content-Security-Policy`) — موجود HSTS و`X-Frame-Options` فقط، لا CSP.
  - الملفات: `archive-server/deploy/Caddyfile`، `archive-server/nginx/default.conf`، `archive-server/nginx/postgres.conf`.
  - ابدأ بـ `Content-Security-Policy-Report-Only` ثم فعّله؛ `default-src 'self'`، اضبط `script-src`/`style-src` حسب بناء الـ SPA.
  - المصدر: comprehensive-audit (S5)، dev-proposals (S1).

- [ ] `[P0]` ⏱️S **تشغيل حاويات Docker كمستخدم غير جذر** — لا يوجد `USER node` في أي Dockerfile.
  - الملفات: `archive-server/Dockerfile.server`، `archive-server/Dockerfile.frontend`.
  - أضف `USER node` بعد ضبط ملكية ملفات وقت التشغيل (`.archive-files`، مجلدات الإقلاع).
  - المصدر: comprehensive-audit (S1)، audit-report.

- [ ] `[P1]` ⏱️M **فصل أسرار JWT حسب الغرض** — حاليًا `shareSecret` و`oauthSecret` يرثان `authSecret` افتراضيًا.
  - الملفات: `archive-server/src/api/server.js:207-217`، `archive-server/src/index.js`، `archive-server/.env.example`، `archive-server/src/config/productionGuard.js`.
  - أضف `JWT_AUTH_SECRET` / `JWT_SHARE_SECRET` / `OAUTH_STATE_SECRET` (مع إبقاء التوريث القديم كـ fallback متوافق).
  - المصدر: audit-report، comprehensive-audit (S8).

- [ ] `[P1]` ⏱️M **آلية إبطال JWT (revocation/blacklist)** — لا توجد طريقة لإلغاء توكن قبل انتهائه.
  - الملفات: `archive-server/src/auth/*`، نقطة فحص في `archive-server/src/api/server.js`.
  - قائمة سوداء in-memory (مع TTL) أو Redis، تُفحص في مسار التحقق.
  - المصدر: comprehensive-audit (S2)، audit-report.

- [ ] `[P1]` ⏱️L **سجل تدقيق (Audit Log) للعمليات المدمّرة** — لا يوجد أثر تدقيق لـ `replaceAll`/`delete`/`emptyTrash`/تغيير الصلاحيات.
  - الملفات: store/جدول جديد + اعتراض في `archive-server/src/api/server.js` (dispatcher الـ RPC).
  - سجّل: المستخدم، العملية، الوقت، السجلات المتأثرة. أضف قواعد تنقيح للأسرار.
  - المصدر: backend-db-report، comprehensive-audit (S9).

- [ ] `[P1]` ⏱️M **إبطال روابط المشاركة مبكرًا** — لا يمكن إلغاء رابط مشاركة قبل انتهاء صلاحيته.
  - الملفات: `archive-server/src/share/`، نقطة تقديم الـ snapshot في `server.js`.
  - جدول revocation يُفحص قبل قبول التوكن (موجود بالفعل field-filtering وانتهاء صلاحية — يُبنى فوقهما).
  - المصدر: backend-db-report، comprehensive-audit (S10).

- [ ] `[P1]` ⏱️S **تنقيح الأسرار في السجلات (log redaction)** — مرتبط بمهمة Pino في القسم 2.
  - قواعد `redact`: `req.headers.authorization`، `*.passwordHash`، `*.apiKey`.
  - المصدر: improvement-proposals (BE-5).

- [ ] `[P2]` ⏱️M **تعقيم مدخلات AI ضد prompt injection** — فصل system prompt عن بيانات المستخدم وتطهير المدخلات.
  - الملفات: `archive-server/src/ai/sdkProvider.js`.
  - المصدر: comprehensive-audit (S3)، dev-proposals (AI).

- [ ] `[P2]` ⏱️S **التحقق من `X-Forwarded-For`** قبل الثقة به في تحديد الـ IP (rate limit).
  - الملفات: `archive-server/src/api/rateLimit.js`، `server.js`.
  - استخدم آخر قيمة أو اضبط قائمة proxies موثوقة.
  - المصدر: comprehensive-audit (S7).

- [ ] `[P2]` ⏱️S **فحص ثغرة `xlsx` (CVE-2024-22363 — ReDoS)** — تحقق إن كانت الاعتمادية مستخدمة في الـ frontend، واستبدلها/رقّها.
  - المصدر: audit-report (CRITICAL).

- [ ] `[P3]` ⏱️S **استبدال `crypto-js` بـ Web Crypto API** إن وُجدت (≈150KB لوظيفة SHA-256 واحدة).
  - المصدر: audit-report (MEDIUM).

---

## 2. الخلفية وقاعدة البيانات (Backend & Database)

- [ ] `[P0]` ⏱️L **Pagination (cursor + limit) لـ `getAll`/`snapshot`** — حاليًا تُحمّل كل البيانات دفعة واحدة.
  - الملفات: بروتوكول RPC في `archive-server/src/api/server.js`، adapters للـ Postgres والـ PocketBase، و`StorageProvider` في `archive-core`.
  - المصدر: audit-report، backend-db-report، comprehensive-audit.

- [ ] `[P0]` ⏱️L **معاملات ذرّية لـ `snapshot()`/`replaceAll()`** — غير متّسقة معاملاتيًا، خطر فقدان بيانات.
  - الملفات: Postgres adapter (لفّ في `prisma.$transaction` بعزل `REPEATABLE READ`)؛ PocketBase adapter (إصلاح TOCTOU، أو إلزام Postgres للإنتاج وتقييد PocketBase للتطوير).
  - المصدر: backend-db-report (CRITICAL).

- [ ] `[P1]` ⏱️S **ضبط Connection Pool لـ Prisma** (`max`, `idleTimeoutMillis`).
  - الملفات: تهيئة `PrismaPg` / `prisma.config.mjs`.
  - المصدر: backend-db-report (CRITICAL).

- [ ] `[P1]` ⏱️M **فهارس قاعدة البيانات** — لا فهارس أبعد من المفتاح الأساسي.
  - الملفات: `archive-server/prisma/schema.prisma` + migration جديدة.
  - أضف: `title`, `documentType`, `createdAt`, `isDeleted` (BTREE) + **GIN** على عمود JSONB (`jsonb_path_ops`).
  - المصدر: improvement-proposals (BE-1)، audit-report.

- [ ] `[P1]` ⏱️S **أعمدة `createdAt`/`updatedAt`** (`@default(now())` / `@updatedAt`) + migration.
  - الملفات: `archive-server/prisma/schema.prisma`.
  - المصدر: backend-db-report، audit-report.

- [ ] `[P1]` ⏱️XL **بحث نصّي كامل من الخادم** — حاليًا البحث على العميل فقط (محدود ~5K عنصر).
  - الملفات: نقطة جديدة `GET /api/v1/search?q=&type=&cursor=&limit=` + GIN index.
  - أضف تطبيعًا عربيًا (إزالة التشكيل، توحيد ألف/همزة وياء/ألف مقصورة).
  - المصدر: development-plan (1.1).

- [ ] `[P2]` ⏱️M **`createMany` + chunking** — استبدل `create` المتكرر في `replaceAll` بـ `createMany`؛ قسّم `putBatch` إلى دفعات (1000).
  - الملفات: Postgres adapter.
  - المصدر: backend-db-report.

- [ ] `[P2]` ⏱️S **حد حجم السجل + تحقق per-item** — افتراضي 10MB؛ تحقق من كل عنصر في `putBatch`/`replaceAll`.
  - الملفات: `archive-server/src/api/validate.js`، dispatcher الـ RPC.
  - المصدر: backend-db-report.

- [ ] `[P2]` ⏱️S **كتابة config ذرّية + تسجيل أخطاء الـ parse** — اكتب لملف مؤقت ثم rename؛ لا تبتلع الأخطاء صامتًا.
  - الملفات: `archive-server/src/config/*`، `adminConfig.js`.
  - المصدر: backend-db-report.

- [ ] `[P2]` ⏱️S **`getByUid()` لبحث المستخدم** — استبدل `getAll("users")` عند كل تسجيل دخول ببحث مستهدف.
  - الملفات: `archive-server/src/auth/authService.js`، `StorageProvider`.
  - المصدر: backend-db-report.

- [ ] `[P2]` ⏱️M **API versioning** — بادئة `/api/v1/` مع إبقاء المسارات الحالية كـ aliases ورؤوس `Sunset`/`Link`.
  - الملفات: `archive-server/src/api/server.js`.
  - المصدر: development-plan (1.8)، dev-proposals (S4).

- [ ] `[P2]` ⏱️M **Structured logging (Pino JSON)** بدل `console.log` (مع redaction من القسم 1).
  - الملفات: عبر `archive-server/src/`.
  - المصدر: audit-report، dev-proposals (S3).

- [ ] `[P2]` ⏱️S **Graceful shutdown** — معالج `SIGTERM` مع تصريف الاتصالات (تحقق إن لم يكن موجودًا).
  - الملفات: `archive-server/src/index.js`.
  - المصدر: audit-report.

---

## 3. الواجهة الأمامية (Frontend)

- [ ] `[P0]` ⏱️XL **استبدال ألوان emerald المثبّتة بـ tokens دلالية** — **456 تكرارًا عبر 53 ملفًا** يعطّل منتقي لون الـ accent.
  - الملفات (أمثلة): `archive app/src/components/navigation/Sidebar.jsx`، `components/common/EmptyState.jsx`، `components/forms/TagAutocomplete.jsx`، و50 ملفًا آخر (الصفحات، features، ui).
  - استبدل `bg-emerald-*`/`text-emerald-*` بـ `--va-accent-soft` / `--va-accent-on-soft` / `--va-accent-border`، وأعد تعريفها لكل خيار accent.
  - المصدر: improvement-proposals (UI-2)، comprehensive-audit، uiux-report (CRITICAL).

- [ ] `[P1]` ⏱️M **React Error Boundaries** (مستوى التطبيق + الأقسام) مع واجهة استرداد.
  - الملفات: `archive app/src/App.jsx`، shell الصفحات.
  - المصدر: dev-proposals (S2)، improvement-proposals (FE-4).

- [ ] `[P1]` ⏱️M **Code splitting عبر `React.lazy`** لكل صفحة.
  - الملفات: `archive app/src/app/pageRegistry.js`، `pageManifest.js`.
  - المصدر: audit-report، comprehensive-audit.

- [ ] `[P1]` ⏱️L **إعادة هيكلة `App.jsx` الضخمة** (632 سطرًا، 15+ `useEffect`) إلى وحدات: Provider / Router / Notifications / Sync.
  - الملفات: `archive app/src/App.jsx`.
  - المصدر: improvement-proposals (FE-3)، audit-report.

- [ ] `[P2]` ⏱️L **إعادة هيكلة CSS بـ `@layer`** لإزالة 150+ `!important`.
  - الملفات: `archive app/src/styles/v1-identity.css` … `v4-identity.css`، `app-overrides.css`.
  - طبقات: reset → tokens → components → themes → utilities.
  - المصدر: improvement-proposals (UI-1)، uiux-report (CRITICAL).

- [ ] `[P2]` ⏱️L **PWA** — manifest + service worker + كشف الاتصال + background sync (غير موجودة حاليًا).
  - الملفات: `archive app/` (vite config، public)، storage adapters للـ sync.
  - المصدر: dev-proposals (S6)، audit-report.

- [ ] `[P2]` ⏱️S **مقياس مسافات** (`--va-space-1`..`--va-space-8`: 4→64px) بدل القيم المبعثرة.
  - الملفات: `archive app/src/styles/*`.
  - المصدر: improvement-proposals (UI-4)، comprehensive-audit.

- [ ] `[P2]` ⏱️M **إدارة حالة التحميل** — hook عام + تعطيل الأزرار لمنع الإرسال المزدوج.
  - الملفات: `archive app/src/stores/`، مكوّنات common.
  - المصدر: improvement-proposals (FE-5).

- [ ] `[P3]` ⏱️S **تحليل الحزمة** (esbuild-visualizer) وتقليل الحجم الابتدائي (~3MB حاليًا).
  - الملفات: `archive app/vite.config.js`.
  - المصدر: dev-proposals (P3).

---

## 4. تجربة وواجهة المستخدم (UI/UX & a11y)

- [ ] `[P0]` ⏱️M **تأكيد متدرّج للعمليات المدمّرة** — `emptyTrash`/حذف مشروع/حذف وسوم بلا تأكيد.
  - مستويات: عادي «هل أنت متأكد؟» / كتابة نص تأكيد / عدّاد + نص.
  - الملفات: `archive app/src/components/common/ConfirmDialog.js` ومواضع الاستدعاء.
  - المصدر: improvement-proposals (UX-1)، uiux-report (CRITICAL).

- [ ] `[P1]` ⏱️S **إصلاح تباين accent في V4** — `#064e3b` على خلفية داكنة = 1.8:1 (يفشل WCAG AA).
  - غيّر خلفية الزر إلى `#10b981` (5.6:1).
  - الملفات: `archive app/src/styles/v4-identity.css`.
  - المصدر: improvement-proposals (UI-5)، uiux-report.

- [ ] `[P1]` ⏱️L **DialogManager موحّد** — حاليًا 3 أنظمة حوار غير متوافقة (z-index مختلف، Escape غير متوقّع، تعارض scroll lock).
  - تكديس تلقائي، focus trap للأعلى فقط، scroll lock مرجعي، Escape يغلق الأعلى.
  - الملفات: `archive app/src/components/common/` (ConfirmDialog، EntityFormModal، ForceChangePasswordDialog).
  - المصدر: improvement-proposals (UI-3)، uiux-report.

- [ ] `[P1]` ⏱️M **مسار تنقّل (breadcrumbs) تفاعلي** — حاليًا نص واحد غير قابل للنقر.
  - الملفات: PageContextBar / shell التنقّل.
  - المصدر: improvement-proposals (UX-2).

- [ ] `[P1]` ⏱️M **واجهة تقدّم للعمليات الطويلة** — نسخ احتياطي/تصدير/رفع بلا مؤشر (%، الوقت المتبقي، إلغاء).
  - استخدم `ProgressEvent` لرفع الملفات.
  - المصدر: improvement-proposals (UX-3).

- [ ] `[P1]` ⏱️L **إصلاحات a11y أساسية** — skip link، focus trap في النوافذ، `role`/`aria-label` للأقسام، تسلسل عناوين سليم، `alt` للصور، `aria-live` للمحتوى الديناميكي.
  - الملفات: عبر `archive app/src/components` و`pages` (موجود اختبار Playwright a11y يكشفها).
  - المصدر: uiux-report، improvement-proposals (FE-2).

- [ ] `[P2]` ⏱️M **تنقّل لوحة المفاتيح للقوائم** — أسهم/Enter/Space/Ctrl+A/Delete.
  - المصدر: improvement-proposals (UX-5).

- [ ] `[P2]` ⏱️M **رسائل خطأ مصنّفة وودّية** — شبكة/مصادقة/تحقق/خادم بدل «حدث خطأ غير معروف».
  - المصدر: improvement-proposals (UX-4).

- [ ] `[P2]` ⏱️M **مؤشرات focus مرئية + pagination مرئي للجداول** (يُربط بـ backend pagination في القسم 2).
  - المصدر: uiux-report.

- [ ] `[P3]` ⏱️M **Virtualization لقوائم الموبايل** (>20 عنصرًا) + بنود تجميل منخفضة من تقرير UI/UX (أحجام أيقونات، tooltips، skeletons…).
  - المصدر: uiux-report.

---

## 5. الاختبارات (Testing)

- [ ] `[P1]` ⏱️L **Vitest للوحدات** (app + core + server) — لا توجد اختبارات وحدة حاليًا (يوجد Playwright e2e/a11y فقط).
  - ابدأ بالوحدات الحرجة (auth، storage adapters، stores).
  - المصدر: audit-report، comprehensive-audit، improvement-proposals.

- [ ] `[P1]` ⏱️M **اختبارات تكامل لمعالج RPC** — تغطية الدوال المُصرّح بها في الـ dispatcher.
  - الملفات: `archive-server/src/api/server.js`.
  - المصدر: audit-report.

- [ ] `[P2]` ⏱️M **jest-axe على مستوى المكوّن** — يكمّل اختبار Playwright a11y الموجود (الذي يعمل على مستوى الصفحة).
  - المصدر: improvement-proposals (FE-2).

- [ ] `[P2]` ⏱️M **توسيع تغطية E2E (Playwright)** — حاليًا ملفّا a11y فقط؛ أضف مسارات وظيفية (رفع، بحث، مشاركة).
  - الملفات: `archive app/tests/`.
  - المصدر: audit-report.

- [ ] `[P3]` ⏱️M **Load testing (k6)** + **Lighthouse CI** للأداء وCore Web Vitals.
  - المصدر: comprehensive-audit، audit-report.

---

## 6. DevOps والمراقبة

- [ ] `[P2]` ⏱️M **Sentry لتتبّع الأخطاء** (frontend + backend) — يُربط بـ Error Boundaries في القسم 3.
  - المصدر: dev-proposals، audit-report.

- [ ] `[P2]` ⏱️M **Redis caching** — نتائج بحث، sessions، snapshots المشاركة (TTL 5–60 دقيقة).
  - المصدر: dev-proposals (P4).

- [ ] `[P2]` ⏱️S **Docker multi-stage build + `.dockerignore`** لتقليل حجم الصورة.
  - الملفات: `archive-server/Dockerfile.server`، `Dockerfile.frontend`.
  - المصدر: audit-report.

- [ ] `[P2]` ⏱️M **نسخ احتياطي مجدول من الخادم** — استبقاء (7 يومي / 4 أسبوعي / 3 شهري) + رفع تلقائي + واجهة إدارة.
  - الملفات: `archive-server/deploy/backup-cron.sh` (موجود — يُبنى فوقه)، نقاط `POST /api/admin/backup/schedule`، `GET /api/admin/backup/list`.
  - المصدر: development-plan (1.4)، arabic-report.

- [ ] `[P3]` ⏱️L **Prometheus + Grafana + تنبيهات** و**Helm chart** لـ Kubernetes.
  - المصدر: dev-proposals (Infra1)، comprehensive-audit، arabic-report.

---

## 7. تطوير ميزات (Feature Development)

- [ ] `[P1]` ⏱️XL **دعم أنواع مستندات متعددة** — حاليًا فيديو فقط. أضف PDF/صور/مستندات مع pdf.js + OCR.
  - حقول schema: `documentType`, `mimeType`, `pageCount`, `ocrText`.
  - المصدر: development-plan (1.3).

- [ ] `[P1]` ⏱️L **استعادة كلمة المرور + بريد** — nodemailer/SMTP، رمز 15 دقيقة، rate limit (3/ساعة).
  - نقاط: `POST /api/auth/forgot-password`، `POST /api/auth/reset-password`.
  - المصدر: development-plan (1.5).

- [ ] `[P1]` ⏱️L **مصادقة ثنائية (2FA — TOTP)** + رموز استرداد، إلزامية للمشرفين، «تذكّر هذا الجهاز» 30 يومًا.
  - المصدر: development-plan (1.7).

- [ ] `[P2]` ⏱️L **وسم تلقائي عند الرفع** — تصنيف AI قابل للقبول/الرفض (يستفيد من تكامل AI الموجود).
  - المصدر: dev-proposals (AI1).

- [ ] `[P2]` ⏱️XL **بحث دلالي** — embeddings + pgvector في PostgreSQL.
  - المصدر: dev-proposals (AI2).

- [ ] `[P2]` ⏱️XL **تعاون لحظي** — WebSocket presence + كشف تعارض التحرير (حاليًا SSE/polling).
  - المصدر: dev-proposals (C1)، development-plan (Phase 3).

- [ ] `[P2]` ⏱️L **خط معالجة الصور** — Sharp: WebP، صور مصغّرة، srcset (تقليل 60–70%).
  - المصدر: dev-proposals (P1).

- [ ] `[P3]` ⏱️L **i18n متعدد اللغات** — مكتبة i18next بدل العربي المثبّت في السلاسل.
  - المصدر: dev-proposals (AI4).

- [ ] `[P3]` ⏱️XL **تطوّر schema مُنمّط** — جداول typed (users, archive_items, content_types) بدل الصف العام JSONB، مع طبقة تجريد للتوافق العكسي.
  - المصدر: development-plan (1.6).

---

## 8. ملحق — بنود أُسقطت (مُنفّذة بالفعل أو غير دقيقة في التقارير)

البنود التالية وردت في التقارير لكنها **موجودة فعلًا في الكود** أو **غير دقيقة**؛ لذا لم تُحوّل إلى مهام:

| ادّعاء التقرير | الواقع | المرجع |
|---|---|---|
| مقارنة كلمة المرور غير timing-safe (CRITICAL) | يُستخدم `bcrypt.compare` للهاش و`timingSafeEqual` للـ JWT | `archive-server/src/auth/authService.js:25`, `auth/jwt.js:72` |
| لا يوجد مسار ترقية SHA-256 → bcrypt | موجود؛ الـ SPA يرقّي عند أول تسجيل دخول محلي ناجح | `archive-server/src/auth/authService.js:19-21` |
| غياب pnpm workspace | موجود | `pnpm-workspace.yaml` |
| غياب `.env.example` | موجود وشامل (~6KB) | `archive-server/.env.example` |
| غياب Docker / docker-compose | موجود (server + frontend + Caddy + متغيرات Postgres) | `archive-server/Dockerfile.*`, `docker-compose*.yml` |
| غياب CI/CD (GitHub Actions) | موجود لكل حزمة | `*/.github/workflows/ci.yml`, `playwright.yml`, `deploy-pages.yml` |
| غياب Rate Limiting | موجود (login 10/min، rpc 600/min، نافذة منزلقة) | `archive-server/src/api/rateLimit.js` |
| غياب Input Validation | موجود (validator مخصص: أسماء stores، أشكال السجلات، حد 256MB) | `archive-server/src/api/validate.js` |
| غياب Health Check | موجود `GET /api/health` | `archive-server/src/api/server.js` |
| غياب اختبارات a11y | موجود Playwright + `@axe-core/playwright` | `archive app/tests/a11y.spec.ts`, `a11y.v4-contrast.spec.ts` |
| غياب Security Headers كليًا | HSTS + X-Frame-Options موجودان (CSP فقط ناقص — مهمة حيّة) | `archive-server/deploy/Caddyfile`, `nginx/*.conf` |
| غياب fallback لمزودي AI | موجود تعدد مزودين (OpenAI/Anthropic/Google/Groq/Mistral/OpenRouter/Ollama) مع fallback | `archive-server/src/ai/sdkProvider.js` |
| التخزين يحتاج تشفير/presigned | 5 مزودين (Disk/S3/Azure/GDrive/Dropbox) مع presigned URLs — الاعتماد لا يصل للمتصفح | `archive-server/src/adapters/files-*` |
| روابط المشاركة بلا حماية | JWT مستقل + field-filtering + انتهاء صلاحية (الإبطال المبكر فقط مهمة حيّة) | `archive-server/src/share/` |
| غياب حارس أسرار للإنتاج | موجود `productionGuard` يفرض `JWT_SECRET` عند النشر العام | `archive-server/src/config/productionGuard.js` |
| غياب نسخ احتياطي | سكربت cron موجود (الجدولة/الواجهة فقط مهمة حيّة) | `archive-server/deploy/backup-cron.sh` |

**ملاحظة:** التقارير افترضت بدائل تقنية «مفقودة» (Express، React Router، Zustand، TanStack Query) بينما المشروع يستخدم بدائل مقصودة (Node http مخصص، page manifest، store مخصص، HTTP adapter). هذه اختيارات معمارية وليست فجوات.
