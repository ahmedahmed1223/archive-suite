# TASKS.md — مهام التنفيذ القادمة

> آخر تحديث: 2026-06-05
> المصدر: مسح منحاز ومُعاد لـ `ahmedahmed1223/CLOUD-MediaDB` عند `HEAD 153117e` + تمرير UI/UX على مشروعنا الحالي.
> القاعدة: وكيل واحد = مهمة واحدة = فرع واحد = PR واحد. عند بدء مهمة، غيّر حالتها إلى
> `in_progress` وأضف اسم الفرع المقترح.

---

## Recently Completed Reference

> **خطة: SQL أساسي + متانة الاتصال + مراقبة حالة الخادم** (Sub-project 1+2)
> المواصفات الكاملة: `docs/superpowers/specs/2026-06-04-sql-primary-server-monitoring-design.md`
> الحالة: ✅ `done` — كل المعالم M1–M7 منفّذة ومدمجة (الخادم في مستودع `archive-server`، والباقي في هذا المستودع).
> ⚠️ **RTL إلزامي** لأي عنصر واجهة: `dir="rtl"` على الجذر، خصائص منطقية (`ms/me/ps/pe/start/end`) لا
> (`ml/mr/left/right`)، الحقول اللاتينية `dir="ltr"` مع تسمية عربية، أيقونات الاتجاه تتبع RTL (التالي=يسار)،
> ممنوع `flex-row-reverse` داخل `dir="rtl"`، أصناف سمة (`va-surface-muted`) لا ألوان داكنة ثابتة، وتحقّق بصري
> نهاري+ليلي. الترتيب: M1 → (M2، M3) → M4 → M5 → M6 → M7.

- [x] **M1 — توسيع `/api/health` بفحص قاعدة البيانات** _(خادم؛ بلا تبعيات)_
  - وسّع `GET /api/health` في `archive-server/src/api/server.js` ليُعيد:
    `{ ok, backend, engine, db:{ ok, latencyMs, error? }, uptimeSec, version, authRequired }`.
  - أضف قدرة `ping()` لمزوّد التخزين: Prisma عبر `$queryRaw\`SELECT 1\`` في
    `src/adapters/cloud-postgres-prisma/storage.js`، و ping خفيف لـ PocketBase، وعرّضها من
    `src/bootstrap/registerCloudProviders.js`. عند فشل ping: `db.ok=false` + `db.error` مع بقاء `ok=true`
    (لتمييز degraded عن offline). لا تكشف أسراراً.
  - الاختبار: `archive-server/scripts/verify-api.mjs` (شكل health + db.ok). القبول: health يعكس صحة DB + latency.

- [x] **M2 — محرّكات SQL متعددة عبر Prisma (Postgres/MySQL/SQLite/SQL Server)** _(خادم؛ بلا تبعيات)_ ✅
  - مكتمل: `adminConfig` + واجهة الإعدادات + `dbConfigClient` يقبلون `engine + url` ويبنيان/يختبران/يحفظان روابط
    PostgreSQL/MySQL/SQLite/SQL Server. **اختيار المحرّك وقت التوليد** عبر `archive-server/scripts/set-db-provider.mjs`
    (يعيد كتابة `provider` في `schema.prisma` من `DATABASE_PROVIDER`، مضمّن في `prisma:generate`/`prisma:migrate`)
    لأن Prisma 7 لا يسمح بـ `env()` في `provider`. مختبَر: `verify-db-provider` + `verify` الكامل للخادم.
    (لغير Postgres: اربط Prisma driver adapter المناسب في صورة الخادم.) التبديل = ضبط env + إعادة توليد/ترحيل + إعادة تشغيل.
  - عمّم `archive-server/src/api/adminConfig.js`: يقبل `engine`، يبني/يختبر رابطاً لكل محرّك، `saveDbConfig`
    يحفظ `{ engine, url }` (restartRequired). حدّث `src/features/settings/dbConfigClient.js` (SPA) بـ `engine`
    + مولّدات روابط لكل محرّك (عمّم `buildPgUrl`).
  - واجهة `DatabaseSettings.jsx`: مُحدِّد نوع المحرّك (⚠️ RTL: `dir="rtl"`، الحقول اللاتينية `dir="ltr"`).
  - وثّق per-engine migration في `docs/FULL_STACK_RUNBOOK.md`.
  - الاختبار: `verify-admin-config.mjs` (محرّكات + اختبار/حفظ)، `verify-modules` (مولّدات الروابط).
  - ملاحظة: المحرّك يُحدَّد وقت النشر؛ تبديله = إعادة تشغيل + migration (لا تبديل runtime).

- [x] **M3 — متانة العميل: `resilientRpc` + شريحة `connectionStatus`** _(عميل؛ بلا تبعيات)_
  - غلّف `src/storage/adapters/cloud-http/index.js` بطبقة `resilientRpc`: مهلة عبر `AbortController` (افتراضي
    15s)، إعادة محاولة (حتى 2) مع backoff **للأخطاء الشبكية/المهلة فقط** (لا إعادة لـ 4xx، خصوصاً 401).
  - نموذج نقي جديد `src/features/server-status/connectionStatus.js`: حالات
    `local | online | degraded | reconnecting | offline` + `lastLatencyMs/lastError/lastCheckedAt` + دوال انتقال خالصة.
    + شريحة Zustand تستهلكه. اربط نتائج RPC بالتحديث (نجاح→online، فشل شبكي→reconnecting/offline، 401→reconnecting).
  - الاختبار: `verify-modules` (resilientRpc: مهلة/إعادة محاولة شبكية فقط/لا إعادة لـ4xx، وانتقالات connectionStatus) بـ fetch وهمي.

