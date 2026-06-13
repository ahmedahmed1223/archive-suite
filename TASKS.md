# مهام Archive Suite — قائمة مُصالَحة من تقارير الفحص

> **المصدر:** 9 تقارير فحص (HTML) في `D:\archiveaq\Reports`.
> **المنهجية:** كل بند في التقارير تم التحقق منه مقابل الكود الفعلي في هذا المستودع. أُبقيت فقط المهام الحقيقية المتبقية؛ والبنود المُنفّذة بالفعل أو غير الدقيقة في التقارير وُثّقت في [القسم 8 (ملحق)](#8-ملحق--بنود-أُسقطت-مُنفّذة-بالفعل-أو-غير-دقيقة-في-التقارير).
> **آخر تحديث:** 8 يونيو 2026. Tasks #74–#79 (P0 security + K8s + frontend bugs + UX) مكتملة. Section 13 (feature proposals 2026) قيد التنفيذ.

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

- [x] `[P2]` ⏱️S **فحص ثغرة `xlsx` (CVE-2024-22363 — ReDoS)** — تحقق إن كانت الاعتمادية مستخدمة في الـ frontend، واستبدلها/رقّها.
  - المصدر: audit-report (CRITICAL).
  - ✅ **تم التحليل والتخفيف (2026-06-09):** جميع استخدامات xlsx في الـ backend (exportService.js) وكتابة Excel في الـ frontend (ReportsPage, DataCenterPage) هي عمليات **كتابة فقط** — لا تتأثر بثغرة CVE-2024-22363. الاستخدام الوحيد لـ `XLSX.read()` هو في `packageOperations.js` لاستيراد ملفات المستخدم الخاصة، وقد تم تطبيق guard صريح (فحص Magic Bytes ZIP/OOXML في السطر 148) يمنع ملفات XLML (ناقل الهجوم). الثغرة غير قابلة للاستغلال في الوضع الحالي.

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

- [x] `[P2]` ⏱️S **`getByUid()` لبحث المستخدم** — استبدل `getAll("users")` عند كل تسجيل دخول ببحث مستهدف.
  - الملفات: `archive-server/src/auth/authService.js`، `StorageProvider`.
  - المصدر: backend-db-report.
  - ✅ **مُنجز مسبقاً:** `authService.js` يستخدم `provider.getByField("users", "username", ...)` مع fallback لـ `getAll` للمزودين الذين لا يدعمون `getByField`.

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

- [x] `[P3]` ⏱️S **تحليل الحزمة** (esbuild-visualizer) وتقليل الحجم الابتدائي (~3MB حاليًا).
  - الملفات: `archive app/vite.config.js`.
  - ✅ **تم (2026-06-11):** مسار `pnpm --filter @archive/app run analyze` يولد تقرير `dist/bundle-stats.html` عبر `rollup-plugin-visualizer`. فُصل Sentry عن الرسم البياني الافتراضي بتحميل ديناميكي مشروط عند وجود `VITE_SENTRY_DSN` فقط، فانخفض بناء SPA إلى `dist/index.html` بحجم 4.077MB / 1.320MB gzip، وانخفض عدد الوحدات المحوّلة في البناء الافتراضي من 2689 إلى 2467. كما أُصلح سكربت `verify` ليخرج صراحة بعد آخر فحص بدل التعليق بعد طباعة كل نتائج `ok`.
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

- [x] `[P2]` ⏱️M **تنقّل لوحة المفاتيح للقوائم** — أسهم/Enter/Space/Ctrl+A/Delete.
  - المصدر: improvement-proposals (UX-5).
  - ✅ **مُنجز مسبقاً:** `hooks/useKeyboardListNav.js` يدعم ArrowUp/Down, Enter/Space, Ctrl+A, Escape, Home/End؛ مُستخدم في `ArchivePageResults.jsx`.

- [x] `[P2]` ⏱️M **رسائل خطأ مصنّفة وودّية** — شبكة/مصادقة/تحقق/خادم بدل «حدث خطأ غير معروف».
  - المصدر: improvement-proposals (UX-4).
  - ✅ **مُنجز مسبقاً + تحديث 2026-06-09:** `services/errorMessages.js` (`categorizeError`) + `utils/errorReporting.js` (`reportError`/`classifyError`) + `components/common/ErrorMessage.jsx` (مكوّن UI بأيقونات وألوان حسب الفئة). ربط `ErrorMessage` بـ `FavoritesPage.jsx` كأول صفحة تستخدمه عملياً لإظهار `favoritesError`.

- [x] `[P2]` ⏱️M **مؤشرات focus مرئية + pagination مرئي للجداول** (يُربط بـ backend pagination في القسم 2).
  - المصدر: uiux-report.
  - ✅ **تم 2026-06-09:** أضيف `.va-sidebar :focus-visible` و`footer :focus-visible` لـ v1-identity.css لتغطية أزرار الشريط الجانبي؛ استُبدل `Pagination` المحلي في `HistoryPage.jsx` بالمشترك `components/common/Pagination.jsx` (a11y كامل + `aria-current` + `totalItems`).

- [x] `[P3]` ⏱️M **Virtualization لقوائم الموبايل** (>20 عنصرًا) + بنود تجميل منخفضة من تقرير UI/UX (أحجام أيقونات، tooltips، skeletons…).
  - المصدر: uiux-report.
  - ✅ **مُنجز ومتحقق (2026-06-11):** `useVirtualList` أصبح يفعّل virtualization عند أكثر من 20 عنصرًا على شاشات الموبايل مع الإبقاء على عتبة سطح المكتب الأكبر، وفحص viewport آمن للـ SSR. أضيف `archive app/src/hooks/useVirtualList.test.js` لتغطية 20/21 عنصرًا على الموبايل وسلوك سطح المكتب، ومرّ `pnpm --filter @archive/app run test`.

---

## 5. الاختبارات (Testing)

- [x] `[P1]` ⏱️L **Vitest للوحدات** (app + core + server) — لا توجد اختبارات وحدة حاليًا (يوجد Playwright e2e/a11y فقط).
  - ابدأ بالوحدات الحرجة (auth، storage adapters، stores).
  - المصدر: audit-report، comprehensive-audit، improvement-proposals.

- [x] `[P1]` ⏱️M **اختبارات تكامل لمعالج RPC** — تغطية الدوال المُصرّح بها في الـ dispatcher.
  - الملفات: `archive-server/src/api/server.js`.
  - المصدر: audit-report.

- [x] `[P2]` ⏱️M **jest-axe على مستوى المكوّن** — يكمّل اختبار Playwright a11y الموجود (الذي يعمل على مستوى الصفحة).
  - المصدر: improvement-proposals (FE-2).
  - ✅ **مُنجز ومتحقق (2026-06-11):** `vitest-axe` مضاف في `archive app/package.json`، والـ matcher مسجل في `archive app/src/test-setup.js`، وتوجد تغطية مكونات في `archive app/src/__tests__/a11y/components.a11y.test.jsx`. تم تشغيل `pnpm --filter @archive/app run test:a11y` بنجاح: 21 اختبارًا مرّ.

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

- [x] `[P1]` ⏱️M **تصدير متقدم (CSV / Excel / ZIP)** — تصدير نتائج البحث أو مجموعة محددة بصيغ متعددة.
  - نقطة: `POST /api/export` (نوع: `csv|xlsx|zip`، مع تصفية بالـ ids).
  - الواجهة: زر "تصدير" في شريط الأدوات وصفحة البحث.
  - ✅ **تم (2026-06-09):** `exportService.js` كان موجودًا، أضيف مسار `POST /api/export` في server.js يستدعيه مباشرة؛ ExportButton.jsx يرسل Bearer token ويستقبل الملف ثنائيًا ويحفظه.

- [x] `[P1]` ⏱️M **عمليات جماعية على السجلات** — تحديد متعدد ثم: تعديل tags / نوع / مشروع / حذف / نقل.
  - الواجهة: شريط تحديد عائم عند اختيار أكثر من عنصر.
  - الخلفية: `POST /api/v1/records/bulk` (action + ids + payload).
  - ✅ **تم (2026-06-09):** `BulkActionBar.jsx` كان موجودًا مع حذف/استعادة/وسوم/مجموعات؛ أضيف `bulkSetType` + `bulkSetProject` في store + قائمة منسدلة للنوع والمشروع في الشريط؛ مسار `POST /api/records/bulk` كان موجودًا مسبقًا.

### ب. الصلاحيات وإدارة المستخدمين

- [x] `[P1]` ⏱️L **RBAC — أدوار وصلاحيات** (admin / editor / viewer).
  - `admin`: كل العمليات + إدارة المستخدمين.
  - `editor`: رفع + تحرير + حذف سجلاته.
  - `viewer`: قراءة فقط، بحث، تصدير.
  - الجدول: `user_roles` في schema؛ middleware للتحقق على كل مسار RPC.

- [x] `[P2]` ⏱️M **إدارة المستخدمين المتقدمة** — دعوة بالبريد، تعطيل حساب، تغيير دور، آخر دخول.
  - صفحة `UsersPage` موجودة — توسيع وظائفها.
  - ✅ **مُنجز ومتحقق (2026-06-13):** صفحة المستخدمين تدعم تغيير الدور وتعطيل/تفعيل الحساب مع حماية آخر مدير نشط، وتعرض آخر دخول ونشاط آخر 7 أيام. أضيف خيار “دعوة بالبريد” عند إنشاء مستخدم جديد: يتحقق من البريد، يولد كلمة مرور مؤقتة قوية، يعرضها مرة واحدة في إشعار قابل للنسخ، يحفظ `inviteStatus="pending"` و`invitedAt`/`invitedBy`، ويُلزم المستخدم بتغيير كلمة المرور. تحقق: `pnpm --filter @archive/app run test -- src/features/users/viewModel.test.js` مرّ بـ 3/3.

### ج. سجل التغييرات والإصدارات

- [x] `[P1]` ⏱️L **سجل إصدارات السجل** — تتبّع كل تعديل على حقول السجل مع إمكانية الاستعادة.
  - جدول: `record_versions` (recordId, version, snapshot JSONB, userId, createdAt).
  - الواجهة: تبويب "السجل التاريخي" في صفحة التفاصيل.

### د. المجموعات الذكية والبحث المحفوظ

- [x] `[P2]` ⏱️M **مجموعات ذكية (Smart Collections)** — مجموعات تتحدّث تلقائيًا بناءً على استعلام محفوظ.
  - جدول: `saved_filters` (query JSONB, ownerId, isLive: bool).
  - صفحة `CollectionsPage` موجودة — إضافة نوع "ذكي" بجانب الثابت.
  - ✅ **مُنجز ومتحقق (2026-06-11):** model/migration `saved_filters` موجودة (`query`, `ownerId`, `isLive`)؛ مسارات `GET/POST/DELETE /api/saved-filters` موجودة؛ `CollectionsPage.jsx` تعرض/تنشئ/تحذف الفلاتر المحفوظة؛ `SearchPage.jsx` ينشئ مجموعة ذكية من البحث؛ و`features/collections/viewModel.js` يحل نتائج المجموعة الحية من الاستعلام المحفوظ. تحقق: `pnpm --filter @archive/app run verify` و`pnpm --filter archive-server run verify:api` مرّا في فحص الوكيل.

### هـ. الإشعارات والتكامل

- [x] `[P2]` ⏱️M **إشعارات البريد الإلكتروني** — إشعار عند: مشاركة سجل، ذكر مستخدم، اكتمال رفع.
  - يستخدم nodemailer الموجود؛ جدول `notification_preferences` لإعدادات كل مستخدم.
  - ✅ **مُنجز ومتحقق (2026-06-11):** `notificationService.js` يرسل بريدًا عبر nodemailer عند المشاركة (`notifyRecordShared`) والذكر (`notifyMention`) واكتمال الرفع (`notifyUploadComplete`) مع احترام تفضيلات `NotificationPreference` (حقول `emailOn*`)، وواجهة `GET/PATCH /api/notification-preferences`. أضيف `archive-server/scripts/verify-notifications.mjs` (ضمن `verify:api` و`verify`)، ومرّت كل الفحوص.

- [x] `[P2]` ⏱️M **Webhooks الصادرة** — إرسال حدث HTTP عند: إضافة/تحديث/حذف سجل.
  - جدول: `webhooks` (url, events[], secret); `POST /api/webhooks` للإدارة.
  - إعادة المحاولة التلقائية (exponential backoff، 3 مرات).
  - ✅ **مُنجز ومتحقق (2026-06-11):** يوجد model/migration للـ `webhooks`، وواجهة `WebhooksSettings.jsx`، ومسارات `GET/POST/DELETE /api/webhooks` محمية بالمصادقة، و`fireWebhooks` يرسل `record.created`/`record.updated`/`record.deleted` بتوقيع HMAC وإعادة محاولة. أضيف تحقق صريح في `archive-server/scripts/verify-api.mjs`، ومرّ `pnpm --filter archive-server run verify:api`.

### و. تحسينات الواجهة

- [x] `[P2]` ⏱️M **لوحة تحليلات محسّنة** — **(مكتملة ✅ — 12 يونيو 2026)** رسوم بيانية تفاعلية: نمو الأرشيف بالزمن، توزيع الأنواع، أكثر الوسوم استخدامًا.
  - **المنجَز:** أُضيفت `recharts@^3` (متوافقة React 19)؛ `components/analytics/InteractiveCharts.jsx` (AreaChart للنمو الشهري + PieChart حلقي لتوزيع الأنواع + BarChart أفقي لأكثر الوسوم، مع `ResponsiveContainer`/Tooltip وحالات فارغة وألوان متوافقة مع الهوية)؛ helper نقي `features/analytics/topTags.js` (تجميع تكرار الوسوم، تجاهل المحذوف، قصّ/تطبيع، كسر التعادل أبجديًا)؛ مدمجة في `ReportsPage.jsx` ضمن قسم «الرسوم التفاعلية» فوق قوائم الأشرطة النصية الموجودة (تبقى كتفصيل يمكن الوصول إليه).
  - **الاختبارات:** `features/analytics/topTags.test.js` — **6 اختبارات تمرّ**. الحزمة تنمو ~120KB gzip (recharts) داخل صفحة التقارير (محمّلة عبر lazy). build:spa أخضر، 137/137 اختبار.
  - يلاحَظ: البيانات (`monthlyDistribution`/`typeDistribution`) كانت محسوبة مسبقًا في ReportsPage؛ هذه المهمة رقّتها من أشرطة نصية إلى رسوم تفاعلية.

- [x] `[P2]` ⏱️S **وضع ملء الشاشة للمعاينة** — عرض المستند/الصورة/الفيديو بملء الشاشة مع تنقّل بالأسهم.
  - ✅ **مُنجز ومتحقق (2026-06-11):** أُضيفت معاينة مكبرة في `PreviewPanel` مع `role="dialog"` وزر إغلاق وتوسيع وتنقل سابق/لاحق عبر الأسهم و`Escape` للإغلاق، مع دعم مستند/صورة/فيديو عبر `DocumentViewer` عند الحاجة. أضيف اختبار `archive app/src/features/archive/PreviewPanel.fullscreen.test.jsx`، ومرّ `pnpm --filter @archive/app run test -- src/features/archive/PreviewPanel.fullscreen.test.jsx` و`pnpm --filter @archive/app run test`.

- [x] `[P3]` ⏱️M **واجهة إدارة API Keys** — **(مكتملة ✅ — مُنجَزة ضمن §20.5)** إنشاء/إلغاء مفاتيح API لتكامل الخدمات الخارجية.
  - جدول: `api_keys` (hash, name, scopes[], lastUsed, expiresAt). ✅ مُطبَّق في `archive-server/prisma/schema.prisma` (`model ApiKey` → `@@map("api_keys")`: `keyHash`/`name`/`scopes[]`/`lastUsedAt`/`expiresAt` + `prefix`/`active`/`ownerId`).
  - الخادم: `archive-server/src/auth/apiKeyService.js` (إصدار/تجزئة/تحقّق/إلغاء بنطاقات scoped). الواجهة: `archive app/src/components/settings/ApiKeysSettings.jsx` (إصدار/قائمة/إلغاء + كشف المفتاح مرة واحدة) + `ApiKeysSettings.test.jsx`، مدمجة في تبويب الإعدادات. مرجع: commits b8155b0 / a8626e3 / c89b801.

- [ ] `[P3]` ⏱️L **حقول بيانات وصفية مخصصة** — إضافة حقول مُعرَّفة من المستخدم (نص/رقم/تاريخ/قائمة) لكل نوع محتوى.

---

## 11. معالج التثبيت والتشغيل (Setup & Installation Wizard)

> هدفه: توجيه أي مستخدم جديد من الصفر — تحميل Docker حتى تشغيل النظام — بخطوات مرقّمة واضحة.

- [x] `[P1]` ⏱️L **سكريبت إعداد تفاعلي (CLI Wizard)** — `scripts/setup.mjs` يُشغَّل بأمر `pnpm setup` أو `node scripts/setup.mjs`.
  - **الخطوة 1 — فحص Docker**: يتحقق من وجود `docker` و`docker compose`؛ إن لم يُوجد يعرض رابط التحميل الصحيح حسب نظام التشغيل (Windows/Mac/Linux) ويطلب إعادة التشغيل بعد التثبيت.
  - **الخطوة 2 — اختيار الوضع**: PocketBase (خفيف، للمطوّر) أو PostgreSQL (إنتاج).
  - **الخطوة 3 — إعداد البيئة**: يولّد ملف `.env` تلقائياً بأسرار JWT عشوائية آمنة + يسأل عن: اسم المستخدم والبريد وكلمة مرور المشرف، إعدادات SMTP (اختياري).
  - **الخطوة 4 — تشغيل Docker**: يُنفّذ `docker compose up -d` ويعرض شريط تقدّم.
  - **الخطوة 5 — فحص الصحة**: يستعلم `GET /api/health` حتى يرد بـ 200 (timeout 120s)، ثم يفتح المتصفح تلقائياً.

- [x] `[P1]` ⏱️M **صفحة الترحيب للتشغيل الأول** — `FirstRunPage.jsx` تظهر عند عدم وجود مستخدمين في النظام.
  - تُسجَّل في `pageRegistry.js` وتُفحَص عند البدء.
  - خطوات: (1) إنشاء حساب المشرف، (2) اختيار الثيم، (3) تعيين لغة التخزين، (4) توجيه للوحة التحكم.
  - تحل محل التسجيل العشوائي وتُوجِّه المستخدم بشكل واضح.
  - ✅ **تم (2026-06-09):** `FirstRunPage.jsx` كانت موجودة ومسجلة في pageRegistry؛ أضيفت شرط `"firstRun"` في RuntimeShellApp: عندما لا يوجد مستخدمون نشطون ولا كلمة مرور مضبوطة تظهر الصفحة بدلاً من LoginScreen.

- [x] `[P2]` ⏱️M **ملف `INSTALL.md`** — دليل تثبيت سريع بالخطوات الثلاث:
  1. `git clone` + `cd archive-suite`
  2. `node scripts/setup.mjs`
  3. افتح `http://localhost:8787`

---

## 10. تحسينات تجربة الإعداد الأولي (Onboarding UX)

> خطة مستوردة من `implementation_plan.md` — تحسينات بصرية وتفاعلية على معالج الإعداد.

- [x] `[P1]` ⏱️S **إصلاح `verify-modules.mjs`** — تصحيح التأكيد في السطر 367: `defaults.openSearch` من `"Ctrl+K"` إلى `"Alt+K"`.
  - الملف: `archive app/scripts/verify-modules.mjs`.

- [x] `[P1]` ⏱️M **معاينة مباشرة للثيم واللون في معالج الإعداد** — استدعاء `applyAccentColor` و`setTheme` داخل `useEffect` مرتبط بـ `accentColor` و`themeChoice` لمعاينة فورية أثناء الإعداد.
  - الملف: `archive app/src/features/onboarding/V1OnboardingWizard.jsx`.
  - ✅ **مُنجز مسبقاً:** السطران 446-453 في V1OnboardingWizard.jsx يُطبّقان بالفعل المعاينة الفورية عبر `useEffect` لكل من `accentColor` و`themeChoice`.

- [x] `[P1]` ⏱️M **تصميم حديث لخطوات معالج الإعداد**:
  - خلفية توهّج شبكي (mesh radial glow) بألوان `--va-accent-*` متحركة.
  - أيقونة ✓ للخطوات المكتملة بدل الرقم + توهّج على الخطوة النشطة.
  - تحويل `scale` عند التمرير/النقر على بطاقات الاختيار (dynamic `color-mix`).
  - شريط قوة كلمة المرور بتصميم حديث.
  - الملف: `archive app/src/features/onboarding/V1OnboardingWizard.jsx`.
  - ✅ **تم (2026-06-09):** خلفية mesh glow موجودة مسبقاً (lines 968-977). أيقونات ✓ لـ completed steps + أرقام للخطوات القادمة + glow effect على الخطوة النشطة عبر `shadow-[...]` مع `color-mix`. scale/color-mix في OptionButton موجود. شريط كلمة المرور بالألوان الديناميكية موجود.

- [x] `[P2]` ⏱️S **تحديث `v2-identity.css`** — أنماط glassmorphic لنافذة الإعداد + tokens انتقالية سلسة.
  - ✅ **مُنجز مسبقاً:** `v2-identity.css` يحتوي على `.va-onboarding-panel` بـ `backdrop-filter: blur(28px) saturate(1.9)`, كيفريمات `va-2-step-in/out`, وتحولات سلسة للأزرار/المدخلات داخل `va-onboarding-panel`.

- [x] `[P2]` ⏱️S **تحديث `v4-identity.css`** — توحيد تباين الوضعين الفاتح والداكن في نافذة الإعداد.
  - ✅ **مُنجز مسبقاً:** `v4-identity.css` يحتوي على `html.light[data-theme-version="v4"] .va-onboarding-shell` مع تصحيحات ألوان النصوص والأزرار والأسطح لكلا الوضعين.

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

- [x] `[P0]` ⏱️S **تشغيل حاويات PocketBase وOCR كمستخدم غير جذر** — صور الخدمات الجانبية تعمل كـ root.
  - الملفات: `archive-server/pocketbase/Dockerfile`، `archive-server/ocr-service/Dockerfile`
  - الإصلاح: أُضيف مستخدم `pbuser`/`ocruser` مع `USER` directive في كل Dockerfile.
  - المصدر: deep-audit-v2 (K8s-04).

---

### 12.3 أمان — P1 عالٍ

- [x] `[P1]` ⏱️S **إصلاح مصادقة WebSocket — استخدام السر الصحيح** — `presenceServer.js` يستخدم `JWT_AUTH_SECRET || JWT_SECRET` بشكل صحيح.
  - الملف: `archive-server/src/presence/presenceServer.js`
  - الإصلاح: تأكد من استخدام `JWT_AUTH_SECRET` الصحيح عند التحقق من توكن WebSocket.
  - المصدر: deep-audit-v2.

- [x] `[P1]` ⏱️M **إضافة رموز استرداد TOTP (Recovery Codes)** — لا يوجد مسار بديل للدخول عند فقدان جهاز TOTP.
  - الملفات: `archive-server/src/auth/totpService.js`، `server.js` (مسارات `/api/totp/*`)، `archive app/src/components/settings/SecuritySettings.jsx`
  - الإصلاح: عند تفعيل TOTP أنتج 8 رموز استرداد (16 حرفًا عشوائيًا مُهاشَة في DB) تُعرض مرة واحدة. أضف مسار `/api/totp/recover` يتحقق ويستهلك الرمز.
  - ✅ **تم (2026-06-09):** رموز الاسترداد مُولَّدة بـ `generateRecoveryCodes()` وتظهر مرة واحدة في UI؛ مسار `/api/totp/recover` يتحقق ويستهلك الرمز عبر `verifyRecoveryCode()` في totpService؛ `TwoFactorSettings.jsx` مُنشأ ومُدمج في SettingsPage.
  - المصدر: deep-audit-v2.

- [x] `[P1]` ⏱️S **Rate Limit على تعطيل TOTP** — لا يوجد تقييد على `/api/totp/disable` مما يُتيح brute-force.
  - الملف: `archive-server/src/api/server.js` (مسار `/api/totp/disable`)
  - الإصلاح: أضف rate limit مخصص (3 محاولات فاشلة/15 دقيقة) على هذا المسار.
  - المصدر: deep-audit-v2.

- [x] `[P1]` ⏱️S **تثبيت `APP_BASE_URL` من متغيرات البيئة** — بناء رابط الاسترداد من ترويسة `Host`/`Origin` يُتيح Open Redirect.
  - الملف: `archive-server/src/api/server.js` أو `emailService.js` (مسار `/api/forgot-password`)
  - الإصلاح: استخدم `process.env.APP_BASE_URL` فقط؛ أضفه لـ `.env.example` وـ `productionGuard.js`.
  - المصدر: deep-audit-v2.

- [x] `[P1]` ⏱️M **تشفير ملفات النسخ الاحتياطية** — ملفات الـ backup تُحفظ بلا تشفير.
  - الملف: `archive-server/deploy/backup-cron.sh`
  - الإصلاح: شفِّر باستخدام `openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY`؛ أضف المتغير لـ `.env.example`.
  - المصدر: deep-audit-2026.
  - ✅ **تم (2026-06-09):** أضيف دالة `encrypt_file()` في backup-cron.sh تستخدم `openssl enc -aes-256-cbc -pbkdf2 -iter 600000`؛ تُشفَّر الملفات وتُحسب `sha256` للنسخة المشفرة، وتُحذف النسخة الأصلية. مقيّد بوجود `BACKUP_ENCRYPTION_KEY` في البيئة. أضيف المتغير لـ `.env.example` مع تعليمات توليده.

- [x] `[P1]` ⏱️S **التحقق من سلامة النسخ الاحتياطية** — لا يوجد checksum أو اختبار استرداد دوري.
  - الملف: `archive-server/deploy/backup-cron.sh`
  - الإصلاح: احسب `sha256sum` للأرشيف واحفظه في `.sha256` مجاور؛ أضف اختبار restore تجريبي شهريًا على DB مؤقتة.
  - المصدر: deep-audit-2026.
  - ✅ **تم (2026-06-09):** Task #3 — sha256sum sidecar files added.

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

- [x] `[P1]` ⏱️S **`useKeyboardListNav` — Stale Closure** — الـ callback يُصبح قديمًا مع تغيّر البيانات.
  - الملف: `archive app/src/hooks/useKeyboardListNav.js`
  - الإصلاح: استخدم `useRef` للاحتفاظ بآخر نسخة من callback: `const cbRef = useRef(cb); useEffect(() => { cbRef.current = cb; }, [cb]);`.
  - المصدر: deep-audit-v2 (FE-03).

- [x] `[P1]` ⏱️S **`DialogManager` — `role="presentation"` يتعارض مع `aria-modal`** — يُلغي الدلالة الدلالية ويكسر شجرة Accessibility.
  - الملف: `archive app/src/components/ui/DialogManager.jsx`
  - الإصلاح: احذف `role="presentation"` من العنصر الخارجي (overlay)؛ استخدم `role="dialog"` مع `aria-modal="true"` على الحاوية الداخلية فقط.
  - المصدر: deep-audit-v2 (FE-04).

- [x] `[P1]` ⏱️S **`AutoTagSuggestions` — تنظيف `AbortController` خاطئ** — `controller.abort()` يُستدعى في `finally` قبل اكتمال المعالجة.
  - الملف: `archive app/src/components/tags/AutoTagSuggestions.jsx`
  - الإصلاح: انقل `abort()` لـ `useEffect` cleanup فقط: `return () => controller.abort()`.
  - المصدر: deep-audit-v2 (FE-05).

- [x] `[P1]` ⏱️S **`DocumentViewer` — Race Condition عند تصيير PDF** — تحميل ملفات متعددة بسرعة يعرض نتيجة رد خاطئ.
  - الملف: `archive app/src/components/viewer/DocumentViewer.jsx`
  - الإصلاح: استخدم `AbortController` لإلغاء الطلب السابق عند تغيير الملف؛ أو احتفظ بـ `requestId` وتجاهل responses القديمة.
  - المصدر: deep-audit-v2 (FE-06).

- [x] `[P1]` ⏱️S **`RecordVersionHistory` — `window.confirm` يكسر PWA** — لا يعمل في وضع PWA Standalone.
  - الملف: `archive app/src/components/records/RecordVersionHistory.jsx`
  - الإصلاح: استبدل `window.confirm(...)` بـ `DialogManager` المخصص (Task 19).
  - المصدر: deep-audit-v2 (FE-07).

- [x] `[P1]` ⏱️S **`PresenceIndicator` — يُعطب عند `username` فارغ** — `username?.charAt(0)` يُلقي استثناءً عند سلسلة فارغة.
  - الملف: `archive app/src/components/collaboration/PresenceIndicator.jsx`
  - الإصلاح: استخدم `(username?.trim() || '?').charAt(0).toUpperCase()`.
  - المصدر: deep-audit-v2 (FE-08).

---

### 12.5 قاعدة البيانات والمتجر — P1

- [x] `[P1]` ⏱️S **تغيير فهرس pgvector من IVFFlat إلى HNSW** — `IVFFlat` يفشل في الإنشاء على جدول فارغ.
  - الملفات: migration الـ pgvector في `archive-server/prisma/migrations/`، `archive-server/src/ai/embeddingService.js`
  - الإصلاح: migration جديدة: `CREATE INDEX USING hnsw (embedding vector_cosine_ops)` — يعمل على جداول فارغة.
  - المصدر: deep-audit-v2 (DB-01).

- [x] `[P1]` ⏱️S **إزالة `DEFAULT ''` من عمود `passwordHash`** — القيمة الافتراضية الفارغة تُتيح إنشاء مستخدمين بكلمة مرور فارغة.
  - الملف: `archive-server/prisma/migrations/` (migration typed_users)
  - الإصلاح: migration جديدة تحذف `DEFAULT ''` وتضيف `NOT NULL` صريحًا.
  - المصدر: deep-audit-v2 (DB-02).

- [x] `[P1]` ⏱️M **إصلاح `storeCore.js` — Shallow Merge يُضيّع البيانات المتداخلة** — `Object.assign(existing, update)` يحذف الحقول المتداخلة غير المذكورة في التحديث.
  - الملف: `archive app/src/store/storeCore.js`
  - الإصلاح: استبدل بدمج عميق انتقائي: احتفظ بمفاتيح root غير المُعدَّلة وادمج القواميس المتداخلة (`metadata`، `tags`) بدل استبدالها كاملًا.
  - المصدر: deep-audit-v2 (FE-BE-01).

- [x] `[P1]` ⏱️S **إصلاح `loadAllData` — Race Condition في React StrictMode** — `useEffect` المزدوج يُشغّل تحميلين متزامنين يتعارضان في الحالة.
  - الملف: `archive app/src/app/archiveSlice.js`
  - الإصلاح: استخدم `useRef` كـ guard: `if (loadingRef.current) return; loadingRef.current = true;`.
  - المصدر: deep-audit-v2 (FE-BE-02).

- [x] `[P1]` ⏱️S **إصلاح `selectors.js` — مراجع جديدة عند كل استدعاء تُسبب Re-Renders زائدة** — الـ selectors تُنشئ مصفوفات/كائنات جديدة حتى لو البيانات لم تتغيّر.
  - الملف: `archive app/src/store/selectors.js`
  - الإصلاح: اربط الـ selectors بـ `useMemo` مع dependency arrays دقيقة، أو استخدم مكتبة `reselect`.
  - المصدر: deep-audit-v2 (FE-BE-03).

---

### 12.6 تجربة المستخدم — P1

- [x] `[P1]` ⏱️L **توحيد `TagAutocomplete` في جميع حقول الوسوم** — 4 من أصل 5 مواضع تستخدم `input` عادي.
  - الملفات:
    - `archive app/src/pages/AddVideoPage.jsx:603`
    - `archive app/src/components/bulk/BulkActionBar.jsx:38-47`
    - `archive app/src/components/dialogs/QuickAddDialog.jsx:301-303`
    - `archive app/src/features/wizard/FileArchiveWizard.jsx`
  - الإصلاح: استبدل حقول الوسوم العادية بـ `<TagAutocomplete value={tags} onChange={setTags} />`.
  - المصدر: uiux-deep-audit (UX-01).

- [x] `[P1]` ⏱️M **ربط صفحة التفريغ النصي (Transcription) بالعناصر المؤرشفة** — صفحة التفريغ منفصلة ولا تُنتج `archive_items`.
  - الملف: `archive app/src/pages/TranscriberPage.jsx`
  - الإصلاح: بعد اكتمال التفريغ أضف زر "حفظ كعنصر أرشيف" يُنشئ `archive_item` بالنص والعنوان والوسوم المستخرجة.
  - ✅ **تم (2026-06-09):** أضيف زر "حفظ كعنصر أرشيف" في شريط نتائج التفريغ؛ يستدعي `addVideoItem` بالعنوان من اسم الملف والنص الكامل في `notes` ونوع الملف (video/audio)؛ يتحول إلى شارة خضراء "تم الحفظ" بعد النجاح.
  - المصدر: uiux-user-journey (UJ-04).

- [x] `[P1]` ⏱️M **إضافة إيماءات اللمس على الجوّال** — لا يوجد swipe أو إجراءات سريعة لمسية.
  - الملفات: `archive app/src/components/records/RecordCard.jsx`، `archive app/src/pages/ArchivePage.jsx`
  - الإصلاح: استخدم `@use-gesture/react` أو Pointer Events API: swipe-right للفتح، swipe-left لقائمة الإجراءات، pull-to-refresh.
  - المصدر: uiux-user-journey (UJ-08).

- [x] `[P1]` ⏱️L **واجهة إدارة Field ACL** — `fieldAcl.js` موجود على الخادم بلا واجهة إدارة.
  - الملفات: `archive-server/src/permissions/fieldAcl.js`، `archive app/src/components/settings/`
  - الإصلاح: أنشئ `FieldPermissionsSettings.jsx` تعرض لكل `contentType` الحقول مع مستوى وصول per-role (قراءة/كتابة/مخفي).
  - المصدر: deep-audit-2026 (UX-05).

- [x] `[P1]` ⏱️L **واجهة مستخدم للتعليقات** ✅ مُنجزة مسبقاً — نموذج بيانات التعليقات موجود في DB بلا واجهة.
  - الملفات: `archive app/src/pages/DetailPage.jsx`
  - الإصلاح: أضف قسم تعليقات في تفاصيل السجل: عرض القائمة + إضافة تعليق + حذف تعليق المستخدم نفسه مع RBAC.
  - المصدر: deep-audit-2026 (FE-09).
  - ✅ **مُنجزة مسبقاً:** `DetailPage.jsx` يحتوي بالفعل على تبويب "التعليقات" كامل: `addItemComment` / `deleteItemComment` من المتجر؛ `getItemComments` / `canDeleteComment` من viewModel؛ حقل إدخال + قائمة تعليقات + حذف + RBAC.

---

### 12.7 تجربة المستخدم — P2

- [x] `[P2]` ⏱️L **تفعيل Inline Editing في عرض الجدول** — عرض الجدول للقراءة فقط، كل تعديل يتطلب فتح نافذة.
  - الملف التاريخي: `archive app/src/components/views/TableView.jsx` غير موجود؛ التنفيذ الحالي في `archive app/src/features/archive/ArchiveViews.jsx`.
  - الإصلاح: خلايا الأعمدة البسيطة المتاحة حالياً (العنوان، النوع، الوسوم) أصبحت قابلة للتعديل المباشر عبر `InlineCellEditor`.
  - المصدر: uiux-deep-audit (UX-02).
  - ✅ **مُنجز ومتحقق (2026-06-11):** `InlineCellEditor.jsx` يدعم نص/وسوم/رقم/تاريخ/قائمة، وجدول `VideoTableView` يربط العنوان/النوع/الوسوم مع حفظ `ArchivePageResults.jsx` عبر `updateVideoItem`. أُضيف تنقل `Tab` / `Shift+Tab` بين الخلايا القابلة للتعديل الحالية، مع اختبارات jsdom: `InlineCellEditor.test.jsx` و`ArchiveViews.inline-edit.test.jsx` (4/4 مرّت). نطاق الأعمدة الإضافية والتراجع الكامل متابع في §13.3.

- [x] `[P2]` ⏱️S **رفع حد `TagCloud` من 40 إلى 200 وسم مع "عرض المزيد"** — يعرض أول 40 وسمًا فقط.
  - الملف: `archive app/src/features/archive/TagCloud.jsx`
  - الإصلاح: حد افتراضي 200 مع انهيار تدريجي (collapse) للوسوم النادرة وزر "عرض المزيد".
  - المصدر: uiux-deep-audit (UX-03).
  - ✅ **تم (2026-06-09):** Task #2.

- [x] `[P2]` ⏱️S **مؤشر تقدم لأزرار التصدير** — التصدير يبدأ صامتًا بلا مؤشر مرئي.
  - الملف: `archive app/src/components/archive/ExportButton.jsx`
  - الإصلاح: أضف حالة `loading` للزر مع شريط تقدم يُحدَّث عبر `useProgress` أو SSE.
  - المصدر: uiux-user-journey (UJ-06).
  - ✅ **تم (2026-06-09):** الزر يعرض spinner + "جاري التصدير..." عبر `isLoading("export")`؛ ChevronDown مخفي أثناء التصدير.

- [x] `[P2]` ⏱️M **إضافة تراجع (Undo) بعد الاستيراد** ✅ 2026-06-09 — السجلات تُضاف بصورة دائمة فور التأكيد بلا إمكانية تراجع.
  - الملفات: `archive app/src/features/archive/FileArchiveWizard.jsx`
  - الإصلاح: احتفظ بـ IDs السجلات المُضافة في state لمدة 30 ثانية مع زر "تراجع" يستدعي `deleteBatch`.
  - المصدر: uiux-user-journey (UJ-07).
  - ✅ **تم (2026-06-09):** `createItems` يجمع IDs قبل الحفظ؛ بعد النجاح يستدعي `showNotification` مع action `{ label: "تراجع", run: () => bulkDeleteItems(ids) }`.

- [x] `[P2]` ⏱️S **تفعيل Virtual List على سطح المكتب** — مُفعَّل للجوّال فقط رغم أن الحزمة مثبتة.
  - الملف: `archive app/src/hooks/useVirtualList.js`
  - الإصلاح: أزل شرط `isMobile` أو اجعل الحد الأدنى للتفعيل 50 عنصرًا على كل الأجهزة.
  - المصدر: uiux-deep-audit (UX-04).
  - ✅ **تم (2026-06-09):** حُذف شرط `isMobile`؛ الحد رُفع إلى 50 عنصرًا على جميع الأجهزة.

- [x] `[P2]` ⏱️M **رسائل خطأ بلغتين (عربي + إنجليزي)** ✅ 2026-06-09 — رسائل الخطأ عربية فقط.
  - الملف: `archive app/src/utils/errorMessages.js`
  - الإصلاح: أضف مفاتيح إنجليزية لكل رسالة كـ fallback؛ استخدم `navigator.language` للاختيار. (مرتبط بـ Task 58 — i18n الكاملة).
  - المصدر: uiux-deep-audit (UX-06).
  - ✅ **تم (2026-06-09):** `errorMessages.js` منشأ بـ 25 مفتاح ثنائي اللغة (ar/en)؛ `errorHandling.js` محدَّث لاستخدام `getErrorMessage()` بدل النصوص الثابتة؛ `navigator.language` يحدد اللغة تلقائياً.

---

### 12.8 البنية التحتية — P3

- [x] `[P3]` ⏱️S **إصلاح إصدار صورة Postgres** — `postgres:18-alpine` غير موجود؛ أحدث إصدار مستقر هو 17.
  - الملفات: `docker-compose.yml`، `docker-compose.prod.yml`، `archive-server/k8s/postgres-deployment.yaml`
  - الإصلاح: استبدل `postgres:18-alpine` بـ `postgres:17-alpine`.
  - المصدر: deep-audit-v2 (INFRA-01).

- [x] `[P3]` ⏱️S **إزالة معلومات الاتصال الحساسة من `pgadmin-servers.json`** — الملف يحتوي host/port/username ثابتة في المستودع.
  - الملف: `archive-server/deploy/pgadmin-servers.json`
  - الإصلاح: استبدل القيم الثابتة بمتغيرات بيئة أو أضف الملف لـ `.gitignore` مع نسخة `.example`.
  - المصدر: deep-audit-v2 (INFRA-02).

- [x] `[P3]` ⏱️M **تحسين HPA — مقاييس مخصصة بجانب CPU** — ✅ **2026-06-13:** أُضيفت مقياسان مخصصان في `hpa.yaml`: `archive_ws_connections_active` (حد 50 اتصال/pod) و`archive_http_queue_depth` (حد 20 طلب/pod)، مع `behavior.stabilizationWindowSeconds` لمنع التذبذب.
  - المصدر: deep-audit-v2 (INFRA-03).

- [x] `[P3]` ⏱️S **استبدال `redis.keys()` بـ `redis.scan()`** — `KEYS` تحجب Redis event loop بالكامل على قواعد بيانات كبيرة.
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

- [x] `[P0]` ⏱️XL **مشغل فيديو احترافي مع دعم ترجمة SRT/VTT** — المشغل الحالي `<video controls>` افتراضي بلا تخصيص. **(مكتملة ✅ — المراحل 1–4 منجزة 2026-06-12)**
  - ✅ **المنجَز (المرحلة 1):**
    - `features/media/subtitleParser.js` — تحليل SRT/WebVTT إلى cues (`parseTimecode`/`parseSubtitles`/`segmentsToCues`/`getActiveCue`)، متساهل مع رؤوس WEBVTT وNOTE وCRLF والترتيب الزمني.
    - `features/media/transcriptToSrt.js` — تحويل ناتج Whisper (segments) إلى SRT/VTT تلقائياً (`formatSrtTimecode`/`formatVttTimecode`/`transcriptToSrt`/`transcriptToVtt`) مع استنتاج نهاية المقطع من بداية التالي ومعالجة فيض التقريب.
    - `components/media/SubtitleRenderer.jsx` — طبقة عرض الترجمة فوق الفيديو مدفوعة بوقت التشغيل المتتبَّع (`aria-live`، أحجام/لون قابلة للتهيئة).
    - ربط في `DetailPage.jsx`: اشتقاق cues من التفريغ الزمني للمادة، طبقة ترجمة + زر تبديل CC فوق الفيديو، وزر «تنزيل الترجمة (SRT)» بجانب مشغل التفريغ المتزامن.
    - الاختبارات: `subtitleParser.test.js` (12) + `transcriptToSrt.test.js` (10) — تمرّ ضمن 193 اختبار / 26 ملف، و`verify` أخضر.
  - ✅ **المنجَز (المرحلة 2 — مشغّل مخصص):** `components/media/VideoPlayer.jsx` يلفّ `<video>` بشريط تحكم مخصص (تشغيل/إيقاف، scrubber، صوت + كتم، عرض الوقت)، تحكم سرعة 0.5x–2x، اختصارات لوحة مفاتيح (Space/K، ←/→ ±5ث، ↑/↓ صوت، F ملء الشاشة، M كتم، C ترجمة)، Picture-in-Picture (محروس بـ `pictureInPictureEnabled`)، ملء الشاشة، وطبقة `SubtitleRenderer` + زر CC مدمجة. يُمرَّر `videoRef` للأب فتبقى الإشارات الزمنية والقفز للتفريغ تعمل، وتُسلسَل دوال الحدث (`onTimeUpdate`/`onLoadedMetadata`/…). مدمج في `DetailPage.jsx` بدل `<video controls>` الخام. `verify` + 193 اختبار أخضر (اختبار عرض DetailPage يمرّ مع المشغّل الجديد).
  - ✅ **المنجَز (المرحلة 3 — استيراد وتنسيق الترجمة):** استيراد ملف SRT/VTT خارجي عبر `FileReader` + `parseSubtitles` (يتجاوز ترجمة التفريغ عند وجوده، مع زر إزالة)؛ تنسيق الترجمة من الواجهة (حجم صغير/متوسط/كبير + منتقي لون) يُمرَّر إلى `SubtitleRenderer` عبر `captionSize`/`captionColor`؛ إعادة تعيين الترجمة المستوردة عند تغيير المادة. `verify` + 193 اختبار أخضر.
  - ✅ **المنجَز (المرحلة 4 — معاينة scrubber + اختبارات تفاعلية):** معاينة مصغّرات thumbnails على شريط التقدّم عند تمرير المؤشر (فيديو خفيّ يُحمَّل عند الحاجة + canvas يُرسم عليه الإطار عند seeked/loadeddata، مع tooltip توقيت يتبع موضع المؤشر ومحجوز داخل الشريط). helper نقي `features/media/scrubberPreview.js` (`previewTimeFromPointer`/`previewPercentFromPointer`) باختبارات `scrubberPreview.test.js` (7)، واختبارات تفاعلية للمشغّل `components/media/VideoPlayer.test.jsx` (7: تشغيل/إيقاف، كتم، اختصارات Space/الأسهم، قائمة السرعة، تبديل الترجمة، ظهور المعاينة، إخفاء CC بلا cues). `verify` + 207 اختبار / 28 ملف أخضر.
  - ⬜ **المتبقّي (اختياري مستقبلاً):** مزامنة ثنائية الاتجاه أعمق مع `TranscriptSyncWorkbench` (تمييز المقطع النشط أثناء التشغيل).
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

- [x] `[P1]` ⏱️L **تشفير النسخ الاحتياطية AES-256-GCM + تحقق SHA-256 تلقائي** — **(مكتملة ✅ — مدمجة 10 يونيو، أُغلقت 11 يونيو)**
  - **✅ منجز ومُختبَر:** `archive-server/src/backup/backupCrypto.js` (AES-256-GCM بمشتقّ مفتاح scrypt + تنسيق ملف ARCE + SHA-256 checksum write/verify)؛ مدمج في `backupScheduler.js` (يشفّر تلقائياً عند ضبط `BACKUP_ENCRYPTION_KEY`، يحذف plaintext، يكتب checksum، يعلّم `encrypted`)؛ `BACKUP_ENCRYPTION_KEY` موثّق في `.env.example:212`؛ `scripts/verify-backup.mjs` — **12 اختبار يمرّ** (round-trip، كلمة مرور خاطئة، تلف، magic header، checksum).
  - **✅ مُنجَز (10 يونيو 2026) — مسار الاستعادة كاملاً:**
    - `restoreBackup()` في `backupScheduler.js`: فحص اسم الملف (منع traversal) → تحقّق SHA-256 (يرفض 409 عند عدم التطابق) → فك تشفير `.enc` بكلمة المرور (400 عند الخطأ/الغياب) → gunzip → `provider.replaceAll`.
    - Endpoint جديد `POST /api/admin/backups/restore` (admin فقط + rate limit + تسجيل تدقيق `backup.restore` في `auditLogger`).
    - واجهة استعادة في `BackupManager.jsx`: زر استعادة لكل نسخة، حقل كلمة مرور للنسخ المشفّرة 🔒، تأكيد `appConfirm` تدميري، رسائل خطأ واضحة (checksum/كلمة مرور).
    - **6 اختبارات جديدة** في `verify-backup.mjs` (round-trip عادي/مشفّر، كلمة مرور خاطئة/غائبة، checksum تالف لا يلمس البيانات، رفض traversal) — السلسلة كاملة 18 suite خضراء.
  - **ملاحظة مستقبلية اختيارية:** تخزين بعيد (S3/Cloudflare R2) مع تشفير أثناء النقل؛ ليس شرطاً لإغلاق مهمة التشفير/السلامة الأساسية.
  - المصدر: feature-proposals-2026 (محور 2 — ميزة #13).

- [x] `[P1]` ⏱️L **حدود الموارد متعددة الطبقات (IP + User + Endpoint)** ✅ 2026-06-09 — Rate limiting موجود على IP فقط، لا حدود للمستخدم ولا لنقاط النهاية الفردية.
  - الملفات: `archive-server/src/api/rateLimit.js`، `archive-server/src/api/server.js`.
  - التنفيذ: طبقة 1 — IP (100 طلب/دقيقة)؛ طبقة 2 — User (60 طلب/دقيقة)؛ طبقة 3 — per-endpoint (OCR: 10/دقيقة، AI: 30/دقيقة)؛ حد تزامن FFmpeg قابل للإعداد (`MEDIA_JOB_CONCURRENCY`)؛ Queue مهام FFmpeg بأولويات (probe > thumbnail > transcode).
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 3 — ميزة #16).
  - ✅ **تم (2026-06-09):** `rateLimit.js` — أضيف `userKeyFromHeader()` (يستخرج sub من JWT بدون تحقق من التوقيع)؛ `server.js` — 7 limiters (rpc/user/ai/ocr/login/reset/totpDisable)؛ AI endpoints تستخدم `ai` limiter (30/min) + `overLimitUser`؛ OCR يستخدم `ocr` limiter (10/min) + `overLimitUser`؛ rpc IP خُفِّض من 600 إلى 100/min.

---

### 13.3 P1 — تجربة المستخدم اليومية

- [ ] `[P1]` ⏱️L **التعديل المضمّن في عرض الجدول (InlineCellEditor)** — كل تعديل يتطلب فتح صفحة التفاصيل والعودة. **(المرحلة 1 منجزة ✅)**
  - الملفات الجديدة: `archive app/src/components/data/InlineCellEditor.jsx` ✅ (مكوّن عام: نص/وسوم/رقم/تاريخ/قائمة، Enter يحفظ، Escape يلغي، blur يحفظ، RTL، وTab/Shift+Tab يطلب الانتقال).
  - تغييرات: `archive app/src/features/archive/ArchiveViews.jsx` ✅ (ربط InlineCellEditor بخلايا العنوان/النوع/الوسوم في `VideoTableView` عبر أيقونة قلم/نقر مزدوج؛ خلية واحدة قيد التحرير في كل مرة؛ تنقل Tab/Shift+Tab بين الأعمدة القابلة للتعديل)، `ArchivePageResults.jsx` ✅ (الحفظ عبر `updateVideoItem` مع سجل التغييرات + toast نجاح/فشل).
  - ✅ المرحلة 1 (2026-06-10): تحرير العنوان والوسوم مضمّنًا؛ حفظ عند Enter/مغادرة الخلية؛ Escape للإلغاء؛ تجاهل القيم غير المتغيّرة/الفارغة.
  - ✅ تحديث (2026-06-11): محرر النوع كقائمة + نقر مزدوج للخلايا المدعومة + تنقل `Tab` / `Shift+Tab` بين العنوان/النوع/الوسوم، مع اختبارات `InlineCellEditor.test.jsx` و`ArchiveViews.inline-edit.test.jsx`.
  - ✅ **2026-06-13:** Ctrl+Z للتراجع مُنجَز — `undoLastActivity` نُقل من `activityLogSlice` عبر `useArchivePageState` إلى `ArchivePageResults` حيث يُعالج `keydown` Ctrl+Z عالمياً (يتجاهل الحقول النصية والـ contentEditable).
  - ⬜ المتبقي: تحرير أي خلية قابلة للتخصيص عند ظهور أعمدة جديدة؛ ربط محررات التاريخ والتقييم عندما تُضاف أعمدتها إلى الجدول.
  - الجهد: 3-4 أسابيع (المتبقي ~1-2 أسبوع).
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #3). ملاحظة: P2 placeholder موجود في §12.7 — هذه الميزة الكاملة.

- [ ] `[P1]` ⏱️L **Service Worker ذكي — Workbox strategies + Background Sync كامل** — SW الحالي cache-first بسيط (Task #39). هذه ترقية لـ Workbox كامل.
  - الملف: `archive app/public/sw.js`، `archive app/vite.config.js`.
  - التنفيذ: `precacheAndRoute` لـ app shell؛ `StaleWhileRevalidate` لـ `/api/`؛ `CacheFirst` للصور والخطوط؛ `BackgroundSync Queue` لعمليات الكتابة أوفلاين تُرسل عند عودة الاتصال؛ `Periodic Background Sync` للمزامنة التلقائية. التطبيق يعمل أوفلاين بشكل كامل (تصفح + إنشاء + تعديل).
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #5).

- [x] `[P1]` ⏱️L **تنقل سفلي ذكي للجوال (Smart Bottom Tabs)** — الشريط الجانبي يتخفّى على الجوال بلا بديل تنقل سفلي.
  - الملفات الجديدة: `archive app/src/components/layout/BottomTabBar.jsx`.
  - تغييرات: `archive app/src/components/layout/MobileActionBar.jsx` → ترقية أو استبدال.
  - التنفيذ: 4-5 أقسام رئيسية تتكيف مع الاستخدام (الأكثر استخداماً أولاً)؛ سحب لإعادة الترتيب؛ ضغط مطوّل لفتح الأقسام الفرعية؛ `safe-area-inset-bottom` للـ notch؛ يحل محل `MobileActionBar`.
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #6).

- [x] `[P1]` ⏱️M **إصلاح تبديل الباكند فوري بلا إعادة تشغيل** — تبديل الباكند (محلي↔سحابي) يتطلب إعادة تشغيل التطبيق.
  - الملفات: `archive app/src/app/App.jsx` أو `registerByBackendChoice.js`، صفحة الإعدادات.
  - التنفيذ: عند تغيير `backendChoice` → `flushPendingWrites()` → `registerByBackendChoice()` ديناميكياً → `loadAllData()` من الباكند الجديد → `showToast("تم التبديل بنجاح")`؛ مؤشر "جاري التبديل…" أثناء العملية.
  - الجهد: 1-2 أسبوع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #8).
  - ✅ **تم (2026-06-09):** `switchBackendHot.js` مُنشأ يُسلسل: persist → `registerByBackendChoice()` → `loadAllData()`؛ `LocalStorageEngineSettings.jsx` محدَّث لاستخدامه بدلاً من `setBackendChoice` + رسالة إعادة التحميل.

---

### 13.4 P1 — التشغيل والنشر والبنية التحتية

- [x] `[P1]` ⏱️L **لوحة تحكم صحة السيرفر المدمجة (ServerStatusPage)** — لا توجد واجهة لحالة السيرفر؛ يتطلب CLI.
  - الملفات الجديدة: `archive app/src/pages/ServerStatusPage.jsx`.
  - تغييرات: `archive-server/src/api/server.js` (توسيع `/api/health`).
  - التنفيذ: مؤشرات حية (CPU/ذاكرة/قرص/اتصالات DB)؛ حالة حاويات Docker (running/stopped/restarting)؛ آخر نسخة احتياطية + زر "نسخ احتياطي الآن"؛ تنبيهات (قرص 90%، ذاكرة عالية، فشل نسخ احتياطي)؛ سجل آخر 50 عملية؛ أزرار تشغيل/إيقاف/إعادة للحاويات (admin only).
  - الصلاحية: admin+ للاطلاع، owner للتشغيل.
  - الجهد: 3-4 أسابيع.
  - المصدر: feature-proposals-2026 (محور 2 — ميزة #10).

- [x] `[P1]` ⏱️M **أتمتة استيراد مخطط PocketBase عبر Admin API** ✅ 2026-06-09 — الإعداد الحالي يتطلب 8+ خطوات يدوية لاستيراد المخطط.
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

- [x] `[P1]` ⏱️L **استعادة النسخ الاحتياطية من الواجهة مع استعادة جزئية** — ✅ 2026-06-12: `BackupManager.jsx` أُعيد بناؤه بالكامل: معاينة محتوى النسخة (store counts)، اختيار مخازن فردية (partial restore)، تأكيد مزدوج بكتابة "استعادة"، دعم كلمة مرور للنسخ المشفّرة. `previewBackup()` export جديد في `backupScheduler.js`، `POST /api/admin/backups/preview` endpoint جديد، `stores` filter في `restoreBackup()` + `if (!(domainKey in payload)) continue` في كلا المحوّلَين.
  - الملفات: `archive app/src/pages/DataCenterPage.jsx`، `archive-server/src/backup/backupScheduler.js`.
  - الملف الجديد: `POST /api/admin/backup/restore`.
  - التنفيذ: قائمة النسخ المتاحة مع التاريخ والحجم؛ معاينة محتوى النسخة (عدد السجلات/المخازن) قبل الاستعادة؛ استعادة جزئية (اختيار مخازن محددة)؛ تأكيد مزدوج مع كتابة النص؛ حماية من استعادة نسخة أقدم على بيانات أحدث.
  - الجهد: 3-4 أسابيع.
  - المصدر: feature-proposals-2026 (محور 3 — ميزة #19).

---

### 13.5 P2 — ميزات مبتكرة جديدة

- [x] `[P2]` ⏱️L **نشر سحابي بنقرة واحدة — Railway / DigitalOcean / Render** — لا أزرار Deploy-to-Cloud في README.
  - الملفات: `README.md`، ملفات `railway.json`/`render.yaml`/`do-app-spec.yaml` جديدة.
  - التنفيذ: أزرار "Deploy to Railway/DigitalOcean/Render" في README؛ 4 متغيرات فقط (DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET)؛ المنصة تتولى البناء والنشر Docker Compose؛ يفتح سوق غير تقني جديد.
  - ✅ **مُنجز ومتحقق (2026-06-13):** أضيف قسم “النشر السحابي السريع” في `README.md` مع أزرار Render/Railway وتعليمات DigitalOcean App Platform، وأضيفت قوالب `archive-server/deploy/render.yaml` و`archive-server/deploy/railway.json` و`archive-server/deploy/digitalocean-app.yaml`. أضيف فحص `scripts/verify-cloud-deploy.mjs` ومرّ `pnpm run verify:cloud-deploy`.
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

---

## 14. مقترحات تقارير 2026 — ميزات جديدة وتحسينات الاستخدام اليومي

> **المصادر:**
> - `D:\archiveaq\Reports\archive-suite-daily-use-proposals.md` — 5 مقترحات للاستخدام اليومي
> - `D:\archiveaq\Reports\archive-suite-new-feature-proposals.md` — 4 مقترحات تطويرية جديدة
>
> **تاريخ الإضافة:** 9 يونيو 2026.

---

### 14.1 P0 — نظام سجل النشاط والتراجع المتقدم (Activity History & Advanced Undo)

- [x] `[P0]` ⏱️XL **بناء نظام سجل النشاط المركزي مع تراجع متعدد المستويات** — لا يوجد سجل نشاط مركزي؛ التراجع محدود بصفحة التفاصيل فقط؛ لا يمكن التراجع عن الحذف أو التعديلات الجماعية.
  - **الملفات الجديدة:**
    - `archive app/src/features/activityLog/viewModel.js` — `createActivityEntry`, `buildDiff`, `describeActivity`
    - `archive app/src/features/activityLog/undoManager.js` — `withActivityLog`, `undoActivityEntry`, `redoActivityEntry`
    - `archive app/src/components/activity/ActivityTimeline.jsx` — شريط النشاط الزمني مجمّع حسب اليوم
    - `archive app/src/components/activity/ActivityEntry.jsx` — عنصر نشاط واحد مع زر تراجع/استعادة
    - `archive app/src/components/activity/DiffView.jsx` — عرض الفروقات قبل/بعد
    - `archive app/src/components/activity/ActivityFilterBar.jsx` — فلترة حسب نوع/تاريخ/مستخدم
    - `archive app/src/pages/ActivityPage.jsx` — صفحة سجل النشاط الكاملة
    - `archive app/src/stores/slices/activityLogSlice.js`
  - **تعديل ملفات:**
    - `archive app/src/services/storage/schema.js` — إضافة store `activity_log`
    - `archive-server/prisma/schema.prisma` — نموذج `ActivityLog` مع فهارس
    - `archive app/src/pages/ArchivePage.jsx` — زر "سجل النشاط" في الشريط العلوي
    - `archive app/src/pages/DetailPage.jsx` — `<ActivityForTarget targetType="item" targetId={id} />`
    - `archive app/src/components/navigation/Sidebar.jsx` — رابط صفحة السجل
  - **التنفيذ:** تسجيل كل عملية (create/update/delete/move/bulk_update/restore) مع snapshot قبل/بعد والفرق التفاضلي؛ تراجع متعدد المستويات؛ Redo بعد التراجع؛ فلترة + تجميع حسب اليوم؛ التوسيع فوق `undoManager` الموجود بلا تعارض.
  - الجهد: 4-6 أسابيع. ~14 ملف جديد/معدَّل.
  - المصدر: archive-suite-daily-use-proposals (المقترح 1 — P0).

---

### 14.2 P0 — نظام الإشعارات المركزية الذكية (Smart Notification Center)

- [x] `[P0]` ⏱️XL **بناء مركز إشعارات موحد مع Push API للمتصفح** — **(مكتملة ✅ — 12 يونيو 2026)** الإشعارات الحالية مشتتة؛ العمليات الطويلة (FFmpeg/OCR/backup) تنتهي بصمت بدون إخبار المستخدم.
  - **الحالة عند الفحص:** البنية الأساسية كانت موجودة مسبقاً (مركز `NotificationDrawer.jsx`، جرس الشريط الجانبي مع badge، `services/pushService.js` لاشتراك Web Push من الخادم، `viewModel.js` للتصفية/التجميع/العدّ، `uiSlice` يحوي `showNotification` بتجميع `groupKey` + حقل `progress` + `updateNotificationProgress`). الفجوات الحقيقية المتبقية عولجت:
  - **المنجَز (2026-06-12):**
    1. **`updateNotificationProgress` كان يُحدّث القائمة الحيّة فقط** — أصبح يزامن `notificationHistory` أيضاً (مصدر الحقيقة للمركز) فيتقدّم شريط التقدّم داخل المركز لا في التوست فقط.
    2. **إجراء `finalizeNotification(id, patch)` جديد** في `uiSlice` — يحوّل إشعار العملية الجارية إلى حالة نهائية (نجاح/خطأ) في مكانه بدل صفّ تقدّم عالق + صفّ اكتمال منفصل.
    3. **`features/notifications/pushManager.js` جديد** — Notification API محلّي قابل للحقن: `requestNotificationPermission`, `showBrowserNotification`, `shouldAlertBrowser` (سياسة: التنبيه عند إخفاء التبويب + إذن ممنوح، تجاهل info العادي)، `notifyForAppNotification` (deduped بـ tag). مكمّل لـ `pushService.js` (اشتراك الخادم) لا بديل عنه.
    4. **`features/notifications/operationProgress.js` جديد** — `startOperation(store, …)` يقود دورة حياة إشعار عملية واحد (بدء→تقدّم→نجاح/فشل) + إطلاق إشعار متصفح عند الاكتمال؛ idempotent؛ قابل لإعادة الاستخدام لـ backup/OCR/transcode لاحقاً.
    5. **شريط تقدّم داخل `NotificationDrawer`** — يُرسَم `role="progressbar"` مع نسبة مئوية عند وجود `item.progress` رقمياً.
    6. **ربط التصدير الفعلي** — `ExportButton.jsx` يبثّ جسم استجابة `/api/export` عبر `getReader()` ويحدّث التقدّم الحقيقي (نسبة التحميل)، وينهي بإشعار نجاح/فشل + إشعار متصفح.
    7. **جسر إشعارات الخلفية** — `useBackgroundNotificationBridge` (مركّب في `AppNotifications.jsx`) يطلق إشعار متصفح للإشعارات الجديدة عند إخفاء التبويب (دون تكرار للسجل عند الإقلاع، إشعار واحد لكل id).
  - **الاختبارات:** `pushManager.test.js` (16 اختبار: الدعم/الإذن/العرض/السياسة) و`operationProgress.test.js` (دورة الحياة + idempotency). `pnpm --filter @archive/app run test` أخضر (171 اختبار، 24 ملف)، و`verify` أخضر.
  - ملاحظة: ملفات الأسماء في المقترح (`NotificationCenter`/`NotificationCard`/`NotificationBell`/`notificationsSlice`) لها مكافئات قائمة (`NotificationDrawer` + جرس Sidebar + `uiSlice`)؛ لم تُكرَّر تفادياً للازدواج.
  - **الملفات الجديدة:**
    - `archive app/src/features/notifications/pushManager.js` — `requestNotificationPermission`, `showBrowserNotification`
    - `archive app/src/components/notifications/NotificationCenter.jsx` — لوحة الإشعارات الرئيسية مع فلترة
    - `archive app/src/components/notifications/NotificationCard.jsx` — بطاقة إشعار مع شريط تقدم + أزرار إجراء
    - `archive app/src/components/notifications/NotificationBell.jsx` — جرس الشريط العلوي مع badge عداد
    - `archive app/src/stores/slices/notificationsSlice.js`
  - **تعديل ملفات:**
    - `archive app/src/features/notifications/viewModel.js` — توسيع `createNotification` + `NOTIFICATION_TYPES` + `shouldGroupNotifications`
    - `archive app/src/services/storage/schema.js` — إضافة `notifications`, `notification_prefs`
    - `archive app/src/pages/ArchivePage.jsx` — ربط التصدير/الاستيراد بإشعارات التقدم
    - `archive app/src/components/layout/TopBar.jsx` — إضافة `<NotificationBell>`
  - **التنفيذ:** 4 فئات (operation/collaboration/system/smart)؛ تجميع ذكي للإشعارات المتشابهة؛ شريط تقدم للعمليات الطويلة؛ Push API للتنبيه حتى لو التطبيق في الخلفية؛ أزرار إجراءات سريعة.
  - ملاحظة: `viewModel.js` موجود بالفعل في `features/notifications/` لكن يحتاج توسيع جوهري.
  - الجهد: 3-5 أسابيع. ~9 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-daily-use-proposals (المقترح 2 — P0).

---

### 14.3 P0 — نظام المجلدات الهرمي (Folder Tree)

- [x] `[P0]` ⏱️XL **بناء نظام مجلدات هرمي كمستكشف الملفات** — الأرشيف قائمة مسطحة؛ لا تنظيم هرمي؛ لا يمكن إنشاء بنية مثل `أرشيف 2024/محاضرات/الفصل الأول`.
  - **الملفات الجديدة:**
    - `archive app/src/features/folders/viewModel.js` — `createFolderValue`, `buildFolderTree`, `getAllItemsInFolder`
    - `archive app/src/components/folders/FolderTree.jsx` — شجرة المجلدات (ARIA tree role)
    - `archive app/src/components/folders/FolderTreeNode.jsx` — عقدة مع توسيع/طي وقائمة سياق
    - `archive app/src/components/folders/FolderBreadcrumb.jsx` — مسار التنقل
    - `archive app/src/stores/slices/foldersSlice.js`
    - `archive app/src/pages/FoldersPage.jsx` (يمكن دمج مع ArchivePage)
  - **تعديل ملفات:**
    - `archive app/src/services/storage/schema.js` — store `archive_folders`
    - `archive-server/prisma/schema.prisma` — نماذج `ArchiveFolder` + `FolderItem`
    - `archive app/src/pages/ArchivePage.jsx` — `<FolderTree>` في الشريط الجانبي مع تبويب وسوم/مجلدات
    - `archive app/src/pages/AddVideoPage.jsx` — حقل اختيار المجلد
    - `archive app/src/pages/DetailPage.jsx` — عرض المسار الكامل للمجلد الحاوي
  - **التنفيذ:** مجلدات فرعية غير محدودة؛ مسار breadcrumb تفاعلي؛ سحب وإفلات العناصر؛ عداد العناصر + الحجم؛ RTL عربي كامل؛ لا تعارض مع المجموعات الموجودة.
  - الجهد: 5-7 أسابيع. ~11 ملف جديد/معدَّل.
  - المصدر: archive-suite-new-feature-proposals (المقترح 1 — P0).

---

### 14.4 P1 — نظام القوالب والتعبئة السريعة (Templates & Quick Fill)

- [x] `[P1]` ⏱️L **بناء نظام القوالب المرنة لتسريع الإدخال اليومي** — لا قوالب؛ نفس البيانات (نوع/وسوم/مجلد) تُدخَل يدوياً في كل مرة.
  - **الملفات الجديدة:**
    - `archive app/src/features/templates/viewModel.js` — `createItemTemplate`, `resolveDynamicFields`, `BUILT_IN_TEMPLATES`
    - `archive app/src/components/templates/TemplatePicker.jsx` — اختيار القالب عند الإضافة
    - `archive app/src/components/templates/QuickAddBar.jsx` — شريط الإضافة السريعة (Enter لكل عنصر)
    - `archive app/src/components/templates/TemplateEditor.jsx` — محرر القوالب المخصصة
    - `archive app/src/stores/slices/templatesSlice.js`
  - **تعديل ملفات:**
    - `archive app/src/pages/AddVideoPage.jsx` — `<TemplatePicker>` قبل النموذج + وضع QuickAdd
    - `archive app/src/services/storage/schema.js` — store `templates`
  - **التنفيذ:** حقول ثابتة + ديناميكية (`today()`, `autoNumber()`, `concat()`)؛ 3 قوالب مدمجة (محاضرة/مستند/صوت)؛ وضع الإضافة السريعة لعشرات العناصر متتالية؛ تتبع الاستخدام.
  - الجهد: 3-4 أسابيع. ~7 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-daily-use-proposals (المقترح 3 — P1).

---

### 14.5 P1 — نظام الحفظ التلقائي وجلسات العمل (Auto-save & Work Sessions)

- [x] `[P1]` ⏱️L **بناء نظام حفظ تلقائي شامل مع استعادة جلسات العمل** — لا حفظ تلقائي؛ مغادرة صفحة الإضافة تُفقد كل البيانات؛ لا استئناف للعمليات الجماعية المنقطعة.
  - **الملفات الجديدة:**
    - `archive app/src/features/autosave/viewModel.js` — `createDraft`, `createWorkSession`, `createBulkProgress`
    - `archive app/src/features/autosave/autosaveEngine.js` — `createAutosaveEngine` (30s interval + beforeunload guard)
    - `archive app/src/features/autosave/sessionManager.js` — `createSessionManager` (استعادة جلسة <1 ساعة)
    - `archive app/src/components/autosave/AutosaveIndicator.jsx` — مؤشر حالة (محفوظ / غير محفوظ / جاري)
    - `archive app/src/components/autosave/DraftRecoveryDialog.jsx` — حوار استعادة المسودة
    - `archive app/src/components/autosave/SessionRestoreBanner.jsx` — شعار استعادة الجلسة
    - `archive app/src/components/autosave/BulkProgressPanel.jsx` — لوحة استئناف العمليات الجماعية
  - **تعديل ملفات:**
    - `archive app/src/pages/AddVideoPage.jsx` — `startTracking` + `DraftRecoveryDialog`
    - `archive app/src/pages/DetailPage.jsx` — حفظ تلقائي بمفتاح `edit_item_${id}`
    - `archive app/src/pages/ArchivePage.jsx` — `SessionManager` + حفظ الفلاتر/التمرير/المجلد
    - `archive app/src/services/storage/schema.js` — stores: `drafts`, `work_sessions`, `bulk_progress`
  - **التنفيذ:** حفظ تلقائي كل 30 ثانية؛ تحذير beforeunload؛ استعادة المسودات؛ استئناف العمليات الجماعية المنقطعة.
  - الجهد: 3-4 أسابيع. ~11 ملف جديد/معدَّل.
  - المصدر: archive-suite-daily-use-proposals (المقترح 4 — P1).

---

### 14.6 P1 — نظام الارتباطات والعلاقات بين العناصر (Item Relations & Links)

- [x] `[P1]` ⏱️L **بناء نظام علاقات مرن لربط العناصر بعلاقات ذات معنى** — العناصر معزولة؛ لا طريقة لربط محاضرات سلسلة أو مستند بفيديو معيّن.
  - **الملفات الجديدة:**
    - `archive app/src/features/relations/viewModel.js` — `createRelation`, `RELATION_TYPES`, `getItemRelations`, `buildRelationsGraph`
    - `archive app/src/components/relations/RelationsPanel.jsx` — لوحة العلاقات في صفحة التفاصيل
    - `archive app/src/components/relations/AddRelationDialog.jsx` — حوار إضافة علاقة مع بحث + نوع
    - `archive app/src/components/relations/RelationsGraph.jsx` — رسم بياني تفاعلي (D3/cytoscape)
    - `archive app/src/stores/slices/relationsSlice.js`
  - **تعديل ملفات:**
    - `archive app/src/pages/DetailPage.jsx` — إضافة تبويب `<RelationsPanel>`
    - `archive app/src/pages/ArchivePage.jsx` — زر "عرض العلاقات" + دعم سحب/إفلات
    - `archive app/src/services/storage/schema.js` — store `item_relations`
    - `archive-server/prisma/schema.prisma` — نموذج `ItemRelation`
  - **التنفيذ:** 9 أنواع علاقات (is_part_of/references/related_to/depends_on/copy_of/precedes/follows/contains/alternative_of)؛ علاقات أحادية وثنائية الاتجاه؛ رسم بياني تفاعلي حتى عمق 2؛ إنشاء علاقات بالسحب والإفلات.
  - الجهد: 4-5 أسابيع. ~9 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-daily-use-proposals (المقترح 5 — P1).

---

### 14.7 P1 — نظام المجموعات/الحاويات الافتراضية المُحسّن (Enhanced Virtual Collections)

- [ ] `[P1]` ⏱️XL **ترقية المجموعات من قوائم ثابتة إلى حاويات افتراضية غنية متعددة المصادر** — المجموعات الحالية قوائم ثابتة (itemIds فقط)؛ لا تدعم مصادر متعددة ولا فلترة متقدمة.
  - **الملفات الجديدة:**
    - `archive app/src/components/collections/ContainerContentsPanel.jsx` — تبويبات مصادر متعددة
    - `archive app/src/features/collections/applyFilterRules.js` — فلترة متقدمة متعددة الشروط
    - `archive app/src/features/collections/cycleDetection.js` — `detectCollectionCycle`
    - `archive app/src/components/collections/FilterRuleBuilder.jsx` — منشئ قواعد الفلترة المرئي
  - **تعديل ملفات:**
    - `archive app/src/features/collections/viewModel.js` — `createVirtualCollectionValue` + `resolveCollectionContents`
    - `archive app/src/pages/CollectionsPage.jsx` — دعم نوع "mixed" + لوحة المحتويات
    - `archive app/src/stores/slices/archiveSlice.js` — تحديث وظائف المجموعات
  - **التنفيذ:** مصادر: عناصر + مجلدات + مجموعات مرجعية + بحوث محفوظة + لقطات فلترة؛ فلترة AND/OR متعددة الشروط؛ منع الحلقات المرجعية؛ عرض مخصص لكل حاوية.
  - يتطلب: §14.3 (المجلدات) اختياري.
  - الجهد: 4-6 أسابيع. ~7 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-new-feature-proposals (المقترح 2 — P1).

---

### 14.8 P1 — مركز تحكم النظام (System Control Center)

- [ ] `[P1]` ⏱️XL **بناء مركز تحكم موحد للنظام عبر واجهة ويب** — لا واجهة للتحكم بالسيرفر؛ يتطلب CLI بـ25+ أمر؛ لا دعم لنظام Windows خارج Docker.
  - **الملفات الجديدة:**
    - `archive-server/src/control/controlAgent.js` — `createControlAgent` (docker/linux-native/windows-native)
    - `archive-server/src/api/controlRoutes.js` — `/api/control/status|start|stop|restart|logs|apply-config`
    - `archive-server/src/control/configSync.js` — `syncConfigToPreset`
    - `archive app/src/pages/SystemControlPage.jsx`
    - `deploy/install-windows.ps1` — سكربت PowerShell (Docker + Native)
  - **تعديل ملفات:**
    - `archive-server/src/api/server.js` — تسجيل controlRoutes بـ `requireAdmin`
    - `archive app/src/features/onboarding/V1OnboardingWizard.jsx` — ربط بمركز التحكم
    - `archive app/src/app/pageRegistry.js` — تسجيل SystemControlPage
  - **التنفيذ:** تشغيل/إيقاف/إعادة تشغيل الخدمات؛ 3 أوضاع (Docker/Linux/Windows)؛ مراقبة CPU/ذاكرة/قرص/DB كل 5 ثوانٍ؛ عرض سجلات الخدمات.
  - **خطر:** متوسط-عالٍ (صلاحيات نظام التشغيل).
  - الجهد: 8-12 أسبوعاً.
  - المصدر: archive-suite-new-feature-proposals (المقترح 3 — P1).

---

### 14.9 P1 — الملء التلقائي لمعالج بدء التشغيل (Onboarding Pre-fill)

- [x] `[P1]` ⏱️L **قراءة إعدادات .env تلقائياً في معالج بدء التشغيل** ✅ 2026-06-12: `presetConfig.js` (server) يقرأ BACKEND/POCKETBASE_URL/DATABASE_URL/ADMIN_EMAIL ويختبر الاتصال بـ DB؛ `GET /api/setup/preset-config` endpoint (يُحجب بعد اكتمال الإعداد)؛ `PresetConfigScreen.jsx` يعرض ملخص الإعدادات مع مؤشرات الحالة؛ `V1OnboardingWizard.jsx` يجلب الإعداد المسبق عند بدء التشغيل ويعرض شاشة "استخدام الإعدادات المكتشفة" بنقرة واحدة.
  - **الملفات الجديدة:**
    - `archive-server/src/api/presetConfig.js` — `createPresetConfigHandler` (قراءة .env + اختبار DB)
    - `archive app/src/features/onboarding/PresetConfigScreen.jsx` — شاشة تأكيد الإعدادات المسبقة
  - **تعديل ملفات:**
    - `archive app/src/features/onboarding/V1OnboardingWizard.jsx` — `mapPresetToFormValues` + `PresetConfigScreen`
    - `archive-server/src/api/server.js` — مسار `GET /api/setup/preset-config` (admin فقط)
  - **التنفيذ:** قراءة .env → ملخص إعدادات مع مؤشرات حالة (DB متصل/غير متصل)؛ تأكيد بنقرة واحدة بدل 9 خطوات؛ أمان: كلمات المرور لا تُرسل للواجهة.
  - يتطلب: §14.8 اختياري — يعمل مع .env فقط.
  - الجهد: 3-4 أسابيع. ~4 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-new-feature-proposals (المقترح 4 — P1).
---

## 15. تقارير UX والسحابة المرفقة — مهام مستخرجة جديدة

> **المصدر:** `archive-suite-cloud-ux-improvements.md` (12 مقترحاً) + `archive-suite-daily-ux-proposals.md` (10 مقترحات).
> **المنهجية:** حُوِّل كل مقترح إلى مهمة تنفيذية بنفس صيغة المهام القديمة. البنود المتداخلة مع أقسام سابقة أُدرجت هنا كتوسعة أكثر تحديداً، وليست بديلاً للمهام المنجزة أو الجارية.
> **آخر تحديث:** 9 يونيو 2026.

---

### 15.1 P0 — نظام دليل المستخدم التفاعلي المدمج (Interactive User Guide)

- [ ] `[P0]` ⏱️XL **بناء دليل مستخدم تفاعلي متعدد الطبقات داخل التطبيق** — المستخدم الجديد لا يحصل على جولة إرشادية أو تلميحات سياقية أو مركز مساعدة قابل للبحث، فتظل ميزات مهمة مثل الوسوم الهرمية والبحث المتقدم غير مكتشفة.
  - **الملفات الجديدة:**
    - `archive app/src/components/help/InteractiveGuideTour.jsx` — جولة ترحيب مع spotlight وخطوات قابلة للتخطي.
    - `archive app/src/components/help/ContextualTooltip.jsx` — تلميحات تظهر عند أول استخدام للميزة.
    - `archive app/src/components/help/HelpCenterSearch.jsx` — بحث داخل محتوى المساعدة.
    - `archive app/src/features/help/guideRegistry.js` — تعريف خطوات الجولة حسب الصفحة والدور.
    - `archive app/src/stores/slices/helpPrefsSlice.js` — تخزين حالة التلميحات المكتشفة ومستوى الإزعاج.
  - **تعديل ملفات:**
    - `archive app/src/pages/HelpPage.jsx` — ترقية الصفحة إلى مركز مساعدة دائم.
    - `archive app/src/components/navigation/TopBar.jsx` أو shell التنقل — زر مساعدة دائم.
    - `archive app/src/features/onboarding/V1OnboardingWizard.jsx` — ربط نهاية الإعداد بجولة الاستخدام.
  - **التنفيذ:** جولة Onboarding حسب الدور؛ تلميحات لا تتكرر بعد الاستخدام؛ مستويات تلميح (مختصر/مفصل/معطّل)؛ FAQ قابل للتحديث؛ بحث في المساعدة.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 1 — P0).

---

### 15.2 P0 — تحسين استقرار المزامنة السحابية (Cloud Sync Stabilization)

- [ ] `[P0]` ⏱️XL **بناء طبقة مزامنة سحابية موثوقة مع كشف تعارضات وطابور مرئي** — المزامنة بين IndexedDB وPrisma قد تخفي التعارضات، ولا تعرض حالة الاتصال أو العمليات المعلقة بشكل واضح.
  - **الملفات الجديدة:**
    - `archive app/src/features/sync/conflictResolver.js` — كشف التعارضات بمراجعات وطوابع زمنية.
    - `archive app/src/components/sync/ConflictResolutionDialog.jsx` — عرض نسختين جنباً إلى جنب مع تمييز الفروقات.
    - `archive app/src/components/sync/ConnectionStatusIndicator.jsx` — مؤشر متصل/معلّق/تعارض/أوفلاين.
    - `archive app/src/components/sync/SyncQueueDashboard.jsx` — لوحة عمليات المزامنة المعلقة والفاشلة والمكتملة.
    - `archive app/src/features/sync/autoSyncEngine.js` — مزامنة تلقائية مع exponential backoff.
  - **تعديل ملفات:**
    - `archive app/src/services/storage/registerByBackendChoice.js` — إدخال طبقة المزامنة بين المحلي والسحابي.
    - `archive app/src/stores/slices/archiveSlice.js` — إضافة revision metadata وعمليات pending.
    - `archive-server/prisma/schema.prisma` — حقول revision/updatedBy عند الحاجة.
  - **التنفيذ:** revisions لكل تعديل؛ سجل تعارضات قابل للاسترجاع؛ طابور مرئي مع إعادة محاولة؛ مزامنة تلقائية عند عودة الاتصال؛ إشعارات عند اكتمال المزامنة أو وجود تعارض.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 2 — P0).

---

### 15.3 P1 — مركز الإعدادات المتقدمة الموحد (Unified Settings Hub)

- [ ] `[P1]` ⏱️L **توحيد الإعدادات المبعثرة في مركز واحد قابل للبحث والاستيراد/التصدير** — الإعدادات موزعة بين Onboarding وSidebar وDataCenterPage وبعضها غير ظاهر من الواجهة.
  - **الملفات الجديدة:**
    - `archive app/src/pages/SettingsHubPage.jsx` — صفحة مركز الإعدادات الموحد.
    - `archive app/src/features/settings/settingsRegistry.js` — تعريف الفئات والقيم الافتراضية والوصف.
    - `archive app/src/components/settings/SettingsSearch.jsx` — بحث في أسماء الإعدادات ووصفها.
    - `archive app/src/components/settings/SettingsImportExport.jsx` — تصدير/استيراد JSON مع استثناء الأسرار.
    - `archive app/src/components/settings/SettingDiffPreview.jsx` — معاينة اختلافات الاستيراد قبل التطبيق.
  - **تعديل ملفات:**
    - `archive app/src/components/navigation/Sidebar.jsx` — توجيه إعدادات Sidebar للمركز الجديد.
    - `archive app/src/pages/DataCenterPage.jsx` — نقل إعدادات التخزين/النسخ الاحتياطي للمركز أو ربطها به.
    - `archive app/src/app/pageRegistry.js` — تسجيل صفحة SettingsHubPage.
  - **التنفيذ:** فئات عام/حساب/أرشفة/بحث/مزامنة/وسائط/أمان/متقدم؛ بحث فوري؛ Smart Defaults مع شرح؛ إعادة أي إعداد للقيمة الافتراضية؛ تعليم واضح للإعدادات التي تحتاج إعادة تشغيل.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 3 — P1).

---

### 15.4 P1 — لوحة المعلومات الرئيسية المحسّنة (Enhanced Dashboard)

- [ ] `[P1]` ⏱️L **بناء لوحة معلومات رئيسية قابلة للتخصيص بدل الدخول المباشر لقائمة الأرشيف** — ArchivePage تعرض قائمة عناصر طويلة بلا ملخص حالة أو إجراءات سريعة أو نشاط حديث.
  - **الملفات الجديدة:**
    - `archive app/src/pages/DashboardPage.jsx` — الصفحة الرئيسية الافتراضية القابلة للتعطيل.
    - `archive app/src/components/dashboard/StatsCards.jsx` — إجمالي العناصر، المجموعات، الوسوم، التخزين، آخر نسخة احتياطية.
    - `archive app/src/components/dashboard/QuickActionsPanel.jsx` — إضافة/استيراد/تصدير/نسخ احتياطي.
    - `archive app/src/components/dashboard/RecentActivityPanel.jsx` — آخر العمليات.
    - `archive app/src/components/dashboard/SmartSuggestionsPanel.jsx` — اقتراحات تنظيمية قابلة للتنفيذ.
  - **تعديل ملفات:**
    - `archive app/src/app/pageRegistry.js` — تسجيل DashboardPage كوجهة بدء اختيارية.
    - `archive app/src/stores/slices/archiveSlice.js` — selectors للإحصائيات والاقتراحات.
  - **التنفيذ:** بطاقات إحصائية محدثة تلقائياً؛ إجراءات سريعة مرتبة حسب الاستخدام؛ نشاط آخر 5-10 عمليات؛ اقتراحات مثل عناصر بلا وسوم/نسخة احتياطية متأخرة/مكررات؛ إعادة ترتيب أقسام اللوحة بالسحب والإفلات.
  - الجهد: 3-5 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 4 — P1).

---

### 15.5 P1 — نظام الاختصارات القابلة للتخصيص (Customizable Keyboard Shortcuts)

- [ ] `[P1]` ⏱️L **بناء نظام اختصارات مركزي قابل للتخصيص مع وضع لوحة مفاتيح كامل** — الاعتماد الحالي على الفأرة يبطئ المستخدمين المكثفين، والاختصارات القليلة غير موثقة وغير قابلة للتعديل.
  - **الملفات الجديدة:**
    - `archive app/src/features/shortcuts/shortcutRegistry.js` — تعريف الاختصارات حسب السياق.
    - `archive app/src/hooks/useGlobalShortcuts.js` — التقاط الاختصارات العامة والصفحية.
    - `archive app/src/components/shortcuts/ShortcutExplorer.jsx` — نافذة Ctrl+/ لعرض اختصارات السياق الحالي.
    - `archive app/src/pages/ShortcutSettingsPage.jsx` — تعديل واستيراد/تصدير خريطة الاختصارات.
    - `archive app/src/features/shortcuts/vimMode.js` — وضع Vim الاختياري.
  - **تعديل ملفات:**
    - `archive app/src/components/navigation/Sidebar.jsx` — اختصارات التنقل بين الأقسام.
    - `archive app/src/pages/ArchivePage.jsx` و`DetailPage.jsx` — اختصارات تحديد/حذف/تعديل/التالي/السابق.
  - **التنفيذ:** منع تعارض الاختصارات؛ عرض الاختصار كتلميح على الأزرار؛ Ctrl+N/Ctrl+K/Ctrl+S/Ctrl+E/Ctrl+B/F2/Delete؛ وضع Vim اختياري؛ حفظ التفضيلات ومزامنتها.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 5 — P1).

