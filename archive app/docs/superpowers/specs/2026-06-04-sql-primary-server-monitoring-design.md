# التصميم: SQL كـ backend أساسي + متانة الاتصال + مراقبة حالة الخادم

> التاريخ: 2026-06-04
> الحالة: مُعتمد (Sub-project 1+2). المزامنة الكاملة (Sub-project 3) مؤجّلة لمواصفات منفصلة.
> ملاحظة للمنفّذ: الوكيل المنفّذ يفهم العربية، **لكنه لا يلتزم اتجاه RTL تلقائياً** — راجع
> قسم «متطلبات RTL الإلزامية» قبل أي عمل على الواجهة.

---

## 1. الهدف والنطاق

**الهدف:** جعل خادم SQL هو الـ backend الأساسي (مصدر الحقيقة) عند ضبطه، مع إبقاء
IndexedDB المحلي كطبقة أوفلاين/مستقلة؛ وتحسين متانة الاتصال بخادم قاعدة البيانات؛
وإضافة مراقبة حيّة لحالة الخادم.

**داخل النطاق (هذه المواصفات = Sub-project 1+2):**
- توسيع `/api/health` ليعكس صحة قاعدة البيانات فعلياً.
- دعم محرّكات SQL متعددة عبر Prisma: PostgreSQL، MySQL، SQLite، SQL Server (MSSQL).
- متانة محوّل `cloud-http`: مهلة (timeout)، إعادة محاولة مع backoff، أخطاء مكتوبة.
- شريحة حالة الاتصال `connectionStatus` + مراقبة حيّة (`serverHealthClient`).
- واجهة مراقبة: شارة تعكس الـ backend الفعلي + الاتصال (بدل «IndexedDB محلي» الثابتة) + لوحة صحة.
- معالج البدء يجعل SQL الخيار الموصى/الأساسي ويلتقط الخادم + الدخول.
- **خيار محرّك التخزين المحلي:** في الوضع المحلي (بلا خادم SQL) يختار المستخدم بين
  **IndexedDB (الافتراضي)** و**SQLite (WASM، يُخزَّن في OPFS)** — بديل محلي شبيه بـSQL
  قابل للتصدير/الفحص كملف. يُختار من المعالج والإعدادات.
- **تحكم كامل من واجهة الإعدادات:** قسم إعدادات موحّد للتخزين وقواعد البيانات يتيح ضبط
  كل شيء من داخل التطبيق (محرّك محلي، اتصال/نوع/اختبار/تبديل خادم SQL، مخزن الملفات،
  وإعدادات الخادم القابلة للتحرير) — **لا الاعتماد على ملفات الإعدادات فقط** (admin-gated).

**خارج النطاق (Sub-project 3 — مؤجّل):**
- مرآة محلية لبيانات SQL، طابور كتابة أوفلاين، مزامنة عند العودة، حل التعارضات.
  (سلوك الأوفلاين الآن: رسالة واضحة + إعادة محاولة، دون طابور كتابة.)

---

## 2. الحالة الحالية (خلاصة الفحص)

- `src/bootstrap/backendChoice.js`: خيارات `local` (افتراضي) / `pocketbase` / `postgres`. AI Studio يفرض المحلي.
- `src/bootstrap/registerByBackendChoice.js`: المحلي يُوصَّل دائماً؛ الخيار السحابي يستبدل التخزين بـ `cloud-http`.
- `src/storage/adapters/cloud-http/index.js`: RPC بسيط (`POST {base}/api/rpc`) — **بلا مهلة/إعادة محاولة/فحص صحة/حالة اتصال**.
- `src/features/settings/dbConfigClient.js` + `DatabaseSettings.jsx`: عرض/اختبار/حفظ DB (postgres فقط؛ `buildPgUrl`؛ restartRequired).
- الخادم `archive-server`:
  - `GET /api/health` → `{ ok, backend, authRequired }` فقط (لا فحص DB).
  - Prisma لـ Postgres (`src/adapters/cloud-postgres-prisma/`) + PocketBase. `BACKEND` env يختار. يدعم Prisma عدة محرّكات أصلاً.
  - مصادقة موجودة: `src/auth/authService.js` + `jwt.js` + `POST /api/auth/login`.
- الواجهة: `src/components/navigation/PageContextBar.jsx` تعرض شارة **ثابتة** «IndexedDB محلي».

---

## 3. المعمارية المستهدفة