- [x] **M4 — `serverHealthClient` + واجهة المراقبة (شارة + لوحة)** _(عميل؛ يعتمد M1، M3)_ ⚠️ **RTL**
  - `src/features/server-status/serverHealthClient.js` نقي (fetch قابل للحقن): يستدعي `/api/health`، يحلّل، يقيس latency.
  - مُجدول poll كل 20s يتباطأ/يتوقف عند إخفاء التبويب (`visibilitychange`) ويُسرّع بعد فشل؛ المحلي بلا poll (الحالة `local`).
  - استبدل الشارة الثابتة «IndexedDB محلي» في `src/components/navigation/PageContextBar.jsx` بشارة تعكس الـ backend
    الفعلي (محلي/SQL+المحرّك) + لون الحالة (أخضر/كهرماني/أحمر/رمادي) + tooltip (latency + آخر فحص).
  - لوحة صحة (popover من الشارة أو قسم في `DataCenterPage.jsx`/`DatabaseSettings.jsx`): المحرّك، URL مُقنّع،
    db.ok+latency، uptime/version، آخر فحص، زر «إعادة الاتصال». **RTL إلزامي + أصناف سمة + تحقّق نهاري/ليلي.**
  - الاختبار: `verify-modules` (تحليل serverHealthClient)، `test:a11y` (تباين الشارة/اللوحة v4 نهاري+ليلي).

- [x] **M5 — معالج البدء: SQL أساسي + الدخول** _(عميل؛ يعتمد M2، M4)_ ⚠️ **RTL**
  - خطوة «التخزين/الخادم» في معالج البدء (`src/features/onboarding/*`): تقدّم **SQL (خادم) كموصى/أساسي**،
    تختار المحرّك، تبني الاتصال، «اختبار الاتصال» (`/api/admin/db/test`)، ثم الدخول (`/api/auth/login` → `cloudSession`).
    عند النجاح: `setBackendChoice(...)` ويُعتبر الخادم الأساسي؛ المحلي خيار «أوفلاين/مستقل» ثانوي صريح.
  - ⚠️ **RTL**: خطوات المعالج `dir="rtl"`، نقاط التقدّم بلا قلب مزدوج، الحقول اللاتينية `dir="ltr"`، أزرار التالي/السابق تتبع RTL.
  - الاختبار: `verify-modules` (تحقّق view-model للخطوة)، تحقّق يدوي/معاينة للتدفق (نهاري+ليلي).

- [x] **M6 — محرّك التخزين المحلي: IndexedDB | SQLite (WASM)** _(عميل؛ يعتمد M5 جزئياً)_ ⚠️ **RTL**
  - التنفيذ الحالي: أضيف `localEngine` ومسار اختيار SQLite في المعالج/الإعدادات، ومحوّل SQLite فعلي عبر
    `sql.js` فوق OPFS مع تراجع آمن إلى IndexedDB عند عدم توفر OPFS.
  - أضف حقل `localEngine` (`indexeddb` افتراضي | `sqlite`) إلى `src/bootstrap/backendChoice.js`
    (تخزين + تطبيع آمن + getters/setter)، بحيث يكون **بديلاً محلياً عن SQL** في الوضع المحلي.
  - محوّل جديد `src/storage/adapters/local-sqlite/index.js` يحقّق منفذ `@archive/core` فوق **WASM SQLite**
    (`sql.js`) مع ثبات في OPFS وتصدير/استيراد ملف `.sqlite`.
  - `src/bootstrap/registerLocalProviders.js`: يختار IndexedDB أو local-sqlite حسب `localEngine`، مع
    **تراجع آمن** إلى IndexedDB عند تعذّر OPFS/التهيئة + إشعار واضح. AI Studio يبقى IndexedDB ما لم يُختر sqlite صراحةً.
  - عرض الخيار في **معالج البدء** (خطوة التخزين عند اختيار «محلي») وفي **الإعدادات** (راجع M7). ⚠️ RTL + `dir="ltr"` لأسماء الملفات.
  - الاختبار: `verify-modules` (تطبيع `localEngine` + اختيار المحوّل)، واختبار عقدي لمنفذ local-sqlite
    (CRUD + snapshot/replaceAll + تصدير/استيراد ملف SQLite).

- [x] **M7 — قسم إعدادات موحّد: تحكّم كامل بالتخزين وقواعد البيانات** _(عميل؛ يعتمد M2، M4، M6)_ ⚠️ **RTL**
  - قسم إعدادات «التخزين وقواعد البيانات» (admin-gated) يجمع في مكان واحد: **اختيار المحرّك المحلي** (M6)،
    **اتصال/نوع/اختبار/تبديل خادم SQL** (`dbConfigClient` + `DatabaseSettings`)، **مخزن الملفات**
    (`FileStoreSettings` القائم)، و**حالة الخادم الحيّة** (من M4).
  - الهدف: **كل ضبط يُحرَّر من الواجهة** وليس عبر ملفات/بيئة فقط؛ ما يحتاج إعادة تشغيل يظهر بوسم `restartRequired`.
    ملفات الإعدادات/البيئة تبقى للتمهيد والقيم الافتراضية فقط.
  - ملفات: `src/pages/SettingsPage.jsx` (تبويب/قسم)، `src/features/settings/DatabaseSettings.jsx`،
    `FileStoreSettings.jsx`، وأي endpoint admin مطلوب في `archive-server/src/api/adminConfig.js`.
  - ⚠️ **RTL**: `dir="rtl"` للأقسام، الحقول اللاتينية (URL/host/port) `dir="ltr"`، خصائص منطقية، تحقّق نهاري+ليلي.
  - الاختبار: `verify-modules` (view-models للإعدادات)، `verify-admin-config` (الحفظ/التبديل)، `test:a11y` (تباين القسم).