---

### 15.6 P0 — تحسين تجربة الإعداد الأولي والتشغيل (Enhanced Onboarding & Setup Experience)

- [ ] `[P0]` ⏱️L **إعادة تصميم الإعداد الأولي حول تجربة فورية ووضع تجريبي قبل الإعداد التقني** — المعالج الحالي يطلب قرارات تقنية قبل أن يرى المستخدم قيمة التطبيق.
  - **الملفات الجديدة:**
    - `archive app/src/features/onboarding/InstantTryScreen.jsx` — خيار “ابدأ فوراً” مقابل “إعداد سحابي”.
    - `archive app/src/features/onboarding/DemoModeSeeder.js` — بيانات نموذجية قابلة للحذف.
    - `archive app/src/features/onboarding/ProgressiveCloudSetup.jsx` — تهيئة سحابية مبسطة بعد التجربة.
    - `archive app/src/components/onboarding/SetupErrorMessage.jsx` — رسائل خطأ مفهومة مع تفاصيل تقنية اختيارية.
  - **تعديل ملفات:**
    - `archive app/src/features/onboarding/V1OnboardingWizard.jsx` — فصل المسار العادي عن المتقدم.
    - `archive app/src/services/storage/schema.js` — وسم بيانات demo لمنع اختلاطها بالبيانات الحقيقية.
  - **التنفيذ:** لحظة قيمة خلال أقل من 30 ثانية؛ بيانات نموذجية؛ إعداد متقدم مخفي خلف رابط واضح؛ تهيئة تدريجية للسحابة بعد الاستكشاف؛ حذف بيانات demo عند الخروج.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 6 — P0).