```
[SPA] PageContextBar/ServerStatusPanel
        ↑ يقرأ
   connectionStatus slice  ←── serverHealthClient (poll /api/health)
        ↑ يُحدِّث                         │
   resilientRpc (timeout/retry) ── cloud-http ──HTTP──> [archive-server]
                                                          ├ /api/rpc      (تخزين)
                                                          ├ /api/health   (موسّع: db ping + meta)
                                                          ├ /api/auth/login
                                                          └ /api/admin/* (config/test DB)
                                                                 │
                                                          Prisma (provider ثابت لكل صورة)
                                                          Postgres | MySQL | SQLite | SQL Server
```

مبدأ العزل: كل وحدة نقية وقابلة للاختبار وحدها (serverHealthClient، connectionStatus model،
resilientRpc) — يُختبر منطقها في `verify-modules` بـ fetch وهمي دون متصفح.

---

## 4. القرارات المعتمدة (من الـ brainstorming)

1. **معنى «SQL أساسي»:** SQL مصدر الحقيقة عند ضبطه؛ المحلي للأوفلاين/المستقل.
2. **سلوك الأوفلاين الآن:** رسالة واضحة + إعادة محاولة (الطابور والمزامنة في Sub-project 3).
3. **عمق الفحص:** توسيع `/api/health` ليشمل فحص DB (SELECT 1) + زمن استجابة.
4. **كيف يصير SQL أساسياً:** الافتراضي البرمجي يبقى `local` للأمان (أول تشغيل/AI Studio)؛ المعالج
   يوصي بـ SQL ويلتقط الخادم؛ الخادم المضبوط = الأساسي؛ الشارة/المراقبة تعكسه؛ المحلي يُوسم «أوفلاين/مستقل».
5. **محرّكات متعددة:** عبر Prisma (postgresql/mysql/sqlite/sqlserver). المحرّك يُحدَّد وقت النشر (provider في
   schema)، وتبديله يتطلب إعادة تشغيل + migration (متوافق مع نمط `restartRequired` القائم).
6. **الدخول:** البنية موجودة (authService + JWT + /api/auth/login + cloudSession) — نضمن التقاطه في المعالج وعمله مقابل SQL.
7. **محرّك التخزين المحلي:** خيار `localEngine` في `backendChoice` بقيمتين `indexeddb` (افتراضي)
   و`sqlite`. SQLite عبر WASM (مكتبة معروفة: `wa-sqlite` مع OPFS، أو `sql.js` كبديل) كمحوّل
   `local-sqlite` جديد يحقّق منفذ التخزين نفسه. لا يكسر AI Studio (يبقى IndexedDB ما لم يُختر صراحة).
8. **التحكم الكامل من الإعدادات:** كل ضبط للتخزين/قواعد البيانات/مخزن الملفات يكون متاحاً وقابلاً
   للتحرير من واجهة الإعدادات (admin-gated)، وملفات الإعدادات/البيئة تبقى كقيم افتراضية/تمهيد فقط.

---

## 5. التفاصيل التقنية

### 5.1 توسيع `/api/health` (الخادم)
الشكل الجديد:
```json
{ "ok": true, "backend": "postgres", "engine": "postgresql",
  "db": { "ok": true, "latencyMs": 12 }, "uptimeSec": 3600,
  "version": "x.y.z", "authRequired": true }
```
- DB ping عبر مزوّد التخزين: أضف قدرة `ping()` لمزوّد Prisma (`$queryRaw\`SELECT 1\``) ولـ PocketBase
  (طلب خفيف)، وعرّضها من `registerCloudProviders`. عند فشل الـ ping: `db.ok=false` + `db.error` و`ok` يبقى
  `true` (HTTP حي) لتمييز «degraded» عن «offline».
- لا تكشف أسراراً (لا روابط/كلمات مرور).

### 5.2 محرّكات SQL عبر Prisma (الخادم)
> تصحيح تنفيذي بعد التحقق من Prisma 7: لا يسمح Prisma 7 بـ `env()` داخل `provider`،
> ولا يسمح بوضع `url` داخل `schema.prisma`؛ الرابط يعيش في `prisma.config.mjs`.
> لذلك لا يكون تبديل المحرّك runtime toggle داخل schema واحد. المطلوب لتفعيل محرّك غير
> PostgreSQL هو schema/client مولد لذلك provider أو صورة نشر منفصلة، مع driver adapter
> المناسب ثم migration.

- `schema.prisma`: `datasource db { provider = "postgresql" }` للصورة الحالية. للمحرّكات الأخرى
  يجب توليد schema/client منفصلين بقيم `provider` الثابتة (`mysql` | `sqlite` | `sqlserver`) وربط adapter مناسب.