---

## Next — UI/UX, Customization, and CLOUD-MediaDB Lift

- [x] **UIUX-1 — شريط عمل موحّد للأرشيف بدل تشتت الأزرار** _(P0؛ archive workstation)_
  - عدّل `ArchivePageHero` و`ArchivePageResults` بحيث تكون أفعال اليوميّة في شريط واحد ثابت ومنخفض الضجيج:
    بحث، فلاتر، تغيير العرض، الكثافة، تحديد متعدد، إضافة، استيراد، ومسح الفلاتر.
  - حافظ على ظهور النتائج في أول viewport، وقلّل ارتفاع منطقة التحكم على سطح المكتب والموبايل.
  - _Modifies:_ `src/features/archive/ArchivePageHero.jsx`, `ArchivePageResults.jsx`, `ArchiveViews.jsx`.
  - التحقق: Playwright screenshot للـ archive على 390px و1440px، ولا يوجد overlap أو زر خارج الحاوية.

- [x] **UIUX-2 — Preview panel عملي لا زخرفي** _(P0؛ scan/preview/edit)_
  - حوّل `PreviewPanel` في الأرشيف إلى لوحة عمل سريعة: معاينة، جودة التوصيف، آخر نشاط، وسوم مختصرة، وأزرار
    “فتح”، “تعديل سريع”، “إضافة لمشروع/مجموعة”.
  - اجعل اللوحة sticky على desktop وتتحول إلى bottom sheet على mobile عند اختيار عنصر.
  - _Modifies:_ `src/features/archive/ArchiveViews.jsx`, `ArchivePageResults.jsx`.
  - التحقق: اختيار عنصر من grid/list/table يعطي نفس الأفعال، واللوحة لا تزاحم النتائج.

- [x] **UIUX-3 — صفحة التفاصيل كمحطة تحرير منقسمة أكثر وضوحاً** _(P0؛ detail workbench)_
  - رتّب `DetailPage` إلى سطحين واضحين: مشغل/وسائط ثابتة، ولوحة بيانات بتبويبات: البيانات، التعليقات، التاريخ،
    الوسائط، AI، العلاقات.
  - أظهر مؤشرات الحفظ/التعديل/الصلاحيات قرب الأفعال نفسها، لا في أماكن بعيدة.
  - _Modifies:_ `src/pages/DetailPage.jsx`, reuses `V1Primitives`, `AiAssistBar`, `SaveIndicator`.
  - التحقق: تعديل بيانات، تعليق، bookmark، ومهمة وسائط كلها تعمل دون فقد موضع المشغل.

- [x] **UIUX-4 — شريط إجراءات موبايل سياقي** _(P0؛ mobile ergonomics)_
  - أضف شريطاً سفلياً سياقياً للموبايل يظهر حسب الصفحة: Archive (فلاتر/إضافة/تحديد)، Detail (تشغيل/حفظ/تعليق)،
    Search (فلاتر/حفظ الاستعلام)، Data Center (تصدير/استيراد).
  - لا يكرر كل أزرار الصفحة؛ يعرض 3-5 أفعال عالية التكرار فقط مع أيقونات lucide وتسميات قصيرة.
  - _Creates/Modifies:_ shared `MobileActionBar` في `components/ui` + ربط الصفحات الأساسية.
  - التحقق: 390px و430px، لا يغطي حقول الإدخال، ويحترم safe-area وRTL.

- [x] **UIUX-5 — نظام حالات موحّد: loading/empty/error/success** _(P1؛ trust & clarity)_
  - وحّد empty states وskeletons ورسائل الخطأ عبر الصفحات باستخدام `EmptyState`, `SkeletonBlock`, `SaveIndicator`.
  - كل صفحة عمل يجب أن تملك: حالة تحميل أولية، حالة فارغة مفيدة، حالة خطأ مع إعادة المحاولة، وحالة نجاح قصيرة.
  - _Modifies:_ `ArchivePage`, `SearchPage`, `UploaderPage`, `TranscriberPage`, `DataCenterPage`, `ReportsPage`.
  - التحقق: view-model أو story-like smoke لكل حالة، وفحص a11y للـ live regions.

- [x] **UIUX-6 — ترقية لوحة الأوامر إلى مركز تنقل + إجراءات** _(P1؛ power users)_
  - وسّع `CommandPalette` لتبحث في الصفحات، المواد، المشاريع، الأوامر، والإعدادات؛ مع أقسام مرئية ونتيجة fallback
    للبحث العام.
  - أضف إجراءات مباشرة: إضافة مادة، فتح آخر مادة، استيراد، تصدير تقرير، فتح الاختصارات، فتح المخزن.
  - _Modifies:_ `src/app/shell/ShellParts.jsx`, `components/common/commandPaletteViewModel.js`.
  - التحقق: keyboard-only كامل: arrows/enter/escape، ونتائج مرتبة حسب السياق الحالي.

- [x] **UIUX-7 — مراجعة الكثافة البصرية والتباين عبر الثيمات** _(P1؛ visual polish)_
  - راجع `v1/v2/v4 identity` لإزالة التضارب بين البطاقات، تخفيف الإطارات الثقيلة، وتوحيد ارتفاع الأزرار والحقول
    والـ badges في صفحات العمل.
  - لا تضف لوناً جديداً إلا كـ token؛ استخدم `va-surface-*` و`va-primary-button`.
  - _Modifies:_ `src/styles/*identity.css`, `components/ui/V1Primitives.jsx` عند الحاجة.
  - التحقق: `npm run test:a11y` + screenshots نهاري/ليلي لأرشيف/تفاصيل/إعدادات.