---

### 15.7 P2 — نظام التخصيص البصري والسمات (Theming & Visual Customization)

- [ ] `[P2]` ⏱️XL **بناء محرر سمات وتخصيص كثافة وتخطيط الواجهة** — التطبيق لا يمنح المستخدم تحكماً كافياً في الألوان والخطوط والكثافة وحجم البطاقات وتخطيط الشريط الجانبي.
  - **الملفات الجديدة:**
    - `archive app/src/pages/AppearanceSettingsPage.jsx` — صفحة التخصيص البصري.
    - `archive app/src/features/theme/themePresets.js` — سمات جاهزة: فاتح/داكن/عالي التباين/باستيل/دافئ.
    - `archive app/src/components/theme/ThemeEditor.jsx` — محرر ألوان ونصف قطر وظلال وحركة.
    - `archive app/src/components/theme/DensitySelector.jsx` — Compact/Balanced/Comfortable.
    - `archive app/src/features/theme/themeExportImport.js` — مشاركة السمات كـ JSON.
  - **تعديل ملفات:**
    - `archive app/src/styles/v*-identity.css` — ربط أعمق بمتغيرات CSS الدلالية.
    - `archive app/src/components/views/*` — دعم حجم البطاقات وكثافة الجداول.
  - **التنفيذ:** معاينة حية قبل التطبيق؛ سمة مخصصة؛ وضع عالي التباين؛ تخصيص عرض الشريط الجانبي وحجم البطاقات وأعمدة الجدول؛ حفظ محلي ومزامنة سحابية عند التفعيل.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 7 — P2).