- `adminConfig.js`: عمّم البناء/الاختبار ليقبل `engine` + بناء رابط لكل محرّك؛ `testDbConnection` ينفّذ ping
  مناسباً للمحرّك؛ `saveDbConfig` يحفظ `{ engine, url }` (restartRequired).
- وثّق per-engine migration (`prisma migrate`) في `docs/FULL_STACK_RUNBOOK.md`.

### 5.3 متانة العميل (`resilientRpc`)
- يغلّف `cloud-http`: مهلة عبر `AbortController` (افتراضي 15s)، إعادة محاولة (حتى 2) مع backoff **للأخطاء الشبكية/المهلة فقط** — لا إعادة محاولة لـ 4xx (خصوصاً 401).
- يحدّث `connectionStatus`: نجاح → `online`(+latency)؛ فشل شبكي/مهلة → `reconnecting` ثم `offline`؛ 401 → `reconnecting` (يطلب دخول).

### 5.4 شريحة حالة الاتصال + المراقبة
- نموذج نقي `src/features/server-status/connectionStatus.js`: حالات `local | online | degraded | reconnecting | offline`، + `lastLatencyMs`, `lastError`, `lastCheckedAt`. دوال انتقال خالصة (تُختبر).
- شريحة Zustand تستهلك النموذج.
- `serverHealthClient.js` نقي (fetch قابل للحقن): يستدعي `/api/health`، يحلّل، يقيس latency.
- مُجدول poll كل 20s (يتباطأ/يتوقف عند إخفاء التبويب `visibilitychange`؛ يُسرّع فوراً بعد فشل). المحلي: الحالة دائماً `local` بلا poll.

### 5.5 واجهة المراقبة
- استبدل شارة `PageContextBar.jsx` الثابتة بشارة تعكس: الـ backend الفعلي (محلي/SQL+المحرّك) + لون الحالة
  (أخضر online / كهرماني degraded|reconnecting / أحمر offline / رمادي local) + tooltip بزمن الاستجابة وآخر فحص.
- لوحة صحة (popover من الشارة أو قسم في DataCenter/DatabaseSettings): المحرّك، الـ URL (مُقنّع)، `db.ok`+latency،
  uptime/version، آخر فحص، زر «إعادة الاتصال» (يفرض فحصاً فورياً).

### 5.6 معالج البدء + الدخول
- خطوة «التخزين/الخادم»: تقدّم **SQL (خادم) كموصى/أساسي**، تختار المحرّك، تبني الاتصال (host/port/db/user/password أو URL)،
  «اختبار الاتصال» (يستدعي `/api/admin/db/test`)، ثم تسجيل الدخول (`/api/auth/login` → cloudSession). عند النجاح:
  `setBackendChoice("postgres"|"pocketbase", url)` ويُعتبر الخادم الأساسي. المحلي يُعرض كخيار «أوفلاين/مستقل» ثانوي صريح،
  ومع اختياره يظهر اختيار المحرّك المحلي (IndexedDB / SQLite).

### 5.7 محرّك التخزين المحلي (IndexedDB | SQLite)
- `backendChoice`: أضف حقل `localEngine` (`indexeddb` افتراضي | `sqlite`) محفوظاً مع الاختيار، ومُطبَّعاً بأمان.
- محوّل جديد `src/storage/adapters/local-sqlite/index.js` يحقّق منفذ `@archive/core` نفسه فوق WASM SQLite
  (`wa-sqlite`/OPFS؛ `sql.js` بديل) مع جدول مفتاح-قيمة لكل store، وثبات في OPFS، وتصدير/استيراد ملف `.sqlite`.
- `registerLocalProviders` يختار المحوّل حسب `localEngine`. AI Studio: IndexedDB دائماً ما لم يُختر sqlite صراحةً وكان OPFS متاحاً.
- تراجع آمن: إذا فشل تهيئة SQLite (لا OPFS) يعود إلى IndexedDB مع إشعار واضح.

### 5.8 تحكم كامل من واجهة الإعدادات (تخزين + قواعد بيانات)
- قسم إعدادات موحّد «التخزين وقواعد البيانات» (admin-gated) يجمع: اختيار المحرّك المحلي، اتصال/نوع/اختبار/تبديل خادم SQL
  (عبر `dbConfigClient`)، مخزن الملفات (`FileStoreSettings` القائم)، وحالة الخادم الحيّة (من §5.5).