- [x] **UIUX-8 — microcopy عربية تشغيلية لا تسويقية** _(P1؛ clarity)_
  - راجع نصوص الأزرار، empty states، التحذيرات، وإرشادات الإعدادات لتكون قصيرة ومباشرة:
    ماذا سيحدث؟ هل يحتاج إعادة تشغيل؟ هل الإجراء قابل للتراجع؟
  - اجعل النصوص التقنية اللاتينية `dir="ltr"` أو `dir="auto"`: URLs، IDs، checksums، timecodes، paths.
  - _Modifies:_ صفحات العمل + `HelpPage` + إعدادات التخزين/AI.
  - التحقق: لا توجد أزرار بأسماء مبهمة مثل “تنفيذ” دون سياق، ولا نص طويل داخل زر صغير.

- [x] **UIUX-9 — تنقل جانبي قابل للفهم من أول نظرة** _(P2؛ information architecture)_
  - حسّن `Sidebar` بتجميعات أوضح: العمل اليومي، التوصيف، الإنتاج، الإدارة، الصيانة؛ وأضف badges فقط عندما تساعد.
  - وضع تحرير الـ Sidebar يبقى موجوداً، لكن لا يطغى على الاستخدام اليومي.
  - _Modifies:_ `components/navigation/Sidebar.jsx`, `navigation/viewModel.js`, `sidebarLayoutModel.js`.
  - التحقق: مستخدم viewer/editor/admin يرى مجموعات مفهومة، ولا تظهر صفحات غير مصرّح بها.

- [x] **UIUX-10 — مصفوفة فحص بصري إلزامية للصفحات الحرجة** _(P2؛ regression safety)_
  - أضف checklist أو سكربت screenshot للصفحات: Dashboard, Archive, Detail, Search, Uploader, Transcriber,
    Projects, Data Center, Settings.
  - يغطي desktop/mobile، light/dark، empty/data/error حيث أمكن.
  - _Creates/Modifies:_ `scripts/` أو docs تحت `.design/archive-ux-audit/`.
  - التحقق: لا تُعتبر أي مهمة UI مكتملة بدون screenshot أو a11y pass للصفحة التي تغيرت.

- [x] **APPEARANCE-1 — استوديو تخصيص المظهر بمعاينة حيّة** _(P0؛ appearance customization)_
  - حوّل تبويب الواجهة في `SettingsPage` إلى “استوديو مظهر”: اختيار الثيم، اللون، الكثافة، حجم الخط، نمط
    البطاقات، وموقع/حالة الشريط الجانبي مع معاينة حيّة مصغرة قبل الحفظ.
  - أضف زر “استعادة الافتراضي” وزر “تطبيق على كل المستخدمين” للمدير فقط.
  - _Modifies:_ `SettingsPage.jsx`, `ThemeVersionPicker.jsx`, `SettingsControls.jsx`, `src/styles/*identity.css`.
  - التحقق: تغيير كل خيار لا يكسر light/dark ولا يسبب layout shift، وفحص 390px/1440px.

- [x] **APPEARANCE-2 — ملفات مظهر شخصية وقوالب جاهزة** _(P1؛ personalization presets)_
  - أضف presets: “محرر يومي كثيف”، “مدير تقارير”، “مراجعة موبايل”، “عرض خفيف”، مع حفظ تفضيل كل مستخدم:
    default view، page size، density، sidebar layout، table columns، accent.
  - اسمح بتصدير/استيراد إعدادات المظهر كـ JSON صغير لا يحتوي أسراراً.
  - _Modifies:_ `utils/settings.js`, `SettingsPage.jsx`, `features/navigation/sidebarLayoutModel.js`.
  - التحقق: preset لا يمس إعدادات الخادم أو الأسرار، ويعمل local/cloud بنفس الشكل.

- [x] **TYPEUX-1 — معالج إنشاء نوع محتوى بدلاً من نموذج طويل** _(P0؛ content type onboarding)_
  - أعد بناء تجربة إنشاء النوع في `TypesPage`: خطوات قصيرة (أساسيات، فروع، حقول، مراجعة) مع قوالب جاهزة:
    مقابلة، محاضرة، خبر، صورة، مستند، مقطع B-roll.
  - في خطوة المراجعة اعرض كيف سيظهر النوع في صفحة الإضافة والتفاصيل قبل الحفظ.
  - _Modifies:_ `TypesPage.jsx`, `features/types/viewModel.js`, reuses `WorkflowStepper`, `EntityFormModal`.
  - التحقق: إنشاء نوع كامل من الصفر على الموبايل دون تمرير مرهق أو فقد مسودة.

- [x] **TYPEUX-2 — محرر حقول مخصصة احترافي مع معاينة وتأثيرات** _(P0؛ custom fields UX)_
  - حوّل `FieldsEditor` إلى محرر جدولي/لوحي يدعم: تعديل الاسم، النوع، الخيارات، المجموعة، required، requiredToSave،
    showWhen، الترتيب، والنسخ duplicate.
  - أضف معاينة حية لنموذج “إضافة مادة” مبنية على الحقول الحالية.
  - _Modifies:_ `TypesPage.jsx`, `features/types/viewModel.js`, `AddVideoPage.jsx`, `DetailPage.jsx`.
  - التحقق: تغيير field type/option/group يظهر فوراً في المعاينة ولا يكسر البيانات القديمة.