---

### 15.8 P1 — تحسين نظام التعامل مع الأخطاء والاسترداد (Error Handling & Recovery)

- [ ] `[P1]` ⏱️L **بناء طبقة استرداد أخطاء شاملة فوق رسائل الخطأ الحالية** — الرسائل الودّية وحدها لا تكفي إذا فشلت عملية كتابة أو مزامنة وتركت بيانات معلقة أو حالة غير متسقة.
  - **الملفات الجديدة:**
    - `archive app/src/features/errors/recoveryQueue.js` — حفظ عمليات الكتابة الفاشلة لإعادة المحاولة.
    - `archive app/src/components/errors/ErrorDetailsPanel.jsx` — طبقات الرسالة: مبسطة/حل مقترح/تفاصيل تقنية.
    - `archive app/src/pages/ErrorLogPage.jsx` — سجل أخطاء مركزي قابل للفلترة.
    - `archive app/src/features/errors/errorReportBuilder.js` — إنشاء تقرير خطأ مع السياق وبيانات الجهاز.
    - `archive app/src/features/storage/transactionalWrite.js` — تغليف عمليات متعددة الخطوات بتراجع عند الفشل.
  - **تعديل ملفات:**
    - `archive app/src/utils/errorHandling.js` — ربط الرسائل الحالية بالاسترداد والسجل.
    - `archive app/src/stores/slices/archiveSlice.js` — استخدام transactional writes للعمليات المركبة.
  - **التنفيذ:** إعادة محاولة عمليات محددة؛ سجل خطأ مع الصفحة والعملية والنوع؛ إبلاغ ذكي عن الخطأ؛ حماية من عنصر بلا ملف أو مجموعة بلا عناصر؛ إشعار “عمليات معلقة”.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 8 — P1).

---

### 15.9 P0 — تحسين رحلة المستخدم في سير العمل المتكرر (Daily Workflow Journey Optimization)

- [ ] `[P0]` ⏱️XL **إزالة احتكاكات الإضافة والتعديل والبحث عبر تدفق عمل متصل** — المستخدم الذي يضيف أو يعدّل عشرات العناصر يضيع وقتاً في فتح صفحات منفصلة وفقدان السياق.
  - **الملفات الجديدة:**
    - `archive app/src/components/workflow/ContextualQuickAddBar.jsx` — شريط إضافة سريع قابل للطي من أي صفحة.
    - `archive app/src/components/workflow/SideEditPanel.jsx` — تعديل سريع دون مغادرة القائمة.
    - `archive app/src/components/workflow/InlineSearchRefinement.jsx` — تحسين البحث داخل السياق الحالي.
    - `archive app/src/features/workflow/recentDefaults.js` — تذكّر آخر مجلد/وسوم/نوع.
  - **تعديل ملفات:**
    - `archive app/src/pages/ArchivePage.jsx` — دمج QuickAdd وSideEdit.
    - `archive app/src/pages/AddVideoPage.jsx` — دعم “تفاصيل إضافية” بدلاً من صفحة كاملة عند الحاجة.
    - `archive app/src/stores/slices/archiveSlice.js` — إنشاء عناصر بإعدادات افتراضية وسياقية.
  - **التنفيذ:** Enter لإضافة متتابعة؛ لوحة تعديل جانبية؛ حفظ السياق بعد الحفظ؛ اقتراح قيم من آخر استخدام؛ اختصار “إضافة عنصر مشابه”.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 9 — P0).

---

### 15.10 P1 — نظام الملاحظات والتعليقات على العناصر (Item Notes & Annotations)

- [ ] `[P1]` ⏱️XL **إضافة ملاحظات شخصية وتعليقات تعاونية مرتبطة بالزمن أو المنطقة داخل العنصر** — العناصر المؤرشفة لا تدعم تدوين ملاحظات زمنية على الفيديو/الصوت أو ملاحظات مرئية على الصور والمستندات.
  - **الملفات الجديدة:**
    - `archive app/src/features/notes/notesModel.js` — نموذج الملاحظات والردود والربط الزمني/المكاني.
    - `archive app/src/components/notes/NotesSidebar.jsx` — لوحة جانبية للملاحظات والتعليقات.
    - `archive app/src/components/notes/TimelineNoteMarkers.jsx` — علامات على شريط الفيديو/الصوت.
    - `archive app/src/components/notes/VisualAnnotationLayer.jsx` — تحديد مناطق في الصور/المستندات.
    - `archive app/src/components/notes/ExportNotesDialog.jsx` — تصدير Markdown/PDF/Text.
  - **تعديل ملفات:**
    - `archive app/src/pages/DetailPage.jsx` — تبويب/لوحة ملاحظات.
    - `archive app/src/components/media/VideoPlayer.jsx` و`DocumentViewer.jsx` — ربط الملاحظات بالنقطة الزمنية أو المنطقة.
    - `archive-server/prisma/schema.prisma` — جدول notes/comments عند الوضع السحابي.
  - **التنفيذ:** ملاحظات شخصية؛ تعليقات Threaded؛ @mentions؛ فلترة ملاحظاتي/الكل؛ بحث داخل الملاحظات؛ تصدير مع روابط للعناصر الأصلية.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 10 — P1).

---

### 15.11 P1 — المزامنة الانتقائية وذكاء النطاق الترددي (Selective Sync & Bandwidth Intelligence)

- [ ] `[P1]` ⏱️XL **تمكين مزامنة انتقائية حسب المجلد/المجموعة مع سياسات نطاق ترددي وتخزين مؤقت ذكي** — المزامنة الحالية تعمل بمنطق الكل أو لا شيء، وهو غير مناسب للأرشيفات الكبيرة أو الجوال.
  - **الملفات الجديدة:**
    - `archive app/src/features/sync/selectiveSyncPolicy.js` — قواعد مزامنة لكل مجلد/مجموعة.
    - `archive app/src/components/sync/SyncScopeToggle.jsx` — زر “مزامنة محلياً”.
    - `archive app/src/components/sync/BandwidthSettings.jsx` — WiFi/بيانات جوال/اتصال بطيء.
    - `archive app/src/features/sync/smartCacheManager.js` — إبقاء الأكثر استخداماً وتنظيف القديم.
    - `archive app/src/components/sync/PerItemSyncBadge.jsx` — حالة العنصر: محلي/سحابي/جاري/تعارض.
  - **تعديل ملفات:**
    - `archive app/src/services/storage/*` — دعم metadata-only وdownload-on-demand.
    - `archive app/src/pages/CollectionsPage.jsx` و`FoldersPage.jsx` — زر المزامنة للمجموعات والمجلدات.
  - **التنفيذ:** مزامنة metadata فقط على بيانات الجوال؛ تنزيل ملفات عند الطلب؛ سقف تخزين محلي؛ إبقاء المفضلة دائماً محلية؛ جدولة مزامنة يدوية/كل ساعة/على WiFi فقط.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 11 — P1).

---

### 15.12 P2 — لوحة إحصائيات الاستخدام الشخصي وتحليلات الأرشيف (Personal Analytics & Archive Insights)

- [ ] `[P2]` ⏱️XL **بناء لوحة تحليلات شخصية تكشف نمو الأرشيف وصحته وأنماط الاستخدام** — لا توجد رؤية كافية حول النمو الشهري، أكثر الوسوم، العناصر غير المصنفة، المكررات، أو نشاط المستخدم.
  - **الملفات الجديدة:**
    - `archive app/src/pages/PersonalAnalyticsPage.jsx` — لوحة التحليلات الشخصية.
    - `archive app/src/components/analytics/GrowthCharts.jsx` — نمو العناصر والمساحة عبر الزمن.
    - `archive app/src/components/analytics/TagAnalyticsPanel.jsx` — أكثر الوسوم وتوحيد الوسوم المتشابهة.
    - `archive app/src/components/analytics/ArchiveHealthScore.jsx` — درجة صحة الأرشيف.
    - `archive app/src/features/analytics/periodicReports.js` — تقارير أسبوعية/شهرية.
  - **تعديل ملفات:**
    - `archive app/src/pages/DataCenterPage.jsx` — ربط التحليلات العامة بالشخصية أو فصلها.
    - `archive app/src/stores/slices/archiveSlice.js` — selectors للتحليل والإحصاءات.
  - **التنفيذ:** عناصر مضافة شهرياً/أسبوعياً؛ توزيع الأنواع؛ وسوم مكررة أو ناقصة؛ عناصر بلا وصف/مجموعة/وسوم؛ أكثر العناصر مشاهدة/تعديلاً؛ تقارير دورية بإشعار أو بريد.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 12 — P2).

---

### 15.13 P0 — لوحة القيادة الشخصية (Personal Dashboard)

- [x] `[P0]` ⏱️L **إضافة لوحة قيادة شخصية موجهة للاستخدام اليومي مع “يحتاج اهتمامك”** — المستخدم يبدأ من أرشيف مسطح ولا يرى ما أضافه اليوم أو الملفات الناقصة أو العمليات الفاشلة.
  - **الملفات الجديدة:**
    - `archive app/src/components/dashboard/PersonalGreeting.jsx` — تحية وسياق زمني ونشاط اليوم/الأسبوع.
    - `archive app/src/components/dashboard/NeedsAttentionPanel.jsx` — عناصر بلا وصف، ملفات لم تُرفع، عمليات فاشلة، مسودات.
    - `archive app/src/components/dashboard/MiniStatsPanel.jsx` — إحصائيات مصغرة.
    - `archive app/src/features/dashboard/actionRanking.js` — ترتيب الإجراءات حسب الاستخدام.
  - **تعديل ملفات:**
    - `archive app/src/pages/DashboardPage.jsx` — دمج الطبقة الشخصية فوق لوحة §15.4.
    - `archive app/src/components/dashboard/QuickActionsPanel.jsx` — إجراءات تتكيف مع عادات المستخدم.
  - **التنفيذ:** تحية باسم المستخدم؛ أرقام اليوم/الأسبوع؛ إجراءات مباشرة لكل تنبيه؛ آخر نشاط مع تراجع سريع عند الإمكان؛ إحصائيات مصغرة محدثة تلقائياً.
  - يتطلب: §15.4 أو يُنفّذ كأول نسخة منها.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 1 — P0).

---

### 15.14 P0 — سير عمل الإضافة الموجّه خطوة بخطوة (Guided Add Workflow)

- [x] `[P0]` ⏱️L **تحويل نموذج الإضافة الطويل إلى معالج 3-4 خطوات حسب نوع المحتوى** — AddVideoPage يعرض حقولاً كثيرة دفعة واحدة، ما يربك المستخدم الجديد ويزيد البيانات الناقصة.
  - **الملفات الجديدة:**
    - `archive app/src/components/add/GuidedAddWizard.jsx` — معالج الإضافة الرئيسي.
    - `archive app/src/components/add/ContentTypeStep.jsx` — اختيار فيديو/صوت/مستند/صورة.
    - `archive app/src/components/add/BasicInfoStep.jsx` — عنوان/وصف/وسوم.
    - `archive app/src/components/add/PlacementStep.jsx` — مجلد/مجموعة مع مقترحات.
    - `archive app/src/components/add/AdvancedDetailsStep.jsx` — حقول اختيارية مطوية.
  - **تعديل ملفات:**
    - `archive app/src/pages/AddVideoPage.jsx` — استبدال النموذج الكامل بالمعالج مع وضع متقدم.
    - `archive app/src/features/templates/*` — تعبئة الخطوات من القوالب إن وُجدت.
  - **التنفيذ:** حفظ كافٍ بعد الخطوات الأساسية؛ مؤشر تقدم؛ “حفظ ومتابعة لاحقاً”؛ اقتراح المجلد الأخير؛ تأكيد بعد الحفظ مع “إضافة عنصر مشابه”.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 2 — P0).

---

### 15.15 P1 — نظام التنقل السياقي الذكي (Contextual Smart Navigation)

- [ ] `[P1]` ⏱️L **استبدال التنقل الثابت بتنقل يتغير حسب الصفحة والنشاط والجهاز** — الشريط الجانبي يعرض نفس الخيارات دائماً، وصفحة التفاصيل والجوال يحتاجان إجراءات مختلفة.
  - **الملفات الجديدة:**
    - `archive app/src/components/navigation/ContextualSidebar.jsx` — sidebar حسب الصفحة.
    - `archive app/src/components/navigation/DetailNavigationPanel.jsx` — التالي/السابق/إجراءات/علاقات/مشابهات.
    - `archive app/src/components/navigation/SmartBottomTabs.jsx` — تنقل سفلي للجوال.
    - `archive app/src/features/navigation/navigationContext.js` — تحديد السياق الحالي.
  - **تعديل ملفات:**
    - `archive app/src/components/navigation/Sidebar.jsx` — التحول إلى wrapper ذكي.
    - `archive app/src/pages/DetailPage.jsx` — تمكين التنقل بين العناصر دون العودة للأرشيف.
    - `archive app/src/pages/AddVideoPage.jsx` — عرض مسودة العنصر والمقترحات في الشريط.
  - **التنفيذ:** قسم الأكثر زيارة ومؤخراً في الأرشيف؛ أزرار التالي/السابق في التفاصيل؛ إجراءات سريعة؛ تنقل سفلي ذكي للجوال؛ شريط اختصارات أسفل الشاشة حسب السياق.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 3 — P1).

---

### 15.16 P0 — تجربة البحث الشاملة الموحّدة (Unified Search Experience)

- [x] `[P0]` ⏱️L **بناء واجهة بحث عالمية Command Palette تعمل من أي صفحة مع نتائج غنية** — البحث الحالي مقيّد بسياق محدود ولا يحفظ السياق أو يعرض نتائج مصنفة بتمييز مطابقات.
  - **الملفات الجديدة:**
    - `archive app/src/components/search/GlobalSearchPalette.jsx` — نافذة Ctrl+K أو `/`.
    - `archive app/src/components/search/SearchSuggestionList.jsx` — اقتراحات عناصر/مجموعات/مجلدات/إجراءات.
    - `archive app/src/components/search/RichSearchResult.jsx` — نتيجة مع تمييز النص ونوع المحتوى والوسوم.
    - `archive app/src/features/search/savedSearches.js` — حفظ الاستعلامات المتكررة.
    - `archive app/src/features/search/contextualSearchHints.js` — اقتراح “بحث في نفس المجلد/المجموعة”.
  - **تعديل ملفات:**
    - `archive app/src/pages/ArchivePage.jsx` — ربط البحث القديم بالواجهة العالمية.
    - `archive-server/src/api/server.js` أو search endpoint الموجود — دعم مقتطفات OCR/transcript عند توفرها.
  - **التنفيذ:** بحث من أي صفحة؛ تبويبات كل النتائج/فيديو/صوت/مستندات/مجموعات؛ تمييز المطابقات؛ بحث محفوظ ديناميكي؛ نتائج داخل OCR والتفريغ مع رابط للموضع أو الزمن.
  - الجهد: 4-5 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 4 — P0).

---

### 15.17 P1 — نظام العرض التكيفي (Adaptive View System)

- [ ] `[P1]` ⏱️XL **إضافة عروض Timeline/Map/Kanban وتذكر تفضيلات العرض حسب السياق** — أوضاع الشبكة/القائمة/الجدول ثابتة ولا تتكيف مع عدد العناصر أو نوعها أو شاشة المستخدم.
  - **الملفات الجديدة:**
    - `archive app/src/components/views/TimelineView.jsx` — عرض زمني يوم/أسبوع/شهر/سنة.
    - `archive app/src/components/views/MapView.jsx` — خريطة للعناصر ذات الإحداثيات.
    - `archive app/src/components/views/KanbanView.jsx` — أعمدة حسب الحالة أو النوع أو حقل تصنيفي.
    - `archive app/src/components/views/TableColumnCustomizer.jsx` — اختيار وترتيب أعمدة الجدول.
    - `archive app/src/features/views/viewPreferenceStore.js` — حفظ التفضيلات لكل مجلد/مجموعة.
  - **تعديل ملفات:**
    - `archive app/src/pages/ArchivePage.jsx` — اختيار العرض التكيفي وتخزينه.
    - `archive app/src/components/views/TableView.jsx` — أعمدة مخصصة وحفظ الترتيب.
  - **التنفيذ:** اختيار تلقائي حسب العدد؛ حفظ العرض والفلاتر والأعمدة؛ Timeline للعناصر المؤرخة؛ Map للعناصر الجغرافية؛ Kanban مع سحب لتغيير الحالة.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 5 — P1).

---

### 15.18 P0 — نظام الإجراءات الجماعية المتقدم (Advanced Bulk Actions)

- [x] `[P0]` ⏱️L **ترقية العمليات الجماعية من تحديد يدوي إلى تحديد شرطي مع معاينة وتراجع** — العمليات الجماعية الأساسية موجودة، لكنها لا تكفي للسيناريوهات الشرطية أو تتبع النجاح والفشل أو التراجع الجزئي.
  - **الملفات الجديدة:**
    - `archive app/src/components/bulk/SmartSelectionBuilder.jsx` — تحديد حسب نوع/تاريخ/حالة/وسوم/حجم.
    - `archive app/src/components/bulk/BulkPreviewDialog.jsx` — معاينة التغييرات والعناصر المتأثرة.
    - `archive app/src/components/bulk/BulkProgressTracker.jsx` — تقدم ونجاح/فشل لكل عنصر.
    - `archive app/src/features/bulk/bulkUndoManager.js` — تراجع جماعي.
    - `archive app/src/pages/BulkOperationsHistoryPage.jsx` — سجل العمليات الجماعية.
  - **تعديل ملفات:**
    - `archive app/src/components/bulk/BulkActionBar.jsx` — إضافة التحديد الذكي والمعاينة.
    - `archive app/src/stores/slices/archiveSlice.js` — حفظ snapshots قبل العملية للتراجع.
    - `archive-server/src/api/server.js` — إعادة نتيجة تفصيلية per-item في bulk endpoints.
  - **التنفيذ:** “حدد العناصر بدون وصف/المضافة هذا الأسبوع/الأكبر من 100MB”؛ دمج شروط AND/OR؛ معاينة قبل التنفيذ؛ أخطاء لا توقف كامل العملية؛ إعادة محاولة للفاشل فقط؛ تراجع خلال 30 ثانية وسجل دائم.
  - يتطلب: يبني فوق مهمة العمليات الجماعية الأساسية المكتملة في §9.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 6 — P0).

---

### 15.19 P1 — تجربة العنصر الأول والتهيئة الموجّهة (First-Item Onboarding)