- كل ما كان يُضبط عبر ملف/بيئة فقط ويُمكن تغييره بأمان وقت التشغيل يصبح قابلاً للتحرير من هنا (مع `restartRequired` حين يلزم).
  ملفات الإعدادات/البيئة تبقى للتمهيد والقيم الافتراضية فقط.
- ⚠️ RTL إلزامي (راجع §6).

---

## 6. متطلبات RTL الإلزامية (حاجز للمنفّذ)

> الوكيل المنفّذ لا يلتزم RTL تلقائياً. أي عنصر واجهة جديد في هذه الخطة **يجب** أن:
- يضع `dir="rtl"` على الجذر العربي (الشارات/اللوحات/خطوات المعالج/الحقول)، ويستخدم `dir="auto"` للنصوص المتغيّرة (روابط/أسماء قواعد بيانات لاتينية داخل سياق عربي).
- يستخدم **الخصائص المنطقية** لا الفيزيائية: `ms-*/me-*/ps-*/pe-*/start-*/end-*` و`text-start/text-end` بدل `ml/mr/pl/pr/left/right/text-left/text-right`. أي قيمة اتجاهية موجودة في الكود يجب أن تُقرأ كـ RTL.
- الأيقونات الاتجاهية (Chevron/Arrow «التالي/السابق») تتبع اتجاه RTL (التالي = يسار، السابق = يمين) — راجع نمط المعالج القائم في `V1OnboardingWizard.jsx`.
- لا `flex-row-reverse` لقلب مزدوج داخل حاوية `dir="rtl"` (خطأ متكرّر سابق).
- الحقول اللاتينية (host/port/URL/user) تُحاذى `dir="ltr"` داخل حقلها مع بقاء التسمية عربية RTL.
- إعادة استخدام الأصناف المتوافقة مع السمة (`va-surface-muted` إلخ) لا ألوان داكنة ثابتة (راجع حارس `verify` للخلفيات).
- التحقق البصري في الوضعين (نهاري/ليلي) عبر المعاينة قبل اعتبار المهمة منجزة.

---

## 7. الأخطاء والحالات الحدّية
- شبكة ساقطة/مهلة → `offline` (رسالة + إعادة محاولة؛ لا فقدان بيانات لأن لا كتابة محلية بعد).
- HTTP حي لكن `db.ok=false` → `degraded` (الخادم يعمل، القاعدة لا) مع رسالة مميّزة.
- 401 → `reconnecting` + مطالبة دخول (cloudSession.signOut موجود).
- المحلي → `local` دائماً (لا فحص شبكة، لا إعادة محاولة).
- AI Studio → يبقى محلياً (forced) — لا تظهر عناصر الخادم.

## 8. الاختبار والبوابات
- `verify` (Node assert، نقي): `serverHealthClient` (تحليل + latency)، انتقالات `connectionStatus`، `resilientRpc`
  (مهلة، إعادة محاولة للشبكة فقط، عدم إعادة لـ 4xx) بـ fetch وهمي؛ مولّدات روابط المحرّكات في `dbConfigClient`.
- خادم: `archive-server/scripts/verify-api.mjs` (شكل `/api/health` الموسّع + db.ok)، `verify-admin-config.mjs` (محرّكات + اختبار/حفظ).
- `test:a11y`: شارة/لوحة الحالة تجتاز التباين في v4 (نهاري+ليلي).
- `build:cloud` + `build:spa` يمرّان.

## 9. المعالم والتبعيات (تفاصيل التنفيذ في `TASKS.md`)
- **M1** توسيع `/api/health` بفحص DB. (أساس)
- **M2** محرّكات SQL متعددة عبر Prisma + admin/dbConfig. (يعتمد على لا شيء؛ خادم)
- **M3** `resilientRpc` + شريحة `connectionStatus`. (عميل)
- **M4** `serverHealthClient` + واجهة المراقبة (شارة + لوحة). (يعتمد M1، M3)
- **M5** معالج البدء SQL-أساسي + الدخول. (يعتمد M2، M4)
- **M6** محرّك التخزين المحلي IndexedDB | SQLite (WASM) + اختياره في المعالج/الإعدادات. (يعتمد M5 جزئياً)
- **M7** قسم إعدادات موحّد للتحكم الكامل بالتخزين وقواعد البيانات ومخزن الملفات (لا ملفات فقط). (يعتمد M2، M4، M6)

ترتيب موصى: M1 → (M2، M3 بالتوازي) → M4 → M5 → M6 → M7.