- [x] **TYPEUX-3 — تحليل أثر قبل حذف/تعديل النوع أو الحقل** _(P0؛ safe schema changes)_
  - قبل حذف/أرشفة نوع أو حقل، اعرض impact sheet: عدد العناصر المتأثرة، الحقول المملوءة، القيم التي ستصبح يتيمة،
    وخيارات آمنة: أرشفة، دمج، نقل القيم، أو حذف نهائي.
  - أضف rollback/audit واضح لتغييرات بنية الأنواع.
  - _Modifies:_ `TypesPage.jsx`, `stores/slices/archiveSlice.js`, `features/archive/itemHistory.js`.
  - التحقق: لا يمكن حذف field مستخدم بدون تأكيد أثر صريح، ويُسجل audit log قابل للقراءة.

- [x] **TYPEUX-4 — اكتشاف تعارضات الحقول والأسماء مبكراً** _(P1؛ validation)_
  - أضف تحذيرات فورية عند: اسم نوع مكرر، storageKey مكرر، خيارات فارغة، شرط showWhen يشير لحقل محذوف،
    أو تغيير نوع حقل عليه قيم غير متوافقة.
  - اقترح أسماء داخلية safe بالإنجليزية/slug تلقائياً مع قابلية التعديل.
  - _Modifies:_ `features/types/viewModel.js`, `TypesPage.jsx`.
  - التحقق: اختبارات view-model لكل تعارض، ورسائل عربية قصيرة غير مخيفة.

- [x] **ENTITYUX-1 — نافذة إنشاء موحّدة لكل العناصر المخصصة** _(P1؛ create-anything flow)_
  - وحّد تجربة إنشاء: نوع، فرع، حقل، مصطلح، هاشتاق/وسم، مجموعة، مشروع، وعنصر أرشيف عبر `EntityFormModal`
    مع “حفظ”، “حفظ وأنشئ آخر”، و“حفظ وافتح”.
  - افتحها من زر إنشاء عام، لوحة الأوامر، وصفحات الإدارة.
  - _Modifies/Creates:_ `EntityFormModal.jsx`, `QuickAddDialog.jsx`, `CommandPalette`, pages: Types/Vocabulary/Collections/Projects.
  - التحقق: نفس مفاتيح الاختصار ونفس حالات الخطأ/النجاح في كل كيان.

- [x] **VOCABUX-1 — تجربة قاموس ومصطلحات أقوى** _(P1؛ vocabulary management)_
  - حسّن `VocabularyPage`: كشف مكرر، دمج مصطلحين، aliases/مرادفات واضحة، تصنيف سريع، بحث داخل التعريفات،
    واستيراد CSV/Excel بمعاينة قبل الإدخال.
  - أضف “مصطلحات بلا استخدام” و“وسوم بلا مصطلح” كقوائم عمل.
  - _Modifies:_ `VocabularyPage.jsx`, `features/vocabulary/viewModel.js`, data import/export helpers.
  - التحقق: merge يحافظ على العلاقات ويعرض عدد العناصر المتأثرة قبل الحفظ.

- [x] **TAGUX-1 — مدير هاشتاقات ووسوم يومي** _(P1؛ hashtags/tags)_
  - أضف سطح إدارة وسوم مستقل أو تبويب داخل القاموس: الوسوم الأكثر استخداماً، غير المستخدمة، المكررة، المقترحة،
    وإجراءات rename/merge/delete مع impact preview.
  - ادعم aliases للوسوم حتى يبحث المستخدم عن مرادف ويصل للوسم الرسمي.
  - _Creates/Modifies:_ `features/archive/TagCloud.jsx`, `VocabularyPage.jsx` أو صفحة `TagsPage`, `relatedItems.js`.
  - التحقق: إعادة تسمية/دمج وسم يحدّث كل العناصر والمجموعات المحفوظة دون فقد.

- [x] **DAILYUX-1 — زر إنشاء سريع عالمي لكل شيء** _(P1؛ daily speed)_
  - طوّر زر الإنشاء/Quick Add ليقدم أوامر: مادة، نوع، حقل، مصطلح، وسم، مجموعة، مشروع، مهمة، تعليق على آخر مادة.
  - الأوامر تتغير حسب الصفحة الحالية وصلاحية المستخدم.
  - _Modifies:_ `QuickAddDialog.jsx`, `RuntimeShellApp.js`, `CommandPalette`, permissions.
  - التحقق: كل أمر يفتح المسار الصحيح، ولا يظهر أمر لا يملك المستخدم صلاحيته.

- [x] **DAILYUX-2 — استئناف العمل الأخير ومسودات آمنة** _(P1؛ continuity)_
  - أضف على Dashboard/PageContextBar شريط “تابع من حيث توقفت”: آخر مواد معدلة، آخر مشروع، مسودات غير محفوظة،
    آخر بحث محفوظ، وآخر نوع/مصطلح تم إنشاؤه.
  - كل نموذج طويل يجب أن يستخدم مسودة محلية آمنة مع زر تجاهل واضح.
  - _Modifies:_ `DashboardPage.jsx`, `PageContextBar.jsx`, `useFormSaveState`, form pages.
  - التحقق: refresh أو navigation لا يفقد مسودة إنشاء نوع/مصطلح/مادة.