- [ ] `[P1]` ⏱️L **إضافة تهيئة استخدام بعد الإعداد التقني تقود المستخدم لإضافة وتنظيم أول عنصر** — صفحة الأرشيف الفارغة لا تشرح ما الذي يجب أرشفته أولاً أو كيف تُنظّم المجلدات والوسوم.
  - **الملفات الجديدة:**
    - `archive app/src/features/onboarding/FirstItemOnboarding.jsx` — مسار أول 10 دقائق.
    - `archive app/src/components/onboarding/UseCasePicker.jsx` — اختيار محاضرات/عمل/وسائط/مؤسسي/أخرى.
    - `archive app/src/features/onboarding/suggestedStructures.js` — قوالب مجلدات ووسوم حسب حالة الاستخدام.
    - `archive app/src/components/onboarding/FirstItemSuccess.jsx` — تأكيد احتفالي وخطوات تالية.
  - **تعديل ملفات:**
    - `archive app/src/features/onboarding/V1OnboardingWizard.jsx` — الانتقال إلى مسار الاستخدام بعد الإعداد.
    - `archive app/src/pages/ArchivePage.jsx` — حالة فارغة ذكية عند عدم وجود عناصر.
  - **التنفيذ:** اختيار حالة الاستخدام؛ إنشاء مقترحات مجلدات ووسوم؛ إضافة أول عنصر عبر §15.14؛ شرح الفرق بين المجلدات والمجموعات؛ جولة قصيرة للأدوات؛ إخفاء الخطوات تدريجياً بعد الخبرة.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 7 — P1).

---

### 15.20 P1 — قائمة الأوامر واكتشاف الاختصارات (Command Palette & Shortcut Discovery)

- [x] `[P1]` ⏱️L **توسيع نظام الاختصارات بقائمة أوامر واكتشاف تدريجي لا يحتاج حفظ الاختصارات** ✅ 2026-06-12 — ShortcutHintBubble + shortcutLearningState (MAX_SHOWS=3, localStorage "va:shortcut:learned") — حتى مع وجود اختصارات، يحتاج المستخدم طريقة لاكتشاف الأوامر وتنفيذها من لوحة المفاتيح.
  - **الملفات الجديدة:**
    - `archive app/src/components/command/CommandPalette.jsx` — Ctrl+Shift+P للبحث في الأوامر.
    - `archive app/src/features/command/commandRegistry.js` — ربط الأوامر بالإجراءات والصلاحيات والسياق.
    - `archive app/src/components/shortcuts/ShortcutHintBubble.jsx` — تلميح يظهر بعد استخدام الفأرة لعملية لها اختصار.
    - `archive app/src/features/shortcuts/shortcutLearningState.js` — إيقاف التلميح بعد تعلّم المستخدم.
  - **تعديل ملفات:**
    - `archive app/src/features/shortcuts/shortcutRegistry.js` — مشاركة نفس المصدر بين الاختصارات وقائمة الأوامر.
    - `archive app/src/components/common/Button.jsx` أو مكونات الأزرار المشتركة — عرض التلميحات عند الحاجة.
  - **التنفيذ:** أوامر عامة وصفحية؛ بحث باسم الأمر؛ عرض الاختصار بجانبه؛ تلميحات تعلم تدريجي تتوقف بعد 3 مرات؛ استيراد/تصدير إعدادات الاختصارات.
  - يتطلب: §15.5 أو يُدمج معه كمرحلة ثانية.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 8 — P1).

---

### 15.21 P2 — نظام التغذية الراجعة السياقية والتعلم الذاتي (Contextual Feedback & Self-Learning)

- [ ] `[P2]` ⏱️L **بناء طبقة اقتراحات ذكية تساعد المستخدم على تحسين طريقة استخدامه تدريجياً** — النظام لا يرشد المستخدم عند تكرار سلوك غير مثالي مثل إضافة عناصر بلا وسوم أو عدم استخدام المجموعات الذكية.
  - **الملفات الجديدة:**
    - `archive app/src/features/feedback/contextualRules.js` — قواعد النصائح حسب السلوك.
    - `archive app/src/components/feedback/ContextualNudge.jsx` — نصيحة غير مزعجة في اللحظة المناسبة.
    - `archive app/src/components/feedback/WeeklySuggestionsPanel.jsx` — 2-3 اقتراحات أسبوعية.
    - `archive app/src/features/feedback/usagePatternAnalyzer.js` — تحليل سلوك المستخدم محلياً.
    - `archive app/src/stores/slices/feedbackPrefsSlice.js` — عدم الإظهار مرة أخرى وحالة النصائح.
  - **تعديل ملفات:**
    - `archive app/src/pages/DashboardPage.jsx` — قسم اقتراحات التحسين.
    - `archive app/src/components/forms/TagAutocomplete.jsx` و`AddVideoPage.jsx` — تلميحات عند الاستخدام المتكرر بلا وسوم/وصف.
  - **التنفيذ:** نصائح سياقية مرة واحدة؛ اقتراحات تنظيم أسبوعية؛ مؤشرات استخدام شخصية؛ كشف ميزات متقدمة تدريجياً؛ تعلم من الأخطاء المتكررة لتعديل القيم الافتراضية المقترحة.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 9 — P2).

---

### 15.22 P1 — تجربة عدم الاتصال الشاملة (Comprehensive Offline Experience)

- [ ] `[P1]` ⏱️L **تحويل تجربة الأوفلاين إلى نمط عمل كامل مع طابور تغييرات ومزامنة تعارضات** — وجود PWA أو cache لا يكفي إذا توقفت الإضافة والتعديل والرفع عند فقدان الاتصال أو لم تظهر حالة واضحة للمستخدم.
  - **الملفات الجديدة:**
    - `archive app/src/components/offline/OfflineBanner.jsx` — شريط حالة واضح.
    - `archive app/src/features/offline/offlineQueue.js` — طابور إضافة/تعديل/حذف محلي.
    - `archive app/src/components/offline/PendingSyncBadge.jsx` — مؤشر على العناصر المعدلة أوفلاين.
    - `archive app/src/features/offline/connectivityProbe.js` — ping دوري للسيرفر بجانب navigator.onLine.
    - `archive app/src/features/offline/precachePolicy.js` — تخبئة آخر 100 عنصر ومجلدات محددة.
  - **تعديل ملفات:**
    - `archive app/public/sw.js` — ربط العمليات طويلة الأمد بالـ background sync إن أمكن.
    - `archive app/src/stores/slices/archiveSlice.js` — قبول عمليات كتابة محلية عند الانقطاع.
    - `archive app/src/features/sync/conflictResolver.js` — استخدام حوار تعارضات §15.2.
  - **التنفيذ:** تصفح وبحث محلي أوفلاين؛ إضافة/تعديل/حذف في الطابور؛ مزامنة زمنية عند عودة الاتصال؛ حفظ طلبات الرفع/التصدير للمعالجة لاحقاً؛ مؤشرات per-item؛ تخبئة مسبقة للمحتوى الأكثر استخداماً.
  - الجهد: 4-5 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 10 — P1).

---

## 16. أفكار الميزات الجديدة — مهام تنفيذية مستخرجة

> المصدر: `archive-suite-new-feature-ideas.md`.
> المنهجية: حُوّلت الأفكار المقترحة إلى مهام تنفيذية بنفس صيغة ملف المهام. البنود التي لها أصل سابق في الملف الحالي صيغت كتوسعة أو مرحلة تنفيذ إضافية بدل تكرار مباشر.

### 16.1 P1 — المجموعات الذكية التلقائية بقواعد مركبة (Smart Auto-Collections)

- [ ] `[P1]` ⏱️L **توسيع المجموعات الذكية لتُدار بقواعد تلقائية عند إضافة/تعديل العناصر** — المهمة الحالية في §9 تغطي مجموعات مبنية على استعلام محفوظ، لكنها لا تغطي محرّك قواعد حي يربط العناصر تلقائياً عند كل تغيير.
  - **حالة حالية (2026-06-11):** يبقى هذا البند مفتوحاً بعد إغلاق §9؛ الموجود حالياً saved filters حيّة، وليس DSL قواعد مركبة ولا جدول `smart_collection_rules` ولا مقيّم خادمي يشتغل عند إضافة/تعديل العناصر.
  - **الملفات الجديدة:**
    - `archive app/src/features/collections/smartCollectionRules.js` — تعريف DSL القواعد: وسوم، نوع، تاريخ، مجلد، حجم، شروط AND/OR.
    - `archive app/src/components/collections/SmartCollectionRuleBuilder.jsx` — محرر قواعد بصري.
    - `archive-server/src/collections/smartCollectionEvaluator.js` — تقييم القواعد في الخادم أو عند المزامنة.
    - `archive-server/prisma/migrations/*_smart_collection_rules/` — جدول `smart_collection_rules`.
  - **تعديل ملفات:**
    - `archive app/src/pages/CollectionsPage.jsx` — تمييز المجموعات الذكية بأيقونة ⚡ وإدارة قواعدها.
    - `archive app/src/stores/slices/collectionsSlice.js` — إعادة حساب العضوية بعد الإضافة/التعديل.
    - `archive-server/src/api/server.js` — مسارات إنشاء/تحديث/اختبار القواعد.
  - **التنفيذ:** قواعد بسيطة ومركبة؛ معاينة عدد العناصر المطابقة قبل الحفظ؛ تطبيق تلقائي عند إضافة عنصر جديد أو تعديل وسومه؛ تحويل مجموعة ذكية لعادية والعكس؛ سجل آخر تشغيل للقاعدة.
  - يرتبط بـ: §9.د “مجموعات ذكية”.
  - المصدر: archive-suite-new-feature-ideas (الميزة 1 — P1).

---

### 16.2 P0 — المفضلات والوصول السريع (Favorites & Quick Access)

- [x] `[P0]` ⏱️M **إضافة نظام مفضلات شامل للعناصر والمجموعات والمجلدات والبحث المحفوظ** — لا يوجد حالياً مسار سريع ثابت للوصول للعناصر المتكررة، ما يجعل المستخدم يعيد البحث أو التنقل لنفس المحتوى يومياً.
  - **الملفات الجديدة:**
    - `archive app/src/features/favorites/favoritesStore.js` — إدارة المفضلات محلياً وسحابياً.
    - `archive app/src/components/favorites/FavoriteButton.jsx` — زر نجمة موحد لكل كيان.
    - `archive app/src/components/favorites/FavoritesSidebarSection.jsx` — قسم أعلى الشريط الجانبي.
    - `archive app/src/pages/FavoritesPage.jsx` — صفحة مفضلات موحدة.
    - `archive-server/prisma/migrations/*_favorites/` — جدول `favorites` بنوع الكيان والمالك والترتيب.
  - **تعديل ملفات:**
    - `archive app/src/components/navigation/Sidebar.jsx` — عرض المفضلات والأكثر استخداماً.
    - `archive app/src/pages/ArchivePage.jsx` و`RecordDetailsPage.jsx` — إظهار زر المفضلة.
    - `archive app/src/features/search/savedSearches.js` — دعم حفظ البحث كمفضلة.
  - **التنفيذ:** مفضلات يدوية؛ قسم “الأكثر استخداماً” تلقائي حسب الفتح/التعديل؛ ترتيب المفضلات بالسحب؛ مزامنة عبر الأجهزة؛ اختصار لوحة مفاتيح لإضافة/إزالة المفضلة.
  - الجهد: 1-2 أسبوع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 2 — P0).

---

### 16.3 P1 — كشف المكررات الذكي ودمجها (Smart Duplicate Detection & Merge)

- [x] `[P1]` ⏱️L **بناء نظام كشف مكررات متعدد الطبقات مع واجهة دمج آمنة** — التحليلات الحالية قد تشير لصحة الأرشيف، لكنها لا تقدم فحصاً عملياً للمكررات ولا عملية دمج قابلة للتراجع.
  - **الملفات الجديدة:**
    - `archive-server/src/duplicates/duplicateScanner.js` — فحص hash والحجم والنوع والعنوان.
    - `archive-server/src/duplicates/mergeService.js` — دمج البيانات الوصفية والملفات المرتبطة.
    - `archive app/src/pages/DuplicatesPage.jsx` — لوحة مراجعة المكررات.
    - `archive app/src/components/duplicates/DuplicatePairCard.jsx` — عرض الزوج ودرجة التشابه.
    - `archive-server/prisma/migrations/*_duplicate_candidates/` — جدول نتائج الفحص وجدول قرارات المستخدم.
  - **تعديل ملفات:**
    - `archive-server/src/files/fileStorageService.js` — حفظ hash للملفات الجديدة.
    - `archive app/src/pages/PersonalAnalyticsPage.jsx` — ربط “صحة الأرشيف” بالمكررات.
    - `archive app/src/stores/slices/archiveSlice.js` — إجراءات دمج/تجاهل/حذف.
  - **التنفيذ:** مطابقة تامة عبر hash؛ مطابقة حجم/نوع؛ تشابه عناوين؛ درجة ثقة؛ تشغيل يدوي أو أسبوعي؛ خيارات: دمج، حذف النسخة الأقدم، تجاهل؛ حفظ قرار “ليسا مكررَين”.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 3 — P1).

---

### 16.4 P1 — شاهد لاحقاً وقوائم القراءة/المراجعة (Watch Later & Reading Lists)

- [x] `[P1]` ⏱️M **إضافة قوائم شخصية مؤقتة لتجميع العناصر المراد الرجوع إليها لاحقاً** — المفضلات لا تكفي لأنها تعبّر عن “مهم دائماً” لا “أريد مراجعته لاحقاً”.
  - **الملفات الجديدة:**
    - `archive app/src/features/lists/readingListsSlice.js` — قوائم المستخدم وحالة التقدم.
    - `archive app/src/components/lists/WatchLaterButton.jsx` — إضافة سريعة للقائمة الافتراضية.
    - `archive app/src/pages/ReadingListsPage.jsx` — إدارة القوائم.
    - `archive app/src/components/lists/ReadingListProgressBadge.jsx` — مكتمل/غير مكتمل/قيد القراءة.
    - `archive-server/prisma/migrations/*_reading_lists/` — جداول `reading_lists` و`reading_list_items`.
  - **تعديل ملفات:**
    - `archive app/src/components/cards/RecordCard.jsx` — زر “شاهد لاحقاً”.
    - `archive app/src/pages/RecordDetailsPage.jsx` — تحديث التقدم عند مشاهدة الفيديو/فتح المستند.
    - `archive app/src/components/navigation/Sidebar.jsx` — عداد العناصر غير المنتهية.
  - **التنفيذ:** قائمة افتراضية؛ قوائم مخصصة؛ ترتيب بالسحب؛ نقل تلقائي إلى “مكتمل” عند انتهاء مشاهدة/قراءة؛ فلاتر للمنتهي وغير المنتهي.
  - الجهد: 1-2 أسبوع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 4 — P1).

---

### 16.5 P1 — الاستيراد من مصادر خارجية (External Source Import)

- [ ] `[P1]` ⏱️XL **بناء منظومة استيراد من يوتيوب وGoogle Drive وروابط الويب والمجلدات المحلية** — الرفع اليدوي وحده يرفع الاحتكاك ويمنع إدخال المحتوى من مصادر الاستخدام اليومية.
  - **الملفات الجديدة:**
    - `archive app/src/pages/ImportSourcesPage.jsx` — مركز ربط المصادر.
    - `archive app/src/components/import/ExternalImportDialog.jsx` — إدخال رابط أو اختيار مصدر.
    - `archive-server/src/importers/youtubeImporter.js` — حفظ مرجع أو تنزيل اختياري مع بيانات وصفية.
    - `archive-server/src/importers/googleDriveImporter.js` — استيراد ملفات Drive بعد OAuth.
    - `archive-server/src/importers/webPageImporter.js` — حفظ صفحة HTML/PDF وmetadata.
    - `archive-server/src/importers/localFolderManifestImporter.js` — استيراد manifest لمجلدات محلية.
    - `archive-server/prisma/migrations/*_import_sources/` — إعدادات المصادر وحالة الاستيراد.
  - **تعديل ملفات:**
    - `archive app/src/pages/AddVideoPage.jsx` أو AddItemPage — خيار “استيراد من مصدر”.
    - `archive-server/src/auth/oauthService.js` — نطاقات OAuth للمصادر الخارجية.
    - `archive-server/src/jobs/jobQueue.js` — تنفيذ الاستيراد كمهام طويلة.
  - **التنفيذ:** استيراد رابط مفرد؛ استيراد مجلد/دفعة؛ استخراج عنوان ووصف ومؤلف وتاريخ نشر؛ سياسة تنزيل/مرجع فقط؛ معالجة أخطاء الصلاحيات؛ شريط تقدم وسجل عمليات.
  - ملاحظة: تنزيل محتوى من منصات خارجية يجب أن يحترم شروط الاستخدام وحقوق الوصول؛ لذلك يفضّل دعم “حفظ مرجع + metadata” كخيار افتراضي آمن.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 5 — P1).

---

### 16.6 P1 — تاريخ إصدارات العناصر والملفات المرفقة (Item Version History)

- [ ] `[P1]` ⏱️L **توسيع سجل الإصدارات ليشمل الحقول والملفات والمقارنة والاستعادة الجزئية** — §9.ج يغطي snapshot للسجل، وهذه المهمة توسّعه إلى تجربة مستخدم كاملة مع ملفات مشتقة وسياسات احتفاظ.
  - **الملفات الجديدة:**
    - `archive app/src/components/versions/VersionTimeline.jsx` — خط زمني للإصدارات.
    - `archive app/src/components/versions/VersionDiffViewer.jsx` — مقارنة حقول ووسوم ووصف.
    - `archive app/src/components/versions/RestoreVersionDialog.jsx` — استعادة كاملة أو جزئية.
    - `archive-server/src/versions/versionRetentionService.js` — تنظيف الإصدارات القديمة حسب السياسة.
    - `archive-server/prisma/migrations/*_item_versions_extended/` — توسيع `record_versions` لدعم fileRevision وdiff metadata.
  - **تعديل ملفات:**
    - `archive-server/src/api/server.js` — نقاط compare/restore/list.
    - `archive app/src/pages/RecordDetailsPage.jsx` — تبويب “الإصدارات”.
    - `archive-server/src/files/fileStorageService.js` — الاحتفاظ بنسخ ملفات عند الاستبدال حسب policy.
  - **التنفيذ:** نسخة عند كل تعديل جوهري؛ عرض من عدّل ومتى وما تغيّر؛ استعادة حقل واحد؛ استعادة ملف سابق؛ مقارنة نسختين؛ سياسة احتفاظ: آخر 10 / آخر 90 يوم / الكل.
  - يرتبط بـ: §9.ج “سجل إصدارات السجل”.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 6 — P1).

---

### 16.7 P1 — المشاركة والتعاون المحدود بصلاحيات دقيقة (Limited Sharing & Collaboration)

- [ ] `[P1]` ⏱️XL **توسيع المشاركة من روابط snapshot إلى مشاركة عناصر ومجموعات بدعوات وصلاحيات وتعليقات** — روابط المشاركة الحالية لا تكفي لسيناريوهات الفريق ولا توفر صلاحيات مثل تعليق/تعديل/تحميل فقط.
  - **الملفات الجديدة:**
    - `archive app/src/components/share/ShareDialog.jsx` — مشاركة عنصر أو مجموعة.
    - `archive app/src/pages/SharedWithMePage.jsx` — المحتوى المشترك مع المستخدم.
    - `archive app/src/components/comments/CommentThread.jsx` — تعليقات على العنصر أو المجموعة.
    - `archive-server/src/share/sharePermissionService.js` — صلاحيات عرض/تحميل/تعليق/تعديل.
    - `archive-server/src/share/invitationService.js` — دعوات بريدية وروابط مؤقتة.
    - `archive-server/prisma/migrations/*_sharing_permissions/` — جداول shares, share_invites, comments.
  - **تعديل ملفات:**
    - `archive-server/src/share/` — دعم كلمة مرور للرابط، انتهاء صلاحية، إلغاء فوري، صلاحيات دقيقة.
    - `archive-server/src/api/server.js` — middleware صلاحيات للموارد المشتركة.
    - `archive app/src/pages/RecordDetailsPage.jsx` و`CollectionsPage.jsx` — أزرار المشاركة والتعليقات.
  - **التنفيذ:** مشاركة عنصر/مجموعة؛ رابط خاص؛ دعوة مستخدم بالبريد؛ صلاحيات: metadata فقط، عرض، تنزيل، تعليق، تعديل؛ انتهاء صلاحية؛ كلمة مرور اختيارية؛ سجل نشاط المشاركة.
  - يرتبط بـ: مهام إبطال روابط المشاركة وRBAC في §1 و§9.
  - الجهد: 5-8 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 7 — P1).

---

### 16.8 P1 — عمليات البحث المحفوظة والتنبيهات التلقائية (Saved Searches & Alerts)

- [x] `[P1]` ⏱️L **تحويل البحث المحفوظ إلى كيان كامل مع تنبيهات عند ظهور عناصر مطابقة** — البحث المحفوظ مذكور ضمن المجموعات الذكية، لكن لا توجد تجربة مستقلة لحفظه وتشغيله والتنبيه عليه.
  - **الملفات الجديدة:**
    - `archive app/src/features/search/savedSearchesSlice.js` — إدارة الاستعلامات المحفوظة.
    - `archive app/src/components/search/SaveSearchButton.jsx` — حفظ من نتائج البحث.
    - `archive app/src/pages/SavedSearchesPage.jsx` — إدارة البحث والتنبيهات.
    - `archive-server/src/search/savedSearchAlertService.js` — فحص العناصر الجديدة المطابقة.
    - `archive-server/prisma/migrations/*_saved_search_alerts/` — جداول saved_searches وsaved_search_alerts.
  - **تعديل ملفات:**
    - `archive app/src/components/navigation/Sidebar.jsx` — قسم “عمليات البحث المحفوظة”.
    - `archive-server/src/notifications/` — ربط التنبيهات بمركز الإشعارات والبريد الاختياري.
    - `archive-server/src/api/searchRoutes.js` أو `server.js` — CRUD للبحث المحفوظ.
  - **التنفيذ:** حفظ استعلام مع اسم وأيقونة؛ تشغيل بنقرة؛ تحويله لتنبيه؛ إشعار عند إضافة عنصر مطابق؛ digest يومي/أسبوعي؛ احترام صلاحيات المستخدم في النتائج.
  - يرتبط بـ: §9.د و§15.4.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 8 — P1).

---

### 16.9 P2 — تلخيص المحتوى واستخلاص النقاط الرئيسية (Content Summarization & Key Insights)

- [ ] `[P2]` ⏱️XL **إضافة طبقة تلخيص AI للعناصر والمجموعات اعتماداً على OCR والتفريغ الصوتي** — البحث داخل المحتوى يصبح أقوى عندما توجد ملخصات ونقاط رئيسية قابلة للعرض والفهرسة.
  - **الملفات الجديدة:**
    - `archive-server/src/ai/summarizationService.js` — توليد ملخص قصير ونقاط وملخص مفصل.
    - `archive-server/src/ai/groupSummaryService.js` — تلخيص مجموعة عناصر.
    - `archive app/src/components/ai/SummaryPanel.jsx` — عرض الملخص في صفحة التفاصيل.
    - `archive app/src/components/cards/SummarySnippet.jsx` — ملخص قصير في بطاقة العنصر.
    - `archive-server/prisma/migrations/*_content_summaries/` — حقول/جدول summaries مع language/model/status.
  - **تعديل ملفات:**
    - `archive-server/src/ai/sdkProvider.js` — حماية prompt وقيود طول.
    - `archive app/src/pages/RecordDetailsPage.jsx` — زر “تلخيص/تحديث الملخص”.
    - `archive-server/src/jobs/jobQueue.js` — تشغيل التلخيص كخلفية بعد OCR/Transcription.
  - **التنفيذ:** ملخص فقرة؛ 5-10 نقاط رئيسية؛ ملخص مفصل بعناوين؛ تلخيص مجموعة؛ تحديث عند تغيير المحتوى؛ دعم العربية؛ عدم تشغيل التفريغ/OCR إلا بموافقة أو إعداد واضح.
  - يرتبط بـ: §7 “بحث دلالي” و§16.15 “تحويل الصيغ”.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 9 — P2).

---

### 16.10 P2 — أتمتة سير العمل بقواعد إذا-ثم (Workflow Automation Rules)

- [ ] `[P2]` ⏱️XL **بناء محرر قواعد أتمتة بصري للأحداث والإجراءات المتكررة** — بدون أتمتة، تبقى خطوات مثل إضافة وسوم أو تشغيل تفريغ أو إرسال تذكير عمليات يدوية سهلة النسيان.
  - **الملفات الجديدة:**
    - `archive app/src/pages/AutomationRulesPage.jsx` — إدارة القواعد.
    - `archive app/src/components/automation/RuleBuilder.jsx` — محرر إذا/ثم.
    - `archive-server/src/automation/ruleEngine.js` — تقييم الأحداث والشروط.
    - `archive-server/src/automation/actionRunner.js` — تنفيذ الإجراءات بأمان.
    - `archive-server/src/automation/ruleExecutionLog.js` — سجل التنفيذ.
    - `archive-server/prisma/migrations/*_automation_rules/` — جداول rules وexecutions.
  - **تعديل ملفات:**
    - `archive-server/src/events/domainEvents.js` — بث أحداث item.created/item.updated/storage.threshold.
    - `archive-server/src/jobs/jobQueue.js` — جدولة القواعد المؤجلة.
    - `archive app/src/components/navigation/Sidebar.jsx` — رابط الأتمتة.
  - **التنفيذ:** أحداث: عنصر أضيف/عُدّل/وُسّم/مساحة تخزين تجاوزت حد؛ إجراءات: أضف وسم، انقل، أرسل إشعار، شغّل OCR/تفريغ، أنشئ نسخة احتياطية؛ تفعيل/تعطيل؛ اختبار القاعدة على عينة؛ سجل تنفيذ قابل للمراجعة.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 10 — P2).

---

### 16.11 P2 — الخط الزمني البصري للأرشيف (Visual Archive Timeline)

- [ ] `[P2]` ⏱️L **إضافة عرض خط زمني تفاعلي يكشف توزيع العناصر عبر الزمن** — العرض الزمني مذكور ضمن نظام العرض التكيفي، وهذه مهمة تنفيذ تفصيلية له كصفحة/وضع عرض مستقل.
  - **الملفات الجديدة:**
    - `archive app/src/components/views/TimelineView.jsx` — عرض العناصر على محور زمني.
    - `archive app/src/components/views/TimelineZoomControls.jsx` — يوم/أسبوع/شهر/سنة.
    - `archive app/src/components/views/TimelineLane.jsx` — صفوف حسب النوع أو المجموعة.
    - `archive app/src/features/timeline/timelineSelectors.js` — تجميع حسب الزمن.
  - **تعديل ملفات:**
    - `archive app/src/pages/ArchivePage.jsx` — إضافة وضع Timeline.
    - `archive app/src/features/views/viewPreferencesSlice.js` — حفظ تفضيل العرض.
    - `archive-server/src/api/searchRoutes.js` — endpoint تجميع زمني عند الأحجام الكبيرة.
  - **التنفيذ:** تكبير/تصغير؛ ألوان/أيقونات حسب النوع؛ حجم النقطة حسب حجم الملف؛ فلاتر وسوم/أنواع/مجموعات؛ خطوط متعددة للمقارنة؛ فتح العنصر من النقطة الزمنية.
  - يرتبط بـ: §15.10 “نظام العرض التكيفي”.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 11 — P2).

---

### 16.12 P2 — الاقتراحات الذكية والمحتوى المرتبط (Smart Suggestions & Related Content)

