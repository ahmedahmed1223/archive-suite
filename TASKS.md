# مهام Archive Suite — قائمة مُصالَحة من تقارير الفحص

> **المصدر:** 9 تقارير فحص (HTML) في `D:\archiveaq\Reports`.
> **المنهجية:** كل بند في التقارير تم التحقق منه مقابل الكود الفعلي في هذا المستودع. أُبقيت فقط المهام الحقيقية المتبقية؛ والبنود المُنفّذة بالفعل أو غير الدقيقة في التقارير وُثّقت في [القسم 8 (ملحق)](#8-ملحق--بنود-أُسقطت-مُنفّذة-بالفعل-أو-غير-دقيقة-في-التقارير).
> **آخر تحديث:** 8 يونيو 2026. Tasks #74–#78 (P0 security + K8s + frontend bugs) مكتملة. Task #79 (P1 UX) قيد التنفيذ.

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

- [x] `[P0]` ⏱️M **إضافة رأس CSP صارم** (`Content-Security-Policy`) — موجود HSTS و`X-Frame-Options` فقط، لا CSP.
  - الملفات: `archive-server/deploy/Caddyfile`، `archive-server/nginx/default.conf`، `archive-server/nginx/postgres.conf`.
  - ابدأ بـ `Content-Security-Policy-Report-Only` ثم فعّله؛ `default-src 'self'`، اضبط `script-src`/`style-src` حسب بناء الـ SPA.
  - المصدر: comprehensive-audit (S5)، dev-proposals (S1).

- [x] `[P0]` ⏱️S **تشغيل حاويات Docker كمستخدم غير جذر** — لا يوجد `USER node` في أي Dockerfile.
  - الملفات: `archive-server/Dockerfile.server`، `archive-server/Dockerfile.frontend`.
  - أضف `USER node` بعد ضبط ملكية ملفات وقت التشغيل (`.archive-files`، مجلدات الإقلاع).
  - المصدر: comprehensive-audit (S1)، audit-report.

- [x] `[P1]` ⏱️M **فصل أسرار JWT حسب الغرض** — حاليًا `shareSecret` و`oauthSecret` يرثان `authSecret` افتراضيًا.
  - الملفات: `archive-server/src/api/server.js:207-217`، `archive-server/src/index.js`، `archive-server/.env.example`، `archive-server/src/config/productionGuard.js`.
  - أضف `JWT_AUTH_SECRET` / `JWT_SHARE_SECRET` / `OAUTH_STATE_SECRET` (مع إبقاء التوريث القديم كـ fallback متوافق).
  - المصدر: audit-report، comprehensive-audit (S8).

- [x] `[P1]` ⏱️M **آلية إبطال JWT (revocation/blacklist)** — لا توجد طريقة لإلغاء توكن قبل انتهائه.
  - الملفات: `archive-server/src/auth/*`، نقطة فحص في `archive-server/src/api/server.js`.
  - قائمة سوداء in-memory (مع TTL) أو Redis، تُفحص في مسار التحقق.
  - المصدر: comprehensive-audit (S2)، audit-report.

- [x] `[P1]` ⏱️L **سجل تدقيق (Audit Log) للعمليات المدمّرة** — لا يوجد أثر تدقيق لـ `replaceAll`/`delete`/`emptyTrash`/تغيير الصلاحيات.
  - الملفات: store/جدول جديد + اعتراض في `archive-server/src/api/server.js` (dispatcher الـ RPC).
  - سجّل: المستخدم، العملية، الوقت، السجلات المتأثرة. أضف قواعد تنقيح للأسرار.
  - المصدر: backend-db-report، comprehensive-audit (S9).

- [x] `[P1]` ⏱️M **إبطال روابط المشاركة مبكرًا** — لا يمكن إلغاء رابط مشاركة قبل انتهاء صلاحيته.
  - الملفات: `archive-server/src/share/`، نقطة تقديم الـ snapshot في `server.js`.
  - جدول revocation يُفحص قبل قبول التوكن (موجود بالفعل field-filtering وانتهاء صلاحية — يُبنى فوقهما).
  - المصدر: backend-db-report، comprehensive-audit (S10).

- [x] `[P1]` ⏱️S **تنقيح الأسرار في السجلات (log redaction)** — مرتبط بمهمة Pino في القسم 2.
  - قواعد `redact`: `req.headers.authorization`، `*.passwordHash`، `*.apiKey`.
  - المصدر: improvement-proposals (BE-5).

- [x] `[P2]` ⏱️M **تعقيم مدخلات AI ضد prompt injection** — فصل system prompt عن بيانات المستخدم وتطهير المدخلات.
  - الملفات: `archive-server/src/ai/sdkProvider.js`.
  - المصدر: comprehensive-audit (S3)، dev-proposals (AI).

- [x] `[P2]` ⏱️S **التحقق من `X-Forwarded-For`** قبل الثقة به في تحديد الـ IP (rate limit).
  - الملفات: `archive-server/src/api/rateLimit.js`، `server.js`.
  - استخدم آخر قيمة أو اضبط قائمة proxies موثوقة.
  - المصدر: comprehensive-audit (S7).

- [ ] `[P2]` ⏱️S **فحص ثغرة `xlsx` (CVE-2024-22363 — ReDoS)** — تحقق إن كانت الاعتمادية مستخدمة في الـ frontend، واستبدلها/رقّها.
  - المصدر: audit-report (CRITICAL).

- [x] `[P3]` ⏱️S **استبدال `crypto-js` بـ Web Crypto API** إن وُجدت (≈150KB لوظيفة SHA-256 واحدة).
  - المصدر: audit-report (MEDIUM).

---

## 2. الخلفية وقاعدة البيانات (Backend & Database)

- [x] `[P0]` ⏱️L **Pagination (cursor + limit) لـ `getAll`/`snapshot`** — حاليًا تُحمّل كل البيانات دفعة واحدة.
  - الملفات: بروتوكول RPC في `archive-server/src/api/server.js`، adapters للـ Postgres والـ PocketBase، و`StorageProvider` في `archive-core`.
  - المصدر: audit-report، backend-db-report، comprehensive-audit.

- [x] `[P0]` ⏱️L **معاملات ذرّية لـ `snapshot()`/`replaceAll()`** — غير متّسقة معاملاتيًا، خطر فقدان بيانات.
  - الملفات: Postgres adapter (لفّ في `prisma.$transaction` بعزل `REPEATABLE READ`)؛ PocketBase adapter (إصلاح TOCTOU، أو إلزام Postgres للإنتاج وتقييد PocketBase للتطوير).
  - المصدر: backend-db-report (CRITICAL).

- [x] `[P1]` ⏱️S **ضبط Connection Pool لـ Prisma** (`max`, `idleTimeoutMillis`).
  - الملفات: تهيئة `PrismaPg` / `prisma.config.mjs`.
  - المصدر: backend-db-report (CRITICAL).

- [x] `[P1]` ⏱️M **فهارس قاعدة البيانات** — لا فهارس أبعد من المفتاح الأساسي.
  - الملفات: `archive-server/prisma/schema.prisma` + migration جديدة.
  - أضف: `title`, `documentType`, `createdAt`, `isDeleted` (BTREE) + **GIN** على عمود JSONB (`jsonb_path_ops`).
  - المصدر: improvement-proposals (BE-1)، audit-report.

- [x] `[P1]` ⏱️S **أعمدة `createdAt`/`updatedAt`** (`@default(now())` / `@updatedAt`) + migration.
  - الملفات: `archive-server/prisma/schema.prisma`.
  - المصدر: backend-db-report، audit-report.

- [x] `[P1]` ⏱️XL **بحث نصّي كامل من الخادم** — حاليًا البحث على العميل فقط (محدود ~5K عنصر).
  - الملفات: نقطة جديدة `GET /api/v1/search?q=&type=&cursor=&limit=` + GIN index.
  - أضف تطبيعًا عربيًا (إزالة التشكيل، توحيد ألف/همزة وياء/ألف مقصورة).
  - المصدر: development-plan (1.1).

- [x] `[P2]` ⏱️M **`createMany` + chunking** — استبدل `create` المتكرر في `replaceAll` بـ `createMany`؛ قسّم `putBatch` إلى دفعات (1000).
  - الملفات: Postgres adapter.
  - المصدر: backend-db-report.

- [x] `[P2]` ⏱️S **حد حجم السجل + تحقق per-item** — افتراضي 10MB؛ تحقق من كل عنصر في `putBatch`/`replaceAll`.
  - الملفات: `archive-server/src/api/validate.js`، dispatcher الـ RPC.
  - المصدر: backend-db-report.

- [x] `[P2]` ⏱️S **كتابة config ذرّية + تسجيل أخطاء الـ parse** — اكتب لملف مؤقت ثم rename؛ لا تبتلع الأخطاء صامتًا.
  - الملفات: `archive-server/src/config/*`، `adminConfig.js`.
  - المصدر: backend-db-report.

- [ ] `[P2]` ⏱️S **`getByUid()` لبحث المستخدم** — استبدل `getAll("users")` عند كل تسجيل دخول ببحث مستهدف.
  - الملفات: `archive-server/src/auth/authService.js`، `StorageProvider`.
  - المصدر: backend-db-report.

- [x] `[P2]` ⏱️M **API versioning** — بادئة `/api/v1/` مع إبقاء المسارات الحالية كـ aliases ورؤوس `Sunset`/`Link`.
  - الملفات: `archive-server/src/api/server.js`.
  - المصدر: development-plan (1.8)، dev-proposals (S4).

- [x] `[P2]` ⏱️M **Structured logging (Pino JSON)** بدل `console.log` (مع redaction من القسم 1).
  - الملفات: عبر `archive-server/src/`.
  - المصدر: audit-report، dev-proposals (S3).

- [x] `[P2]` ⏱️S **Graceful shutdown** — معالج `SIGTERM` مع تصريف الاتصالات (تحقق إن لم يكن موجودًا).
  - الملفات: `archive-server/src/index.js`.
  - المصدر: audit-report.

---

## 3. الواجهة الأمامية (Frontend)

- [x] `[P0]` ⏱️XL **استبدال ألوان emerald المثبّتة بـ tokens دلالية** — **406 تكرارًا عبر 50 ملفًا** يعطّل منتقي لون الـ accent.
  - الملفات (أمثلة): `archive app/src/components/navigation/Sidebar.jsx`، `components/common/EmptyState.jsx`، `components/forms/TagAutocomplete.jsx`، و50 ملفًا آخر (الصفحات، features، ui).
  - استُبدلت جميع الفئات المستقلة: `va-accent-text`، `va-accent-text-on-soft`، `va-accent-bg`، `va-accent-bg-soft`، `va-accent-border` (بالإضافة إلى `va-tone-accent`).
  - الحالات التفاعلية (hover/focus) لا تزال تستخدم emerald لكنها محجوبة بواسطة جسر CSS في v1-identity.css بـ `var(--va-action)`.
  - المصدر: improvement-proposals (UI-2)، comprehensive-audit، uiux-report (CRITICAL).

- [x] `[P1]` ⏱️M **React Error Boundaries** (مستوى التطبيق + الأقسام) مع واجهة استرداد.
  - الملفات: `archive app/src/App.jsx`، shell الصفحات.
  - المصدر: dev-proposals (S2)، improvement-proposals (FE-4).

- [x] `[P1]` ⏱️M **Code splitting عبر `React.lazy`** لكل صفحة.
  - الملفات: `archive app/src/app/pageRegistry.js`، `pageManifest.js`.
  - المصدر: audit-report، comprehensive-audit.

- [x] `[P1]` ⏱️L **إعادة هيكلة `App.jsx` الضخمة** (632 سطرًا، 15+ `useEffect`) إلى وحدات: Provider / Router / Notifications / Sync.
  - الملفات: `archive app/src/App.jsx`.
  - المصدر: improvement-proposals (FE-3)، audit-report.

- [ ] `[P2]` ⏱️L **إعادة هيكلة CSS بـ `@layer`** لإزالة 150+ `!important`.
  - الملفات: `archive app/src/styles/v1-identity.css` … `v4-identity.css`، `app-overrides.css`.
  - طبقات: reset → tokens → components → themes → utilities.
  - المصدر: improvement-proposals (UI-1)، uiux-report (CRITICAL).

- [x] `[P2]` ⏱️L **PWA** — manifest + service worker + كشف الاتصال + background sync (غير موجودة حاليًا).
  - الملفات: `archive app/` (vite config، public)، storage adapters للـ sync.
  - المصدر: dev-proposals (S6)، audit-report.

- [x] `[P2]` ⏱️S **مقياس مسافات** (`--va-space-1`..`--va-space-8`: 4→64px) بدل القيم المبعثرة.
  - الملفات: `archive app/src/styles/*`.
  - المصدر: improvement-proposals (UI-4)، comprehensive-audit.

- [x] `[P2]` ⏱️M **إدارة حالة التحميل** — hook عام + تعطيل الأزرار لمنع الإرسال المزدوج.
  - الملفات: `archive app/src/stores/`، مكوّنات common.
  - المصدر: improvement-proposals (FE-5).

- [ ] `[P3]` ⏱️S **تحليل الحزمة** (esbuild-visualizer) وتقليل الحجم الابتدائي (~3MB حاليًا).
  - الملفات: `archive app/vite.config.js`.
  - المصدر: dev-proposals (P3).

---

## 4. تجربة وواجهة المستخدم (UI/UX & a11y)

- [x] `[P0]` ⏱️M **تأكيد متدرّج للعمليات المدمّرة** — `emptyTrash`/حذف مشروع/حذف وسوم بلا تأكيد.
  - مستويات: عادي «هل أنت متأكد؟» / كتابة نص تأكيد / عدّاد + نص.
  - الملفات: `archive app/src/components/common/ConfirmDialog.js` ومواضع الاستدعاء.
  - المصدر: improvement-proposals (UX-1)، uiux-report (CRITICAL).

- [x] `[P1]` ⏱️S **إصلاح تباين accent في V4** — `#064e3b` على خلفية داكنة = 1.8:1 (يفشل WCAG AA).
  - غيّر خلفية الزر إلى `#10b981` (5.6:1).
  - الملفات: `archive app/src/styles/v4-identity.css`.
  - المصدر: improvement-proposals (UI-5)، uiux-report.

- [x] `[P1]` ⏱️L **DialogManager موحّد** — حاليًا 3 أنظمة حوار غير متوافقة (z-index مختلف، Escape غير متوقّع، تعارض scroll lock).
  - تكديس تلقائي، focus trap للأعلى فقط، scroll lock مرجعي، Escape يغلق الأعلى.
  - الملفات: `archive app/src/components/common/` (ConfirmDialog، EntityFormModal، ForceChangePasswordDialog).
  - المصدر: improvement-proposals (UI-3)، uiux-report.

- [x] `[P1]` ⏱️M **مسار تنقّل (breadcrumbs) تفاعلي** — حاليًا نص واحد غير قابل للنقر.
  - الملفات: PageContextBar / shell التنقّل.
  - المصدر: improvement-proposals (UX-2).

- [x] `[P1]` ⏱️M **واجهة تقدّم للعمليات الطويلة** — نسخ احتياطي/تصدير/رفع بلا مؤشر (%، الوقت المتبقي، إلغاء).
  - استخدم `ProgressEvent` لرفع الملفات.
  - المصدر: improvement-proposals (UX-3).

- [x] `[P1]` ⏱️L **إصلاحات a11y أساسية** — skip link، focus trap في النوافذ، `role`/`aria-label` للأقسام، تسلسل عناوين سليم، `alt` للصور، `aria-live` للمحتوى الديناميكي.
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

- [x] `[P1]` ⏱️L **Vitest للوحدات** (app + core + server) — لا توجد اختبارات وحدة حاليًا (يوجد Playwright e2e/a11y فقط).
  - ابدأ بالوحدات الحرجة (auth، storage adapters، stores).
  - المصدر: audit-report، comprehensive-audit، improvement-proposals.

- [x] `[P1]` ⏱️M **اختبارات تكامل لمعالج RPC** — تغطية الدوال المُصرّح بها في الـ dispatcher.
  - الملفات: `archive-server/src/api/server.js`.
  - المصدر: audit-report.

- [ ] `[P2]` ⏱️M **jest-axe على مستوى المكوّن** — يكمّل اختبار Playwright a11y الموجود (الذي يعمل على مستوى الصفحة).
  - المصدر: improvement-proposals (FE-2).

- [x] `[P2]` ⏱️M **توسيع تغطية E2E (Playwright)** — حاليًا ملفّا a11y فقط؛ أضف مسارات وظيفية (رفع، بحث، مشاركة).
  - الملفات: `archive app/tests/`.
  - المصدر: audit-report.

- [x] `[P3]` ⏱️M **Load testing (k6)** + **Lighthouse CI** للأداء وCore Web Vitals.
  - المصدر: comprehensive-audit، audit-report.

---

## 6. DevOps والمراقبة

- [x] `[P2]` ⏱️M **Sentry لتتبّع الأخطاء** (frontend + backend) — يُربط بـ Error Boundaries في القسم 3.
  - المصدر: dev-proposals، audit-report.

- [x] `[P2]` ⏱️M **Redis caching** — نتائج بحث، sessions، snapshots المشاركة (TTL 5–60 دقيقة).
  - المصدر: dev-proposals (P4).

- [x] `[P2]` ⏱️S **Docker multi-stage build + `.dockerignore`** لتقليل حجم الصورة.
  - الملفات: `archive-server/Dockerfile.server`، `Dockerfile.frontend`.
  - المصدر: audit-report.

- [x] `[P2]` ⏱️M **نسخ احتياطي مجدول من الخادم** — استبقاء (7 يومي / 4 أسبوعي / 3 شهري) + رفع تلقائي + واجهة إدارة.
  - الملفات: `archive-server/deploy/backup-cron.sh` (موجود — يُبنى فوقه)، نقاط `POST /api/admin/backup/schedule`، `GET /api/admin/backup/list`.
  - المصدر: development-plan (1.4)، arabic-report.

- [x] `[P3]` ⏱️L **Prometheus + Grafana + تنبيهات** و**Helm chart** لـ Kubernetes.
  - المصدر: dev-proposals (Infra1)، comprehensive-audit، arabic-report.

---

## 7. تطوير ميزات (Feature Development)

- [x] `[P1]` ⏱️XL **دعم أنواع مستندات متعددة** — حاليًا فيديو فقط. أضف PDF/صور/مستندات مع pdf.js + OCR.
  - حقول schema: `documentType`, `mimeType`, `pageCount`, `ocrText`.
  - المصدر: development-plan (1.3).

- [x] `[P1]` ⏱️L **استعادة كلمة المرور + بريد** — nodemailer/SMTP، رمز 15 دقيقة، rate limit (3/ساعة).
  - نقاط: `POST /api/auth/forgot-password`، `POST /api/auth/reset-password`.
  - المصدر: development-plan (1.5).

- [x] `[P1]` ⏱️L **مصادقة ثنائية (2FA — TOTP)** + رموز استرداد، إلزامية للمشرفين، «تذكّر هذا الجهاز» 30 يومًا.
  - المصدر: development-plan (1.7).

- [x] `[P2]` ⏱️L **وسم تلقائي عند الرفع** — تصنيف AI قابل للقبول/الرفض (يستفيد من تكامل AI الموجود).
  - المصدر: dev-proposals (AI1).

- [x] `[P2]` ⏱️XL **بحث دلالي** — embeddings + pgvector في PostgreSQL.
  - المصدر: dev-proposals (AI2).

- [x] `[P2]` ⏱️XL **تعاون لحظي** — WebSocket presence + كشف تعارض التحرير (حاليًا SSE/polling).
  - المصدر: dev-proposals (C1)، development-plan (Phase 3).

- [x] `[P2]` ⏱️L **خط معالجة الصور** — Sharp: WebP، صور مصغّرة، srcset (تقليل 60–70%).
  - المصدر: dev-proposals (P1).

- [x] `[P3]` ⏱️L **i18n متعدد اللغات** — مكتبة i18next بدل العربي المثبّت في السلاسل.
  - المصدر: dev-proposals (AI4).

- [x] `[P3]` ⏱️XL **تطوّر schema مُنمّط** — جداول typed (users, archive_items, content_types) بدل الصف العام JSONB، مع طبقة تجريد للتوافق العكسي.
  - المصدر: development-plan (1.6).

---

## 9. موجة التطوير الثانية — Wave 2 (مهام جديدة)

> تُضاف بعد اكتمال خطة التدقيق (64 مهمة). تركّز على تعميق الوظائف وتحسين تجربة المستخدم.

### أ. التصدير والعمليات الجماعية

- [ ] `[P1]` ⏱️M **تصدير متقدم (CSV / Excel / ZIP)** — تصدير نتائج البحث أو مجموعة محددة بصيغ متعددة.
  - نقطة: `POST /api/v1/export` (نوع: `csv|xlsx|zip`، مع تصفية).
  - الواجهة: زر "تصدير" في شريط الأدوات وصفحة البحث.

- [ ] `[P1]` ⏱️M **عمليات جماعية على السجلات** — تحديد متعدد ثم: تعديل tags / نوع / مشروع / حذف / نقل.
  - الواجهة: شريط تحديد عائم عند اختيار أكثر من عنصر.
  - الخلفية: `POST /api/v1/records/bulk` (action + ids + payload).

### ب. الصلاحيات وإدارة المستخدمين

- [ ] `[P1]` ⏱️L **RBAC — أدوار وصلاحيات** (admin / editor / viewer).
  - `admin`: كل العمليات + إدارة المستخدمين.
  - `editor`: رفع + تحرير + حذف سجلاته.
  - `viewer`: قراءة فقط، بحث، تصدير.
  - الجدول: `user_roles` في schema؛ middleware للتحقق على كل مسار RPC.

- [ ] `[P2]` ⏱️M **إدارة المستخدمين المتقدمة** — دعوة بالبريد، تعطيل حساب، تغيير دور، آخر دخول.
  - صفحة `UsersPage` موجودة — توسيع وظائفها.

### ج. سجل التغييرات والإصدارات

- [ ] `[P1]` ⏱️L **سجل إصدارات السجل** — تتبّع كل تعديل على حقول السجل مع إمكانية الاستعادة.
  - جدول: `record_versions` (recordId, version, snapshot JSONB, userId, createdAt).
  - الواجهة: تبويب "السجل التاريخي" في صفحة التفاصيل.

### د. المجموعات الذكية والبحث المحفوظ

- [ ] `[P2]` ⏱️M **مجموعات ذكية (Smart Collections)** — مجموعات تتحدّث تلقائيًا بناءً على استعلام محفوظ.
  - جدول: `saved_filters` (query JSONB, ownerId, isLive: bool).
  - صفحة `CollectionsPage` موجودة — إضافة نوع "ذكي" بجانب الثابت.

### هـ. الإشعارات والتكامل

- [ ] `[P2]` ⏱️M **إشعارات البريد الإلكتروني** — إشعار عند: مشاركة سجل، ذكر مستخدم، اكتمال رفع.
  - يستخدم nodemailer الموجود؛ جدول `notification_preferences` لإعدادات كل مستخدم.

- [ ] `[P2]` ⏱️M **Webhooks الصادرة** — إرسال حدث HTTP عند: إضافة/تحديث/حذف سجل.
  - جدول: `webhooks` (url, events[], secret); `POST /api/v1/webhooks` للإدارة.
  - إعادة المحاولة التلقائية (exponential backoff، 3 مرات).

### و. تحسينات الواجهة

- [ ] `[P2]` ⏱️M **لوحة تحليلات محسّنة** — رسوم بيانية تفاعلية: نمو الأرشيف بالزمن، توزيع الأنواع، أكثر الوسوم استخدامًا.
  - صفحة `DataCenterPage` موجودة (1267 سطر) — توسيع المخططات.

- [ ] `[P2]` ⏱️S **وضع ملء الشاشة للمعاينة** — عرض المستند/الصورة/الفيديو بملء الشاشة مع تنقّل بالأسهم.

- [ ] `[P3]` ⏱️M **واجهة إدارة API Keys** — إنشاء/إلغاء مفاتيح API لتكامل الخدمات الخارجية.
  - جدول: `api_keys` (hash, name, scopes[], lastUsed, expiresAt).

- [ ] `[P3]` ⏱️L **حقول بيانات وصفية مخصصة** — إضافة حقول مُعرَّفة من المستخدم (نص/رقم/تاريخ/قائمة) لكل نوع محتوى.

---

## 11. معالج التثبيت والتشغيل (Setup & Installation Wizard)

> هدفه: توجيه أي مستخدم جديد من الصفر — تحميل Docker حتى تشغيل النظام — بخطوات مرقّمة واضحة.

- [ ] `[P1]` ⏱️L **سكريبت إعداد تفاعلي (CLI Wizard)** — `scripts/setup.mjs` يُشغَّل بأمر `pnpm setup` أو `node scripts/setup.mjs`.
  - **الخطوة 1 — فحص Docker**: يتحقق من وجود `docker` و`docker compose`؛ إن لم يُوجد يعرض رابط التحميل الصحيح حسب نظام التشغيل (Windows/Mac/Linux) ويطلب إعادة التشغيل بعد التثبيت.
  - **الخطوة 2 — اختيار الوضع**: PocketBase (خفيف، للمطوّر) أو PostgreSQL (إنتاج).
  - **الخطوة 3 — إعداد البيئة**: يولّد ملف `.env` تلقائياً بأسرار JWT عشوائية آمنة + يسأل عن: اسم المستخدم والبريد وكلمة مرور المشرف، إعدادات SMTP (اختياري).
  - **الخطوة 4 — تشغيل Docker**: يُنفّذ `docker compose up -d` ويعرض شريط تقدّم.
  - **الخطوة 5 — فحص الصحة**: يستعلم `GET /api/health` حتى يرد بـ 200 (timeout 120s)، ثم يفتح المتصفح تلقائياً.

- [ ] `[P1]` ⏱️M **صفحة الترحيب للتشغيل الأول** — `FirstRunPage.jsx` تظهر عند عدم وجود مستخدمين في النظام.
  - تُسجَّل في `pageRegistry.js` وتُفحَص عند البدء.
  - خطوات: (1) إنشاء حساب المشرف، (2) اختيار الثيم، (3) تعيين لغة التخزين، (4) توجيه للوحة التحكم.
  - تحل محل التسجيل العشوائي وتُوجِّه المستخدم بشكل واضح.

- [ ] `[P2]` ⏱️M **ملف `INSTALL.md`** — دليل تثبيت سريع بالخطوات الثلاث:
  1. `git clone` + `cd archive-suite`
  2. `node scripts/setup.mjs`
  3. افتح `http://localhost:8787`

---

## 10. تحسينات تجربة الإعداد الأولي (Onboarding UX)

> خطة مستوردة من `implementation_plan.md` — تحسينات بصرية وتفاعلية على معالج الإعداد.

- [ ] `[P1]` ⏱️S **إصلاح `verify-modules.mjs`** — تصحيح التأكيد في السطر 367: `defaults.openSearch` من `"Ctrl+K"` إلى `"Alt+K"`.
  - الملف: `archive app/scripts/verify-modules.mjs`.

- [ ] `[P1]` ⏱️M **معاينة مباشرة للثيم واللون في معالج الإعداد** — استدعاء `applyAccentColor` و`setTheme` داخل `useEffect` مرتبط بـ `accentColor` و`themeChoice` لمعاينة فورية أثناء الإعداد.
  - الملف: `archive app/src/features/onboarding/V1OnboardingWizard.jsx`.

- [ ] `[P1]` ⏱️M **تصميم حديث لخطوات معالج الإعداد**:
  - خلفية توهّج شبكي (mesh radial glow) بألوان `--va-accent-*` متحركة.
  - أيقونة ✓ للخطوات المكتملة بدل الرقم + توهّج على الخطوة النشطة.
  - تحويل `scale` عند التمرير/النقر على بطاقات الاختيار (dynamic `color-mix`).
  - شريط قوة كلمة المرور بتصميم حديث.
  - الملف: `archive app/src/features/onboarding/V1OnboardingWizard.jsx`.

- [ ] `[P2]` ⏱️S **تحديث `v2-identity.css`** — أنماط glassmorphic لنافذة الإعداد + tokens انتقالية سلسة.

- [ ] `[P2]` ⏱️S **تحديث `v4-identity.css`** — توحيد تباين الوضعين الفاتح والداكن في نافذة الإعداد.

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

---

## 12. نتائج الفحص المعمّق 2026 — مهام جديدة

> **المصدر:** 4 تقارير فحص معمّق أُضيفت بتاريخ 8 يونيو 2026:
> - `archive-suite-deep-audit-2026.html` (87 ثغرة، 12 مجالًا، 69.7/100)
> - `archive-suite-deep-audit-v2.html` (107 ثغرة، 17 حرجة)
> - `archive-suite-uiux-deep-audit-2026.html` (37 نقطة ألم، 64.3/100)
> - `archive-suite-uiux-user-journey-report.html` (22 نقطة ألم في رحلة المستخدم)
>
> جميع البنود التالية غير مُغطّاة في الأقسام السابقة. البنود الموجودة فعلًا في الكود أُضيفت للملحق (القسم 8).

---

### 12.1 أمان — P0 حرج (ثغرات مباشرة)

- [x] `[P0]` ⏱️S **إصلاح حقن SQL عبر `Prisma.raw()` في `getByField`** — الحقول غير `uid`/`id` تُدرج مباشرة في استعلام خام بلا تعقيم.
  - الملف: `archive-server/src/adapters/cloud-postgres-prisma/storage.js:305`
  - الإصلاح: ابنِ whitelist للحقول المسموحة (`uid`, `id`, `ownerId`, `email`) وارفض أي حقل خارجها قبل بناء الاستعلام.
  - المصدر: deep-audit-v2 (SEC-02)، critical.

- [x] `[P0]` ⏱️S **تأمين نقطة `/api/ocr`** — بلا `requireAuth()` ولا حد لحجم الطلب؛ يقبل رفع ملفات غير محدودة الحجم من أي زائر.
  - الملف: `archive-server/src/api/ocrHandler.js:9,20-21`
  - الإصلاح: أضف `requireAuth()` أول شيء في المعالج + حد `20MB` على `busboy`/`multer` + rate limit مخصص (5 طلبات/دقيقة للمستخدم).
  - المصدر: deep-audit-v2 (SEC-03)، critical.

- [x] `[P0]` ⏱️S **إصلاح XSS في قالب بريد إعادة تعيين كلمة المرور** — `username` و`resetLink` غير مُعقَّمَين في قالب `emailService.js`.
  - الملف: `archive-server/src/email/emailService.js`
  - الإصلاح: استخدم دالة `escapeHtml()` على كل متغير يُدرج في HTML. مرجع: `notificationService.js` (Task 71) يُعقَّم بشكل صحيح.
  - المصدر: deep-audit-v2 (S3)، critical.

- [x] `[P0]` ⏱️M **توليد QR code للـ TOTP محليًا** — الكود يُرسل سر TOTP إلى `api.qrserver.com` خارجي عند كل تفعيل 2FA.
  - الملف: `archive-server/src/auth/totpService.js:47`
  - الإصلاح: `npm install qrcode` واستبدل الطلب الخارجي بـ `qrcode.toDataURL(otpauthUrl)` — ينتج data-URI محليًا بلا اتصال خارج.
  - المصدر: deep-audit-v2 (S4)، critical.

- [x] `[P0]` ⏱️S **معالجة استعلامات pgvector بـ Parameterized SQL** — `vectorStr` يُبنى بتسلسل نصي يدوي في خدمة التضمينات.
  - الملف: `archive-server/src/ai/embeddingService.js`
  - الإصلاح: استبدل السلسلة النصية بـ Prisma template literal:
    `await prisma.$queryRaw\`SELECT * FROM embeddings ORDER BY embedding <=> ${vector}::vector LIMIT ${limit}\``
  - المصدر: deep-audit-v2 (S5)، critical.

- [x] `[P0]` ⏱️S **التحقق من JWT في `searchHandler` عبر `verifyJwt()`** — الكود يُحلّل حمولة التوكن بـ `JSON.parse(atob(payload))` متجاوزًا التحقق من التوقيع.
  - الملف: `archive-server/src/api/searchHandler.js`
  - الإصلاح: استبدل بـ `const payload = await verifyJwt(token)` المستوردة من `src/auth/jwt.js`.
  - المصدر: deep-audit-v2 (S6)، critical.

- [x] `[P0]` ⏱️S **إصلاح إعادة تعيين كلمة المرور — دمج بدل استبدال السجل** — `put("users", {id, passwordHash})` يحلّ محل سجل المستخدم كاملًا بحقلين فقط.
  - الملف: `archive-server/src/api/server.js:547` (مسار `/api/reset-password`)
  - الإصلاح: احضر المستخدم الحالي أولًا ثم ادمج: `await storage.put("users", { ...existingUser, passwordHash: newHash })`.
  - المصدر: deep-audit-v2 (S7)، critical.

- [x] `[P0]` ⏱️S **إصلاح IDOR في خادم الحضور (Presence)** — أي مستخدم مصادَق يمكنه البث على أي `recordId` دون تحقق من صلاحية وصوله للسجل.
  - الملف: `archive-server/src/presence/presenceServer.js:78-91`
  - الإصلاح: قبل إضافة المستخدم لغرفة `recordId` تحقق أنه يملك صلاحية قراءة ذلك السجل عبر `checkPermission(userId, recordId)`.
  - المصدر: deep-audit-v2 (S8)، critical.

- [x] `[P0]` ⏱️M **نقل JWT Blacklist وResetTokenStore إلى Redis** — القوائم in-memory تُفقد عند إعادة التشغيل وغير متوافقة مع HPA متعدد النسخ.
  - الملفات: `archive-server/src/auth/tokenBlacklist.js`، `archive-server/src/auth/resetTokenStore.js`
  - الإصلاح: استخدم Redis Sets مع `SETEX`/`EXPIRE` بـ TTL مساوٍ لانتهاء صلاحية التوكن؛ استخدم Redis client الموجود في `src/cache/`.
  - المصدر: deep-audit-v2 (S1/S2)، critical.

---

### 12.2 أمان — P0 البنية التحتية (K8s)

- [x] `[P0]` ⏱️M **إضافة `securityContext` لجميع K8s Deployments** — الحاويات تعمل كـ root بدون قيود kernel.
  - الملف: `archive-server/k8s/*.yaml` (جميع Deployments)
  - الإصلاح: أضف لكل container: `runAsNonRoot: true`، `runAsUser: 1000`، `readOnlyRootFilesystem: true`، `allowPrivilegeEscalation: false`، `capabilities.drop: ["ALL"]`.
  - المصدر: deep-audit-v2 (K8s-01)، critical.

- [x] `[P0]` ⏱️M **تطبيق `NetworkPolicy` لعزل الخدمات في K8s** — افتراضيًا أي Pod يتواصل مع أي Pod آخر.
  - الملف: `archive-server/k8s/network-policy.yaml` (جديد)
  - الإصلاح: سياسة deny-all افتراضية + allow-list صريح: `app -> postgres` و`app -> redis` فقط.
  - المصدر: deep-audit-v2 (K8s-02).

- [x] `[P0]` ⏱️S **استبدال قيم `CHANGE_ME` في K8s Secrets** — `k8s/secret.yaml` يحتوي على قيم `CHANGE_ME` ثابتة في المستودع.
  - الملف: `archive-server/k8s/secret.yaml`
  - الإصلاح: احذف القيم الافتراضية؛ استخدم Kubernetes ExternalSecrets أو Helm `--set` عند النشر؛ أضف فحص في `productionGuard.js`.
  - المصدر: deep-audit-v2 (K8s-03)، critical.

- [ ] `[P0]` ⏱️S **تشغيل حاويات PocketBase وOCR كمستخدم غير جذر** — صور الخدمات الجانبية تعمل كـ root.
  - الملفات: `archive-server/Dockerfile.pocketbase`، `services/ocr/Dockerfile`
  - الإصلاح: أضف `USER 1000:1000` بعد تعيين أذونات الملفات في كل Dockerfile.
  - المصدر: deep-audit-v2 (K8s-04).

---

### 12.3 أمان — P1 عالٍ

- [ ] `[P1]` ⏱️S **إصلاح مصادقة WebSocket — استخدام السر الصحيح** — `presenceServer.js` يستخدم متغير JWT خاطئ للتحقق من توكنات الاتصال.
  - الملف: `archive-server/src/presence/presenceServer.js`
  - الإصلاح: تأكد من استخدام `JWT_AUTH_SECRET` الصحيح عند التحقق من توكن WebSocket.
  - المصدر: deep-audit-v2.

- [ ] `[P1]` ⏱️M **إضافة رموز استرداد TOTP (Recovery Codes)** — لا يوجد مسار بديل للدخول عند فقدان جهاز TOTP.
  - الملفات: `archive-server/src/auth/totpService.js`، `server.js` (مسارات `/api/totp/*`)، `archive app/src/components/settings/SecuritySettings.jsx`
  - الإصلاح: عند تفعيل TOTP أنتج 8 رموز استرداد (16 حرفًا عشوائيًا مُهاشَة في DB) تُعرض مرة واحدة. أضف مسار `/api/totp/recover` يتحقق ويستهلك الرمز.
  - المصدر: deep-audit-v2.

- [ ] `[P1]` ⏱️S **Rate Limit على تعطيل TOTP** — لا يوجد تقييد على `/api/totp/disable` مما يُتيح brute-force.
  - الملف: `archive-server/src/api/server.js` (مسار `/api/totp/disable`)
  - الإصلاح: أضف rate limit مخصص (3 محاولات فاشلة/15 دقيقة) على هذا المسار.
  - المصدر: deep-audit-v2.

- [ ] `[P1]` ⏱️S **تثبيت `APP_BASE_URL` من متغيرات البيئة** — بناء رابط الاسترداد من ترويسة `Host`/`Origin` يُتيح Open Redirect.
  - الملف: `archive-server/src/api/server.js` أو `emailService.js` (مسار `/api/forgot-password`)
  - الإصلاح: استخدم `process.env.APP_BASE_URL` فقط؛ أضفه لـ `.env.example` وـ `productionGuard.js`.
  - المصدر: deep-audit-v2.

- [ ] `[P1]` ⏱️M **تشفير ملفات النسخ الاحتياطية** — ملفات الـ backup تُحفظ بلا تشفير.
  - الملف: `archive-server/deploy/backup-cron.sh`
  - الإصلاح: شفِّر باستخدام `openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY`؛ أضف المتغير لـ `.env.example`.
  - المصدر: deep-audit-2026.

- [ ] `[P1]` ⏱️S **التحقق من سلامة النسخ الاحتياطية** — لا يوجد checksum أو اختبار استرداد دوري.
  - الملف: `archive-server/deploy/backup-cron.sh`
  - الإصلاح: احسب `sha256sum` للأرشيف واحفظه في `.sha256` مجاور؛ أضف اختبار restore تجريبي شهريًا على DB مؤقتة.
  - المصدر: deep-audit-2026.

---

### 12.4 أخطاء الواجهة الأمامية — P1

- [x] `[P1]` ⏱️S **`usePresence` — إعادة اتصال بلا Exponential Backoff** — يُعيد الاتصال فورًا عند الانقطاع مما يُغرق الخادم.
  - الملف: `archive app/src/hooks/usePresence.js`
  - الإصلاح: أضف exponential backoff (500ms -> 1s -> 2s -> max 30s مع jitter) عند كل محاولة إعادة اتصال.
  - المصدر: deep-audit-v2 (FE-01).

- [x] `[P1]` ⏱️S **`useProgress` — `setTimeout` غير مُنظَّف (Memory Leak)** — المؤقت يُطلق `setState` على مكوّن unmounted.
  - الملف: `archive app/src/hooks/useProgress.js`
  - الإصلاح: احفظ معرّف `setTimeout` وأضف `return () => clearTimeout(id)` كـ cleanup لـ `useEffect`.
  - المصدر: deep-audit-v2 (FE-02).

- [ ] `[P1]` ⏱️S **`useKeyboardListNav` — Stale Closure** — الـ callback يُصبح قديمًا مع تغيّر البيانات.
  - الملف: `archive app/src/hooks/useKeyboardListNav.js`
  - الإصلاح: استخدم `useRef` للاحتفاظ بآخر نسخة من callback: `const cbRef = useRef(cb); useEffect(() => { cbRef.current = cb; }, [cb]);`.
  - المصدر: deep-audit-v2 (FE-03).

- [ ] `[P1]` ⏱️S **`DialogManager` — `role="presentation"` يتعارض مع `aria-modal`** — يُلغي الدلالة الدلالية ويكسر شجرة Accessibility.
  - الملف: `archive app/src/components/ui/DialogManager.jsx`
  - الإصلاح: احذف `role="presentation"` من العنصر الخارجي (overlay)؛ استخدم `role="dialog"` مع `aria-modal="true"` على الحاوية الداخلية فقط.
  - المصدر: deep-audit-v2 (FE-04).

- [ ] `[P1]` ⏱️S **`AutoTagSuggestions` — تنظيف `AbortController` خاطئ** — `controller.abort()` يُستدعى في `finally` قبل اكتمال المعالجة.
  - الملف: `archive app/src/components/tags/AutoTagSuggestions.jsx`
  - الإصلاح: انقل `abort()` لـ `useEffect` cleanup فقط: `return () => controller.abort()`.
  - المصدر: deep-audit-v2 (FE-05).

- [ ] `[P1]` ⏱️S **`DocumentViewer` — Race Condition عند تصيير PDF** — تحميل ملفات متعددة بسرعة يعرض نتيجة رد خاطئ.
  - الملف: `archive app/src/components/viewer/DocumentViewer.jsx`
  - الإصلاح: استخدم `AbortController` لإلغاء الطلب السابق عند تغيير الملف؛ أو احتفظ بـ `requestId` وتجاهل responses القديمة.
  - المصدر: deep-audit-v2 (FE-06).

- [ ] `[P1]` ⏱️S **`RecordVersionHistory` — `window.confirm` يكسر PWA** — لا يعمل في وضع PWA Standalone.
  - الملف: `archive app/src/components/records/RecordVersionHistory.jsx`
  - الإصلاح: استبدل `window.confirm(...)` بـ `DialogManager` المخصص (Task 19).
  - المصدر: deep-audit-v2 (FE-07).

- [ ] `[P1]` ⏱️S **`PresenceIndicator` — يُعطب عند `username` فارغ** — `username?.charAt(0)` يُلقي استثناءً عند سلسلة فارغة.
  - الملف: `archive app/src/components/collaboration/PresenceIndicator.jsx`
  - الإصلاح: استخدم `(username?.trim() || '?').charAt(0).toUpperCase()`.
  - المصدر: deep-audit-v2 (FE-08).

---

### 12.5 قاعدة البيانات والمتجر — P1

- [ ] `[P1]` ⏱️S **تغيير فهرس pgvector من IVFFlat إلى HNSW** — `IVFFlat` يفشل في الإنشاء على جدول فارغ.
  - الملفات: migration الـ pgvector في `archive-server/prisma/migrations/`، `archive-server/src/ai/embeddingService.js`
  - الإصلاح: migration جديدة: `CREATE INDEX USING hnsw (embedding vector_cosine_ops)` — يعمل على جداول فارغة.
  - المصدر: deep-audit-v2 (DB-01).

- [ ] `[P1]` ⏱️S **إزالة `DEFAULT ''` من عمود `passwordHash`** — القيمة الافتراضية الفارغة تُتيح إنشاء مستخدمين بكلمة مرور فارغة.
  - الملف: `archive-server/prisma/migrations/` (migration typed_users)
  - الإصلاح: migration جديدة تحذف `DEFAULT ''` وتضيف `NOT NULL` صريحًا.
  - المصدر: deep-audit-v2 (DB-02).

- [x] `[P1]` ⏱️M **إصلاح `storeCore.js` — Shallow Merge يُضيّع البيانات المتداخلة** — `Object.assign(existing, update)` يحذف الحقول المتداخلة غير المذكورة في التحديث.
  - الملف: `archive app/src/store/storeCore.js`
  - الإصلاح: استبدل بدمج عميق انتقائي: احتفظ بمفاتيح root غير المُعدَّلة وادمج القواميس المتداخلة (`metadata`، `tags`) بدل استبدالها كاملًا.
  - المصدر: deep-audit-v2 (FE-BE-01).

- [ ] `[P1]` ⏱️S **إصلاح `loadAllData` — Race Condition في React StrictMode** — `useEffect` المزدوج يُشغّل تحميلين متزامنين يتعارضان في الحالة.
  - الملف: `archive app/src/app/archiveSlice.js`
  - الإصلاح: استخدم `useRef` كـ guard: `if (loadingRef.current) return; loadingRef.current = true;`.
  - المصدر: deep-audit-v2 (FE-BE-02).

- [x] `[P1]` ⏱️S **إصلاح `selectors.js` — مراجع جديدة عند كل استدعاء تُسبب Re-Renders زائدة** — الـ selectors تُنشئ مصفوفات/كائنات جديدة حتى لو البيانات لم تتغيّر.
  - الملف: `archive app/src/store/selectors.js`
  - الإصلاح: اربط الـ selectors بـ `useMemo` مع dependency arrays دقيقة، أو استخدم مكتبة `reselect`.
  - المصدر: deep-audit-v2 (FE-BE-03).

---

### 12.6 تجربة المستخدم — P1

- [ ] `[P1]` ⏱️L **توحيد `TagAutocomplete` في جميع حقول الوسوم** — 4 من أصل 5 مواضع تستخدم `input` عادي.
  - الملفات:
    - `archive app/src/pages/AddVideoPage.jsx:603`
    - `archive app/src/components/bulk/BulkActionBar.jsx:38-47`
    - `archive app/src/components/dialogs/QuickAddDialog.jsx:301-303`
    - `archive app/src/features/wizard/FileArchiveWizard.jsx`
  - الإصلاح: استبدل حقول الوسوم العادية بـ `<TagAutocomplete value={tags} onChange={setTags} />`.
  - المصدر: uiux-deep-audit (UX-01).

- [ ] `[P1]` ⏱️M **ربط صفحة التفريغ النصي (Transcription) بالعناصر المؤرشفة** — صفحة التفريغ منفصلة ولا تُنتج `archive_items`.
  - الملف: `archive app/src/pages/TranscriptionPage.jsx`
  - الإصلاح: بعد اكتمال التفريغ أضف زر "حفظ كعنصر أرشيف" يُنشئ `archive_item` بالنص والعنوان والوسوم المستخرجة.
  - المصدر: uiux-user-journey (UJ-04).

- [ ] `[P1]` ⏱️M **إضافة إيماءات اللمس على الجوّال** — لا يوجد swipe أو إجراءات سريعة لمسية.
  - الملفات: `archive app/src/components/records/RecordCard.jsx`، `archive app/src/pages/ArchivePage.jsx`
  - الإصلاح: استخدم `@use-gesture/react` أو Pointer Events API: swipe-right للفتح، swipe-left لقائمة الإجراءات، pull-to-refresh.
  - المصدر: uiux-user-journey (UJ-08).

- [ ] `[P1]` ⏱️L **واجهة إدارة Field ACL** — `fieldAcl.js` موجود على الخادم بلا واجهة إدارة.
  - الملفات: `archive-server/src/permissions/fieldAcl.js`، `archive app/src/components/settings/`
  - الإصلاح: أنشئ `FieldPermissionsSettings.jsx` تعرض لكل `contentType` الحقول مع مستوى وصول per-role (قراءة/كتابة/مخفي).
  - المصدر: deep-audit-2026 (UX-05).

- [ ] `[P1]` ⏱️L **واجهة مستخدم للتعليقات** — نموذج بيانات التعليقات موجود في DB بلا واجهة.
  - الملفات: `archive app/src/components/records/RecordDetail.jsx`، مسار API جديد `/api/comments`
  - الإصلاح: أضف قسم تعليقات في تفاصيل السجل: عرض القائمة + إضافة تعليق + حذف تعليق المستخدم نفسه مع RBAC.
  - المصدر: deep-audit-2026 (FE-09).

---

### 12.7 تجربة المستخدم — P2

- [ ] `[P2]` ⏱️L **تفعيل Inline Editing في عرض الجدول** — عرض الجدول للقراءة فقط، كل تعديل يتطلب فتح نافذة.
  - الملف: `archive app/src/components/views/TableView.jsx`
  - الإصلاح: اجعل خلايا الأعمدة البسيطة (العنوان، الوصف، الوسوم) قابلة للنقر للتعديل المباشر.
  - المصدر: uiux-deep-audit (UX-02).

- [ ] `[P2]` ⏱️S **رفع حد `TagCloud` من 40 إلى 200 وسم مع "عرض المزيد"** — يعرض أول 40 وسمًا فقط.
  - الملف: `archive app/src/components/tags/TagCloud.jsx`
  - الإصلاح: حد افتراضي 200 مع انهيار تدريجي (collapse) للوسوم النادرة وزر "عرض المزيد".
  - المصدر: uiux-deep-audit (UX-03).

- [ ] `[P2]` ⏱️S **مؤشر تقدم لأزرار التصدير** — التصدير يبدأ صامتًا بلا مؤشر مرئي.
  - الملف: `archive app/src/components/export/ExportButton.jsx`
  - الإصلاح: أضف حالة `loading` للزر مع شريط تقدم يُحدَّث عبر `useProgress` أو SSE.
  - المصدر: uiux-user-journey (UJ-06).

- [ ] `[P2]` ⏱️M **إضافة تراجع (Undo) بعد الاستيراد** — السجلات تُضاف بصورة دائمة فور التأكيد بلا إمكانية تراجع.
  - الملفات: `archive app/src/components/import/ImportDialog.jsx`، مسار `/api/rpc/putBatch`
  - الإصلاح: احتفظ بـ IDs السجلات المُضافة في state لمدة 30 ثانية مع زر "تراجع" يستدعي `deleteBatch`.
  - المصدر: uiux-user-journey (UJ-07).

- [ ] `[P2]` ⏱️S **تفعيل Virtual List على سطح المكتب** — مُفعَّل للجوّال فقط رغم أن الحزمة مثبتة.
  - الملف: `archive app/src/components/lists/ArchiveList.jsx`
  - الإصلاح: أزل شرط `isMobile` أو اجعل الحد الأدنى للتفعيل 50 عنصرًا على كل الأجهزة.
  - المصدر: uiux-deep-audit (UX-04).

- [ ] `[P2]` ⏱️M **رسائل خطأ بلغتين (عربي + إنجليزي)** — رسائل الخطأ عربية فقط.
  - الملف: `archive app/src/utils/errorMessages.js`
  - الإصلاح: أضف مفاتيح إنجليزية لكل رسالة كـ fallback؛ استخدم `navigator.language` للاختيار. (مرتبط بـ Task 58 — i18n الكاملة).
  - المصدر: uiux-deep-audit (UX-06).

---

### 12.8 البنية التحتية — P3

- [ ] `[P3]` ⏱️S **إصلاح إصدار صورة Postgres** — `postgres:18-alpine` غير موجود؛ أحدث إصدار مستقر هو 17.
  - الملفات: `docker-compose.yml`، `docker-compose.prod.yml`، `archive-server/k8s/postgres-deployment.yaml`
  - الإصلاح: استبدل `postgres:18-alpine` بـ `postgres:17-alpine`.
  - المصدر: deep-audit-v2 (INFRA-01).

- [ ] `[P3]` ⏱️S **إزالة معلومات الاتصال الحساسة من `pgadmin-servers.json`** — الملف يحتوي host/port/username ثابتة في المستودع.
  - الملف: `archive-server/deploy/pgadmin-servers.json`
  - الإصلاح: استبدل القيم الثابتة بمتغيرات بيئة أو أضف الملف لـ `.gitignore` مع نسخة `.example`.
  - المصدر: deep-audit-v2 (INFRA-02).

- [ ] `[P3]` ⏱️M **تحسين HPA — مقاييس مخصصة بجانب CPU** — HPA يعتمد على CPU فقط ولا يتوسع عند ضغط WebSocket أو I/O.
  - الملف: `archive-server/k8s/hpa.yaml`
  - الإصلاح: أضف Custom Metrics: عدد اتصالات WebSocket النشطة + عمق قائمة انتظار الطلبات.
  - المصدر: deep-audit-v2 (INFRA-03).

- [ ] `[P3]` ⏱️S **استبدال `redis.keys()` بـ `redis.scan()`** — `KEYS` تحجب Redis event loop بالكامل على قواعد بيانات كبيرة.
  - الملف: `archive-server/src/cache/redisClient.js`
  - الإصلاح: استبدل `client.keys(pattern)` بـ async iterator عبر `client.scan(0, { MATCH: pattern, COUNT: 100 })`.
  - المصدر: deep-audit-v2 (INFRA-04).

---

## 13. مقترحات الميزات 2026 — مهام جديدة

> **المصدر:** `D:\archiveaq\Reports\archive-suite-feature-proposals-2026.md` — 27 ميزة عبر 5 محاور.
> **المنهجية:** البنود الـ 10 المُغطّاة بالفعل في أقسام سابقة (TagAutocomplete→#79، touch gestures→#79، PWA basic→#39، setup wizard→#73، ثغرات أمان→#74-76، مراقبة→#57، بحث→#14+#52، i18n→#58، a11y→#22+#49) لم تُضف هنا. فقط المهام الحقيقية الجديدة مدرجة.
> **التأثير المتوقع:** رفع درجة التدقيق الشامل من 69.7 إلى 85+.

---

### 13.1 P0 — رفع الملفات ومشغل الوسائط

- [ ] `[P0]` ⏱️XL **رفع الملفات الفعلي مع رفع مقسم وطابور في الخلفية** — النظام يخزن بيانات وصفية فقط، لا يرفع ملفات حقيقية.
  - الملفات الجديدة: `archive app/src/store/uploadSlice.js`، `archive app/src/hooks/useChunkedUpload.js`، `archive app/src/components/upload/UploadQueue.jsx`.
  - التغييرات: `archive app/src/pages/AddVideoPage.jsx`، `archive app/src/components/modals/FileArchiveWizard.jsx`.
  - التنفيذ: رفع مقسم (5MB chunks) عبر `FileStore.putBlob()`؛ استئناف تلقائي بعد انقطاع الإنترنت؛ طابور خلفي يسمح للمستخدم بمواصلة العمل أثناء الرفع؛ شريط تقدم دقيق (نسبة الملف + إجمالي الطابور)؛ كشف التكرارات بـ SHA-256 checksum.
  - الجهد: 6-8 أسابيع. يدعم جميع مزودي التخزين (S3/Azure/GDrive/Dropbox).
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #1).

- [ ] `[P0]` ⏱️XL **مشغل فيديو احترافي مع دعم ترجمة SRT/VTT** — المشغل الحالي `<video controls>` افتراضي بلا تخصيص.
  - الملفات الجديدة: `archive app/src/components/media/VideoPlayer.jsx`، `archive app/src/components/media/SubtitleRenderer.jsx`، `archive app/src/features/media/subtitleParser.js`، `archive app/src/features/media/transcriptToSrt.js`.
  - التنفيذ: شريط تقدم مخصص مع معاينة مصغرات (thumbnails)؛ دعم SRT/VTT مع عرض على الفيديو وتخصيص الخط واللون؛ تحكم بالسرعة (0.5x–2x)؛ اختصارات لوحة مفاتيح (Space/←→/↑↓/F)؛ Picture-in-Picture؛ تحويل ناتج Whisper تلقائياً إلى SRT؛ مزامنة مع `TranscriptSyncWorkbench`.
  - الجهد: 6-8 أسابيع. يرفع درجة مرحلة الميديا من 58 إلى 85+.
  - المصدر: feature-proposals-2026 (محور 4 — ميزة #20).

- [ ] `[P0]` ⏱️XL **محرر خط زمني بصري للمونتاج مع موجة صوتية** — المحرر الحالي يعتمد على إدخال أرقام بلا معاينة بصرية.
  - الملفات الجديدة: `archive app/src/features/projects/TimelineEditor.jsx`، `WaveformTrack.jsx`، `VideoTrack.jsx`، `SubtitleTrack.jsx`، `TransitionsPanel.jsx`، `ExportDialog.jsx`.
  - تغييرات: `archive-server/src/export/ffmpegPlan.js`.
  - التنفيذ: عرض موجة صوتية عبر `wavesurfer.js`؛ سحب حواف المقاطع لتعديل نقاط البداية/النهاية؛ معاينة فورية؛ مسارات متعددة (فيديو + صوت + ترجمة)؛ تصدير محسّن مع اختيار الدقة/الترميز/الجودة؛ انتقالات بسيطة (crossfade/cut/dissolve)؛ Undo/Redo.
  - الجهد: 8-10 أسابيع.
  - المصدر: feature-proposals-2026 (محور 4 — ميزة #21).

---

### 13.2 P1 — الأمان والاستقرار

- [ ] `[P1]` ⏱️L **تشفير النسخ الاحتياطية AES-256-GCM + تحقق SHA-256 تلقائي** — النسخ غير مشفرة وغير مُتحقق منها.
  - الملفات: `archive-server/src/backup/backupScheduler.js`، صفحة `DataCenterPage.jsx`.
  - التنفيذ: تشفير AES-256-GCM لكل نسخة تلقائياً؛ حساب SHA-256 checksum بعد كل نسخة والتحقق قبل الاستعادة؛ تخزين بعيد اختياري (S3/Cloudflare R2) مع تشفير أثناء النقل؛ واجهة استعادة تطلب كلمة مرور التشفير؛ تنبيه عند فشل التحقق.
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 2 — ميزة #13).

- [ ] `[P1]` ⏱️L **حدود الموارد متعددة الطبقات (IP + User + Endpoint)** — Rate limiting موجود على IP فقط، لا حدود للمستخدم ولا لنقاط النهاية الفردية.
  - الملفات: `archive-server/src/api/rateLimit.js`، `archive-server/src/api/server.js`.
  - التنفيذ: طبقة 1 — IP (100 طلب/دقيقة)؛ طبقة 2 — User (60 طلب/دقيقة)؛ طبقة 3 — per-endpoint (OCR: 10/دقيقة، AI: 30/دقيقة)؛ حد تزامن FFmpeg قابل للإعداد (`MEDIA_JOB_CONCURRENCY`)؛ Queue مهام FFmpeg بأولويات (probe > thumbnail > transcode).
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 3 — ميزة #16).

---

### 13.3 P1 — تجربة المستخدم اليومية

- [ ] `[P1]` ⏱️L **التعديل المضمّن في عرض الجدول (InlineCellEditor)** — كل تعديل يتطلب فتح صفحة التفاصيل والعودة.
  - الملفات الجديدة: `archive app/src/components/views/InlineCellEditor.jsx`.
  - تغييرات: `archive app/src/components/views/TableView.jsx`.
  - التنفيذ: نقر مزدوج لتحرير أي خلية مباشرة؛ Tab/Shift+Tab للتنقل بين الخلايا؛ حفظ تلقائي عند Enter أو مغادرة الخلية؛ Ctrl+Z للتراجع عبر `undoManager` الموجود؛ محررات حسب نوع الحقل (نص/قائمة/تاريخ/تقييم/وسوم). يقلل نقرات التعديل من 5+ إلى 2.
  - الجهد: 3-4 أسابيع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #3). ملاحظة: P2 placeholder موجود في §12.7 — هذه الميزة الكاملة.

- [ ] `[P1]` ⏱️L **Service Worker ذكي — Workbox strategies + Background Sync كامل** — SW الحالي cache-first بسيط (Task #39). هذه ترقية لـ Workbox كامل.
  - الملف: `archive app/public/sw.js`، `archive app/vite.config.js`.
  - التنفيذ: `precacheAndRoute` لـ app shell؛ `StaleWhileRevalidate` لـ `/api/`؛ `CacheFirst` للصور والخطوط؛ `BackgroundSync Queue` لعمليات الكتابة أوفلاين تُرسل عند عودة الاتصال؛ `Periodic Background Sync` للمزامنة التلقائية. التطبيق يعمل أوفلاين بشكل كامل (تصفح + إنشاء + تعديل).
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #5).

- [ ] `[P1]` ⏱️L **تنقل سفلي ذكي للجوال (Smart Bottom Tabs)** — الشريط الجانبي يتخفّى على الجوال بلا بديل تنقل سفلي.
  - الملفات الجديدة: `archive app/src/components/layout/BottomTabBar.jsx`.
  - تغييرات: `archive app/src/components/layout/MobileActionBar.jsx` → ترقية أو استبدال.
  - التنفيذ: 4-5 أقسام رئيسية تتكيف مع الاستخدام (الأكثر استخداماً أولاً)؛ سحب لإعادة الترتيب؛ ضغط مطوّل لفتح الأقسام الفرعية؛ `safe-area-inset-bottom` للـ notch؛ يحل محل `MobileActionBar`.
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #6).

- [ ] `[P1]` ⏱️M **إصلاح تبديل الباكند فوري بلا إعادة تشغيل** — تبديل الباكند (محلي↔سحابي) يتطلب إعادة تشغيل التطبيق.
  - الملفات: `archive app/src/app/App.jsx` أو `registerByBackendChoice.js`، صفحة الإعدادات.
  - التنفيذ: عند تغيير `backendChoice` → `flushPendingWrites()` → `registerByBackendChoice()` ديناميكياً → `loadAllData()` من الباكند الجديد → `showToast("تم التبديل بنجاح")`؛ مؤشر "جاري التبديل…" أثناء العملية.
  - الجهد: 1-2 أسبوع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #8).

---

### 13.4 P1 — التشغيل والنشر والبنية التحتية

- [ ] `[P1]` ⏱️L **لوحة تحكم صحة السيرفر المدمجة (ServerStatusPage)** — لا توجد واجهة لحالة السيرفر؛ يتطلب CLI.
  - الملفات الجديدة: `archive app/src/pages/ServerStatusPage.jsx`.
  - تغييرات: `archive-server/src/api/server.js` (توسيع `/api/health`).
  - التنفيذ: مؤشرات حية (CPU/ذاكرة/قرص/اتصالات DB)؛ حالة حاويات Docker (running/stopped/restarting)؛ آخر نسخة احتياطية + زر "نسخ احتياطي الآن"؛ تنبيهات (قرص 90%، ذاكرة عالية، فشل نسخ احتياطي)؛ سجل آخر 50 عملية؛ أزرار تشغيل/إيقاف/إعادة للحاويات (admin only).
  - الصلاحية: admin+ للاطلاع، owner للتشغيل.
  - الجهد: 3-4 أسابيع.
  - المصدر: feature-proposals-2026 (محور 2 — ميزة #10).

- [ ] `[P1]` ⏱️M **أتمتة استيراد مخطط PocketBase عبر Admin API** — الإعداد الحالي يتطلب 8+ خطوات يدوية لاستيراد المخطط.
  - الملفات الجديدة: `scripts/pb-init.mjs`.
  - تغييرات: `deploy/setup.sh`، `scripts/setup.mjs`.
  - التنفيذ: عند اختيار PocketBase في wizard → إنشاء حساب المسؤول برمجياً عبر PocketBase Admin API → استيراد المخطط تلقائياً → التحقق من كل خطوة. يحول من 8 خطوات يدوية إلى 0.
  - الجهد: 1-2 أسبوع.
  - المصدر: feature-proposals-2026 (محور 2 — ميزة #11).

- [ ] `[P1]` ⏱️L **طابور مهام وسائط مستمر — BullMQ + Redis** — مهام FFmpeg في الذاكرة فقط، تُفقد عند إعادة تشغيل السيرفر.
  - الملفات: `archive-server/src/media/mediaJobs.js` → استبدال `createInMemoryMediaJobStore`.
  - التنفيذ: `Queue('media-jobs', { connection: redisConnection })`؛ `Worker` بـ concurrency قابل للإعداد (`MEDIA_JOB_CONCURRENCY`)؛ المهام تنجو من إعادة التشغيل؛ أولويات (probe > thumbnail > transcode)؛ إعادة محاولة تلقائية عند الفشل؛ متابعة تقدم المهمة من أي جلسة.
  - الجهد: 3-4 أسابيع.
  - المصدر: feature-proposals-2026 (محور 3 — ميزة #17).

- [ ] `[P1]` ⏱️L **استعادة النسخ الاحتياطية من الواجهة مع استعادة جزئية** — لا واجهة للاستعادة؛ يدوي عبر CLI فقط.
  - الملفات: `archive app/src/pages/DataCenterPage.jsx`، `archive-server/src/backup/backupScheduler.js`.
  - الملف الجديد: `POST /api/admin/backup/restore`.
  - التنفيذ: قائمة النسخ المتاحة مع التاريخ والحجم؛ معاينة محتوى النسخة (عدد السجلات/المخازن) قبل الاستعادة؛ استعادة جزئية (اختيار مخازن محددة)؛ تأكيد مزدوج مع كتابة النص؛ حماية من استعادة نسخة أقدم على بيانات أحدث.
  - الجهد: 3-4 أسابيع.
  - المصدر: feature-proposals-2026 (محور 3 — ميزة #19).

---

### 13.5 P2 — ميزات مبتكرة جديدة

- [ ] `[P2]` ⏱️L **نشر سحابي بنقرة واحدة — Railway / DigitalOcean / Render** — لا أزرار Deploy-to-Cloud في README.
  - الملفات: `README.md`، ملفات `railway.json`/`render.yaml`/`do-app-spec.yaml` جديدة.
  - التنفيذ: أزرار "Deploy to Railway/DigitalOcean/Render" في README؛ 4 متغيرات فقط (DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET)؛ المنصة تتولى البناء والنشر Docker Compose؛ يفتح سوق غير تقني جديد.
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 2 — ميزة #12).

- [ ] `[P2]` ⏱️XL **مساعد ذكي مدمج (AI Copilot) — لوحة جانبية قابلة للطي** — مزودو AI متاحون لكن معزولون في صفحة منفصلة.
  - الملفات الجديدة: `archive app/src/components/ai/AICopilotPanel.jsx`، `archive app/src/components/ai/AICopilotButton.jsx`.
  - التنفيذ: اقتراحات ذكية أثناء إدخال العنوان/الوصف؛ توليد وسوم تلقائية من المحتوى؛ تلخيص عنصر أو مجموعة بنقرة؛ إجابة أسئلة بالعربية عن المحتوى المؤرشف؛ توليد تقارير ذكية (إحصائيات/أنماط/توصيات)؛ لوحة جانبية قابلة للطي لا تعيق العمل.
  - الصلاحية: admin + editor.
  - الجهد: 6-8 أسابيع.
  - المصدر: feature-proposals-2026 (محور 4 — ميزة #22).

- [ ] `[P2]` ⏱️L **سير عمل المراجعة والموافقة (Draft → Review → Approved → Published)** — لا حالات للمحتوى؛ أي مستخدم بإذن تعديل يمكنه نشر مباشرة.
  - الملفات: حقل `status` في `StorageRow.data`؛ `archive app/src/components/review/ReviewWorkflow.jsx`؛ تكامل مع نظام RBAC الموجود.
  - التنفيذ: 4 حالات (مسودة/قيد المراجعة/معتمد/منشور)؛ إشعارات للمراجعين عند تقديم عنصر؛ تعليقات مراجعة منظمة مع طلب تعديلات؛ سجل مراجعة كامل؛ تكامل مع ACL + Comments.
  - الجهد: 4-6 أسابيع.
  - المصدر: feature-proposals-2026 (محور 4 — ميزة #24).

- [ ] `[P2]` ⏱️L **صفحة مساعدة تفاعلية مع جولة إرشادية react-joyride** — صفحة المساعدة الحالية أساسية بلا توجيه.
  - الملفات: `archive app/src/pages/HelpPage.jsx` (موجود → ترقية)؛ `archive app/src/components/onboarding/OnboardingTour.jsx` جديد.
  - التنفيذ: جولة إرشادية (onboarding tour) عبر `react-joyride` للمستخدمين الجدد؛ دليل استخدام تفاعلي مع لقطات شاشة؛ بحث في المحتوى التعليمي؛ تلميحات سياقية (tooltips) على كل ميزة؛ اختصارات لوحة مفاتيح قابلة للاكتشاف.
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 5 — ميزة #27).

---

### ملاحظة: بنود مُغطّاة في أقسام سابقة

| الميزة | تغطيها |
|--------|--------|
| توحيد TagAutocomplete (#2) | Task #79 (pending) |
| إيماءات اللمس للجوال (#4) | Task #79 (pending) |
| PWA Service Worker أساسي (#5 — جزء) | Task #39 (completed) |
| معالج إعداد الويب (#9) | Task #73 (in_progress) |
| إصلاح الثغرات الحرجة (#14) | Tasks #74-#76 (pending) |
| مصادقة إلزامية (#15) | Task #73 (in_progress) |
| مراقبة متقدمة (#18) | Task #57 (completed) |
| تحسين البحث الدلالي (#23) | Tasks #14 + #52 (completed) |
| استخراج i18n (#25) | Task #58 (completed) |
| تحسين Accessibility (#26) | Tasks #22 + #49 (completed) |