- [x] **NOTIFYUX-1 — مركز إشعارات قابل للتنفيذ لا مجرد سجل** _(P0؛ notification center)_
  - حسّن `NotificationDrawer`: تجميع حسب اليوم/الكيان، بحث، فلتر بالمقروء/غير المقروء، وأفعال مباشرة:
    فتح المادة، فتح المشروع، إعادة المحاولة، تحديد فردي كمقروء، أرشفة إشعار.
  - أضف إعدادات هدوء: mute لفئة، مدة الاحتفاظ، وإظهار/إخفاء toast حسب النوع.
  - _Modifies:_ `NotificationDrawer.jsx`, `features/notifications/viewModel.js`, `uiSlice.js`, `SettingsPage.jsx`.
  - التحقق: keyboard + screen reader، وعدم حذف السجل بدون confirm.

- [x] **NOTIFYUX-2 — إشعارات استقرار النظام والصيانة** _(P1؛ operational awareness)_
  - اربط إشعارات واضحة بحالات: فقد الاتصال، عودة الاتصال، فشل مزود AI، فشل FileStore، export انتهى/فشل،
    sync conflict، health degraded.
  - كل إشعار تشغيلي يجب أن يحتوي إجراء مناسباً: إعادة فحص، فتح الإعدادات، فتح السجل، أو نسخ التفاصيل.
  - _Modifies:_ `server-status`, `mediaClient`, `sync`, `NotificationDrawer`, `SettingsPage`.
  - التحقق: لا spam؛ نفس المشكلة لا تنتج إشعاراً جديداً كل poll.

- [x] **STABILITY-1 — طبقة تعافي موحدة للأخطاء اليومية** _(P0؛ system stability)_
  - وحّد `reportError`, `showToast`, و`SaveIndicator` في نمط واحد: رسالة مفهومة، سبب مختصر، إجراء تعافي،
    ونسخ تفاصيل تقنية عند الحاجة.
  - طبّقها على الحفظ، الاستيراد، التصدير، إعدادات الخادم، AI، FileStore، وأنواع المحتوى.
  - _Modifies:_ `utils/errorReporting.js`, `stores/slices/uiSlice.js`, major forms/pages.
  - التحقق: كل catch في الصفحات الحرجة يمر عبر reportError أو سبب موثق.

- [x] **STABILITY-2 — حماية من النقر المكرر والعمليات الطويلة** _(P1؛ reliability UX)_
  - أضف guards موحدة لمنع double-submit، إظهار progress للعمليات الطويلة، وزر إلغاء حيث يمكن: import/export,
    media jobs, save type, save settings, transcribe.
  - _Creates/Modifies:_ reusable `useAsyncAction` أو توسيع `useFormSaveState`, pages with long actions.
  - التحقق: نقر زر الحفظ 5 مرات لا ينشئ 5 كيانات، والزر يوضح busy state.

- [x] **STABILITY-3 — صفحة صحة النظام اليومية للمستخدم العادي والمدير** _(P2؛ confidence)_
  - اجمع مؤشرات الصحة في سطح واحد: التخزين، قاعدة البيانات، FileStore، AI، التزامن، آخر نسخة احتياطية،
    مساحة/حجم البيانات، وآخر أخطاء.
  - المستخدم العادي يرى حالة مبسطة، والمدير يرى التفاصيل والإجراءات.
  - _Modifies:_ `DataCenterPage.jsx`, `SettingsPage.jsx`, `ServerStatusBadge`, `SyncLogPage.jsx`.
  - التحقق: لا تكشف أسراراً، وكل حالة لها نص عربي وفعل واضح.

- [x] **CM-UX1 — بوابة البحث العميق داخل التفريغ** _(P0؛ منتج/بحث)_
  - ابنِ تجربة بحث مخصصة تشبه قوة `DeepSearchPortal`: بحث في العنوان/الملاحظات/الوسوم/التفريغ، فلاتر مركبة
    (النوع، التصنيف، حالة التفريغ، المدة، تاريخ الأرشفة)، واستعلامات محفوظة.
  - النتائج تعرض مقتطفات التفريغ المطابقة مع timecode واضح؛ النقر يفتح المادة ويقفز للمقطع نفسه.
  - استخدم `timestampLinks.js` والبيانات الحقيقية الموجودة، ولا تعتمد على مدد/أحجام مولدة وهمياً.
  - التحقق: view-model نقي لاستخراج المقتطفات، فلاتر البحث، وحفظ/استدعاء saved views.

- [x] **CM-UX2 — مشغل تفريغ متزامن داخل صفحة المادة** _(P0؛ مونتاج/مراجعة)_
  - أضف وضع “مشغل + نص متزامن” مستوحى من `SmartSyncPlayerModal`: فيديو/صوت بجانب قائمة تفريغ، السطر النشط
    يتبع `currentTime`، بحث داخل التفريغ، تمييز المطابقات، auto-scroll، وقفز مباشر عند النقر على السطر.
  - اربطه بنتائج CM-UX1 وبإشاراتنا المرجعية الحالية حتى لا تتكرر مفاهيم الوقت في أكثر من مكان.
  - التحقق: parse segments، تحديد السطر النشط، seek، واختصارات التشغيل/التقديم/التأخير.

- [x] **CM-UX3 — @mentions ووسوم/قاموس بإكمال ذكي** _(P1؛ تعاون/توصيف)_
  - حسّن التعليقات وحقول الوسوم بإكمال تلقائي عند `@` أو كتابة وسم: مستخدمون، مصطلحات القاموس، وسوم متكررة،
    ومرادفات.
  - عند ذكر مستخدم في تعليق أو مهمة مشروع، أنشئ إشعار mention واضحاً ضمن مركز الإشعارات الحالي.
  - التحقق: tokenizer للإشارات، ترتيب الاقتراحات، وعدم إنشاء إشعارات مكررة عند تعديل التعليق.