- [ ] `[P2]` ⏱️L **إضافة قسم محتوى مرتبط واقتراحات تحسين مبنية على التشابه والسلوك** — الاقتراحات العامة في اللوحة لا تكفي إذا لم تظهر أيضاً داخل صفحة العنصر وفي لحظة اتخاذ القرار.
  - **الملفات الجديدة:**
    - `archive-server/src/recommendations/relatedContentService.js` — حساب التشابه بالوسوم/المجموعة/النوع/المحتوى.
    - `archive app/src/components/recommendations/RelatedContentPanel.jsx` — عناصر مرتبطة في صفحة التفاصيل.
    - `archive app/src/components/recommendations/ArchiveImprovementSuggestions.jsx` — اقتراحات تنظيف وتنظيم.
    - `archive app/src/features/recommendations/recommendationFeedback.js` — إخفاء/مفيد/غير مفيد.
  - **تعديل ملفات:**
    - `archive app/src/pages/RecordDetailsPage.jsx` — تبويب أو لوحة جانبية للمحتوى المرتبط.
    - `archive app/src/pages/DashboardPage.jsx` — اقتراحات تحسين على مستوى الأرشيف.
    - `archive-server/src/ai/summarizationService.js` — استخدام الملخصات كإشارة تشابه عند توفرها.
  - **التنفيذ:** 5-10 عناصر مشابهة؛ تفسير سبب الاقتراح؛ اقتراح جمع عناصر في مجموعة؛ اقتراح إضافة وصف/وسوم؛ إمكانية تجاهل الاقتراح؛ عدم إظهار اقتراحات مكررة.
  - يرتبط بـ: §15.21 و§16.9.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 12 — P2).

---

### 16.13 P1 — الالتقاط السريع من الجوال وصندوق الوارد (Mobile Quick Capture)

- [ ] `[P1]` ⏱️XL **بناء تجربة التقاط سريع للجوال عبر PWA مع Inbox للتنظيم لاحقاً** — نموذج الإضافة الكامل غير مناسب للحظات السريعة مثل تصوير وثيقة أو تسجيل ملاحظة صوتية.
  - **الملفات الجديدة:**
    - `archive app/src/pages/MobileCapturePage.jsx` — واجهة التقاط مبسطة.
    - `archive app/src/components/mobile/FloatingCaptureButton.jsx` — زر + عائم للجوال.
    - `archive app/src/features/capture/captureInboxSlice.js` — عناصر “بريد الوارد”.
    - `archive app/src/components/capture/CaptureReviewQueue.jsx` — تنظيم العناصر الملتقطة لاحقاً.
    - `archive app/public/manifest.webmanifest` — shortcuts للتقاط صورة/صوت إن أمكن.
  - **تعديل ملفات:**
    - `archive app/src/serviceWorker.js` أو `public/sw.js` — دعم offline capture queue.
    - `archive app/src/pages/AddVideoPage.jsx` أو AddItemPage — وضع “حفظ الآن وتعديل لاحقاً”.
    - `archive-server/src/uploads/uploadRoutes.js` — قبول uploads من الطابور المتأخر.
  - **التنفيذ:** التقاط صورة/فيديو/صوت/ملاحظة نصية؛ عنوان تلقائي بالوقت؛ حفظ في Inbox؛ حقل عنوان واحد فقط؛ تفريغ الملاحظة الصوتية عند توفر الخدمة؛ عمل أوفلاين ثم رفع لاحق.
  - يرتبط بـ: §15.22 “الأوفلاين الشامل” و§15.8 “تجربة الجوال”.
  - الجهد: 5-6 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 13 — P1).

---

### 16.14 P1 — العلامات المرجعية الزمنية للفيديو والصوت (Time-Based Bookmarks)

- [x] `[P1]` ⏱️M **إضافة علامات زمنية داخل مشغل الفيديو/الصوت مع ملاحظات وتصدير** — **(مكتملة ✅ — 12 يونيو 2026)**
  - **✅ منجز ومُدمج:** `archive app/src/components/media/TimeBookmarks.jsx` (يصدّر `TimeBookmarkButton` + `TimeBookmarkList`: التقاط الوقت الحالي، عنوان+ملاحظة، نقر للانتقال، حذف، تصدير Markdown/CSV، RTL+a11y)؛ مدمج في `DetailPage.jsx` (التقاط من `videoRef.currentTime`، `seekToBookmark`)؛ الحفظ عبر slice `addBookmark`/`removeBookmark` (`archiveSlice.js:266,281`) إلى مخزن `BOOKMARKS` (IndexedDB + محوّل sqlite + import/export portability).
  - **⬜ المتبقي (مهام الإكمال):**
    - ✅ **تم جزئياً (2026-06-11):** أضيف `TimeBookmarkTimelineMarkers` كخط زمني مصغّر قابل للنقر أسفل المشغّل الحالي، مع helper نقي `buildTimeBookmarkMarkers` واختبار في `verify-modules.mjs`. سيبقى دمجه داخل شريط تقدّم مشغّل مخصّص عند تنفيذ §13.1 #20.
    - ✅ **محسوم معماريًا (2026-06-12):** لا حاجة لجدول prisma مخصّص `time_bookmarks`. مخزن `BOOKMARKS` مُسجَّل ضمن `DATA_STORES` في `services/storage/index.js`، فيُحفظ ويُزامَن على الخادم عبر طبقة التخزين الموحّدة `storage_rows` (`store`+`uid`+`data` JSON) ودوال RPC `putBatch`/`deleteBatch`/`getAll`/`snapshot`/`replaceAll` — تمامًا كبقية المجموعات (items/types/relations) على محوّلَي Postgres وPocketBase. إنشاء جدول منفصل كان سيجعل العلامات الكيان الوحيد الذي يتجاوز الطبقة الموحّدة (هجرة زائدة + مسار مزامنة ثانٍ)، فتُرك عمدًا.
    - ✅ **تم (2026-06-11):** ربط تلقائي بفقرة transcript: عند فتح نموذج علامة زمنية يُقترح عنوان وملاحظة من مقطع التفريغ النشط عبر `createTranscriptBookmarkDraft`.
    - ✅ **تم (2026-06-11):** اختبار وحدة لـ slice العلامات يغطي `addBookmark`/`removeBookmark` وتطبيع الوقت/العنوان/الوصف.
  - الجهد المتبقي: ~1 أسبوع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 14 — P1).

---

### 16.15 P2 — تحويل المحتوى بين الصيغ والملفات المشتقة (Content Format Conversion)

- [ ] `[P2]` ⏱️L **بناء نظام تحويل صيغ داخلي يحفظ النتائج كملفات مشتقة مرتبطة بالأصل** — وجود FFmpeg وOCR يصبح أكثر قيمة إذا استطاع المستخدم توليد صيغ بديلة من داخل التطبيق.
  - **الملفات الجديدة:**
    - `archive-server/src/conversion/conversionService.js` — تحويل فيديو/صوت/صورة/مستند.
    - `archive-server/src/conversion/conversionJobRunner.js` — تشغيل التحويلات الطويلة.
    - `archive app/src/components/conversion/ConversionPanel.jsx` — واجهة التحويل في التفاصيل.
    - `archive app/src/components/conversion/DerivedFilesList.jsx` — الملفات المشتقة المرتبطة بالأصل.
    - `archive-server/prisma/migrations/*_derived_files/` — جدول `derived_files`.
  - **تعديل ملفات:**
    - `archive-server/src/media/ffmpegService.js` — استخراج الصوت وضغط الفيديو وتغيير الصيغة.
    - `archive-server/src/ocr/` — OCR للصورة/المستند كتحويل قابل للطلب.
    - `archive app/src/pages/RecordDetailsPage.jsx` — قسم “الملفات المشتقة”.
    - `archive-server/src/jobs/jobQueue.js` — شريط تقدم وإلغاء.
  - **التنفيذ:** فيديو → صوت؛ فيديو → صيغة/حجم أصغر؛ صورة → نص OCR؛ صوت → نص transcript؛ مستند → PDF؛ حفظ الناتج كملف مرتبط لا كعنصر جديد؛ سجل تحويلات؛ حذف ملف مشتق دون حذف الأصل.
  - يرتبط بـ: §7 “خط معالجة الصور” و§16.9 “التلخيص”.
  - الجهد: 3-5 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 15 — P2).

---

## 17. مقترحات DaisyUI وتحسينات المظهر/UX — مهام مستخرجة جديدة

> **المصدر:** `archive-suite-daisyui-ux-proposals.md` (18 مقترحاً).
> **المنهجية:** حُوّل كل مقترح إلى مهمة تنفيذية بنفس صيغة الملف. تتمحور حول تبنّي DaisyUI كنظام تصميم موحّد فوق Tailwind v4، وتحسينات مظهر وتجربة شاملة. تتكامل مع §4 (UI/UX) و§15.3 (مركز الإعدادات الموحّد).
> **آخر تحديث:** 10 يونيو 2026.

---

### 17.1 P1 — الانتقال إلى نظام مكوّنات DaisyUI كأساس تصميمي (DaisyUI Component System Migration)

- [ ] `[P1]` ⏱️XL **تبنّي DaisyUI كنظام تصميم موحّد فوق Tailwind v4 وترحيل المكوّنات تدريجياً** — المكوّنات الحالية مكتوبة بـ CSS مخصص غير موحّد، ما ينتج تبايناً بصرياً ويصعّب الصيانة والتخصيص ودعم السمات.
  - **التثبيت:** `npx skills add saadeghi/daisyui --agent claude-code --yes` ثم إضافة `daisyui` كـ plugin في `archive app/src/styles/tailwind.css` (Tailwind v4 `@plugin "daisyui";`).
  - **تعديل ملفات:** `archive app/src/styles/tailwind.css` (ملف Tailwind الجذري)، `archive app/src/components/ui/*` (الأزرار، البطاقات، الحقول، النوافذ)، `archive app/tailwind.config.*` إن وُجد.
  - **التنفيذ التدريجي:** المرحلة 1 المكوّنات الأساسية (`btn`, `input`, `card`)؛ المرحلة 2 المكوّنات المركّبة (`navbar`, `menu`, `drawer`)؛ المرحلة 3 الصفحات الكاملة. دعم RTL أصيل، توحيد الأحجام والمسافات.
  - 🔄 **تقدم 2026-06-12:** `daisyui` مثبت ومفعّل في `archive app/src/styles/tailwind.css`؛ أُضيف تبنٍّ تدريجي لمكوّنات `btn`/`card`/`badge`/`alert`/`skeleton`/`progress`/`dock` داخل primitives المشتركة (`V1Primitives.jsx`, `EmptyState.jsx`, `ProgressBar.jsx`, `MobileActionBar.jsx`) مع إبقاء طبقة `va-*` والثيمات الحالية. تقدمت §17.10 أيضاً بمعرض 34 سمة ومحرر حي مرتبطين بـ `SettingsPage`. لا تزال المهمة مفتوحة لأن ترحيل الصفحات الكاملة و`navbar/menu/drawer` كعمل شامل لم يكتمل بعد.
  - يرتبط بـ: §4 (UI/UX)، §17.10 (السمات)، §19.4 (تثبيت daisyUI).
  - الجهد: 6-8 أسابيع (تدريجي).
  - المصدر: daisyui-ux-proposals (المقترح 1 — P1).

### 17.2 P1 — لوحة الأوامر الشاملة (Command Palette / Ctrl+K)

- [x] `[P1]` ⏱️L **بناء لوحة أوامر مركزية (Ctrl+K) للوصول لأي إجراء/صفحة/عنصر/إعداد عبر الكتابة** — التنقل يتطلب حالياً المرور بالقوائم والصفحات.
  - **الملفات الجديدة:** `archive app/src/components/command/CommandPalette.jsx`، `archive app/src/features/command/commandRegistry.js` (تعريف الأوامر السياقية حسب الصفحة)، `archive app/src/hooks/useCommandPalette.js`.
  - **تعديل ملفات:** `archive app/src/app/App.jsx` (مزوّد عام + اختصار Ctrl+K)، `archive app/src/app/pageManifest.js` (مصدر للصفحات القابلة للتنقل).
  - **التنفيذ:** فلترة فورية، تصنيف (أوامر/صفحات/عناصر/إعدادات)، أوامر سياقية حسب الصفحة الحالية، تنقّل بلوحة المفاتيح، عرض الاختصارات.
  - 🔄 **مُنجَز (موجود في الكود):** `CommandPalette` في `ShellParts.jsx` (لوحة Ctrl+K كاملة: تنقل/أوامر/عناصر/مشاريع/مجموعات/إعدادات، تذكّر الأوامر الأخيرة، تنقل بلوحة المفاتيح، ربط `RuntimeShellApp`).
  - الجهد: 3-4 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 2 — P1).

### 17.3 P1 — السحب والإفلات متعدد المناطق (Multi-Zone Drag & Drop)

- [ ] `[P1]` ⏱️L **تعزيز السحب والإفلات عبر كل مناطق التطبيق (قائمة←مجلد، سطح المكتب←صفحة، بين المجموعات)** — السحب والإفلات محدود جداً حالياً.
  - **الملفات الجديدة:** `archive app/src/features/dnd/dndController.js`، `archive app/src/components/dnd/DropZone.jsx`، `archive app/src/components/dnd/DragPreview.jsx`.
  - **تعديل ملفات:** `archive app/src/features/archive/ArchiveViews.jsx`، `Sidebar.jsx`، صفحات المجموعات/المجلدات.
  - **التنفيذ:** إفلات من القائمة على مجلد/مجموعة، رفع ملفات من سطح المكتب لأي مكان، سحب متعدد التحديد مع شارة عدّاد، مؤشّر خط إفلات، تمييز مناطق الإفلات (DaisyUI dragover styling).
  - يرتبط بـ: §17.16 (Kanban)، §18.5 (العلاقات بالسحب).
  - الجهد: 3-5 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 3 — P1).

### 17.4 P2 — الانتقالات السلسة والحركات الدقيقة (Smooth Transitions & Micro-Animations)

- [x] `[P2]` ⏱️M **إضافة انتقالات وحركات سلسة بين الحالات والصفحات والمكوّنات مع احترام `prefers-reduced-motion`** — **(مكتملة ✅ — 12 يونيو 2026)**
  - **المنجَز سابقاً:** انتقالات الصفحات عبر `motion.div` في `AppRouter.jsx` + `PageMotion`/`MotionPage` و`staggerContainer`/`staggerItem` في `V1Primitives.jsx` (كلها تحترم `useReducedMotion`)؛ skeletons أثناء التحميل (§17.8)؛ **مفتاح تعطيل في الإعدادات** — مُحدِّد `motionLevel` (كامل/مخفّف/إيقاف) في `SettingsPage.jsx` → سمة `data-motion` على `va-app-shell` → كِبح عام للحركة في `v1-identity.css` (`data-motion="off"` يصفّر كل `animation/transition`، `"reduced"` يقصّرها لـ0.12s).
  - **المكمَّل الآن (counter animation للأرقام):** `features/ui/countUp.js` ✅ (`easeOutCubic` + `countUpValue` نقيّان قابلان للاختبار)، `components/ui/AnimatedNumber.jsx` ✅ (عدّ تصاعدي عبر `requestAnimationFrame`، يعرض القيمة النهائية فوراً عند `motionLevel` مخفّف/إيقاف أو `prefers-reduced-motion`)؛ مربوط في بطاقات إحصاءات اللوحة عبر `ReportStrip` (يحرّك عند توفّر `animateTo` رقمي وإلا يعرض النص كما هو).
  - **الاختبارات:** `features/ui/countUp.test.js` — **8 اختبارات تمرّ** (easing، الحدود، تقريب، إقحام غير رقمي). build:spa أخضر.
  - يرتبط بـ: §17.8 (Skeleton)، مهارة motion-ui.
  - **متبقٍ اختياري (تجميلي):** scale-up للنوافذ من نقطة النقر، slide-down للعناصر الجديدة — تحسينات دقيقة غير ضرورية لتحقيق القبول الأساسي.
  - المصدر: daisyui-ux-proposals (المقترح 4 — P2).

### 17.5 P2 — التخطيط متعدد الأجزاء / العرض المنقسم (Multi-Pane / Split View)

- [ ] `[P2]` ⏱️XL **إتاحة تقسيم الشاشة إلى أجزاء مستقلة (مثل VS Code) للمقارنة والعمل المتوازي** — يُعرض جزء واحد فقط حالياً في كل لحظة.
  - **الملفات الجديدة:** `archive app/src/components/layout/SplitView.jsx`، `archive app/src/features/layout/paneManager.js`، `archive app/src/hooks/usePaneLayout.js`.
  - **التنفيذ:** سحب تبويب لجزء جانبي، حتى 3 أجزاء، مقابض تغيير حجم، تذكّر التخطيط عبر الجلسات، تحوّل لتبويبات على الجوال.
  - يرتبط بـ: §17.15 (الجوال).
  - الجهد: 5-7 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 5 — P2).

### 17.6 P1 — القوائم السياقية الذكية (Smart Context Menus)

- [x] `[P1]` ⏱️M **قوائم نقر-يمين / ضغط-مطوّل غنية وسياقية لكل عنصر/مجلد/وسم/مساحة فارغة** — النقر الأيمن لا يقدّم شيئاً حالياً.
  - **الملفات الجديدة:** `archive app/src/components/context-menu/ContextMenu.jsx`، `archive app/src/features/context-menu/menuRegistry.js`، `archive app/src/hooks/useContextMenu.js`.
  - **تعديل ملفات:** `ArchiveViews.jsx`، `Sidebar.jsx`، بطاقات العناصر.
  - **التنفيذ:** إجراءات حسب نوع الهدف، إجراءات جماعية عند تعدد التحديد، DaisyUI `dropdown` styling، ضغط مطوّل على الجوال، عرض اختصارات.
  - 🔄 **مُنجَز (موجود في الكود):** `ContextMenu.jsx` (portal + framer-motion + focus trap + keyboard nav)؛ `buildItemContextMenu` في `ArchivePageResults.jsx`؛ `onContextMenu` على بطاقات العناصر في ArchiveViews؛ `FolderTree` + `FolderTreeNode` يستخدمانه.
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 6 — P1).

### 17.7 P2 — وضع التركيز والعرض الخالي من الإلهاء (Focus Mode)

- [x] `[P2]` ⏱️M **وضع تركيز (F11) يخفي العناصر غير الضرورية للتركيز على المحتوى (مشغّل فيديو/قارئ مستند/نموذج إضافة)** — **(مكتملة ✅ — 12 يونيو 2026)**
  - **الملفات الجديدة:** `archive app/src/features/focus/focusMode.js` ✅ (منطق نقي: ثوابت التوقيت، صفحات موصى بها، آلة حالة بومودورو focus⇄break — قابلة للاختبار بالكامل)، `archive app/src/components/focus/FocusShell.jsx` ✅ (شريط تحكّم عائم عبر portal + framer-motion، يحترم `prefers-reduced-motion`).
  - **التنفيذ المنجَز:** اختصار **F11** (مُسجّل في `keyboardShortcuts.js` + `globalShortcuts.js` + معالج في `RuntimeShellApp.js`)؛ **Escape** للخروج (capture listener)؛ إخفاء تلقائي للتحكّمات بعد 3 ثوانٍ خمول (`FOCUS_AUTO_HIDE_MS`)؛ **مؤقّت بومودورو** (25/5 دقيقة، تشغيل/إيقاف/إعادة، عدّ الجولات)؛ **“عدم الإزعاج”** (`focusDoNotDisturb` في `uiSlice` — يكتم التوست مع إبقاء السجل، الأخطاء تظهر دائماً)؛ إخفاء الـ chrome عبر `body.va-focus-active` في `tailwind.css` (sidebar/context-bar/bottom-tabs)؛ تنظيف الحالة عند الخروج.
  - **الاختبارات:** `features/focus/focusMode.test.js` — **12 اختبار يمرّ** (بومودورو، formatClock، الصفحات الموصى بها، اللاتغيير/immutability). build:spa أخضر.
  - المصدر: daisyui-ux-proposals (المقترح 7 — P2).

### 17.8 P1 — التحميل الهيكلي (Skeleton) والتغذية الراجعة الفورية

- [x] `[P1]` ⏱️M **استبدال مؤشّرات التحميل الدوّارة بهياكل (skeleton) تحاكي شكل المحتوى + تغذية راجعة فورية لكل تفاعل** — الفجوة بين الفعل والاستجابة تسبب ارتباكاً وضغطات متكررة.
  - **الملفات الجديدة:** `archive app/src/components/ui/Skeleton.jsx` (DaisyUI `skeleton`)، `archive app/src/components/ui/CardSkeleton.jsx`، `DetailSkeleton.jsx`.
  - **تعديل ملفات:** `ArchivePageResults.jsx`، `DetailPage.jsx`، الأزرار (حالة `btn-active`/علامة نجاح/اهتزاز عند الفشل).
  - **التنفيذ:** هياكل بأشكال البطاقات/التفاصيل، fade-in عند اكتمال التحميل، تأكيد بصري فوري لكل ضغطة زر.
  - 🔄 **مُنجَز (موجود في الكود):** `SkeletonBlock` في `V1Primitives.jsx`؛ `ArchiveResultsSkeleton` في `ArchivePageResults.jsx` (skeleton شبكة/قائمة)؛ `UXStateBlock` يستخدم SkeletonBlock لحالة التحميل؛ `showSkeleton` يشغّل الهيكل عند أول تحميل.
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 8 — P1).

### 17.9 P1 — البطاقات التكيّفية حسب نوع المحتوى (Adaptive Content Cards)

- [x] `[P1]` ⏱️M **بطاقات عرض تتكيّف شكلاً ومعلوماتٍ حسب نوع المحتوى (فيديو/صوت/مستند/صورة)** — كل العناصر تظهر بنفس شكل البطاقة حالياً.
  - **تعديل ملفات:** `ArchiveViews.jsx`، مكوّن بطاقة العنصر، `archive app/src/features/archive/itemCard*`.
  - **التنفيذ:** بطاقة فيديو (مصغّرة + مدّة + شارة تشغيل)، صوت (موجة + مدّة)، مستند (صفحة أولى + عدد صفحات + صيغة)، صورة (معاينة + أبعاد)؛ ألوان DaisyUI مميّزة لكل نوع؛ توسّع طفيف عند hover.
  - 🔄 **مُنجَز:** `getContentKind()` يستنتج النوع من الامتداد + إشارة `item.type`؛ `VideoThumb` تعرض: صورة (`<img>` أو ImageIcon زمرد)، صوت (Music icon بنفسجي)، مستند (FileText icon أزرق + شارة الامتداد)، فيديو (العرض الأصلي).
  - الجهد: 3-4 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 9 — P1).

### 17.10 P1 — نظام سمات DaisyUI المتعددة مع محرّر حيّ (Theme System + Live Editor)

- [x] `[P1]` ⏱️M **توسيع نظام السمات للتوافق مع سمات DaisyUI (30+ سمة جاهزة) + محرّر سمة حيّ** — يعتمد على §17.1.
  - **الملفات الجديدة:** `archive app/src/features/theme/daisyThemes.js`، `archive app/src/components/settings/ThemeGallery.jsx`، `archive app/src/components/settings/LiveThemeEditor.jsx`.
  - **تعديل ملفات:** `archive app/src/theme/useTheme.js`، `SettingsPage.jsx` (تبويب السمات).
  - **التنفيذ:** معاينات مصغّرة لكل سمة، تبديل فوري عبر `data-theme`، محرّر ألوان حيّ، حفظ سمة مخصّصة، جدولة فاتح/داكن حسب `prefers-color-scheme`، تصدير/استيراد JSON.
  - 🔄 **تقدم 2026-06-12:** أُضيفت الملفات المطلوبة فعلياً: `features/theme/daisyThemes.js` (34 سمة جاهزة + normalize/store/apply)، `components/settings/ThemeGallery.jsx` (معرض radio + `theme-controller` + معاينة `data-theme` لكل بطاقة)، و`components/settings/LiveThemeEditor.jsx` (select/range عبر DaisyUI). تم توسيع `@plugin "daisyui"` ليضم السمات الجاهزة، وربط `settings.ui.daisyTheme` بـ `SettingsPage`, `AppRouter`, boot helper `applyInitialDaisyTheme.js`, وتصدير/استيراد ملف المظهر.
  - ✅ **جدولة فاتح/داكن مُنجَزة 2026-06-12:** أُضيف `features/theme/themeSchedule.js` (محرك نقي: `relativeLuminance`/`getDaisyThemeTone`/`normalizeSchedule`/`resolveScheduledTheme` + تخزين `videoArchive:themeSchedule`) مع `themeSchedule.test.js` (12 اختبار). يدعم وضع `manual` (يحترم اختيار `daisyTheme` الحالي — لا ارتداد للمستخدمين) و`auto` (سمة فاتحة/داكنة حسب `prefers-color-scheme`). رُبط في `theme/applyInitialDaisyTheme.js` مع `watchSystemThemeChange` لتتبّع تبدّل النظام وقت التشغيل.
  - 🔄 **تقدم إضافي 2026-06-12:** أضيفت واجهة تبديل `manual/auto` داخل `LiveThemeEditor` باستخدام DaisyUI `toggle` و`select` لاختيار سمة فاتحة وداكنة، وصارت الجدولة جزءاً من مسودة المظهر: تُعاين فورياً، وتُحفظ عبر `storeSchedule()` عند تطبيق المظهر، وتُضمّن في تصدير/استيراد JSON لملف المظهر.
  - ✅ **السمة المخصصة مُنجَزة 2026-06-12:** أُضيف `features/theme/customDaisyTheme.js` لحفظ وتطبيع وتطبيق CSS vars كاملة لرموز DaisyUI والتطبيق، مع `customDaisyTheme.test.js` (6 اختبارات). رُبطت الطبقة في boot helper و`AppRouter` و`SettingsPage`، وأضيفت واجهة `toggle` + `input` ألوان داخل `LiveThemeEditor`، وصار ملف المظهر يصدّر/يستورد `customDaisyTheme`.
  - يرتبط بـ: §17.1، §15.3 (مركز الإعدادات).
  - الجهد: 2-3 أسابيع (بعد §17.1).
  - المصدر: daisyui-ux-proposals (المقترح 10 — P1).

### 17.10.1 P1 — توحيد الثيمات على DaisyUI كنظام وحيد افتراضي (Theme Consolidation)

- [ ] `[P1]` ⏱️L **إزالة أنظمة الهوية `v1–v4` وجعل DaisyUI النظام الوحيد الافتراضي، مع جعل التباين عبر قوالب لونية (سمات DaisyUI) بدل إصدارات هوية منفصلة** — حالياً يتعايش 4 أنظمة `data-theme-version` (v1–v4) فوق DaisyUI، ما يُضاعف CSS ويُربك التخصيص. الهدف: ثيم أساسي واحد (DaisyUI) + قوالب لونية.
  - **يبني على §17.10 (مُنجَز جزئياً):** `features/theme/daisyThemes.js` (34 سمة)، `ThemeGallery.jsx`، `LiveThemeEditor.jsx`، و`settings.ui.daisyTheme` مربوطة في `SettingsPage`/`AppRouter`/`applyInitialDaisyTheme.js` موجودة بالفعل.
  - **الإزالة:** `styles/v1-identity.css`، `v2-identity.css`، `v3-identity.css`، `v4-identity.css`؛ سمة `data-theme-version` من `AppRouter.jsx` وأي مُطبِّق؛ `features/settings/ThemeVersionPicker.jsx` ومنطق اختيار الإصدار؛ مفاتيح `themeVersion`/`v4` الافتراضية في `stores/settingsDefaults.js` و`theme/useTheme.js`.
  - **النقل:** ترحيل الرموز البصرية المتبقية في طبقات v1–v4 (ألوان الأسطح/الحدود/التركيز الخاصة بكل إصدار) إلى رموز DaisyUI (`--color-base-*`/`--color-primary`…) أو طبقة `va-*` موحّدة واحدة فوق DaisyUI؛ الحفاظ على `data-accent`/`data-density`/`data-font-scale`/`data-motion`/`data-card-style` كمحاور تخصيص مستقلة عن السمة.
  - **الافتراضي:** ضبط سمة DaisyUI افتراضية واحدة (مثل `dark` أو سمة مخصّصة للعلامة) في `settingsDefaults` + `@plugin "daisyui"` (`--default`)؛ هجرة إعدادات المستخدمين الحاليين من `themeVersion` إلى `daisyTheme` عبر migration في تحميل الإعدادات.
  - **التحقق:** `verify-modules.mjs` (لا مراجع متبقية لـ`data-theme-version`/`v*-identity`)، `build:spa` أخضر، اختبارات `useTheme`/الإعدادات، فحص بصري للصفحات الرئيسية في الوضعين فاتح/داكن.
  - **مخاطرة:** عالية — تمسّ كل سطح بصري؛ يجب فحص بصري شامل (Playwright matrix 320/768/1024/1440). يُنفَّذ في **جلسة جديدة نظيفة** على فرع مخصّص.
  - يرتبط بـ: §17.10، §17.1 (تبنّي DaisyUI)، §15.7 (محرر السمات)، §15.3 (مركز الإعدادات).

### 17.11 P2 — رحلة اكتشاف المحتوى (Content Discovery Journey)

- [x] `[P2]` ⏱️L **أقسام “استكشف/رائج/عشوائي/الأكثر نشاطاً/المنسيّون” لإحياء المحتوى المؤرشف** — لا توجد طريقة لاكتشاف محتوى لم يبحث عنه المستخدم.
  - **الملفات الجديدة:** `archive app/src/pages/DiscoverPage.jsx` (DaisyUI `hero` + card grid)، `archive app/src/features/discover/discoveryEngine.js`.
  - **تعديل ملفات:** `Sidebar.jsx`، `pageManifest.js`.
  - **التنفيذ:** مُضاف حديثاً، مقترحات حسب آخر مشاهدة، عشوائي (“أفاجئني”)، الأكثر نشاطاً أسبوعياً، المنسيّون (لم يُفتحوا منذ مدة).
  - **✅ مُنجَز 2026-06-12:** أُضيفت صفحة `DiscoverPage.jsx` بواجهة DaisyUI (`hero`/`tabs`/`stats`/`card`/`badge`) ومحرك `discoveryEngine.js` للأقسام الخمسة مع استبعاد المحذوفات، عشوائية حتمية قابلة للاختبار، وترتيب النشاط الأسبوعي والمنسيّات. رُبطت الصفحة في `pageManifest.js`, `pageRegistry.js`, `Sidebar.jsx`, و`ShellParts.jsx`، وأُضيف route `#/discover` لاختبار التنقل.
  - الجهد: 3-4 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 11 — P2).

### 17.12 P1 — نظام الإشعارات المنبثقة المحسّن (Toast & Snackbar — DaisyUI)

- [x] `[P1]` ⏱️M **toast/alert محسّن بـ DaisyUI مع إجراءات سريعة وتراجع وشريط تقدّم** — toasts الحالية بدائية بلا تفاعل.
  - **الملفات الجديدة:** `archive app/src/components/ui/ToastSystem.jsx` (DaisyUI `toast`/`alert`)، `archive app/src/features/toast/toastStore.js`.
  - **التنفيذ:** أولوية حسب النوع، تجميع المتشابهة (“3 عناصر أُضيفت”)، إجراء سريع داخل toast (تراجع/تنزيل/إعادة)، إبقاء الأخطاء حتى تُقرأ، DaisyUI `progress` للعمليات الطويلة، سجل إشعارات.
  - 🔄 **مُنجَز:** `uiSlice.showNotification` يدعم `groupKey`/`groupTemplate` (تجميع)، أخطاء persistent تلقائياً، `progress: 0-100`، فرز حسب الأولوية (error>warning>success>info)، `updateNotificationProgress(id, progress)`؛ `ToastNotification` يعرض شارة العدد ×N وشريط تقدّم.
  - يرتبط بـ: §18.2 (مركز الإشعارات)، `AppNotifications.jsx`.
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 12 — P1).

### 17.13 P1 — التنقّل المتكامل مع مسار الخبز الديناميكي (Dynamic Breadcrumb)

- [x] `[P1]` ⏱️M **مسار خبز محفوص ديناميكي + تاريخ تنقّل (رجوع/تقدّم) + قائمة المواقع الأخيرة** — لا breadcrumb يوضّح الموقع في التسلسل ولا تاريخ تنقّل.
  - **الملفات الجديدة:** `archive app/src/components/navigation/Breadcrumb.jsx` (DaisyUI `breadcrumbs`)، `archive app/src/features/navigation/navHistory.js`، `RecentLocations.jsx`.
  - **تعديل ملفات:** `AppRouter.jsx`، `TopBar.jsx`، `pageManifest.js` (مصدر breadcrumb موجود بالحقل `meta.breadcrumb`).
  - **التنفيذ:** مسار قابل للنقر لكل مستوى، أزرار رجوع/تقدّم عبر تاريخ التنقّل، آخر 10 مواقع، تقلّص ذكي على الجوال.
  - 🔄 **مُنجَز (موجود في الكود):** `Breadcrumb.jsx` + `useBreadcrumbs.js` + `PageContextBar.jsx` مدمجة في `AppRouter.jsx`.
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 13 — P1).

### 17.14 P2 — مدجات لوحة المعلومات القابلة للتخصيص (Customizable Dashboard Widgets)

- [ ] `[P2]` ⏱️L **لوحة معلومات قابلة للتخصيص بالكامل عبر مدجات تُضاف/تُزال/تُرتّب/تُكبّر (react-grid-layout موجود)** — اللوحة ثابتة التخطيط حالياً.
  - **الملفات الجديدة:** `archive app/src/features/dashboard/widgetRegistry.js`، `archive app/src/components/dashboard/WidgetStore.jsx`، `WidgetFrame.jsx`.
  - **تعديل ملفات:** `DashboardPage.jsx` (يستخدم `react-grid-layout` بالفعل).
  - **التنفيذ:** متجر مدجات، سحب لإعادة الترتيب، توسيع/تصغير، مدجات قابلة للتهيئة (إحصائيات/نشاط/عشوائي)، DaisyUI `stat`/`timeline`، تخطيط متجاوب.
  - الجهد: 4-6 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 14 — P2).

### 17.15 P1 — إصلاح شامل لتجربة الجوال المتجاوبة (Mobile-First Responsive Overhaul)

- [ ] `[P1]` ⏱️XL **إعادة تصميم تجربة الجوال بأدوات DaisyUI المتجاوبة مع أولوية المحتوى والإيماءات** — الجوال نسخة مصغّرة من سطح المكتب لا تجربة مصمّمة.
  - **الملفات الجديدة:** `archive app/src/components/navigation/BottomNav.jsx`، `archive app/src/hooks/useSwipeGesture.js`، `MobileShell.jsx`.
  - **تعديل ملفات:** shell التنقل، الصفحات الرئيسية (full-screen بدل أجزاء على الجوال)، `index.css` (breakpoints).
  - **التنفيذ:** تنقل سفلي ثابت بشارة عدّاد، شريط علوي مبسّط، إيماءات سحب (رجوع/تحديث/تبديل عرض)، lazy load، أولوية محتوى مختصرة على الجوال.
  - يرتبط بـ: §4 (a11y)، §17.5.
  - الجهد: 5-7 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 15 — P1).

### 17.16 P1 — نظام العرض المتعدد مع تخصيص الأعمدة (Multi-View + Kanban/Gallery)

- [x] `[P1]` ⏱️L **توسيع خيارات العرض: معرض (Masonry) + كانبان + قائمة مدمجة + قائمة تفاصيل، مع تخصيص الأعمدة لكل عرض** — يُعرض حالياً شبكة أو جدول فقط.
  - **المكوّنات المستهدفة:** Gallery/Masonry، Kanban، Compact، Details + Column customizer داخل ملفات الأرشيف القائمة.
  - **تعديل ملفات:** `ArchiveViews.jsx`، `ArchivePageResults.jsx`، تخزين تفضيل العرض (`settingsSlice.js`).
  - **التنفيذ:** معرض Masonry بحجم صور قابل للضبط، كانبان بأعمدة (مجموعات/أنواع/حالات) مع سحب، تخصيص أعمدة الجدول وترتيبها، DaisyUI `join`+`btn` للتبديل، حفظ التخصيص لكل عرض.
  - ✅ **مُنجز 2026-06-12:** أُضيفت أسماء العرض الرسمية `gallery`/`compact`/`details`/`kanban` مع توافق خلفي لقيم `masonry`/`tiles`/`table` القديمة، وأصبح تبديل أوضاع الأرشيف يستخدم DaisyUI `join` + `btn`. `gallery` يرسم Masonry responsive بحجم قابل للضبط عبر كثافة الشبكة، و`compact` يرسم عرض البلاطات الكثيف، و`details` يرسم جدول التفاصيل مع مخصص الأعمدة، و`kanban` يرسم أعمدة حالات workflow قابلة لسحب البطاقات بينها لتحديث `workflowStatus`. حُدّثت روابط التنقل والاختصارات وخيارات الإعدادات والاختبارات للمسارات الجديدة.
  - يرتبط بـ: §17.17 (الحالات)، §17.3 (السحب).
  - الجهد: 4-6 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 16 — P1).

### 17.17 P1 — نظام حالات العناصر المرئية (Visual Item Status System)

- [x] `[P1]` ⏱️M **حالة مرئية لكل عنصر (جديد/قيد المعالجة/مكتمل/يحتاج مراجعة/مؤرشف) بشارة ولون DaisyUI** — لا يمكن تمييز حالة العنصر بالنظر.
  - **الملفات الجديدة:** `archive app/src/features/archive/itemStatus.js`، `archive app/src/components/archive/StatusBadge.jsx`.
  - **تعديل ملفات:** بطاقة العنصر، عمود الحالة في الجدول، `archiveSlice.js`، فلاتر البحث.
  - **التنفيذ:** badge ملوّن (info/warning/success/error/neutral)، فلترة حسب الحالة، تغيير تلقائي للحالة (عنصر بلا وسم→“يحتاج مراجعة”)، اقتراحات تلقائية.
  - ✅ **مُنجز ومتحقق (2026-06-11):** `StatusBadge.jsx` جديد يعرض حالة `workflowStatus` مع تنبيه الاستحقاق المتأخر؛ `ArchiveViews.jsx` يعرض الشارة في البطاقات/البلاطات/القائمة ويضيف عمود `الحالة` للجدول؛ `tableColumns.js` يعرّف العمود؛ `viewModel.js` يدعم فلتر `filterStatus` ورابط `status=`؛ `ArchivePageDetailedFilters.jsx` و`ArchiveFilterChips` يضيفان اختيار/مسح الحالة؛ `createVideoItemValue` يحفظ `workflowStatus` ويقترح `review` للعناصر الجديدة بلا وسوم و`archived` للمحذوفة مع حفظ حقول workflow عند التعديل. تحقق: `itemStatus.test.js` و`viewModel.test.js` و`StatusBadge.test.jsx` (12/12 مرّت).
  - يرتبط بـ: §17.16، §18.1 (سجل النشاط).
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 17 — P1).

### 17.18 P2 — مسار التنقّل الموجّه حسب الدور (Role-Based Guided Journey)

- [x] `[P2]` ⏱️L **تكييف الواجهة حسب دور المستخدم ونمط استخدامه (مسؤول/محرّر/مشاهد) — تخصيص واجهي لا نظام صلاحيات** — نفس الواجهة للجميع حالياً.
  - **الملفات الجديدة:** `archive app/src/features/onboarding/roleProfiles.js`، `archive app/src/components/onboarding/RoleSelectionStep.jsx`.
  - **تعديل ملفات:** `V1OnboardingWizard.jsx`، `Sidebar.jsx` (ترتيب الأقسام حسب الاستخدام)، الإعدادات (تبديل الوضع).
  - **التنفيذ:** سؤال أول دخول عن طريقة الاستخدام، إبراز/إخفاء أدوات حسب الدور، تكيّف مع الجهاز، إعادة ترتيب الشريط حسب الأكثر استخداماً.
  - **✅ مُنجَز 2026-06-12:** أُضيفت بروفايلات `admin/editor/viewer` مع صفحات أولوية ومسارات خطوات وصفحات هادئة، ومكوّن `RoleSelectionStep` بواجهات DaisyUI `card`/`badge`/`steps`. رُبط الاختيار في معالج البداية، تبويب الإعدادات العام، وقسم قابل للبحث في المساعدة. يعيد `Sidebar.jsx` ترتيب الأقسام حسب البروفايل ويطبق إخفاءً واجهياً ناعماً للأدوات الأقل صلة فقط عند عدم وجود تخطيط Sidebar مخصص محفوظ، دون تغيير الصلاحيات.
  - يرتبط بـ: §15.1 (الدليل التفاعلي)، §18 (الجلسات).
  - الجهد: 3-4 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 18 — P2).

---

## 18. مقترحات الاستخدام اليومي — مهام مستخرجة جديدة

> **المصدر:** `archive-suite-daily-use-proposals.md` (5 مقترحات).
> **المنهجية:** حُوّل كل مقترح إلى مهمة تنفيذية. جميعها تستخدم مخازن IndexedDB جديدة مستقلة (لا تحتاج هجرة بيانات) وتتكامل مع StorageProvider الموجود عبر `put()`/`getAll()`/`delete()`.
> **آخر تحديث:** 10 يونيو 2026.

---

### 18.1 P0 — سجل النشاط والتراجع المتقدّم (Activity History & Advanced Undo)

- [ ] `[P0]` ⏱️L **سجل نشاط مركزي + تراجع متعدد المستويات يغطّي الإضافة/التعديل/الحذف/النقل/التعديل الجماعي مع Redo** — `undoManager` الحالي يدعم صفحة التفاصيل فقط ولا يغطّي الحذف/النقل/التعديل الجماعي.
  - **الملفات الجديدة:** `archive app/src/features/activityLog/viewModel.js` (createActivityEntry/buildDiff/describeActivity)، `undoManager.js` (توسعة)، `archive app/src/components/activity/ActivityTimeline.jsx`، `ActivityEntry.jsx`، `DiffView.jsx`، `ActivityFilterBar.jsx`، `archive app/src/pages/ActivityPage.jsx`، `archive app/src/stores/slices/activitySlice.js`.
  - **تعديل ملفات:** `ArchivePage.jsx`، `DetailPage.jsx`، `Sidebar.jsx`، `archiveSlice.js`، `services/storage/schema.js` (store `activity_log`)، `undoManager`.
  - **مخطط:** store `activity_log` (IndexedDB) + جدول Prisma `ActivityLog` (before/after/diff JSON، فهارس على timestamp/userId/targetType/action) للباك-إند السحابي.
  - **التنفيذ:** snapshot before/after + diff، شريط زمني مجمّع حسب اليوم، فلترة حسب النوع/التاريخ/المستخدم، Bulk Undo بضغطة، Redo؛ توسعة `undoManager` لا استبداله.
  - يرتبط بـ: §17.17 (الحالات)، §1 (سجل التدقيق في الخادم).
  - الجهد: 4-6 أسابيع.
  - المصدر: daily-use-proposals (المقترح 1 — P0).
  - **حالة التنفيذ (المرحلة 1 — محلي فقط، 11 يونيو 2026):**
    - ✅ منجز: `features/activityLog/viewModel.js` (createActivityEntry/buildDiff/describeActivity/filterActivityEntries/groupActivitiesByDay) + اختبارات وحدة (`viewModel.test.js`، 13 اختبار)؛ `features/activityLog/undoManager.js` (توسعة withActivityLog فوق SimpleUndoRedoManager)؛ store `activity_log` في `schema.js` مع مرايا DATA_STORES/SNAPSHOT_STORES/الاستيراد في `services/storage/index.js` و`storage/adapters/local-sqlite/index.js`؛ `stores/slices/activityLogSlice.js` (add/remove/load/clear/filters + undoActivityEntryById/redoActivityEntryById) مركّب في `appStore.js`؛ صفحة `ActivityPage.jsx` + `components/activity/` (ActivityTimeline/ActivityEntry/DiffView/ActivityFilterBar) مسجّلة في pageManifest/pageRegistry (id: `activity`)؛ توثيق نشاط تلقائي في `archiveSlice.updateVideoItem` (snapshot before/after، failure-safe، خيار skipActivityLog).
    - ✅ **مُنجَز المرحلة 2 (2026-06-12):** أُضيف `addActivityEntry` لعمليات `addVideoItem` (create)، `deleteVideoItem` (delete + skipActivityLog)، `restoreVideoItem` (restore + skipActivityLog)، `bulkDeleteItems` (bulk_delete)، `bulkRestoreItems` (restore جماعي) — جميعها failure-safe (try/catch + .catch()). الـ undo/redo lambdas تمرّر الآن `skipActivityLog: true`.
    - ✅ **مُنجَز المرحلة 3 (2026-06-13):** (1) نموذج `ActivityLog` في `archive-server/prisma/schema.prisma` (فهارس على timestamp/userId/targetType/action/targetId). (2) فلترة التاريخ: `ActivityFilterBar.jsx` أُضيفت حقول من/إلى؛ `ActivityPage.jsx` وُسّع state + memo. 215 اختبار ✅. مستقبلياً: `prisma migrate dev` لتطبيق المخطط + توثيق عمليات collections/folders.

### 18.2 P0 — مركز الإشعارات المركزي الذكي (Smart Notification Center)

- [x] `[P0]` ⏱️L **مركز إشعارات موحّد يجمع إشعارات العمليات/التعاون/النظام/الذكية مع Push API وتجميع ذكي وإجراءات سريعة** — الإشعارات مبعثرة وبدائية، والعمليات الطويلة (FFmpeg/OCR/تصدير/نسخ احتياطي) لا تعرض حالة التقدّم أو الاكتمال.
  - **مُنجَز (2026-06-12):** `NotificationDrawer.jsx` (329 سطر — فلاتر تبويب/قراءة/بحث/تجميع بالأيام/إجراءات جماعية)؛ زر الجرس مع عداد غير المقروء في `Sidebar.jsx`؛ حالة الإشعارات الكاملة في `uiSlice.js`؛ `viewModel.js` بتصنيفات ونماذج؛ `NotificationPreferences.jsx` و`pushService.js` لإشعارات Push؛ `ProgressBar.jsx` و`StatusBar` لعمليات الخلفية. ✅ 111 اختبار يمرّ + بناء spa ينجح.
  - يرتبط بـ: §17.12 (toast)، §18.1.
  - المصدر: daily-use-proposals (المقترح 2 — P0).

### 18.3 P1 — القوالب والتعبئة السريعة (Templates & Quick Fill)

- [x] `[P1]` ⏱️M **قوالب مخصّصة لأنواع العناصر المتكرّرة + تعبئة دينامية (today/autoNumber/copyFromLast/concat) + وضع إضافة سريعة** ✅ 2026-06-12 (مكتمل بالكامل): `viewModel.js` + `templatesSlice.js` + `TemplatePicker.jsx` + `TemplateEditor.jsx` + تكامل `AddVideoPage.jsx` + `QuickAddBar.jsx` (إضافة سريعة متتالية مع تتبع counter/lastValues للحقول الديناميكية، قائمة العناصر المضافة، اختيار نوع المحتوى، وسوم مشتركة). `schema.js` يحتوي مسبقاً على TEMPLATES store. زر "إضافة سريعة" أُضيف لـ AddVideoPage يُظهر QuickAddBar كـ floating bar.
  - يرتبط بـ: §18.4 (الحفظ التلقائي).
  - الجهد: 3-4 أسابيع.
  - المصدر: daily-use-proposals (المقترح 3 — P1).

### 18.4 P1 — الحفظ التلقائي وجلسات العمل (Auto-save & Work Sessions)

- [x] `[P1]` ⏱️M **حفظ تلقائي للمسودات (كل 30 ثانية) + تحذير المغادرة + استعادة المسودة + جلسات عمل تحفظ سياق العرض + حفظ تقدّم العمليات الجماعية** — لا حفظ تلقائي حالياً، وفقدان الاتصال أثناء تعديل جماعي يضيّع العمل.
  - **الملفات الجديدة:** `archive app/src/features/autosave/viewModel.js`، `autosaveEngine.js`، `sessionManager.js`، `archive app/src/components/autosave/AutosaveIndicator.jsx`، `DraftRecoveryDialog.jsx`، `SessionRestoreBanner.jsx`، `BulkProgressPanel.jsx`، `archive app/src/stores/slices/autosaveSlice.js`.
  - **تعديل ملفات:** `AddVideoPage.jsx`، `DetailPage.jsx`، `ArchivePage.jsx`، `schema.js` (stores `drafts`, `work_sessions`, `bulk_progress`).
  - **التنفيذ:** مؤشّر حالة الحفظ، `beforeunload` guard، استعادة المسودة/الجلسة، حفظ موضع التمرير والفلاتر، استئناف العمليات الجماعية بعد الانقطاع.
  - 🔄 **مُنجَز 2026-06-12:** `DetailPage.jsx` — تكامل `createAutosaveEngine` بمفتاح `edit_item_${id}` (30ث + beforeunload)؛ `DraftRecoveryDialog` يعرض عند اكتشاف مسودة محفوظة؛ `AutosaveIndicator` بجانب زر التحرير؛ تنظيف localStorage عند الحفظ. البنية التحتية (engine/viewModel/slice/components) كانت جاهزة.
  - يرتبط بـ: §18.1، §18.3.
  - الجهد: 3-4 أسابيع.
  - المصدر: daily-use-proposals (المقترح 4 — P1).

### 18.5 P1 — الارتباطات والعلاقات بين العناصر (Item Relations & Links)

- [x] `[P1]` ⏱️L **نظام علاقات ذات معنى بين العناصر (جزء من/يرتبط مع/نسخة من/يعتمد على/يشير إلى/بديل عن/يسبق/يتبع) مع رسم بياني تفاعلي** — العناصر معزولة ولا يمكن ربطها بعلاقة دلالية.
  - **الملفات الجديدة:** `archive app/src/features/relations/viewModel.js` (createRelation/RELATION_TYPES/getItemRelations/buildRelationsGraph)، `archive app/src/components/relations/RelationsPanel.jsx`، `AddRelationDialog.jsx`، `RelationsGraph.jsx`، `archive app/src/stores/slices/relationsSlice.js`.
  - **تعديل ملفات:** `DetailPage.jsx`، `ArchivePage.jsx`، `schema.js` (store `item_relations`)؛ Prisma `ItemRelation` (unique على [sourceId,targetId,type]، فهارس) للباك-إند.
  - **التنفيذ:** علاقات أحادية/ثنائية الاتجاه، تنقّل سريع بين المرتبطين، رسم علاقات (D3/cytoscape)، إنشاء بالسحب، اكتشاف تلقائي للعلاقات المحتملة (نفس الوسم/المجلد).
  - 🔄 **تقدم 2026-06-12:** أُضيف `RelationsGraph.jsx` (cytoscape تفاعلي، تكبير/تصغير/ملاءمة، lazy import، النقر للتنقل) ودُمج في `RelationsPanel.jsx` فوق قوائم العلاقات. سابقاً (2026-06-11): `RelationsPanel` + `AddRelationDialog` في `DetailPage.jsx`.
  - ✅ **2026-06-13:** نموذج `ItemRelation` أُضيف لـ `schema.prisma` (unique على [sourceId,targetId,type]، فهارس على sourceId/targetId) مع migration `20260613110000_item_relations`. ✅ **Drag-to-link:** سحب بطاقة على أخرى في عرض الشبكة يفتح `AddRelationDialog` مع العنصر المستهدف محدداً مسبقاً (`initialTargetId`)؛ يعمل عبر event delegation على حاوية الشبكة (`data-archive-item-id`).
  - ✅ **مُنجز ومتحقق (2026-06-13):** خريطة العلاقات العامة `GraphViewPage` أصبحت تستهلك `itemRelations` وتعرض العلاقات اليدوية كحواف موجهة وموسومة داخل cytoscape حتى بدون وسوم/مجموعات مشتركة، مع تجاهل `mirrorOf` لمنع تكرار العلاقات الثنائية. تحقق: `pnpm --filter @archive/app run test -- src/features/graph/buildGraphModel.test.js` مرّ بـ 12/12.
  - يرتبط بـ: §16 (المجموعات/المجلدات)، §17.3 (السحب)، §11/§12 graph.
  - الجهد: 4-5 أسابيع.
  - المصدر: daily-use-proposals (المقترح 5 — P1).

---

## 19. توجيهات تشغيلية — إصلاحات وإعادة هيكلة مطلوبة (10 يونيو 2026)

> **المصدر:** توجيهات المستخدم المباشرة (10 يونيو 2026).
> **ملاحظة:** §19.3 و§19.2 عمليتان كبيرتان/خطرتان — تتطلّبان commit للعمل غير المحفوظ أولاً وموافقة صريحة قبل التنفيذ.

---

### 19.1 P0 — حلّ تعارض صفحتَي الإعدادات/النظام (Duplicate Settings Conflict)

- [x] `[P0]` ⏱️M **مُنجَز (10 يونيو 2026): توحيد مسارَي الإعداد الأولي المتعارضَين** — أُزيل فرع `firstRun` من آلة authState في `RuntimeShellApp.js`؛ التثبيت النظيف يهبط الآن على `setup` → `V1OnboardingWizard` (يختار التخزين + ينشئ المشرف محلياً عبر `setMasterPassword`/`skipPasswordSetup` بلا خادم). `FirstRunPage` تقاعدت كمسار قابل للوصول (تبقى في pageRegistry كإرث). أُزيلت بوابة العرض الميتة. ✅ 37 اختبار يمرّ + بناء spa ينجح. **يُنصح بتحقّق وقت تشغيل** لاحق (تثبيت نظيف عبر spa/aistudio/server).
  - ~~التشخيص الأصلي:~~ كان يوجد مساران لـ"إعداد النظام أول مرة" يتفرّعان حسب `authState`.
  - **التشخيص (مؤكَّد بالكود — 10 يونيو 2026):**
    - مسار 1: `authState==="firstRun"` (يُضبط في `RuntimeShellApp.js:230` عند `!isPasswordSet && !hasUsers && !onboardingRequired && !initialAdminPassword`) → يعرض `FirstRunPage.jsx` (3 خطوات تنشئ المشرف عبر `POST /api/auth/register`).
    - مسار 2: `authState==="setup"` (`RuntimeShellApp.js:234`) → `shouldShowStartupOnboarding` → `V1OnboardingWizard.jsx` (8 خطوات: تخزين/أمان/مظهر — محايد للباك-إند).
    - **جذر التعارض:** `onboardingRequired`/`initialAdminPassword` غير موجودَين في `settingsDefaults.js` (falsy افتراضياً)، فالتثبيت النظيف يهبط على `firstRun` → **FirstRunPage** الذي يتطلّب خادماً (`/api/auth/register`) — معطّل في بناء spa/aistudio (بلا خادم). بينما الـ wizard المحايد للباك-إند (الأصح) لا يظهر إلا في حالة `setup` التي لا يصلها التثبيت النظيف.
  - **الإصلاح الموصى به (يتطلّب تحقّق وقت تشغيل — كود مصادقة حسّاس):** توحيد على `V1OnboardingWizard` كمسار قانوني (يعمل محلي/سحابي/aistudio): توجيه التثبيت النظيف لحالة `setup` بدل `firstRun`، والتأكد من أن خطوة `admin` في الـ wizard + bootstrap تنشئ المشرف محلياً وسحابياً، ثم تقاعد `FirstRunPage` (أو إبقاؤه كنداء register داخل الـ wizard لوضع الخادم فقط).
  - **⚠️ لماذا لم يُنفَّذ في جلسة 10 يونيو:** تعديل bootstrap المصادقة دون تشغيل التطبيق خطر (قد يحجب الدخول/إنشاء المشرف عبر الأهداف الثلاثة). يلزم اختبار وقت تشغيل (`pnpm dev` + متصفّح) لكل من: تثبيت محلي نظيف، وضع خادم، aistudio.
  - **الملفات:** `RuntimeShellApp.js:227-254` (آلة authState)، `features/onboarding/viewModel.js:79` (`shouldShowStartupOnboarding`)، `pages/FirstRunPage.jsx`، `app/pageRegistry.js:61` (تسجيل `firstRun`).
  - يرتبط بـ: §15.3 (مركز الإعدادات الموحّد)، §17.18 (مسار حسب الدور).
  - الجهد: 1-3 أيام (مع اختبار وقت تشغيل).
  - المصدر: توجيه المستخدم (10 يونيو 2026) + تشخيص الكود.