- [x] **CM-UX4 — جولة تشغيل موجّهة حسب دور المستخدم** _(P1؛ onboarding)_
  - طوّر `V1ProductTour` إلى مسارات عملية: ربط مخزن الملفات، رفع/فهرسة، تفريغ، توصيف، مشروع مونتاج،
    مشاركة/تصدير.
  - اجعل الجولة قابلة لإعادة التشغيل من Help، ومربوطة بإصدار tour حتى تظهر عند تغييرات كبيرة.
  - التحقق: view-model لقرار الظهور، حفظ حالة الإكمال/التخطي، وفحص RTL على الموبايل.

- [x] **CM-UX5 — تقارير جودة وإنتاجية أقوى** _(P1؛ إدارة/حوكمة)_
  - وسّع Reports بمؤشرات مباشرة: اكتمال التوصيف، تغطية التفريغ، إجمالي زمن المواد، النشاط الزمني، إنتاجية المستخدمين
    من audit logs، وتوزيع أنواع الملفات.
  - أضف أزرار تصدير CSV/Excel للوحة التقارير نفسها مع UTF-8 BOM للعربية.
  - التحقق: حسابات view-model، تصدير CSV عربي، وحالات عدم وجود بيانات.

- [x] **CM-UX6 — مركز بيانات بمخرجات تحرير جاهزة** _(P1؛ Data Center/NLE)_
  - حسّن Data Center بمسارات تصدير واضحة: Excel متعدد الأوراق، CSV مبسط، NLE JSON/EDL مبني على rough cuts
    والمشاريع، مع progress وchecksum ورسائل نجاح قابلة للفهم.
  - لا تكرر وظائف التصدير الحالية؛ اجمعها في presets مفهومة للمحرر ومدير الأرشيف.
  - التحقق: workbook sheets، JSON schema للمونتاج، وعدم كسر الاستيراد الحالي.

- [x] **CM-UX7 — مساعد قاموس ومرادفات للتوصيف** _(P2؛ taxonomy/search)_
  - استثمر فكرة `dictionary_terms.synonyms`: اقتراح وسوم مرادفة، تحذير من مصطلحات متقاربة/مكررة،
    واستخراج مرشحات من التفريغ بنمط regex آمن.
  - أظهر “فجوات توصيف” قابلة للنقر: مادة بلا تصنيف، تفريغ بلا وسوم، ووسوم بلا مصطلح قاموسي.
  - التحقق: normalizer عربي/لاتيني، ترتيب المرادفات، وحالات التعارض.

- [x] **CM-UX8 — إجراءات أرشفة سريعة دون فقد السياق** _(P2؛ سرعة تشغيل)_
  - أضف من نتائج البحث/المعاينة: إضافة لمجموعة، إضافة لمشروع، وسم سريع، فتح التفريغ المتزامن، ومعالجة جماعية
    للحقول الأساسية.
  - الهدف: ما يفعله المستخدم كثيراً يجب أن يتم من نفس الشاشة دون الانتقال لصفحة التفاصيل إلا عند الحاجة.
  - التحقق: صلاحيات الأزرار، bulk selection، وحالات الفشل الجزئي.

- [x] **CM-UX9 — نقل قصة المنتج لا معمارية CLOUD-MediaDB** _(P2؛ وثائق/حماية قرار معماري)_
  - حدّث Help/README/STATUS بنبرة أوضح: “محطة عمل أرشيف إعلامي” تربط البحث، التفريغ، المونتاج، والمشاركة.
  - ممنوع نقل `server.ts` الأحادي أو SQLite داخل المستودع أو Firestore كمسار معماري؛ مشروعنا أقوى بالمنافذ
    و`archive-server`.
  - التحقق: وثائق تشير صراحة إلى أن CLOUD-MediaDB مرجع UX/product، وليس مرجع بنية.

---

## Later

- [x] **Sub-project 3 — أوفلاين-أولاً: مرآة محلية + طابور كتابة + مزامنة/حل تعارض** — المواصفة جاهزة:
  `docs/superpowers/specs/2026-06-05-offline-first-sync-design.md`.
  يعتمد على M1–M4 (كشف الاتصال). المحلي يصبح مرآة لـ SQL؛ الكتابات تُطابَر أوفلاين وتُزامَن عند العودة مع حل التعارضات.

---

## Done

- [x] **M-FF1..M-FF5 — مجموعة أدوات وسائط ffmpeg** — أضيفت نواة `mediaPlan/runMedia`
  للخادم، نقاط `/api/media/*` المتزامنة، طابور `media_jobs` للتحويل/المونتاج،
  عميل `mediaClient` للواجهة، أدوات تفاصيل المادة، توليد تلقائي بعد الرفع، إجراء
  جماعي في الأرشيف، لوحة «مهام الوسائط»، وتنظيف النواتج المشتقة عند الحذف النهائي.
  التحقق: `archive-server npm run verify`, `archive app npm run verify`,
  `build:spa`, `build:cloud`, `test:a11y`، وفحص Playwright بصري.

- [x] **P0 — Dropbox داخل الواجهة: الاتصال واختيار المخزن النشط** — أُضيفت بطاقة
  `مخزن الملفات` في الصيانة، endpoint آمن `/api/files/status` يعرض حالة FileStore
  ويفحص `list("")` بدون كشف الأسرار، وadmin config يحفظ `disk/dropbox` مع
  `rootPath/accessToken` في `server-config.json` ويطبّقه عند إعادة تشغيل الخادم.
  الواجهة تميّز بين المخزن النشط الآن والإعداد المحفوظ بعد restart. تم التحقق عبر
  `verify-api`, `verify-files-dropbox`, `verify-server-config`, `verify-admin-config`,
  `verify-modules`, و`build:spa/build:cloud`.