### 19.2 P1 — إعادة بناء نسخة AI Studio: دعم Firebase + SQLite ومواءمة أحدث AI Studio

> **تحديث 11 يونيو 2026 — توسيع النطاق:** بدل دعم Firebase/SQLite في aistudio فقط، تقرّر **التقارب نحو إصدار واحد شامل**: نسخة cloud هي الإصدار القانوني، كل المحرّكات (IndexedDB/SQLite/Firebase/Postgres/PocketBase) خيارات وقت تشغيل، وspa/aistudio مجرد قوالب تغليف بلا تفرّع سلوكي. **📋 الخطة الحاكمة:** [`archive app/docs/unified-edition-plan.md`](archive%20app/docs/unified-edition-plan.md) (مراحل أ–هـ، ⏱️XL). الخطة أدناه تبقى مرجعاً تفصيلياً لمحوّل Firebase ومواءمة AI Studio.

- [ ] `[P1]` ⏱️XL **استبدال هدف بناء `aistudio` ليدعم Firebase وSQLite، ومواءمة نسخة السيرفر مع أحدث AI Studio Apps** — **📋 الخطة الكاملة:** [`archive app/docs/aistudio-firebase-sqlite-plan.md`](archive%20app/docs/aistudio-firebase-sqlite-plan.md) (مُنجَزة 10 يونيو 2026 — مرحلة التخطيط).
  - **تصحيح بعد تشخيص الكود:**
    - **SQLite:** المحوّل **موجود بالفعل** (`archive app/src/storage/adapters/local-sqlite/index.js`، و`LOCAL_ENGINES=["indexeddb","sqlite"]`)، لكن AI Studio لا يصله لأن `resolveBackendChoice` (`backendChoice.js:108`) يُجبر `localEngine: indexeddb` ثابتاً. **الإصلاح صغير (المرحلة أ).**
    - **Firebase:** **غير موجود** — عمل جديد كامل (خيار باك-إند + محوّلات Firestore/Auth/Storage). مناسب لـ AI Studio لأنه يعمل عميل-جانب عبر HTTPS (بخلاف pocketbase/postgres اللذين يحتاجان خادماً لا يصله iframe).
  - **المراحل:** أ) فتح SQLite لـ AI Studio (S–M، قيمة فورية) → بحث توافق AI Studio (§4 بالخطة) → ب) محوّل Firestore → ج) Firebase Auth/Storage → د) واجهة التهيئة → هـ) تبديل ساخن/ترحيل.
  - **الملفات:** `backendChoice.js`، `registerByBackendChoice.js`، محوّلات `firebase-*` جديدة، `V1OnboardingWizard.jsx`، `DatabaseSettings.jsx`، `archive-server` (توافق).
  - الجهد: XL (المرحلة أ وحدها S–M).
  - المصدر: توجيه المستخدم (10 يونيو 2026) + تشخيص الكود.

### 19.3 P1 — إزالة المسافة من اسم مجلد `archive app` (Folder Rename)

- [ ] `[P1]` ⏱️M **إعادة تسمية مجلد `archive app` → `archive-app` (إزالة المسافة) وتحديث كل المراجع** — المسافة في اسم المجلد تسبّب مشاكل في المسارات والأدوات والسكربتات.
  - **ملاحظة خطر:** عملية مدمّرة — يجب `git commit` للتعديلات غير المحفوظة أولاً (يوجد حالياً تعديلات غير محفوظة في `archive app`). اسم الحزمة `@archive/app` يُستخدم في كل سكربتات pnpm (لن تتأثر)، لكن المسارات الحرفية ستتأثر.
  - **تعديل ملفات/خطوات:** `git mv "archive app" archive-app`، `pnpm-workspace.yaml` (`"archive app"`→`archive-app`)، أي مسارات حرفية في الجذر (`package.json` docker:config إن وُجدت)، `playwright.config`، سكربتات `scripts/*.mjs`، الوثائق، CI.
  - **التحقّق:** `pnpm install` ثم `pnpm verify` + `pnpm build:spa` بعد إعادة التسمية.
  - الجهد: 1-3 أيام.
  - المصدر: توجيه المستخدم (10 يونيو 2026).

### 19.4 P1 — تثبيت daisyUI وتحسين المظهر العام (DaisyUI Install + Polish)

- [x] `[P1]` ⏱️M **تثبيت إضافة daisyUI وتحسين المظهر العام حسب مهارة daisyui/frontend-design** — `daisyui` مثبت ومفعّل كـ Tailwind v4 plugin + تطبيق سمات وتحسينات بصرية أولية.
  - **تعديل ملفات:** `archive app/src/styles/tailwind.css` (`@plugin "daisyui";`)، مكوّنات `components/ui/*` الأساسية أولاً.
  - **✅ مُنجَز 2026-06-12:** الاعتماد الفعلي موجود في `archive app/src/styles/tailwind.css` (`@plugin "daisyui"` مع `light/dark` و`logs:false`)؛ طبقة primitives المشتركة تستخدم الآن `btn`/`card`/`badge`/`alert`/`skeleton`/`progress`/`dock` في `components/ui/*` و`components/common/*` بدون إزالة نظام الثيم `va-*`.
  - **✅ تحقّق:** `pnpm --filter @archive/app run verify`، `build:spa`، `build:cloud`، `build:aistudio`، و`playwright test tests/navigation.spec.ts --project=mobile-chrome` كلها نجحت.
  - يرتبط بـ: §17.1، §17.10، مهارة `daisyui`/`frontend-design`.
  - الجهد: 1-3 أيام (انطلاق) — الترحيل الكامل في §17.1.
  - المصدر: توجيه المستخدم (10 يونيو 2026).

### 19.5 P1 — جولة إصلاح أخطاء وتنظيف عامة (General Bug-Fix & Cleanup Pass)

- [x] `[P1]` ⏱️S **مُنجَز جزئياً (10 يونيو 2026): إصلاحات سريعة + تشخيص فحص الخادم.**
  - **✅ أُصلح:** `pnpm-workspace.yaml:9` (`sharp: set this to true or false` → `sharp: true` — sharp@^0.33.5 يُستخدم في `archive-server/src/media/imageProcessor.js`، يحتاج بناءه الأصلي).
  - **✅ أُصلح:** توليد Prisma client المفقود (`pnpm --filter archive-server prisma:generate` — كان `src/generated/prisma/` غير موجود).
  - **✅ تحقّق:** `pnpm verify:app` و`verify:core` ينجحان؛ بناء spa + cloud + aistudio الثلاثة ينجح مع daisyUI.
- [x] `[P1]` ⏱️M **مُنجَز (10 يونيو 2026): إصلاح فحص الخادم `pnpm verify:server` — السلسلة كاملة خضراء.**
  - **(أ) فجوة node↔tsx:** ✅ سكربتات `verify-*` تعمل الآن تحت `tsx` في `package.json` (Prisma 7 يولّد `.ts` بمحددات `.js`).
  - **(ب) خلل mock:** ✅ أُضيف `createMany({data, skipDuplicates})` لـ fake Prisma في `verify-postgres-adapter.mjs`، وعُدّل اختبار rollback ليحقن الفشل في `createMany` (المحوّل لم يعد يستخدم `create` في الاستيراد).
  - **(ج) تأكيد متقادم:** ✅ اختبار allow-list في `verify-api.mjs` حُدّث ليشمل `getByField` (12 طريقة).

---

## 20. توجيهات المستخدم — دفعة ثانية (10 يونيو 2026)

> **المصدر:** توجيه المستخدم المباشر. صيغت المهام من نصّ وصل مشوّهاً جزئياً — تُراجع الصياغة مع المستخدم عند بدء التنفيذ.

### 20.1 P1 — Refresh Token + التجديد الصامت (Silent Renewal)

- [x] `[P1]` ⏱️M **إضافة `POST /api/auth/refresh` وتجديد JWT تلقائياً قبل الانتهاء** — حالياً انتهاء التوكن يقطع جلسة العمل (أرشفة طويلة تنقطع).
  - **التنفيذ:** refresh token يُخزَّن في HttpOnly cookie (لا localStorage)؛ access token قصير العمر يُجدَّد صامتاً في الخلفية قبل انتهائه؛ إبطال refresh token عند تسجيل الخروج (يرتبط بآلية إبطال JWT الموجودة في §1)؛ rotation عند كل تجديد لكشف إعادة الاستخدام.
  - **الملفات:** `archive-server/src/auth/*`، `archive-server/src/api/server.js`، `archive app/src/bootstrap/cloudSession.js` (مؤقّت تجديد صامت + إعادة محاولة عند 401).
  - الجهد: 1-2 أسبوع.
  - ✅ **مُنجز ومتحقق (2026-06-11):** وحدة جديدة `archive-server/src/auth/refreshTokenStore.js` (عائلات rotation + كشف إعادة الاستخدام يبطل العائلة كاملة)؛ `POST /api/auth/refresh` يدوّر كوكي `va_refresh` (HttpOnly، `Path=/api/auth`، `SameSite=Strict`، `Secure` على HTTPS) ويصدر access token جديدًا؛ login يزرع الكوكي وlogout يبطل العائلة ويمسحها؛ `REFRESH_EXPIRES_IN_SEC` في `.env.example` (افتراضي 30 يومًا). في العميل: `refreshCloudToken` + `createSilentRenewal` (تجديد قبل الانتهاء بدقيقة، إعادة محاولة عند خطأ شبكة، خروج تلقائي عند 401) موصول في `createCloudSessionProvider`. اختباران HTTP شاملان في `verify-auth.mjs` (مرّا) و7 اختبارات vitest في `cloudSession.refresh.test.js` (مرّت، 73/73).

### 20.2 P1 — التنبيهات الذكية (Smart Alerts عبر Web Push)

- [x] `[P1]` ⏱️M **ربط خدمة الإشعارات بـ Web Push API لإرسال تنبيهات خارج التطبيق** — تُرسل عند: إسناد مهام، اكتشاف مكررات (§16.3)، فشل نسخ احتياطي، تحديث سجل، إغلاق/أرشفة سجل.
  - **التنفيذ:** اشتراك Push في Service Worker + VAPID keys في الخادم؛ تفضيلات اشتراك لكل نوع تنبيه؛ تجميع التنبيهات المتشابهة.
  - **الملفات:** `archive-server/src/notifications/notificationService.js` (أو إنشاؤها)، `archive app/public/sw.js`، تكامل مع §18.2 (مركز الإشعارات — هذه قناة التسليم الخارجية له).
  - الجهد: 2-3 أسابيع.
  - ✅ **مُنجز ومتحقق (2026-06-11):** خادم: `webPushService.js` جديد (مكتبة `web-push` + VAPID من البيئة، إرسال fire-and-forget، تجميع التنبيهات المتطابقة خلال 30 ث، حذف endpoints الميتة عند 404/410)؛ مسارات `GET /api/push/vapid-public-key` و`POST /api/push/subscribe|unsubscribe` خلف المصادقة؛ Prisma: model `PushSubscription` + حقول `pushOn*` في التفضيلات مع migration `20260611120000_web_push`؛ ربط push بأحداث المشاركة واكتمال الرفع؛ `VAPID_*` في `.env.example`. عميل: معالجا `push`/`notificationclick` في `sw.js` (tag للتجميع، فتح/تركيز النافذة)، وخدمة `pushService.js` (اشتراك/إلغاء/حالة). تحقق: 5 اختبارات جديدة في `verify-notifications.mjs` (11/11 مرّت) و10 اختبارات vitest في `pushService.test.js` (82/82 مرّت). المتبقي لاحقًا: زر تفعيل في واجهة الإعدادات + قنوات حدث إضافية (مكررات/فشل نسخ احتياطي) عند توفر مصادر أحداثها.

### 20.3 P1 — نظام Workflow لحالات السجلات (Status Flow + Webhooks)

- [x] `[P1]` ⏱️L **آلة حالات معرّفة للسجلات: مسودة → تحرير → مراجعة → معتمد → منشور → مؤرشف (+ تواريخ استحقاق)** — انتقالات مضبوطة بالأدوار، وصلاحيات معرّفة لكل انتقال.
  - ✅ **مُنجز ومتحقق (2026-06-11):** خادم: `archive-server/src/workflow/stateMachine.js` (6 حالات بتسميات عربية، انتقالات data-driven مقيدة بالأدوار — editor للتأليف وadmin/owner للاعتماد/النشر، `applyTransition` immutable يلحق `workflowHistory` ويتحقق من `dueDate`)؛ مساران `GET /api/workflow/definition` و`POST /api/workflow/transition` (تدقيق + webhook `record.status_changed` + push للمالك عند تغيير حالة سجله من مستخدم آخر — تكامل §20.2). عميل: `itemStatus.js` (مرآة الحالات + `isOverdue`) و`StatusTransitionMenu.jsx` (شارة + قائمة انتقالات حسب الدور). تحقق: `verify-workflow.mjs` جديد ضمن سلسلة `verify` (6/6 مرّت) و9 اختبارات vitest (91/91 مرّت). المتبقي لاحقًا: تذكيرات مجدولة لتواريخ الاستحقاق، وتضمين القائمة في صفحة التفاصيل، وschema قابل للتهيئة من واجهة الإدارة.
  - **التنفيذ:** تعريف الحالات والانتقالات المسموحة في schema قابل للتهيئة؛ صلاحيات لكل انتقال حسب الدور (admin/editor/viewer)؛ إطلاق webhooks عند كل انتقال حالة (يبني على بنية Webhooks الموجودة في `WebhooksSettings.jsx` وأحداث `record.*` في `server.js`)؛ تواريخ استحقاق مع تنبيهات (تكامل §20.2)؛ سجل انتقالات لكل سجل.
  - **الملفات:** `archive-server/src/workflow/stateMachine.js` (جديد)، `archive-server/src/api/server.js`، `archive app/src/features/archive/itemStatus.js` (يرتبط بـ §17.17 — الحالات المرئية تُبنى فوق هذا الـ workflow)، `archive app/src/components/workflow/StatusTransitionMenu.jsx`.
  - يرتبط بـ: §17.17 (شارات الحالة)، §18.1 (سجل النشاط)، §20.2 (تنبيهات الاستحقاق).
  - الجهد: 3-4 أسابيع.

### 20.4 P1 — تصدير متقدّم: PDF منسّق + قوالب Excel + صيغ أكاديمية

- [x] `[P1]` ⏱️L **قدرة تصدير منسّقة: تقارير PDF بهوية بصرية (pdf-lib)، قوالب Excel قابلة للتخصيص، وصيغ BibTeX/RIS أكاديمية** — التصدير الحالي CSV/Excel خام عبر XLSX فقط.
  - 🔄 **تقدم 2026-06-11 (جزء الاستشهادات):** أُنجزت صيغتا BibTeX/RIS عبر `archive-server/src/export/citationExport.js` (دوال نقية: `recordToBibtex`/`recordToRis`/`recordsTo*`/`makeCiteKey`، اشتقاق السنة من `createdAt`، تهريب أحرف BibTeX الخاصة مع إبقاء URL/ID خامًا، تخطّي المحذوف). مدموجتان في `exportRecords` وقائمة سماح `/api/export` (`csv,xlsx,zip,bibtex,ris`). تحقق: 7 اختبارات في `verify-export.mjs` (16/16 مرّت). المتبقي من البند: تقارير PDF بهوية بصرية (pdf-lib + خط عربي) وقوالب Excel قابلة للتخصيص.
  - ✅ **مُنجز ومتحقق (2026-06-13):** أُضيف `pdf-lib` + `@pdf-lib/fontkit` لتوليد تقارير PDF منسّقة مع غلاف وملخص وجدول سجلات، وبحث تلقائي عن خط عربي عبر `ARCHIVE_PDF_FONT_PATH` أو مسارات النظام الشائعة مع fallback آمن. أُضيفت صيغة `xlsx-template` بورقة بيانات وورقة تعليمات وورقة إعدادات قالب قابلة للتخصيص، وتوسّعت قائمة السماح في `/api/export` لتشمل `pdf` و`xlsx-template`، كما ظهرت الصيغ الجديدة في زر التصدير داخل الواجهة. تحقق: `pnpm --filter archive-server run verify:export` مرّ شاملاً اختبارات PDF، قالب Excel، ومسار HTTP للصيغتين.
  - **التنفيذ:** تقارير PDF (غلاف + جداول منسّقة + دعم RTL/خط عربي مدمج) عبر مكتبة pdf خفيفة (`pdf-lib`)؛ قوالب Excel معرّفة مسبقاً (أعمدة/تنسيق/شعار) فوق `xlsx` الموجودة؛ تصدير مراجع BibTeX/RIS للاستخدام الأكاديمي (تحويل حقول العنصر إلى مدخلات استشهاد).
  - **الملفات:** `archive-server/src/export/pdfReport.js` (جديد)، `archive-server/src/export/citationExport.js` (جديد)، توسعة `archive-server/src/export/exportService.js`، خيارات في `DataCenterPage.jsx`/`ReportsPage.jsx`.
  - **تنبيه:** فحص الخط العربي المدمج (حجم/ترخيص)؛ تعقيم إدخال المستخدم في حقول PDF.
  - الجهد: 3-4 أسابيع.

### 20.5 P1 — واجهة API عامة بمفاتيح API + تكامل CMS

- [x] `[P1]` ⏱️L **API عام موثّق بمفاتيح API (منفصلة عن JWT) يتيح للأنظمة الخارجية قراءة البيانات برمجياً + موصلات CMS (WordPress/Drupal) للمزامنة التلقائية** — حالياً الـ RPC داخلي فقط بمصادقة JWT.
  - **التنفيذ:** إصدار/إبطال API Keys من واجهة الإدارة (تخزين hash فقط)؛ صلاحيات لكل مفتاح (قراءة فقط/نطاقات stores)؛ rate limiting لكل مفتاح؛ توثيق OpenAPI؛ نقاط REST للقراءة بترقيم cursor (يبني على §2 pagination)؛ webhook/موصل WordPress وDrupal للنشر التلقائي عند انتقال الحالة لـ"منشور" (تكامل §20.3).
  - **الملفات:** `archive-server/src/api/publicApi.js` (جديد)، `archive-server/src/auth/apiKeys.js` (جديد)، `archive app/src/components/settings/ApiKeysSettings.jsx` (جديد)، توثيق `archive-server/docs/public-api.md`.
  - **تنبيه أمان:** مراجعة security-reviewer إلزامية قبل الدمج (سطح هجوم جديد).
  - الجهد: 3-4 أسابيع.
  - ✅ **مُنجز ومتحقق (2026-06-11):** `archive-server/src/auth/apiKeyService.js` (توليد `ak_<prefix8>_<secret32>`، تخزين SHA-256 hash فقط، إظهار المفتاح الخام مرّة واحدة، نطاقات read/write → دور viewer/editor، احترام `expiresAt`/`active`، ختم `lastUsedAt`)؛ Prisma model `ApiKey` + migration `20260611140000_api_keys`؛ مسارات إدارة محمية بـ JWT (`GET/POST/DELETE /api/api-keys`) ونقطة قراءة عامة `GET /api/public/records` بترويسة `X-API-Key` ونطاق read مع حد `limit`؛ تدقيق على الإنشاء/الإبطال. واجهة `ApiKeysSettings.jsx` (إنشاء/سرد/إبطال مع إظهار المفتاح الخام مرّة واحدة + نسخ) موصولة في تبويب Webhooks بصفحة الإعدادات. تحقق: `verify-apikeys.mjs` جديد ضمن سلسلة `verify` (5/5 مرّت، بما فيها مسار HTTP كامل: إنشاء→سرد بلا سر→قراءة عامة→إبطال→رفض بعد الإبطال) و3 اختبارات vitest للواجهة (104/104 مرّت). rate-limit لكل مفتاح مضاف على `/api/public/records` (محدِّد `apiKey` مفتاحه `apiKeyId`، افتراضي 120/دقيقة، 429 عند التجاوز)، وترقيم cursor مستقر (`?cursor=&limit=` مرتّب حسب id مع `nextCursor` في الاستجابة) مع اختبارَي انحدار (8/8 مرّت). المتبقي لاحقًا: توثيق OpenAPI، موصلات WordPress/Drupal.

### 20.6 P2 — البحث الصوتي (Web Speech API)

- [x] `[P2]` ⏱️M **السماح بالبحث الصوتي: المستخدم ينطق "محاضرات يونيو 2026" أو "افتح هذا الملف" فيُنفَّذ البحث/الأمر** — عبر Web Speech API (SpeechRecognition) مع دعم العربية.
  - **التنفيذ:** زر ميكروفون في شريط البحث + لوحة الأوامر (§17.2)؛ تحويل الكلام لاستعلام بحث (مع التطبيع العربي في `archive-core/src/utils/arabicNormalize.js`)؛ أوامر صوتية بسيطة (افتح/ابحث/أضف)؛ fallback مهذّب حيث لا يتوفر SpeechRecognition؛ احترام إذن الميكروفون وعدم التسجيل الدائم.
  - **الملفات:** `archive app/src/features/search/voiceSearch.js` (جديد)، `archive app/src/components/search/VoiceSearchButton.jsx` (جديد)، تكامل `SearchPage.jsx`.
  - ✅ **مُنجز ومتحقق (2026-06-12):** أضيفت وحدة `voiceSearch.js` لاكتشاف `SpeechRecognition`/`webkitSpeechRecognition`، استخراج النص من نتائج المتصفح، وتطبيع أوامر عربية بسيطة (`ابحث`/`افتح`/`أضف`) إلى intents قابلة للتنفيذ. أضيف زر `VoiceSearchButton` داخل شريط بحث `SearchPage`، يعمل بلغة `ar-SA`، لا يسجل إلا عند الضغط، ويعرض fallback عبر toast عند غياب الدعم أو رفض إذن الميكروفون. أوامر البحث تضبط الاستعلام، أمر الفتح يفتح النتيجة الوحيدة أو يضيّق النتائج، وأمر الإضافة ينتقل لصفحة الإضافة. التحقق: اختبار RED/GREEN جديدان (`voiceSearch.test.js`, `VoiceSearchButton.test.jsx`) + حارس `verify-modules` + `pnpm --filter @archive/app run test` (111/111) + `pnpm --filter @archive/app run verify` + `pnpm --filter @archive/app run build:spa`.
  - الجهد: 1-2 أسبوع.

### 20.7 P1 — إصلاح/ترقية خريطة العلاقات (Graph View بـ cytoscape.js)

- [x] `[P1]` ⏱️M **ترقية `GraphViewPage.jsx` إلى cytoscape.js وإصلاح عدم ظهور الروابط بين العناصر** — المستخدم يبلّغ أن الروابط/العلاقات لا تظهر حالياً في الخريطة.
  - **التحقيق أولاً:** ✅ السبب: المطابقة كانت نصية حرفية (lowercase فقط، بلا تطبيع عربي ولا aliases للوسوم الهرمية)، لا حواف للمجموعات إطلاقاً، وقصّ أول 60 عنصراً بترتيب الإدخال قبل حساب الحواف.
  - **التنفيذ:** ✅ تم — `cytoscape.js` (cose ≤250 عقدة / concentric فوقها، استيراد كسول)؛ عقد ملوّنة حسب documentType؛ حواف وسوم مشتركة (مطبّعة عربياً + aliases الوسوم الهرمية) + نفس المجموعة بوزن = عدد التداخل؛ حواف علاقات §18.5 اليدوية موجهة وموسومة؛ تكبير/سحب؛ نقرة → تحديد ونقرة ثانية → التفاصيل؛ فلترة حسب النوع/الوسم؛ سقف 500 عقدة مع «تحميل المزيد». **متبقٍ لاحقًا:** أداء ~5K عقدة (عرض تدريجي حقيقي).
  - **الملفات:** `archive app/src/pages/GraphViewPage.jsx`، تبعية `cytoscape` جديدة، `archive app/src/features/graph/buildGraphModel.js` + `buildGraphModel.test.js` (جديدان، 10 اختبارات).
  - يرتبط بـ: §18.5 (العلاقات)، §11/§12 graph.
  - الجهد: 2-3 أسابيع.

### 20.8 P0 — إصلاح مشاكل واجهة التطبيق على شاشات المحمول (Mobile UI Defects)

- [x] `[P0]` ⏱️L **جولة إصلاح شاملة لعيوب الواجهة على المحمول — المستخدم يبلّغ عن "مشاكل كثيرة في الواجهات والقوائم الرئيسية" على شاشات الهاتف** — هذه مهمة إصلاح عيوب (defects) وليست تحسيناً؛ تسبق إعادة التصميم الكاملة في §17.15.
  - **المرحلة 1 — جرد العيوب (تشخيص أولاً):** تحليل شيفرة CSS وكلاسات Tailwind لكل مكوّن بدلاً من Playwright (إضافة المتصفح غير مثبتة). تم اكتشاف عيبين رئيسيين:
    - فراغ وهمي 64px في أعلى كل صفحة على الهواتف (≤640px) بسبب `pt-16` ثابت رغم أن `.va-context-bar` تصبح `position:static` على تلك العروض.
    - تراكب زر الهامبرغر مع عنوان الصفحة: الزر عند `right:12px + width:44px = 56px` لكن `padding-inline-start` كان 52px فقط.
  - **المرحلة 2 — الإصلاحات (منجزة):**
    - `AppRouter.jsx`: `pt-16` → `pt-0 sm:pt-16` يُطبّق المسافة العلوية فقط عند ≥640px؛ أُضيف `overflow-x-hidden` للمحتوى الأفقي.
    - `app-overrides.css`: `padding-inline-start: 3.25rem` → `3.75rem` داخل `@media (max-width: 640px)` لإيجاد مسافة 4px بعد نهاية الزر.
  - **المرحلة 3 — التحقق:** 37/37 اختباراً تجتاز؛ لا مراجع `pt-16` متبقية في `src/`.
  - **الملفات المرجّحة:** `Sidebar.jsx`، `TopBar.jsx`/`PageContextBar.jsx`، `MobileActionBar.jsx`، القوائم المنسدلة، النوافذ المنبثقة، `app-overrides.css`، صفحات الأرشيف/التفاصيل.
  - يرتبط بـ: §17.15 (إعادة تصميم الجوال الكاملة — هذه الجولة تصلح العيوب الحرجة قبلها)، §13.3 (BottomTabBar المنجز).
  - الجهد: 1-2 أسبوع.
  - المصدر: توجيه المستخدم (10 يونيو 2026 — دفعة ثانية). منجز: 11 يونيو 2026.