- [x] **P0 — Dropbox داخل الواجهة: متصفح ملفات حي** — تحولت `UploaderPage` إلى
  متصفح FileStore يعرض كل النتائج لا preview محدود فقط، مع بحث، تصنيف حسب النوع،
  thumbnails للصور، فتح عبر `/api/files/url?key=...`، حذف، ورفع إلى مجلد محدد.
  تم تحديث `cloud-files.getUrl` لاستخدام الرابط المؤقت بدل تنزيل blob لكل فتح.
  التحقق: `verify-modules`, `verify-api`, و`build:spa/build:cloud`. فحص Playwright
  فتح shell محليًا بدون أخطاء page-level جديدة، لكنه توقف عند onboarding/login بسبب
  تهيئة أول تشغيل في بيئة الفحص.

- [x] **P1 — طبقة تعاون حول الملف: تعليقات ومناقشة** — أضيفت تعليقات لكل مادة في
  `DetailPage`، مع إضافة/حذف حسب الصلاحيات: صاحب التعليق يستطيع حذفه، وeditor/admin
  يستطيعان حذف أي تعليق. تُخزّن التعليقات كسجلات `audit_logs` من نوع `comment.create`
  مع soft delete، لذلك تدخل في snapshot والتصدير/الاستيراد الحالي بدون schema جديد.
  التحقق: `comments view model`, `store action smoke tests`, `verify-modules`,
  و`build:spa/build:cloud`.

- [x] **P1 — مهام مشاريع Kanban مرتبطة بالمواد** — أضيف نموذج مهام داخل المشروع
  بحالات `todo / doing / review / done`، وربط اختياري بمادة أرشيفية، وإسناد اختياري
  لمستخدم، ولوحة Kanban داخل `ProjectsPage`. تحفظ المهام داخل record المشروع نفسه،
  لذلك تعمل عبر التخزين المحلي والسحابي الحالي. التحقق: `projects — kanban tasks`,
  `verify-modules`, و`build:spa/build:cloud`.

- [x] **P1 — صلاحيات حقول دقيقة Field-level ACL** — أضيف نموذج ACL لكل مادة/حقل
  مع ضوابط admin في `DetailPage` للوسوم والملاحظات والحقول المخصصة، وإخفاء القراءة
  عن المستخدمين غير المصرح لهم مع رسالة حجب. تطبق المشاركة العامة الفلترة على JSON
  نفسه قبل الإخراج، لذلك لا تعتمد على الواجهة فقط. التحقق: `field ACL view model`,
  `verify-share`, `verify-modules`, و`build:spa/build:cloud`.

- [x] **P2 — OAuth وDropbox team/select-user** — أضيفت طبقة OAuth لـDropbox مع
  route لبدء الربط وcallback يحفظ refresh token server-side، ودعم
  `Dropbox-API-Select-User` و`Dropbox-API-Select-Admin` في adapter وواجهة إعدادات
  مخزن الملفات. التحقق: `verify-dropbox-oauth`, `verify-files-dropbox`,
  `verify-server-config`, `verify-admin-config`, `verify-modules`, و`build:cloud`.

- [x] **P2 — مركز إشعارات إنتاجي** — أضيف view model للإشعارات مع فئات
  `mention/comment/task/share/export`، وحالة مقروء/غير مقروء، وbadge غير مقروء
  في Sidebar، وربط الأحداث العملية: تعليق، مهمة مشروع، مشاركة، وتصدير. التحقق:
  `notifications view model`, `store action smoke tests`, `verify-modules`, و`build:spa`.

- [x] **P2 — تحسين المشاركة العامة** — صار رابط المشاركة يحمل عنواناً وانتهاء صلاحية
  قابلاً للضبط من الإعدادات، وتعرض صفحة `SharedView` العنوان وموعد الانتهاء ونطاق
  المشاركة، مع استمرار فلترة ACL قبل إخراج JSON العام. التحقق: `verify-share`,
  `share client`, `verify-modules`, و`build:cloud`.

- [x] **P2 — AI Workbench للملف الواحد** — تحولت مساعدة AI إلى سطح `AI Workbench`
  داخل نماذج المادة، يوضح إجراءات التلخيص والوسوم والتدقيق وهدف كل إجراء، ويخفي
  أزرار الملاحظات/الوسوم حسب صلاحيات الحقول. التحقق: `ai assist — workbench action
  descriptors`, `verify-modules`, و`build:cloud`.

- [x] **P2 — دليل تشغيل full-stack مع AI وملفات سحابية** — أضيف
  `docs/FULL_STACK_RUNBOOK.md` وربطه من `README.md`، ويغطي Postgres/auth/FileStore
  وDropbox OAuth وAI والتفريغ ومسار رفع مادة وتشغيلها. التحقق: مراجعة الملف ضمن
  التحقق النهائي.

- [x] **P0 — إعادة صياغة قصة المنتج والوثائق العامة** — تم تحديث `README.md`
  و`docs/STATUS.md` بنبرة منصة أرشيف إعلامي ذكية، مع إبراز السحابة وAI والمونتاج
  وFileStore المتعدد بدل وصف التطبيق كمشغّل فيديو بسيط.

- [x] **مسح CLOUD-MediaDB وتحديد الفجوات المتبقية** — تبيّن أن مشروعنا أقوى معماريًا،
  لكن `CLOUD-MediaDB` ما زال أفضل في وضوح قصة المنتج وتجربة Dropbox والتعاون المباشر.
