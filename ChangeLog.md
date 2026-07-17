# سجل التغييرات — Archive Suite (مهام مُنجَزة)

> **هذا الملف أرشيف المنجزات المعتمدة.** نُقلت إليه تفاصيل البنود المكتملة من `TASKS.md` في 17 يوليو 2026، ويبقى `TASKS.md` مخصصًا لما لم يكتمل فقط.
> أُعيد تسميته من `TASKS.md` بعد إنجاز جميع بنوده. للموجة الجديدة (مُستخرَجة من تقارير P4) راجع [`TASKS.md`](TASKS.md).
>
> **المصدر الأصلي:** 9 تقارير فحص (HTML) في `D:\archiveaq\Reports`.
> **المنهجية:** كل بند هنا تم التحقق منه مقابل الكود الفعلي وقت التنفيذ. البنود المُسقطة (مُنفّذة قبل التقرير أو غير دقيقة) موثّقة في [القسم 8 (ملحق)](#8-ملحق--بنود-أُسقطت-مُنفّذة-بالفعل-أو-غير-دقيقة-في-التقارير).
> **آخر تحديث (كأرشيف):** 17 يوليو 2026.

## أرشفة سجل البنود المكتملة من TASKS — 2026-07-17

> تُحفظ التفاصيل الموسعة للبنود التي تملك قسمًا مستقلًا أدناه كما هي. يجمع هذا القسم البنود التي كانت سجلاتها الوحيدة في `TASKS.md` قبل تنظيفه، حتى تبقى المعرفات ونتيجة التنفيذ قابلة للتتبع.

- **تخطيط UX/الاعتمادية:** أُغلقت شرائح UX 5–9 (الأرشيف والبحث، التنظيم والجودة، مراجعة الوسائط والتعاون، المشاركة والإدارة، والتحقق النهائي). كما أُنجز عقد رموز الأخطاء الثابتة وإزالة اقتران sentinel-string في `ba927be`؛ يعتمد العرض الآن على رمز خطأ مستقر مع تعقيم أخطاء الإنتاج.
- **V1-000، V1-001، V1-002:** مراجعة cutover وإزالة الإرث، قفل نطاق المسارات عبر `RouteScopeTest`، وعقد الإصدار/الرخصة `v1.0.0-rc.1` وسياسة SemVer.
- **V1-101، V1-103، V1-104، V1-111، V1-122:** إغلاق مانعات الأمن والاستعادة: حراس المدير وcookies الآمنة، مسار refresh وOrigin/throttle، أسرار المشاركة، احتواء وظائف الوسائط، واستعادة غير مدمرة مع checksum.
- **V1-201، V1-203، V1-209، V1-212A:** إصلاح Control Center، ترحيلات آمنة مع نسخة احتياطية، Docker profiles، ومصفوفة توافق وصفية مرتبطة بعقد المنصات.
- **V1-210A..C وV1-211A..C وV1-212B:** حزم وadapters Native لويندوز ولينكس وخدمات البيانات، مع harness قبول موحد؛ لا يعني ذلك دعم منصة معلنًا قبل دليل clean-host في V1-210D/V1-211D.
- **V1-302، V1-303A، V1-304A..C:** حماية آخر مدير، بوابة axe عامة أولية، pagination/sync الصحيح، pagination لقواعد الأتمتة، وcursor كتالوج مركّب متوافق خلفيًا.
- **V1-713، V1-714، V1-715:** استيراد/تصدير القاموس CSV/JSON بمعاملة ذرية، استيراد/تصدير السجلات CSV مع `dryRun`، وتصدير Premiere XML/FCPXML؛ جميعها موثقة بعقود API واختبارات موجهة.
- **V1-748، V1-750، V1-753:** تحديد نطاقي بـShift، قائمة سياقية لبطاقة الأرشيف، وتحرير عنوان سريع بالنقر المزدوج.
- **V1-756، V1-757، V1-759، V1-760، V1-761:** تنبؤ التخزين، كشف تشابه الفيديو، مفاتيح API وwebhooks الموقعة، صحة الطوابير، وأعلام الميزات؛ اكتملت باختبارات Laravel/TypeScript الموجهة.
- **V1-778، V1-779:** مؤشرات حالة لا تعتمد على اللون وشريط إجراءات sticky بنمط RTL في نماذج السجل الطويلة.

## V1-768 — تفعيل التحقق الفوري لكل حقل في محرر الأنواع — 2026-07-17

- فحوصات الحفظ في `TypesEditor` (معرّف/اسم النوع، اسم كل حقل، تكرار الأسماء، اكتمال العرض المشروط) استُخرجت إلى دوال نقية مُعاد استخدامها في التحقق الفوري عند `onBlur` وفي فحص الحفظ الإجمالي معًا، فلا يوجد منطق مكرر. الأخطاء تُعرض عبر مكوّن `FieldError` الموجود مسبقًا (كان غير مُستخدَم لكل حقل) بعد لمس الحقل فقط، والحفظ الفاشل يلمس كل الحقول دفعة واحدة فتظهر كل الأخطاء معًا.

## V1-716 — إفلات ملفات مباشرة في أي مكان بصفحة الأرشيف — 2026-07-17

- معالجات سحب/إفلات على حاوية `/archive` الجذرية (تتفاعل فقط مع سحب ملفات نظام حقيقي عبر فحص `dataTransfer.types.includes("Files")`، فلا تتصادم مع أي تفاعل سحب داخلي مستقبلي على البطاقات)؛ كل ملف مُفلَت يُرفع عبر `archiveApi.uploadFile` الموجود ثم يُسجَّل عبر `bulkRecords`، مع تراكب بصري أثناء السحب وتوست نجاح/فشل وإعادة تحميل القائمة عند النجاح.

## V1-774 — مسار تنقّل هرمي كامل (Breadcrumb) — 2026-07-17

- مكوّن `Breadcrumb` جديد يُركَّب في `AppHeader` ويبني المسار (الرئيسية ← القسم النشط ← الرابط النشط) من حالة التنقل الموجودة أصلاً؛ خاصية جديدة `breadcrumbExtra` في `AppShell` تسمح لصفحة تفاصيل السجل بإلحاق عنوان السجل المفتوح كعنصر أخير غير قابل للنقر.

## V1-738 — تحذير عند مغادرة صفحة بها تغييرات غير محفوظة — 2026-07-17

- hook جديد `lib/use-unsaved-changes-guard.ts` يضبط مستمع `beforeunload` الأصلي للمتصفح (بلا رسالة مخصّصة، لأن المتصفحات الحديثة تتجاهلها لأسباب أمنية)، مُطبّق على نموذج تحرير توصيف السجل (`RecordDescribeForm`) عبر مقارنة الحقول الحالية بقيم السجل المحمّل. النطاق مقصور على هذا النموذج فقط؛ نماذج أخرى (محرر الأنواع، الإعدادات) مرشحة لمتابعة لاحقة بنفس الـhook.

## V1-749 — لوحة اختصارات "؟" سياقية — 2026-07-17

- اختصار جديد `shortcutsHelp` (Shift+?) مُضاف إلى `lib/keyboard-shortcuts.ts` بنفس نظام الاختصارات القابلة للتخصيص المستخدم لـ`commandPalette`.
- مكوّن جديد `ShortcutsOverlay` يعرض جميع مخرجات `getAllShortcuts()`/`formatShortcutDisplay()` داخل `Dialog` موجود مسبقًا؛ يتجاهل الضغط أثناء التركيز على حقل إدخال/نص/contenteditable، ويُغلق بـEscape. مُركّب في `AppShell` إلى جانب الطبقات العامة الأخرى.

## V1-775 — استعادة موضع التمرير عند الرجوع من السجل للقائمة — 2026-07-17

- `WorkspacePositionRestorer` كان يحفظ موضع التمرير فقط عند حدث `pagehide`، الذي لا يُطلق عند التنقّل من جانب العميل في Next.js (فقط عند إغلاق التبويب أو إعادة تحميل حقيقية)، فكان الانتقال قائمة ← سجل ← رجوع لا يستعيد الموضع.
- أُضيف مستمع `scroll` مقيّد بـ`requestAnimationFrame` يحفظ الموضع في `localStorage` باستمرار أثناء التمرير على `/archive`، إلى جانب `pagehide` الموجود؛ فيبقى آخر موضع محفوظًا وقت مغادرة الصفحة إلى تفاصيل السجل ويُستعاد عند العودة.

## V1-725 — تنبيه إنجاز المهام الطويلة في الخلفية — 2026-07-17

- `getNewCompletionNotifications` في `archive-next/lib/use-notifications.ts` تقارن كل استطلاع (poll) بالسابق لاكتشاف إشعارات `ingest_complete`/`backup_result`/`restore_result` الجديدة فقط (لا `share_event`)، وتُطلق `Notification` المتصفح (بعد إذن صريح عبر زر "تفعيل تنبيهات المتصفح" الجديد في `NotificationsPanel`) ووميض عنوان التبويب فقط عندما يكون غير مركَّز.
- **الصوت أُسقط عمداً**: لا يوجد نمط أو أصل صوتي موجود مسبقاً في المشروع، والعبارة "و/أو" في نص التذكرة تسمح بذلك.

## V1-782 — وضع تباين عالٍ (High Contrast) — 2026-07-17

- preset جديد `high-contrast` (خلفية سوداء #000000، نص أبيض، لون تمييز أصفر #FFD60A) في `THEME_PRESETS` بـ`lib/themes.ts`؛ يظهر تلقائيًا في `AppearanceSettings` لأن شبكة الأنماط مبنية بالكامل على البيانات، بلا أي تعديل إضافي على منطق العرض أو `getPreferredThemeMode`.

## V1-707 — معاينة سريعة (Hover Preview) لنتيجة البحث — 2026-07-17 (منجز مسبقًا)

- تحقق من الكود الفعلي وُجد أن `app/search/page.tsx` ينفّذ المعاينة عند التمرير منذ `9320d3d` (إعادة تصميم مساحة عمل البحث): `onMouseEnter` يضبط `previewId`، وشريط `record-preview-rail` يعرض العنوان والوصف والمخزن والنوع والوسوم دون فتح السجل. البند بقي مفتوحًا في `TASKS.md` لأن التنفيذ الأصلي لم يُربط بمعرّف V1-707.

## V1-777 — تبديل كثافة العرض (مريح/مضغوط) — 2026-07-17

- زر `DensityToggle` جديد في `AppHeader` يضبط `data-density` على جذر `AppShell`؛ خلايا `DataTable` وبطاقات السجلات/الملفات/نتائج البحث تقرأ التباعد من متغيرات CSS (`--density-cell-padding`, `--density-card-padding`) فتتغير المسافات فقط دون أي إعادة تنفيذ للتخطيط. التفضيل محفوظ عبر `persisted-view-state.ts` الموجود مسبقًا (`lib/density.ts`).

## Persisted sort/filter/view state per user — 2026-07-16

- أُضيف `lib/persisted-view-state.ts` (localStorage بمفتاح userId+الصفحة) وطُبّق على فرز `/archive` وفلاتر/عرض `/search`؛ روابط URL تبقى لها الأولوية (V1-752). التخزين على الخادم لكل مستخدم خارج النطاق.

## ContextualTips coverage extended — 2026-07-16

- وُسّعت `lib/contextual-tips.ts` بـ 43 مفتاح صفحة جديد ونصوص عربية مقابلة، ورُبطت 43 صفحة عبر `tipsPage` على `AppShell` (V1-781)؛ لم تُربط `archive/[id]` لتعارضها مع جلسة أخرى متزامنة.

## Compatible runtime refresh — 2026-07-15

- حُدّث خط التشغيل المتوافق فقط: Node.js من 22.13.0 إلى 22.23.1، وNext.js إلى 16.2.10، وLaravel إلى 13.20.0 مع اعتماداته المقيدة، مع إبقاء العقود ضمن Node 22 وNext 16 وLaravel 13.
- جُدّدت pins صور PostgreSQL 17/pgvector وPostgreSQL 17 Alpine إلى digests ثابتة، وشملت Compose وKubernetes ووصف الإصدار والحزمة غير المتصلة.
- أصلح اختبار قابلية إعادة الإنتاج مرجعًا متقادمًا بعد انتقال `runPnpm` إلى وحدة operations؛ صار يتحقق من نقطة التنفيذ الحقيقية دون تغيير سلوك التطبيق.
- التحقق تحت Node 22.23.1: `pnpm typecheck` و`pnpm build:next` و`pnpm verify:api-contracts` و`pnpm docker:config` و`pnpm verify:infra` و`pnpm verify:laravel-next` ناجحة.

## V1-301A — تقدم onboarding خادمي موحد — 2026-07-15

- تقدم أول الاستخدام أصبح حقيقة تشغيلية مشتركة للمؤسسة بدلاً من حالة متصفح: المراحل الخمس الثابتة تحفظ في صف `storage_rows` مخصص، وتعيد كل مرحلة الحالة `pending` أو `completed` وطابع `completedAt` أو `null`.
- `GET /onboarding/progress` متاح لكل مستخدم مصادَق، بينما `PATCH /onboarding/progress/{stage}` محصور بالـadmin؛ المرحلة أو الحالة غير المعروفة ترفض بـ422، وإعادة المرحلة إلى pending تمسح طابع الإكمال.
- عقد OpenAPI وعميل TypeScript يعرّفان `OnboardingProgress` و`OnboardingStage` وعمليتي القراءة والتحديث. لم تُربط واجهة `/first-run` بعد؛ هذا نطاق V1-301B، وتبقى رحلة المدير الحية V1-301C.
- التحقق: RED مؤكّد (404 قبل إضافة المورد)، ثم `OnboardingProgressApiTest` 3/3 (23 assertions)، و`RouteScopeTest` 8/8، و`pnpm verify:api-contracts`، و`pnpm typecheck`، و`pnpm build:next` ناجحة.

## V1-301B — واجهة أول تشغيل مستأنفة — 2026-07-15

- أصبحت `/first-run` تقرأ الحالة الموحدة للمؤسسة من `GET /onboarding/progress` بعد المصادقة، فتظهر المراحل نفسها بعد تسجيل الدخول مجددًا أو على جهاز آخر. الضيف يحصل على دعوة دخول صريحة، وحالات التحميل والفشل تملك رسالة عربية وزر إعادة محاولة.
- خطوات المؤسسة الخمس تعرض الآن أفعالًا تنفيذية حقيقية (الإعدادات، المستخدمون، الرفع، البحث). الـadmin وحده يملك زر تبديل المرحلة؛ الواجهة لا تغيّر الإكمال محلياً، بل تنتظر نتيجة `PATCH` الناجحة. editor وviewer يشاهدان التقدم فقط.
- بقي اختيار مسار setup السريع/المتقدم وتخطي المراجعة الخبيرة تفضيلات محلية، لأنهما لا يمثلان إنجاز المؤسسة. V1-301C يبقى مسؤولاً عن إثبات المراحل تلقائيًا في رحلة admin حية.

## V1-301C — رحلة admin حية لتقدم أول تشغيل — 2026-07-15

- أضيف اختبار Playwright حي يسجل مديرًا عبر الواجهة، يحاكي فشل حفظ مرحلة المؤسسة، ثم يعيد المحاولة ويكمل المراحل الخمس بالترتيب ويتحقق من بقائها بعد reload وإعادة الدخول.
- تمرر صفحة `/first-run` access token للجلسة إلى قراءة/تحديث التقدم؛ فلا يعتمد عميل الصفحة المستقل على refresh cookie المقيد بمسار `/auth/refresh`.
- أصبح bootstrap الجلسة يطلب refresh صريحًا ويحتفظ بالـaccess token، مع تسلسل refresh المتزامن ومنع رد bootstrap متأخر من محو جلسة تسجيل دخول ناجحة.
- أصبح مشغّل التحقق الحي يقبل `ARCHIVE_E2E_SPECS` لتشغيل سيناريو محدد، ويضيف origin العشوائي لخادم Next إلى allowlist Laravel أثناء الاختبار.
- التحقق: RED مؤكد لوحدة mapping ولربط الصفحة، ثم Vitest 8/8، `pnpm typecheck`، و`pnpm build:next` ناجحة.

## V1-701 / V1-702 / V1-704 — إثراء السجل والتفريغ — 2026-07-15

- **V1-701:** أضيف `descriptorCompletion` محسوب خادميًا من العنوان والوصف والنوع والوسوم، بثلاث حالات صريحة (مكتمل/يحتاج استكمالًا/ناقص). لا يمكن للعميل تزوير النتيجة؛ العقد وبطاقة الأرشيف يعرضانها بنص ورمز، لا باللون فقط.
- **V1-702:** أصبح مخطط النوع يدعم `condition: { field, equals }` اختياريًا. الخادم يرفض المرجع الذاتي والحقل غير الموجود والقيم غير الصالحة، والمحرر العربي يستبعد الحقل ذاته ويزيل الشرط عند إيقافه. صلاحيات الحقول السابقة بقيت كما هي.
- **V1-704:** استيراد SRT/VTT من مشغّل الوسائط يحفظ التفريغ عبر `PATCH /records/{id}/transcript` عندما يكون المشغّل مرتبطًا بسجل. التحديث مقيد بالمحرر، مقفل داخل معاملة، ويحفظ حقل التفريغ فقط؛ تشغيل ملف بلا `recordId` يظل معاينة لا تعدّل أي سجل.
- التحقق المشترك: اختبارات Laravel الموجهة، `pnpm verify:api-contracts`، `pnpm typecheck`، و`pnpm build:next` نجحت لكل ميزة. تحذير إصدار Node المحلي (24 خارج نطاق العقد 22) بقي تحذيرًا فقط.

## V1-706 — لغة البحث المتقدمة — 2026-07-15

- يدعم البحث الآن صيغة اختيارية مثل `type:video AND tag:"تاريخ شفهي"`، مع الحقول `title` و`description` و`type` و`subtype` و`tag` و`store` و`status` و`uid`.
- الأولوية ثابتة: `NOT` ثم `AND` (بما فيه الربط الضمني) ثم `OR`. القيم المقتبسة تسمح بالمسافات، بينما الأقواس غير مدعومة عمدًا في هذا النطاق.
- الصيغة المتقدمة غير الصحيحة، الحقول المجهولة، العوامل المعلقة، الاقتباس غير المغلق، أو تجاوز 128 رمزًا تعيد 422؛ البحث النصي العادي يحتفظ بمساره السابق ولا يُقيد بهذا الحد. مسار DSL لا يستخدم البحث الدلالي/المتجهي، وتبقى فلاتر URL متصلة به بمنطق AND.
- واجهة البحث تعرض مثالًا عربيًا مرتبطًا بحقل الإدخال عبر `aria-describedby`. التحقق: `SearchApiTest` 8/8 (67 assertion)، API contracts، typecheck والبناء، ومراجعة مستقلة بعد إصلاح enum `SearchFacets.mode`.

## V1-708 — فرق بصري لتاريخ السجل — 2026-07-15

- تحديث سجل واحد عبر `/records/bulk` يسجل الآن، عند النجاح فقط، حقولًا عليا متغيرة في `metadata.diff.before` و`metadata.diff.after`. لا تغير القراءة والأحداث الأخرى سلوكها، والسجلات القديمة تظل صالحة.
- المفاتيح الحساسة مستبعدة كليًا من لقطات الفرق؛ يبقى payload التدقيق العام خاضعًا للتنقيح القائم (`[redacted]`).
- صفحة السجل تعرض جدولًا عربيًا قابلًا للوصول للحقل والقيمة السابقة والقيمة الجديدة، مع الحفاظ على شارات الحقول وpayload المنقح كبديل عندما لا تتوفر لقطتان.
- التحقق: `RecordHistoryApiTest` 5/5 (32 assertion)، API contracts، typecheck والبناء، ومراجعة مستقلة للأمن والتوافق.

## V1-767 / V1-771 / V1-780 — Shared UI infrastructure — 2026-07-15

- **Skeleton (B39):** one `components/ui/Skeleton.tsx` applied to 31 call sites across 28 files. The dominant wrapper `<div className="panel panel-compact" role="status" aria-live="polite">` already carried a live region, so nesting Skeleton (which owns `role="status"`/`aria-live`/`aria-busy`) inside would double-announce; the wrapper ARIA was stripped wherever a Skeleton took over, verified with zero surviving nested live regions. Bars are `aria-hidden`, only the visually-hidden `label` is announced, and the CSS-only shimmer stops under `prefers-reduced-motion`. Deliberately skipped: 5 `state-banner` sites with real explanatory copy a skeleton would delete, 2 sites passing loading text as a prop value rather than a rendered placeholder, an `EmptyState` `title` prop, 3 inline `helper-text` hints, and a readiness *check* status that is not a load.
- **useMediaQuery (B46):** `lib/use-media-query.ts` built on `useSyncExternalStore` — the correct React 19 primitive for subscribing to an external store — with an SSR-safe `() => false` server snapshot. Only 2 hand-rolled `matchMedia` sites existed; both sat inside lazy `useState` initializers feeding **user-settable** view state wired to `DataViewSwitcher` and saved views, so subscribing them reactively would override the user's choice on any resize — a behavior regression. The module therefore exports both `useMediaQuery` (reactive; consumed by `RouteProgress` for reduced-motion, so not dead code) and `matchesMediaQuery` (one-shot imperative read, same SSR guard) for those initializers.
- **RouteProgress (B62):** uses the already-present `motion` dependency, mounts in `AppProviders`, and is `aria-hidden` with no role or live region — page changes are already announced via the title, so announcing every navigation would be constant chatter. `usePathname` only updates *after* navigation commits, so a pathname-triggered bar would appear once loading is already done; it instead starts on capture-phase clicks of genuine in-app links (rejecting external origins, `target=_blank`, `download`, modified clicks, and same-page anchors) and clears on pathname settle, with an 8s failsafe so a cancelled navigation cannot strand it. Progress is approximate — App Router exposes no global load fraction; `useLinkStatus` is the noted upgrade path.
- Verification: Next suite **152 passing** (baseline 133, +19: 7 media-query, 6 skeleton, 6 route-progress) after confirmed REDs; `pnpm typecheck` clean; `pnpm build:next` compiles.

## V1-731 (B07) — Independent trash with restore — 2026-07-15

- New `TrashController`, `trashed_records` table, `archive-next/app/trash` page, and a scheduled `trash:prune` command. `RecordsController::bulkDelete` now moves rows to the trash instead of destroying them.
- **Why not native SoftDeletes:** records are not an Eloquent entity. They live in a generic `storage_rows` table (composite PK `[store, uid]`, schemaless JSON `data`) read through ~45 raw `DB::table('storage_rows')` call sites across search, sync, discover, public catalog, backups, embeddings, ingest, and ACL. `SoftDeletes` only filters queries routed through the model, so a `deleted_at` column would leave trashed records visible to every one of those readers unless each grew a `whereNull` — a large blast radius and a correctness bug the moment one was missed. Instead, delete moves the row out of `storage_rows` (every existing reader stays correct with zero edits) and restore re-inserts the original payload, `sync_version`, and timestamps verbatim. The reasoning is recorded in the migration docblock.
- **RBAC:** `GET /trash` is any authenticated user (a read, like `GET /records`). `POST /trash/restore` is `requireEditor` — restoring re-creates content, the same `manage-content` write that deleted it, so the role that deleted it can undo it without an admin. `POST /trash/purge` is `requireAdmin`: it is the only irreversible step, and editors keep bulk-delete precisely because it is now recoverable.
- **Retention:** `trash:prune` runs daily alongside the four V1-123 commands, with `TRASH_RETENTION_DAYS` defaulting to 30 — a bin is an undo window, not an archive; the row is already out of `storage_rows` and backups are the long-term recovery story. Deliberately shorter than audit (365, compliance trail) and media (90).
- **Two non-obvious behaviors:** restore is refused with `reason: "conflict"` if a record with the same uid went live while the old one sat in the trash, rather than clobbering live data — and the trash entry survives. Deleting the same uid twice replaces the trash entry (unique on `store,uid`) rather than erroring or accumulating. Both tested.
- Verification: `TrashApiTest` 12/12 (116 assertions) after a confirmed RED; full Laravel suite **599 passing**, 0 failing (baseline was 587); `verify:api-contracts` ok; `typecheck` clean.
- Out of scope, documented: restore/purge auditing is inherited from middleware via the routes' registration in `RouteScopeTest::FIXTURE` as the audited `V1` group (no V1 controller hand-rolls `AuditLog::`); bulk restore/purge UI (the API accepts `ids[]`, the page drives one row at a time); trash search uses `LIKE` over uid and raw JSON rather than the FTS index, because the schemaless store has no title column to index — marked with a `ponytail:` comment naming the upgrade path.

## V1-208L follow-up — Install preflight wired into the live path — 2026-07-15

- The preflight module added earlier existed but nothing called it. `createDockerRuntimeAdapter` now accepts an injected `preflight` that runs before any manifest write or Compose call; a failing verdict returns `{ok:false, supported:true, ...verdict}` without touching Compose, and records `failedStep: "host-preflight"` with the verdict's nextActions in the manifest. Preflight is opt-in, so adapters injecting none behave exactly as before.
- `infra/platform/compatibility.v1.json` gained an explicit machine-readable `diskBytes` per resource profile, and the schema now **requires** it so it cannot silently go missing. The prose `disk` string stays for humans; a test fails if the two drift.
- New `requiredDiskBytes(contract, {runtimeProfiles, capabilities})` in `platform-contract.mjs` derives the gate from the contract rather than a hardcoded number. It takes the **max**, not the sum: the contract states each profile's disk as a whole-host recommendation (core=100GiB, media=250GiB), so running both needs 250GiB, not 350GiB. `core` is always included — an empty selection must never resolve to zero and let any disk pass. An unknown id is rejected instead of silently lowering the requirement; `edge` is allowed through as a known profile that declares no storage of its own.
- `createHostProbes` supplies the real probes: `statfsSync` using **`bavail`, not `bfree`** (bfree counts root-reserved blocks the installer cannot write, overstating free space on Linux), and a `spawnSync` docker check with `shell:false`. A spawn failure counts as missing, never as present. Both stay injected so tests never touch the host.
- `install-preflight.run()` is now synchronous. It was declared `async` but performed no awaits, while `compose()`, the manifest store, and every `install()` caller are synchronous (`assert.deepEqual(adapter.install(), …)`); making install a promise would have broken them all. Existing `await run()` call sites remain valid.
- `control-center.mjs` builds the preflight from the contract via `hostPreflightFor(configuration)` and propagates a preflight verdict's own stable code instead of collapsing it into the generic `INSTALL_FAILED`, which would have hidden the actionable reason. The non-zero exit and secret redaction are inherited from `renderSetupResult`.
- Verification: Control Center + contract suites 212/212 (was 200); `node --check` and `git diff --check` clean; `pnpm verify:infra` passes (it is **not** blocked locally, contrary to an earlier note). Driven against the real host: contract resolves 100/250/500 GiB for core / core+media / core+ai, real `statfs` reports 759 GiB free, docker is detected present, an absent binary is reported missing, and the live verdict is `PREFLIGHT_PASSED`.

## V1-208L — Lifecycle failure matrix — 2026-07-15

- Inventory found seven of the nine required scenarios already covered with stable codes by their owning modules (checksum/signature in `release-descriptor.mjs`, port in `access-mode.mjs`, mid-install/resume in `installation-manifest.mjs`, DB/Redis in `data-probes.mjs`, restore/update/rollback in `update-release.mjs` and `rollback-release.mjs`). The disk and missing-dependency scenarios had **no implementation at all** — no `DISK_*` or `DEPENDENCY_*` code existed anywhere in the repo.
- New `scripts/control-center/install-preflight.mjs` (injected probes; tests never touch the real host) adds four stable codes: `INSUFFICIENT_DISK_SPACE` (reports the exact shortfall), `DISK_FULL` (its own code, never conflated with a shortfall), `DEPENDENCY_MISSING` (names what is absent), and `DISK_PROBE_FAILED` — **fail-closed**: an unreadable probe stops the install rather than assuming space, and the raw probe error is deliberately swallowed because it carries real host paths. Both checks always run, so one report lists every blocker instead of surfacing them one retry at a time.
- `lifecycle-failures.test.mjs` is the matrix: a `{scenario, module, code}` registry covering all twelve entries, a gate that fails when a listed code disappears from the implementation (rename/removal can no longer leave a scenario silently uncovered), and a second gate guarding the `driven` escape hatch so it can only be claimed for codes a live test really asserts. Runtime-composed codes (`data-probes` builds `${BACKEND}_UNAVAILABLE`, so the literal never appears in source) are proven by execution instead of a source scan. Driven scenarios also assert credential redaction: a postgres/redis driver error carrying a password in its URL must not reach the operator result.
- The gate was mutation-tested (renaming `DISK_FULL` in the source turns it red; restoring turns it green), so it is not rubber-stamping.
- Verification: full Control Center suite 200/200 (was 182); `node --check` and `git diff --check` clean. Out of scope, documented: wiring `install-preflight` into the live `install` path in `runtime-adapter` — the module exists and is tested, but the live call needs a per-profile `requiredBytes` decision from the resources contract. No claim is made here that a live install yet checks disk space.

## V1-304D — Montage projects added to the API contract — 2026-07-15

- `docs/api/archive-contract.openapi.json` now documents `/montage-projects` (GET/POST) and `/montage-projects/{id}` (GET/PUT/DELETE) with five schemas: `MontageProject`, `MontageProjectsResponse`, `MontageProjectResponse`, `CreateMontageProjectRequest`, and `UpdateMontageProjectRequest`.
- The contract describes reality, verified against three sources: `routes/api.php` (update is `PUT`, not PATCH), `MontageProjectsController::payload()` (actual fields including ISO `createdAt`/`updatedAt`; the list response reuses the shared `PaginationMeta` because `index()` returns exactly `{total, page, limit, hasMore}`), and the real client `archive-next/lib/montage.ts` — which calls `fetch` directly rather than going through `archive-api.ts`, reads `data.projects`/`data.project`, and picks POST for new projects and PUT for existing ones.
- The documented 403 on writes is real, backed by `requireEditor` in store/update/destroy (from V1-102F). `tracks`, `clips`, `markers`, `comments`, and `transitions` are documented as open-shaped object arrays because the server stores them as-is without structural validation — recording actual behavior rather than asserting an unenforced shape.
- Verification: `pnpm verify:api-contracts` clean; `MontageProjectsApiTest` 13/13 (67 assertions).

## V1-306A — Accessible dialogs replace native browser dialogs — 2026-07-15

- `archive-next/components/ui/ConfirmDialog.tsx` adds `ConfirmDialogProvider` and `useConfirmDialog()`, exposing promise-based `confirm`, `prompt`, and `alert` that preserve native semantics exactly (`false`/`null` on cancel or dismiss). They build on the existing Radix `Dialog`/`DialogContent`, inheriting focus trap, Escape handling, and ARIA wiring rather than reimplementing them.
- Initial focus is set explicitly via `onOpenAutoFocus`: the input for `prompt`, and the **safe** action (Cancel) for `confirm`. Destructive calls pass `destructive: true`, which colors the confirm button as a danger action while focus stays on Cancel, so Enter never triggers a destructive default.
- The provider mounts in `components/AppProviders.tsx` under the root `app/layout.tsx`, covering every route. 17 call sites across 11 files were converted (archive, archive/[id], automation, collections, errors, projects, search, shares, shares/with-me, transcriber, types, ShortcutsSettings). Every message now states the action's impact instead of a bare confirmation, and Arabic copy stays consistent with the surrounding pages.
- Verification: grep proves zero `window.confirm`/`prompt`/`alert` remain in application code; 11 new `ConfirmDialog` tests cover resolved values, cancel, dismiss, and the out-of-provider throw; full Next suite 133/133; `pnpm typecheck` clean; `pnpm build:next` succeeds. Closes backlog item B40.

## V1-406 — Release-blocking task gate — 2026-07-14

- `scripts/verify-release-readiness.mjs` now enforces the full V1 plan, not just historical P0s. A new `tasks-v1-blockers` check fails the gate while any unchecked `**V1-` item remains in `TASKS.md` (optional `V1-X` capability verifications and the B backlog never block). Enforcement applies only in release mode — a `v*` tag pointing at HEAD (the trigger for `release.yml`) or `READINESS_RELEASE=1`; regular CI pushes print a warning with the open-blocker count instead of going permanently red while the declared decision is NO-GO.
- A new `platform-support-evidence` check rejects any platform in `infra/platform/compatibility.v1.json` claiming `status: "supported"` without an `evidence` reference. Planned/conditional platforms block nothing (disabled features stay free), but promoting a support claim now requires recorded proof, backing the V1-212C gate.
- TDD: 5 new tests (blocker failure, V1-X/B exemption, CI warning mode, evidence rejection and acceptance); full suite `node --test scripts/verify-release-readiness.test.mjs` 13/13. Live run against the repo confirms 41 open blockers → warning + exit 0 in CI mode, hard failure in release mode.

## V1-208I — Atomic artifact release update — 2026-07-14

- `setup update` now follows the Docker release lifecycle: immutable-descriptor preflight, legal full backup, verified online pull or offline bundle load, `archive:migrate-safe`, switch, deep health, and an anonymous/authenticated access-boundary smoke check. Development mode retains its separate source rebuild path.
- A failed switch, health check, or smoke check stops the unsafe target containers and automatically recreates the pinned previous release. The manifest keeps the active release until success, records the attempted target while an update is in progress, and stores a complete safe previous-release reference after success; images are never pruned.
- Manifest read/write failures now return the redacted `UPDATE_MANIFEST_IO_FAILED` result envelope, including JSON mode, rather than rejecting with a raw filesystem error. Existing manifests without a pinned prior-release reference fail closed before an update.
- TDD coverage includes switch/health/smoke restoration, ordered health-then-smoke gating, target/previous reference recording, and begin/step/fail/complete manifest I/O failures. Final Control Center suite: 139 passing, 0 failing; `node --check` and `git diff --check` pass.
- Review hardening: any manifest write failure after the target has switched now restores the pinned prior release before returning `UPDATE_MANIFEST_IO_FAILED`. Role smoke now requires both a real anonymous denial and an authenticated `/auth/me` acceptance using `ARCHIVE_UPDATE_SMOKE_TOKEN`, which is process-only and never persisted, rendered, or included in diagnostics.

## Setup wizard flexible choices and explicit confirmation — 2026-07-14

- The interactive Setup wizard now explains optional runtime profiles and capabilities in English, including why each option exists, its resource or exposure impact, and how to enter it. It accepts exact names, option numbers, declared aliases (such as `tls` for `edge`), and comma/`+`/`;`/`|` separators; `all` and `none` are explicit choices. Unknown input is rejected and re-prompted rather than guessed.
- `core` remains enabled automatically. The wizard never adds `edge` implicitly: selecting public access without an explicit `edge` selection is still rejected by the shared configuration resolver before any write or Docker operation.
- The summary now requires the literal word `confirm` before provisioning. `back` restarts the questions without changes and `q` cancels. An empty response is not a confirmation, preventing accidental duplicate or automatic installation.
- TDD evidence: parser tests cover normalization, aliases, numeric selection, `all`/`none`, duplicates, and unknown input; controlled wizard tests cover English help plus confirmation/back/quit behavior. Focused Control Center and parser tests pass locally.
- Review hardening: the profile contract now exposes `1) core` as already enabled, `2) media` (also `ocr`), and `3) edge` (also `tls`/`public`), so displayed numbers and accepted input cannot drift. Unknown values are replaced by `[REDACTED_INPUT]` before terminal display, preventing pasted credential URLs from leaking. Resolver-invalid interactive choices return to the questions without writes, and the heading is now `Your setup summary`.
- Re-review hardening: Setup now routes the real `.env`/Docker provisioning callback through one injectable confirmation flow. Controlled tests prove `back` and `q` perform no `.env` or Docker calls, while literal `confirm` invokes the callback once. The same tests assert `1` keeps implicit core un-duplicated and `all` resolves to core, media, and edge.

## Setup interactive menu result acknowledgement — 2026-07-14

- Interactive Setup now keeps each completed operation's result visible until the operator presses Enter to return to the main menu or `q` to exit. Invalid acknowledgement input repeats only that acknowledgement prompt, and each selected handler runs exactly once.
- Menu shortcut validation rejects duplicate selectable shortcuts before an operation can run. Named commands and `--json` remain prompt-free; stdin without a named command now fails clearly instead of opening the menu, keeping piped and non-TTY execution automation-safe.

## V1-208O — لغة إنجليزية إلزامية لمخرجات Setup — مكتمل 2026-07-14

- قرار مستخدم صريح: العربية في نصوص Setup التفاعلية (wizard prompts + ملخص الاختيارات، منذ V1-208F) تظهر mojibake في ترميزات Windows terminal الشائعة. تُرجمت `WIZARD_RUNTIME_PROMPTS` بالكامل (`scripts/control-center/setup-wizard.mjs`) ونصوص `guidedSetup()` (الأسئلة، السجل، ملخص الاختيارات، رسائل الرفض/الإلغاء) في `scripts/control-center.mjs` إلى الإنجليزية دون أي تغيير منطقي أو بنيوي.
- اختبار `control-center.test.mjs` (كان يفرض وجود شرح عربي في كل prompt) عُكس ليفرض غياب نطاق الأحرف العربية (`؀-ۿ`) بدلاً من ذلك، بتعليق يوثق السبب (mojibake) لمنع رجوع مستقبلي عن غير قصد.
- هذا قرار سياسة عامة لكل مخرجات Setup التفاعلية المستقبلية (لا استثناء لهذا التغيير فقط) — أي نص جديد يُضاف لـwizard/CLI يجب أن يبقى إنجليزيًا.
- التحقق: `node --test scripts/control-center.test.mjs scripts/control-center/*.test.mjs` ‏95/95، `node --check` على الملفين المعدَّلين.

## V1-208H — النسخ والاستعادة القانونية في Setup — مكتمل 2026-07-14

- استُبدل `pg_dump`/`psql` الخام في `scripts/control-center/operations.mjs` (backupNow/listBackups/restoreBackup) بأربعة أوامر artisan جديدة (`archive:backup-run|list|verify|restore`) تُغلّف `BackupService` الموجودة أصلاً (DB+files+manifest+sha256 كاملة)، عبر trait مشترك `EmitsBackupResult` يفرض عقد `{ok, code, message, details}` بسطر JSON واحد فقط على stdout عند `--json` (السرد البشري يمر عبر `$this->components`/stderr، فلا يلوث parsing).
- `archive:backup-restore` يرفض العمل بلا `--force` قبل لمس `BackupService` إطلاقًا (لا أثر جانبي)؛ تأكيد المشغّل التفاعلي يبقى في Setup/Node كما كان. بوابة checksum الموجودة في `BackupService::restore()` (ترفض نسخة تالفة قبل أي تغيير في البيانات الحية) لم تُعدَّل ولا يمكن تجاوزها من المسار الجديد.
- أضيف أمر `setup verify-backup` (CLI + قائمة تفاعلية) يستدعي `archive:backup-verify` دون لمس بيانات حية. جانب Node (`runBackupCommand`) يفشل بأمان (`ok:false`) عند stdout غير صالح أو حاوية غير متاحة، فلا تُقرأ استجابة تالفة كنجاح.
- **تصحيح مراجعة أمنية مستقلة (Opus):** وُسّع catch في `BackupRunCommand`/`BackupRestoreCommand`/`BackupVerifyCommand` ليشمل `Throwable` غير المتوقع (لا `BackupException` فقط) فيُسجَّل عبر `report()` ويُعاد عبر envelope JSON نظيف بدل ترك stack trace خام يصل لـstderr المشغّل. أصبح Node يحذّر صراحة (`output.warn`) عند استعادة نسخة قديمة بلا `.sha256` sidecar تنجح لكن بلا تحقق (`verified:false`) بدل عرض "Restore complete" غير المشروط.
- دليل TDD: `archive-laravel/tests/Feature/BackupCommandsTest.php` (7 اختبارات: run/list/verify سليم وتالف/restore بلا force مرفوض/restore بنسخة مزوَّرة الـchecksum مرفوض مع بقاء البيانات كما هي/استعادة صحيحة تُطبَّق، وتحقق أن `--json` سطر JSON واحد فقط). `scripts/control-center/operations.test.mjs` جديد (13 اختبارًا) + تحديث `scripts/control-center.test.mjs` (ترقيم القائمة بعد إضافة verify-backup، واختبار wiring). التحقق الكامل بعد تصحيح المراجعة: `node --test scripts/control-center.test.mjs scripts/control-center/*.test.mjs` ‏95/95، و`pnpm verify:laravel` ‏585 تمر/0 فشل (2736 تأكيدًا، تحذير واحد قديم واختباران متخطيان معروفان)، و`php -l` نظيف على الملفات الستة الجديدة/المعدَّلة.
- خارج النطاق موثقًا (مهام تالية منفصلة): V1-208I (update ذري)، V1-208J (rollback حقيقي)، V1-208K (uninstall/reconnect-data)، V1-208L (اختبارات فشل دورة الحياة).

## V1-208M — فحوص خدمات البيانات والتخزين — مكتمل 2026-07-14

- أضيفت وحدة مستقلة `scripts/control-center/data-probes.mjs` لعقد probes قابل للتركيب داخل Setup أو adapters المنصات. تتحقق PostgreSQL باستعلام ثابت read-only (`SELECT 1 AS archive_probe`) فقط، فلا تنشئ أو تعدّل بيانات المستخدم.
- يتحقق Redis-compatible والتخزين المحلي أو الخارجي عبر namespace عشوائي منشأ داخلياً: Redis يستعمل مفتاحاً مؤقتاً وstorage يستعمل كائناً مؤقتاً، ثم `delete/remove` داخل النطاق الذي أنشأه probe فقط في النجاح أو الفشل أو timeout. لا تقبل الوحدة namespace مقدماً من المستخدم ولا تلامس أي مسار خارجه.
- النتائج JSON آمنة وثابتة الحقول (`ok/code/message/details/nextActions`)؛ لا تنسخ أخطاء drivers أو URLs/credentials إلى stdout أو manifest أو support bundle. لكل backend timeout وحدود اتصال وإجراء تالٍ مفهوم، والتنظيف best-effort ومحدود بالنطاق نفسه.
- دليل TDD: RED لاختبارات الوحدة الغائبة ثم GREEN. تغطي اختبارات mock نجاح/فشل/timeout والتنظيف لـPostgreSQL وRedis والتخزين، وعدم مسار مستخدم، وتنقية credential URLs وعقد JSON. التحقق: `node --test scripts/control-center/data-probes.test.mjs` ‏7/7، و`node --check` و`git diff --check`; بوابة `pnpm verify:infra` تبقى محجوبة محلياً بإصدار Node/Docker المعروفين.
- **تصحيح مراجعة:** أصبحت كل عملية driver تستقبل `AbortSignal` لتتوقف فوراً عندما يدعمه backend. وإذا تجاهل backend الإلغاء وأكمل write/set متأخراً، تُجدول عملية cleanup ثانية داخل namespace نفسه بعد اكتماله، فلا يبقى object/key يتيمًا. لم يعد فشل cleanup يُبتلع: يعيد `REDIS_CLEANUP_FAILED` أو `STORAGE_CLEANUP_FAILED` بمعاملة JSON آمنة وإجراء يدوي واضح؛ تغطي اختبارات regression الكتابة المتأخرة وفشل cleanup لكل من Redis والتخزين.

## V1-208N — أوضاع الوصول والشهادات — مكتمل 2026-07-14

- أضيفت `scripts/control-center/access-mode.mjs` كوحدة مستقلة عن wizard وبوابة الأوامر: تمرر اختيار الوصول أولًا إلى resolver المعياري في `setup-config.mjs`، فتثبت سياسة العقد (`public` مع `edge` فقط) وصحة mode/platform/profiles/storage قبل تشغيل أي probe أو كتابة.
- تفحص كل عملية switch تعارض المنفذ أولًا؛ ويضيف وضع public فحصي DNS والشهادة بعقد probe صريح. لا يفسر الفحص غير المدعوم أو الفاشل كنجاح ولا يصل إلى Docker أو كتابة الإعداد.
- يخزن `createEnvAccessStore` snapshot داخليًا داخل `WeakMap` خلف token معتم، ويغير `ACCESS_MODE` و`ARCHIVE_COMPOSE_PROFILES` بملف مؤقت ثم rename ذري. بعد health فاشل يعيد snapshot؛ لا تدخل القيم السرية أو محتوى `.env` الخام في النتيجة أو السجل أو API.
- دليل TDD: بدأ اختبار RED باستيراد وحدة غير موجودة، ثم غطى local/intranet/public، تعارض المنفذ، DNS/certificate غير المتاحين، rollback، تعقيم snapshot، ورفض platform/profile/credential-URL غير القانونيين قبل probes/writes. التحقق: `node --test scripts/control-center/access-mode.test.mjs` ‏8/8 و`git diff --check`. لم تُشغّل `pnpm verify:infra` لأنها محجوبة محليًا بإصدار Node/Docker المعروفين.

## V1-208G — بوابة Setup الأساسية — مكتمل 2026-07-14

- أصبحت أوامر Setup الأساسية في وضع `--json` تعيد كائنًا واحدًا وثابت الحقول: `ok`, `code`, `message`, `details`, `nextActions`، مع exit code موافق. لا يُدرج transcript البشري أو مخرجات أدوات فرعية في JSON، فلا يمكنه تسريب credentials أو secrets.
- تظل أوامر `plan` و`import-config` و`export-config` و`install` و`repair` و`wizard` بعقودها المتخصصة القائمة، بينما تستخدم lifecycle (`start/stop/restart/status/health/logs/migrate-status`) إصدار Docker المسجل فقط. لا تنفذ عمليات update/rollback/uninstall غير المدعومة.
- **تصحيح مراجعة:** صار تعقيم URL كاملاً (لا كلمة المرور وحدها) يمر على message/details/nextActions لعقود `plan` و`import-config` و`install` و`repair` و`wizard`؛ تغطي fixtures URL تحمل credential كل هذه المسارات. انتقل `migrate --yes` إلى `releaseMigrateDeploy`: يبني `php artisan archive:migrate-safe` عبر adapter المُنشأ من manifest وإصدار Compose، لا adapter Compose التطويري. اختبار وحدة للأمر الفعلي واختبار wiring يثبتان arguments والمسار.
- أصبح `rotate-secrets --json` و`migrate --json` يتطلبان `--yes`: بلاه يعيدان `CONFIRMATION_REQUIRED` بلا كتابة أو تشغيل. ومعه يتجاوزان prompt فقط وينفذان العملية الفعلية؛ وبذلك لا يُبلّغ JSON عن نجاح إلغاء غير تفاعلي.
- أصبحت diagnostics صامتة عند JSON حتى لا تلوث مخرجات `pnpm verify` الغلاف الآلي. وحزمة الدعم تقبل مسار إخراج مضبوطًا للتشغيل، وتبقى محمية بـACL/0600 في الإنتاج؛ تفشل بأمان وتحذف الملف إن تعذر تثبيت ACL.
- دليل TDD: اختبارات CLI الجديدة بدأت بفشل JSON أمام النص الملون وفشل حزمة الدعم، ثم غطت help/config/lifecycle/doctor/rotate/migrate/diagnostics/support-bundle وunknown command، مع fixtures URL/password/token والتحقق من stdout/stderr والملف. فُصل اختبار محتوى الحزمة المعقم عن ACL Windows الإنتاجي عبر dependency injection، وبقي اختبار ACL الفاشل مغلقًا بأمان. التحقق: 78 اختبار Node مركزًا ناجحًا (Control Center/manifest/release/runtime/observability/platform)، و`node --check` و`git diff --check`. بوابة `pnpm verify:infra` محجوبة محليًا بإصدار Node 24 خارج العقد وصلاحيات Docker/`--env-file` المعروفة.

## V1-208F — واجهة Setup wizard الشاملة — مكتمل 2026-07-14

- صار `setup wizard --config=<file>` المسار غير التفاعلي للمعالج: يستدعي `setup plan` نفسه حرفياً، فينتج العقد والـplan والـcodes نفسها بلا إنشاء `.env` أو manifest أو مسارات بيانات أو استدعاء Docker.
- تستدعي إجابات الواجهة التفاعلية الدالة المشتركة `planInput` في `setup-config.mjs` قبل أي كتابة. تعرض الخيارات المعلنة في العقد بالعربية: Docker/Native والمنصة والمصدر online/offline ونمط الوصول وprofiles (`core` إلزامي و`media`/`edge` اختياريان) وcapabilities والتخزين المحلي، وتوضح أن PostgreSQL وRedis خدمتا البيانات الأساسيتان المفعّلتان تلقائياً. Native يبقى للتخطيط فقط ويرفض التنفيذ قبل الكتابة أو Docker.
- سياسة الوصول صريحة داخل resolver: `public` يتطلب profile `edge` الذي يملك TLS، و`edge` لا يصح مع `local` أو`intranet`. ترفض الأوامر المخالفة بالكودين الثابتين `PUBLIC_ACCESS_REQUIRES_EDGE` و`EDGE_REQUIRES_PUBLIC_ACCESS` قبل `.env` أو manifest أو Docker.
- بعد قبول الخطة لا يستدعي المعالج مسار Compose التطويري؛ يجهز `.env` ثم يمرر الاختيار المعياري إلى `install` الخاص بإصدار Docker الموقّع. يبقى `wizard` القديم بلا config متوافقاً مع وضع التطوير الصريح فقط.
- دليل TDD: اختبارات RED لمسار `wizard --config` الغائب ولدالة resolver المباشرة، ثم GREEN. أضيف تصحيح مراجعة باختبار controlled-prompt يستدعي طبقة إجابات wizard ويطابق ناتج resolver، وحالات رفض الوصول قبل الكتابة. التحقق: `node --test scripts/control-center.test.mjs` ‏37/37 و`node --check` للوحدات و`git diff --check`.

## V1-208E — Docker release adapter — مكتمل 2026-07-14

- أضيف عقد إصدار مغلق versioned في `infra/platform/release.v1.json` وschema مرافق له. لا يقبل إلا مراجع online بصيغة `image:version@sha256:<digest>`، ويرفض التكرار، غياب خدمات `core`، اختلاف semantic version، والحقول أو القيم الحساسة.
- أضيف `infra/docker-compose.release.yml` لمسار المستخدم: لا يحتوي `build:` ويستخدم مراجع العقد فقط. يمرّر adapter `install` و`repair` إلى `up -d` بلا `--build`، ويظل `--build` محصوراً في adapter تطوير صريح (`buildLocal: true`) ومسار Compose التطويري القديم.
- يراجع مسار offline manifest/checksums والحزمة المغلقة قبل Compose، ويربط كل image محمّلة محلياً بمرجع الإصدار؛ يمرر `pull_policy: never` عند offline. لا يعد بنجاح offline إذا نقصت الحزمة أو اختلف الإصدار/profile/image.
- **تصحيح مراجعة:** تستخدم lifecycle للمستخدم (`start/stop/restart/status/health/logs/exec`) سياق الإصدار من manifest وCompose الإصدار حصراً. توسع Compose الإصدار بالخدمات والبيئة والتخزين والشبكة والمنافذ والاعتمادات القانونية لـcore، مع defaults لا تتطلب متغيرات media/edge. يُحمّل offline archives ويُفحص محلياً قبل Compose.
- **تصحيح مراجعة ثانٍ:** صار inventory الحزمة offline يطابق خدمات `core` السبعة ووثيقة الإصدار immutable (بما فيها fpm/worker/reverb) ولا يضم Caddy أو OCR. يتحقق verifier من `source` immutable المطابق، ويغطي اختبار happy-path حزمة core كاملة ثم load/tag/inspect قبل Compose، إضافة إلى حالات الرفض السابقة. اكتمل أيضاً تعريف Reverb وCaddy في Compose الإصدار ببيئتهما وحجومهما واعتماداتهما اللازمة عند اختيار profile.
- **تصحيح مراجعة ثالث:** rehearsal الـcore صار يثبت HTTP القانوني بدلاً من HTTPS الذي يتطلب edge/Caddy، وevidence يطابق ذلك. ينشئ builder inventory داخل الحزمة من مراجع `NEXT_IMAGE` و`LARAVEL_IMAGE` الموقعة من workflow، ومن مراجع runtime التي يمررها workflow؛ يرفض الغياب أو tag عائم/digest غير صالح قبل `docker pull`.
- **تصحيح مراجعة رابع:** تقبل pipeline مراجع workflow ذات digest فقط (`image@sha256:...`) وتطبعها في inventory/manifest الفعلي. تطبّع Setup offline بادئة `v` في version، وتقبل مراجع التطبيق الموقعة من bundle بعد تحقق checksum/manifest بدلاً من مطابقة placeholder ثابت؛ تبقى مراجع runtime مطابقة للعقد. يغطي اختبار E2E بناء حزمة مزيفة على شكل workflow ثم تحقق Setup وتحميلها محلياً قبل Compose.
- **تصحيح مراجعة خامس:** صارت سياسة tags موحدة: تقبل pipeline مدخل `:vX.Y.Z@digest` وتكتب `:X.Y.Z@digest` في inventory/manifest وbundle refs، مع الإبقاء على manifest version صالحاً للعرض. يمر الاختبار الواحد end-to-end من builder الحقيقي بمداخل workflow ذات `v` إلى `resolveRelease` وload/tag/inspect.
- أُدخلت artifacts الآمنة المستخرجة من عقد الإصدار في manifest القابل للاستئناف، وتبقى `plan` و`import-config` بلا Docker أو كتابة manifest. التحقق: 56 اختبار Node (Control Center/manifest/adapter/release/platform) ناجح، وفحص syntax و`git diff --check`؛ `pnpm verify:infra` محجوب محلياً بإصدار Node/Docker المعروفين.

## V1-208D — installation manifest قابل للاستئناف — مكتمل 2026-07-14

- أضيف schema مغلق `infra/setup/installation-manifest.v1.schema.json` ووحدة `scripts/control-center/installation-manifest.mjs`. يسجل الـmanifest حقولًا معلنة فقط: الإصدار، المصدر، الوضع والمنصة، runtime profiles وcapabilities، digests/checksums المتاحة، الخدمات المملوكة ومسارات البيانات، آخر خطوة ناجحة والإصدار السابق، وحالة install/repair مع إجراءاته التالية.
- الكتابة ذرية عبر ملف مؤقت ثم rename؛ لا تستبدل JSON السابق عند فشل الكتابة. ترفض الوحدة المفاتيح والقيم الحساسة، وURLs أو مسارات بيانات ذات credentials، ولا تعرض الأسرار عند الفشل.
- أضيف `install --config=<file>` و`repair --config=<file>` لمسار Docker المتاح حاليًا؛ يعيدان استخدام manifest الواحد ويحتفظان بـ`previousVersion` و`lastSuccessfulStep` حتى تنجح خطوة جديدة. يبقى `plan` و`import-config` صِرفين بلا manifest أو Docker، ولا تنفذ هذه الشريحة update/rollback/uninstall.
- دليل TDD: RED لوحدة manifest و`repair` غير الموجودين ثم GREEN لإنشاء آمن، رفض secrets، الكتابة الذرية، الاستئناف بعد فشل، repair idempotent، وعدم إنشاء manifest في plan/import. التحقق: `node --test scripts/control-center.test.mjs scripts/control-center/installation-manifest.test.mjs scripts/control-center/runtime-adapter.test.mjs` ‏40/40، و`node --test scripts/platform-contract.test.mjs` ‏4/4، و`node --check` للوحدات، و`git diff --check`.
- **تصحيح مراجعة:** توسّع تنقية مسارات البيانات إلى `key` و`apiKey` و`privateKey` بكل اختلافات الحالة وإلى قيم credentials بلا protocol. صار schema يطابق التنفيذ: artifact يحتاج digest أو checksum، و`dataPaths` غير فارغ ومقيد الأسماء/URLs/credential pairs والقيم الحساسة، والحقول الاختيارية غير فارغة عند وجودها. يحسب `begin` قرار resume قبل كتابة `in-progress`؛ بعد `services-started` لا يعيد adapter تشغيل Compose، بينما يسجل استثناء Compose كفشل ثم يعيد رمي الخطأ الأصلي كي يعرض CLI `INSTALL_FAILED` لا خطأ manifest. التحقق المحدّث: 49/49 في اختبارات Control Center/manifest/adapter/platform.
- **تصحيح مراجعة لاحق:** أضيف قيد `\S` إلى كل الحقول النصية ذات التنفيذ المقابل (version/platform/profiles/capabilities/services/artifact id/digest/checksum/data path values/steps/nextActions)، وإلى أسماء `dataPaths`. بذلك لا تقبل schema قيمة whitespace-only بينما يرفضها التنفيذ بعد `trim`؛ اختبار parity يغطي القيم الصحيحة والفراغات لهذه المسارات.

## V1-208C — schema وخطة تثبيت declarative — مكتمل 2026-07-14

- أُضيف `infra/platform/setup-config.v1.schema.json`، وهو schema إصدار 1.0 مغلق يغطي `mode` و`platform` و`source` و`intent` و`access` وruntime profiles وcapabilities وخدمتي البيانات والتخزين المحلي، فلا يقبل حقول credentials أو keys إضافية.
- أضيفت طبقة `scripts/control-center/setup-config.mjs` التي تتحقق من الإعداد عبر عقد V1-208A الفعلي: `core` إلزامي، ولا يجوز تمرير capability كـruntime profile، ولا profile/capability خارج ما تعلنه المنصة، ولا mode لا يطابق platform. يستعمل `plan` و`import-config` القراءة والتحقق فقط؛ لا `.env` ولا Docker ولا إنشاء مسارات. `export-config` يبني إعدادًا قانونيًا من `.env` ويستبعد كل secret وpassword وtoken وURL حساس.
- أضيفت أوامر Control Center: `plan --config=<file>` للخطة الحتمية الصِرفة، و`import-config --config=<file>` لطباعة الإعداد المعياري فقط، و`export-config` لتصدير الاختيارات الحالية غير السرية. مع `--json` ينتج كل مسار الحقول نفسها تمامًا: `ok`, `code`, `message`, `details`, `nextActions`، ويعود بفشل غير صفري عند رفض الإعداد.
- دليل TDD: بدأت اختبارات CLI كـRED، وفشلت 3 حالات لأن الأوامر كانت غير معروفة/لا تنتج JSON، ثم أصبحت GREEN بعد التنفيذ. تغطي الاختبارات خطة حتمية، عدم إنشاء `.env` تحت PATH فارغ، منع platform/profile غير السليم قبل الكتابة، وغياب تسريب password/URL. التحقق: `node --test scripts/control-center.test.mjs` ‏23/23، و`node --test scripts/platform-contract.test.mjs` ‏4/4، و`node --check` للوحدتين، و`git diff --check`.
- **تصحيح مراجعة:** صار `storage.path` يقبل مسارًا محليًا فقط، ويرفض URL وأي نص يحمل credentials قبل الخطة أو الاستيراد أو التصدير. صار `export-config --json` يلتقط فشل قراءة `.env` (ومن ذلك مسار directory) ويعيد عقد JSON الثابت بلا stack trace. فُصلت اختبارات platform/mode وcapability-as-profile وillegal profile وsource وstorage credentials، مع regression لتصدير storage credential URL؛ التحقق المحدّث: Control Center ‏29/29 وcontract ‏4/4.

## V1-208B — تفكيك Control Center إلى وحدات — مكتمل 2026-07-14

- بقي `scripts/control-center.mjs` نقطة الدخول العامة نفسها للأوامر والقائمة التفاعلية، لكنه أصبح shell تركيبيًا يستدعي وحدات مركزة تحت `scripts/control-center/`: `cli.mjs` لتحليل الأعلام والأمر، `configuration.mjs` لقراءة/كتابة `.env` والنسخ الاحتياطي وإخفاء الأسرار، `docker-compose.mjs` لاكتشاف Compose وتمرير الـprofiles المتحقق منها، و`operations.mjs` لعمليات الخادم والهجرات والنسخ الاحتياطية والتشخيص/التحديث.
- أضيف `runtime-adapter.mjs` بعقد lifecycle موحد: `install`, `start`, `stop`, `restart`, `status`, `health`, `logs`, `exec`, `update`, `rollback`, `uninstall`. Docker adapter يربط العمليات المنفذة بـCompose ويحافظ على السلوك السابق؛ `update` و`rollback` و`uninstall` غير المنفذة في هذا adapter تعيد `{ ok: false, supported: false, operation, reason: "unsupported" }` بلا أمر أو سلوك وهمي. لا يوجد تنفيذ Native في هذه الشريحة.
- حفظ التفكيك قرار V1-208A: `core` افتراضي، و`media` و`edge` اختيار صريح فقط، وcapabilities ليست Compose profiles. أضيف اختبار RED ثم GREEN للعقد والنتائج غير المدعومة، واختبار تركيبي للـentry point، مع بقاء اختبارات CLI عبر العملية الفعلية.
- التحقق: `node --test scripts/control-center.test.mjs scripts/control-center/runtime-adapter.test.mjs` نجح 23/23؛ `node --test scripts/platform-contract.test.mjs` نجح 4/4؛ `node --check` لكل وحدات Control Center و`git diff --check` نجحا. محاولة `pnpm verify:infra` فشلت خارج الكود: Node `v24.15.0` لا يطابق `>=22.13.0 <23`، وDocker لا يستطيع قراءة `C:\Users\LAPTOP PC WORLD\.docker\config.json` ثم يرفض `compose --env-file`. التفاصيل الكاملة في `.superpowers/sdd/v1-208b-report.md`.
- **تصحيح مراجعة لاحق:** نُقلت طبقة CLI/display الفعلية إلى `scripts/control-center/cli.mjs`: الألوان، logging، العناوين والفواصل، banner، menu، وreadline prompt/confirm/close. صار `control-center.mjs` يركب هذه الواجهة ولا ينشئ `readline` أو banner/menu محليًا؛ بقيت الواجهة العامة نفسها. وُسّع اختبار adapter من تسمية العمليات إلى سلوك كل `install/start/stop/restart/status/health/logs/exec`، مع أوامر Compose الدقيقة ونتائج فشل Compose/health، إضافة إلى العمليات غير المدعومة. التحقق المحدّث: Control Center + adapter ‏24/24 وcontract ‏4/4.

## V1-208A — توحيد عقد الخيارات — مكتمل 2026-07-14

- فُصلت خيارات التشغيل القانونية في `infra/platform/compatibility.v1.json` وschema إلى runtime profiles هي `core` و`media` و`edge`، وcapabilities هي `ocr` و`ai` و`observability`. كل منصة تعلن المجموعتين بصورة مستقلة؛ ولا يُعامل أي capability كـDocker Compose profile.
- صار Control Center يبدأ بـ`core` فقط. يتيح Setup اختيار `media` صراحةً لمعالجة الوسائط/OCR الاختيارية ذات العبء الأعلى، و`edge` صراحةً للوصول العام وTLS، ويحفظ الاختيار في `ARCHIVE_COMPOSE_PROFILES`. قيمة shell لهذا المتغير تعلو الإعداد المحفوظ لجلسة واحدة، بينما ترفض البوابة تمرير `ocr` أو `ai` كـprofile.
- أُضيفت بوابة drift في `scripts/platform-contract.mjs`: تتحقق من تطابق أسماء Compose الاختيارية مع العقد ومن أن Setup يحلها من العقد، وتفشل برسالة صريحة عند إدخال capability أو اسم مخالف. دليل TDD: اختبار RED أثبت أن الافتراضي القديم كان `media,edge`، ثم صار GREEN مع `core` فقط؛ و`node --test scripts/platform-contract.test.mjs` نجح 3/3 و`node --test scripts/control-center.test.mjs` نجح 18/18.
- محاولة `pnpm verify:infra` لم تصل إلى تحقق Compose بسبب البيئة المحلية: Node `v24.15.0` خارج العقد `>=22.13.0 <23`، وDocker لا يملك صلاحية قراءة `C:\Users\LAPTOP PC WORLD\.docker\config.json` ولا يتعرف على `compose --env-file`. لا يُخفى ذلك كنجاح؛ تفاصيله في تقرير V1-208A.
- **تصحيح مراجعة لاحق:** schema صار مغلقاً فعلياً (`additionalProperties: false`) مع مفاتيح صريحة فقط لكل من runtime profiles وcapabilities. أزيل فحص النص الهش لمسار Setup؛ بدله اختبار CLI سلوكي يشغّل `status` مع `PATH` فارغ و`ARCHIVE_COMPOSE_PROFILES=ocr` ويثبت أن capability تُرفض قبل أي اكتشاف Docker. صُحح وصف `core` كي لا ينسب Caddy إليه؛ Caddy جزء من `edge`. التحقق المحدّث: contract ‏4/4 وControl Center ‏19/19.

## إصلاح CI/إنتاج: تصادم مفاتيح throttle عبر كل المسارات المحدودة — 2026-07-14

- وظيفة `Live Laravel + Next integration (Playwright)` في CI فشلت باستمرار عبر عدة commits سابقة (غير مرتبطة بجلسة RBAC هذه)، وثلاث محاولات إصلاح على مستوى اختبار Playwright وحده لم تنجح فعليًا رغم خفض عدد نداءات تسجيل الدخول من 10 إلى 6 لكل تشغيل — التشخيص النهائي (بإضافة رسالة خطأ صريحة تطبع status/body الحقيقيين) كشف السبب الجذري الحقيقي: **429 `{"code":"RATE_LIMITED"}` رغم أن تسجيل الدخول نفسه لم يُستدعَ سوى 6 مرات، أقل بكثير من حد `throttle:10,1`.**
- **السبب الجذري الحقيقي (وليس عدد الاستدعاءات)**: توقيع مفتاح Laravel الافتراضي لـ`throttle:X,Y` (`ThrottleRequests::resolveRequestSignature()`) هو `$route->getDomain().'|'.$request->ip()` **فقط** — لا يتضمن مسار الـroute نفسه إطلاقًا، ولا بادئة افتراضية. بالتالي **كل** المسارات الست التي تستخدم `throttle:X,Y` المباشر (`/share/{token}`، `/review-links/{token}`، `/invitations/{token}/accept`، `/upload-links/{token}`، `/auth/login`، `/auth/refresh`) كانت **تتشارك عدّاد rate-limit واحدًا لكل IP**، بصرف النظر عن الحد الأقصى المُعلَن لكل مسار على حدة. في اختبار التكامل الحي، صفحات `accessibility.spec.ts` المتعددة تستدعي `/api/v1/auth/refresh` مرارًا أثناء تصفح الصفحات (SSR) — هذه الاستدعاءات الكثيرة كانت تستنزف العدّاد **المشترك** نفسه الذي يفحصه `/auth/login` (حده 10)، فيصل تسجيل الدخول 429 حتى وإن كان قد استُدعي مرات قليلة فقط. هذا عيب أمان/صحة حقيقي في الإنتاج أيضًا، وليس خاصًا بالاختبار: أي مستخدم يستهلك `/share/{token}` أو `/auth/refresh` بكثافة من نفس IP قد يُحرَم من تسجيل الدخول بلا سبب متعلق بمحاولات دخول فعلية.
- **الإصلاح**: أُضيفت بادئة (`prefix`) مميزة لكل مسار من الستة عبر المعامل الثالث الموجود أصلاً في توقيع middleware الرسمي (`throttle:maxAttempts,decayMinutes,prefix`) — `login`، `refresh`، `share-view`، `review-link-view`، `invitation-accept`، `upload-link-view`. لا تغيير في القيم العددية (10/30 والنافذة الزمنية) — فقط عزل كل مسار بعدّاده الخاص كما كان الحد الأصلي يوحي به ضمنيًا لكنه لم يكن مُطبَّقًا فعليًا.
- محاولات الإصلاح الوسيطة على `next-laravel-integration.spec.ts` (نقل تسجيل الدخول من `beforeEach` إلى `beforeAll` لخفض عدد النداءات، ثم إصلاح استخراج الكوكي عبر `browser.newContext()` بدل `request.newContext()` المستقل) بقيت — وهي تحسينات صحيحة بذاتها (تقلل الضغط على أي rate limiter مستقبلاً)، لكنها لم تكن السبب الجذري الحقيقي؛ رسالة الخطأ التشخيصية المُضافة (`login failed: ${status} ${statusText} — ${body}`) أبقيت أيضًا لأنها تسرّع أي تشخيص مماثل مستقبلاً.
- التحقق: اختبارات throttle الموجودة (`AuthApiTest`، `LoginRateLimitTest`، `ShareApiTest`، `ErrorCodeContractTest`) ‏23 اختبارًا/177 تأكيدًا ناجحة بلا تغيير في التوقعات (الحدود الفردية لكل مسار لم تتغير، فقط عُزلت). `pnpm verify:laravel` الكامل بعد هذا الإصلاح: 578 اختبارًا ناجحًا/2678 تأكيدًا، صفر فشل.

## حماية سعة الرفع (V1-112F) — مكتمل 2026-07-14

- أُضيف `UploadsController::assertCapacityAvailable()`، يُستدعى مباشرة بعد قراءة `$file->getSize()` من الملف المرفوع و**قبل** أي كتابة إلى quarantine — رفض الطلب لا يترك أي أثر على القرص لأن لا شيء يُكتب أصلاً قبل نجاح الفحص.
- فحصان مستقلان: **(1) هامش مساحة حرة آمن** — `ingest.min_free_bytes` (افتراضي 100MB عبر `INGEST_MIN_FREE_BYTES`)؛ رفض `507 insufficient_disk_space` إذا كانت المساحة الحرة على قرص الـingest بعد طرح حجم الرفع أقل من الهامش. **(2) حصة تخزين مؤسسية اختيارية** — `ingest.storage_quota_bytes` (افتراضي `null` = بلا حد، عبر `INGEST_STORAGE_QUOTA_BYTES`)؛ رفض `413 storage_quota_exceeded` إذا تجاوز الاستخدام الحالي + حجم الرفع الحصة المُعلنة.
- **تبسيط متعمد موثق (ponytail)**: تُقاس الحصة كاستخدام قرص volume الـingest بالكامل (`disk_total_space() - disk_free_space()`) لا بعدّاد لكل سجل — لأن هذا النشر أحادي المؤسسة لكل تثبيت (مسار بيانات مخصص واحد لكل مضيف حسب عقد المنصة `infra/platform/compatibility.v1.json`)؛ سقف هذا التبسيط: تثبيت متعدد المؤسسات (multi-tenant حقيقي) يحتاج عدّاد استخدام لكل مؤسسة بدلاً من قياس القرص كاملاً.
- كلا الفحصين يُطبَّقان فقط عندما يكون `filesystems.disks.{disk}.driver` الخاص بقرص الـingest هو `local` — يُتخطَّيان بأمان (لا رفض، لا خطأ) لأي disk بعيد (S3/Azure/GCS/SFTP/FTP)، حيث `disk_free_space()`/`disk_total_space()` لا معنى لهما فيزيائيًا.
- اختبارات جديدة في `UploadsApiTest` تفرض حالتَي الرفض عبر قيم config متطرفة حقيقية بدل mocking دالة PHP العامة `disk_free_space()`: `config(['ingest.min_free_bytes' => PHP_INT_MAX])` يضمن دخول فرع 507 على أي قرص اختبار حقيقي (لا قرص يملك PHP_INT_MAX بايت حر)، و`config(['ingest.storage_quota_bytes' => 1])` يضمن دخول فرع 413 (أي قرص حقيقي يستخدم أكثر من بايت واحد). كلاهما يؤكد عدم بقاء ملف في `quarantine/` وعدم إدراج صف في `storage_rows`. اختبار إيجابي ثالث يؤكد أن القيم الافتراضية (بلا حصة، هامش 100MB) لا تكسر مسار الرفع الطبيعي على بيئة CI/تطوير عادية.
- التحقق المركّز: `UploadsApiTest` كاملاً ‏13 اختبارًا/68 تأكيدًا، صفر فشل. التحقق الشامل بعد تجميع V1-102F+V1-102G+V1-102H+V1-112F هذه الجلسة: `pnpm verify:laravel` بالكامل 578 اختبارًا ناجحًا/2678 تأكيدًا (كان 576 قبل الجلسة)، تحذير قديم واحد واختبارا DB integration متخطيان (معروفان مسبقًا من جلسات سابقة، غير مرتبطين بهذا التغيير).
- خارج النطاق موثقًا: AV/ClamAV حقيقي على الرفع ما زال مؤجلاً (موثق أصلاً في V1-112 الأصلي)؛ فحص السعة هنا وقائي (مساحة/حصة) لا فحص محتوى.

## بوابة route/role مشتركة (V1-102H) — مكتمل 2026-07-14

- أُضيف `RouteScopeTest::ROLE_FIXTURE`: خريطة "METHOD uri" ← admin/editor/any لكل مسار مصادَق عليه تحت `/api/v1` (127 مسارًا)، تستخدم نفس آلية `test_every_registered_v1_route_is_classified` الموجودة أصلاً لتصنيف النطاق (V1/ADMIN/EXPERIMENTAL) — لكن كمحور مستقل عن النطاق، لا امتدادًا له.
- `PUBLIC_ROUTES` (9 مسارات: health، public/openapi.json، public/catalog، share/{token}، review-links/{token}، invitations/{token}/accept، upload-links/{token}، auth/login، auth/refresh) مستبعدة صراحة بقائمة ثابتة، لا باستبطان middleware عبر `gatherMiddleware()` — أبسط وأوثق تدقيقًا من الاعتماد على سلوك Laravel الداخلي لحل الـalias.
- اختباران جديدان يعيدان نفس نمط `test_every_registered_v1_route_is_classified`/`test_fixture_has_no_stale_entries`: `test_every_authenticated_route_has_expected_role_coverage` يفشل عند إضافة route مصادَق عليه بلا تصنيف في `ROLE_FIXTURE` (ولا في `PUBLIC_ROUTES`)، و`test_role_fixture_has_no_stale_entries` يمنع بقاء إدخالات لمسارات حُذفت.
- القيمة `any` (صراحة، لا الغياب) تعني "أي دور مصادَق بما فيه viewer" — توثيق قرار متعمد، وهي الأغلبية (86 من 127) لأن معظم القراءة والعمل على سجلات المستخدم نفسه (media jobs، rights، uploads، إلخ) مصمم كذلك.
- تأكيد عملي أن النطاق (scope) والدور (role) محوران مستقلان كما ينص تصميم 2026-07-14: `system/odbc/*` نطاقه EXPERIMENTAL ودوره admin (بعد V1-102G)، بينما `records/{id}/broadcast-metadata` نطاقه EXPERIMENTAL أيضًا لكن دوره any — لا يمكن اشتقاق أحدهما من الآخر.
- خارج النطاق موثقًا: هذا الاختبار لا يستدعي كل route فعليًا للتحقق من مطابقة سلوكه HTTP الحقيقي (403/200) للقيمة المُعلنة — ذلك يقع على `RoleMatrixApiTest`/`OdbcReadApiTest` للمجموعات المحمية فعليًا؛ الضمانة هنا هي منع إضافة route جديد بلا توقع موثّق على الإطلاق (لا التحقق السلوكي الشامل لكل route قديم).
- التحقق: `RouteScopeTest` كاملاً ‏8 اختبارات/19 تأكيدًا، صفر فشل — بما فيها الاختباران الجديدان يمران من أول تشغيل لأن `ROLE_FIXTURE` بُني مباشرة من نتائج grep حقيقية لكل استدعاء `requireAdmin()`/`requireEditor()` في القاعدة الكودية، لا تخمينًا.

## قصر ODBC على admin (V1-102G) — مكتمل 2026-07-14

- أُضيف `Controller::requireAdmin()` كأول سطر في الدوال الخمس لـ`SystemController`: `odbc()` (probe)، `odbcReadTable()`، `odbcCreateRow()`، `odbcUpdateRow()`، `odbcDeleteRow()`. كانت هذه المسارات محمية فقط بعلَم الميزة `archive.feature:odbc` وبقائمة سماح الجداول (allowlist) داخل `OdbcReadRepository`، بلا أي فحص دور — أي مستخدم مصادَق (حتى viewer) كان يستطيع قراءة/كتابة/حذف صفوف من قاعدة بيانات خارجية عبر ODBC.
- `odbc()` لم تكن تستقبل `Request $request` أصلاً؛ أُضيف كمعامل (لا يغيّر توقيع الاستدعاء من route، Laravel يحقن الاعتماديات بالنوع).
- `tests/Feature/OdbcReadApiTest.php`: كان يستخدم `AuthenticatesArchiveRequests::authHeaders()` المشترك (دور editor افتراضيًا بحكم تعليق الثقة في تلك السمة) لكل اختباراته الاثني عشر — بعد هذا التغيير كانت ستفشل جميعًا بـ403. أُضيفت `adminHeaders()`/`editorHeaders()`/`viewerHeaders()` محليان (نفس نمط `RoleMatrixApiTest`)، واستُبدلت كل استدعاءات `authHeaders()` بـ`adminHeaders()`، وأُضيفت 6 اختبارات رفض جديدة: viewer/editor على probe، read table، وwrite (create+update+delete مجمّعة في اختبار واحد لكل دور).
- `tests/Feature/RouteScopeTest.php::test_odbc_route_is_reachable_when_its_feature_flag_is_on` كان يستخدم نفس `authHeaders()` المشترك (editor) للتحقق من أن المسار يعمل عند تفعيل العلَم — كان سيفشل بـ403 لنفس السبب. أُضيف `adminHeaders()` محلي وأُصلح الاستدعاء.
- التحقق: `OdbcReadApiTest` + `RouteScopeTest` معًا ‏23 اختبارًا ناجحًا/86 تأكيدًا، صفر فشل.
- خارج النطاق موثقًا: V1-X02 (تحقق ODBC حي على DSN/driver فعلي) يبقى تحققًا مشروطًا منفصلًا في `TASKS.md` — هذه المهمة أغلقت الثغرة الأمنية (RBAC) فقط، لا الوظيفة نفسها.
- **تصحيح لاحق (أثناء تحقق V1-112F الشامل):** بحث الملفات وقت V1-102G استخدم نمط تسمية `tests/Feature/*{Vocabulary,Collection,...}*.php` فلم يلتقط `OdbcStatusApiTest.php` (تسمية مختلفة، لا تحمل كلمة "Odbc" في نمط البحث المستخدم). كان يستخدم `authHeaders()` المشترك (editor) رغم أن اسم الاختبار يدّعي "for_authenticated_admin" — لم يُكتشف إلا عند تشغيل `pnpm verify:laravel` الكامل (لا المُصفّى) فكشف فشل 403 بدل 200 المتوقع. أُصلح بنفس نمط `adminHeaders()` المحلي، وأُضيف اختبار `test_odbc_status_is_forbidden_for_non_admin_roles` جديد. الدرس: بحث الملفات بنمط الاسم وحده غير كافٍ لضمان اكتشاف كل التبعيات — `grep` مباشر على السلوك (هنا: `requireAdmin`) أو تشغيل الحزمة الكاملة قبل الإغلاق هو الضامن الفعلي.

## إغلاق بقية مصفوفة RBAC (V1-102F) — مكتمل 2026-07-14

- أُضيف `Controller::requireEditor()` كأول سطر في كل دالة كتابة (POST/PATCH/DELETE) في ثمانية متحكمات كانت مفتوحة لأي دور مصادَق منذ V1-102 الأصلي: `TagNodesController` (store/update/destroy/reorder/merge/move)، `VocabularyController` (store/destroy)، `CollectionsController` (store/destroy)، `RelationsController` (store/update/destroy)، `TypesController` (store/destroy)، `AutomationRulesController` (store/update/destroy/run)، `IngestController` (scan/ftpPull/smbPull)، `UploadLinksController` (store/revoke).
- نقاط القراءة (index/show/graph) بقيت مفتوحة لأي دور مصادَق عمدًا (تصفح الأرشيف لا يحتاج editor)، وكذلك `POST /types/{id}/check-field-acl` — فحص صلاحية حقل للمستخدم الحالي (read semantics رغم فعل POST)، ليس كتابة؛ `TypesControllerTest` القائم يمارسها بدور viewer دون توقع 403.
- ثلاث دوال (`RelationsController::destroy`، `TypesController::destroy`، `UploadLinksController::revoke`) لم تكن تستقبل `Request` أصلاً؛ أُضيف كمعامل أول (Laravel يحقنه عبر type-hint بغض النظر عن الترتيب، معامل المسار `{id}` يبقى مربوطًا بالاسم فقط).
- `RoleMatrixApiTest` أضاف 24 اختبارًا جديدًا: رفض viewer لكل route كتابة في المجموعات الثمانية + دورة حياة editor كاملة لكل مجموعة (إنشاء→تعديل→حذف أو ما يعادلها).
- إصلاح جانبي اكتشفه هذا التغيير: `tests/Feature/Api/V1/TagNodesControllerTest.php` كان ينشئ مستخدم اختبار عبر `User::factory()->create()` بلا `role` (فيرث القيمة الافتراضية `viewer` من المهاجرة) ثم `actingAs()` — كانت ستفشل كل اختبارات الكتابة فيه بـ403 بعد هذا التغيير؛ أُصلح إلى `['role' => 'editor']`.
- التحقق: نطاق مركّز (`RoleMatrixApiTest` + ثمانية ملفات اختبار المتحكمات المتأثرة + `RouteScopeTest`) ‏99 اختبارًا ناجحًا/472 تأكيدًا، صفر فشل.
- خارج النطاق موثقًا: V1-102G (تقييد ODBC على admin) وV1-102H (بوابة CI تربط تصنيف الأدوار تلقائيًا) مهمتان منفصلتان في `TASKS.md`.

## بوابة axe-core للوصولية (V1-401 CI gates، جزء من V1-303) — مكتمل 2026-07-14

- أُضيف `@axe-core/playwright` كتبعية تطوير في `archive-next` (كانت غائبة صراحةً وموثقة كمانع في `.github/workflows/ci.yml` منذ 798be19).
- سبك جديد `archive-next/e2e/accessibility.spec.ts` يفحص 6 مسارات لا تتطلب Laravel حياً أو كوكي مصادقة (`/`, `/login`, `/help`, `/reports`, `/settings`, `/archive`) عند العتبات الثلاث المطلوبة (375/768/1280) مقابل وسمي `wcag2a`/`wcag2aa`، ويفشل عند أي انتهاك `serious`/`critical`. 18 اختبارًا (6 مسارات × 3 عتبات)، جميعها ناجحة مقابل بناء إنتاجي حقيقي (`pnpm run build` ثم `next start`) — تحقق فعلي وليس تشغيلاً جافاً فقط.
- توسيع 2026-07-14: أُضيف `/share/demo-token` و`/media/jobs` إلى قائمة المسارات (مُثبَتان أصلاً في `next-migration-shell.spec.ts` كمسارَين يُرسَمان بلا Laravel حي)، فأصبحت البوابة تغطي 8 مسارات. 48 اختباراً (8 مسارات × 3 عتبات × مشروعَي Playwright chromium/mobile-chrome)، جميعها ناجحة.
- أُدمجت البوابة داخل `scripts/verify-next-laravel-live.mjs` (سطر استدعاء playwright) فتُنفَّذ تلقائيًا ضمن نفس خادم Next الحي الذي تستخدمه وظيفة `live-integration` في CI؛ حُذف تعليق "ponytail" القديم في `ci.yml` الذي كان يوثق التأجيل.
- أُضيف سكربت جذري `e2e:next:a11y` (بنمط `e2e:next`/`e2e:next:integration` الموجودين) للتشغيل المستقل.
- خارج النطاق موثقًا: تغطية المسارات المتبقية (records/media/rights/إلخ) ومراجعة الاستجابة البصرية اليدوية الكاملة للتطبيق — هذه تبقى ضمن V1-303 المفتوح جزئيًا.

## صدق وضع الأوفلاين (V1-305) — مكتمل 2026-07-14

- إزالة ادعاء PWA غير الصحيح من `DEPLOYMENT.md`: لا يوجد `manifest.json` ولا service worker في `archive-next` القانوني (بقيا في `archive-app` القديم المحذوف 2026-07-12)، فالتطبيق لم يعد قابلاً للتثبيت كما وثّق الدليل سابقًا. القرار الافتراضي لـV1 (موثق أصلاً في خطة التنفيذ): توثيق الطابور المحدود بدل بناء PWA كاملة هذا الإصدار.
- وثّق الدليل الحدود الفعلية لطابور التعديلات الحالي (`archive-next/lib/offline-queue.ts` + `offline-manager.ts`): يحفظ عمليات الكتابة في `localStorage` ويعيد تشغيلها عند عودة الاتصال (last-write-wins)، لكن بلا تحميل offline للتطبيق نفسه، ولا تخزين مؤقت للقراءات، ولا عمل في الخلفية خارج تبويب المتصفح المفتوحة. لا تغيير في الكود — التوثيق فقط، تغطية الاختبار الحالية (`offline-queue.test.ts`) كافية لسلوك الطابور نفسه.

## المراقبة المحلية وحزمة الدعم (V1-207) — أُعيد فتحها 2026-07-13 بعد إغلاق أولي

- **تصحيح حالة 2026-07-13:** أُعيد فتح V1-207. التنفيذ واختبارات الوحدة/العقود وLaravel المركزة باقية وموثقة، لكن harness السابق استخدم upstream PHP يحاكي حدّي Next/Laravel ولم يشغّل التطبيقين القانونيين، لذلك لا يثبت correlation end-to-end في الصور الفعلية ولا يصلح دليل إغلاق. الإغلاق معلّق على rehearsal معزول يشغّل صور Next وLaravel القانونية خلف Caddy واعتماداتهما، يثبت المعرّف نفسه في response وسجلات Caddy وNext وLaravel، ثم يثبت cleanup؛ تعذر تشغيله حاليًا بسبب رفض صلاحية Docker بعد بلوغ حد التنفيذ. البنود التاريخية أدناه لم تُمحَ، لكن وصف «مكتملة» أعلاه لم يعد حالة المهمة الحالية؛ المرجع الحالي هو `TASKS.md`.
- إصلاح مراجعة P1 إضافي: يطلب collector سجلات الخدمات structured مع `--no-log-prefix`، ويبقى parser قادرًا على fixture Compose الحقيقي `service | {json}` ويفشل مغلقًا عند event JSON مشوه بدل إرجاع صفر. يسجل Caddy الآن `X-Request-ID` النهائي من response عبر `{http.response.header.X-Request-ID}`، فيحافظ Next/Laravel على validation. اختبارات العقود المركزة نجحت، لكن harness الشبكي الذي استُخدم هنا كان محاكاة وليس E2E للتطبيقين القانونيين؛ لذلك سُحب كدليل إغلاق وحُذف من بوابة الاختبارات.
- إصلاح مراجعة P0/P1: أصبحت حزمة الدعم تفك وتُنقح JSON recursively وتغطي fallback للـquery/percent-encoding والـenv المقتبس/متعدد الأسطر وCLI flags، مع fixtures adversarial تفحص غياب القيم السرية من الـbundle النهائي. أصبحت الصلاحيات enforced ومتحققًا منها: `0600` على POSIX وACL owner-only عبر `icacls` على Windows مع fail-closed وحذف artifact عند الفشل.
- أصبح collector يقرأ JSON array أو JSON-lines من `compose ps --all` ويقارنه بقائمة الخدمات القانونية الصريحة، ويعامل Docker/Redis/log/deep-health failures كـcritical unknown. يجمع عقد readiness واحدًا من probe الـAPI العميق الحالي وprocess health للعامل وReverb، ويعد فقط error events structured ومؤرخة داخل نافذة قابلة للضبط عبر `OBS_*`.
- اكتملت correlation/logging العملية: Caddy يمرر `X-Request-ID`، وNext يتحقق/يولد ويسجل event JSON ويمرر المعرّف، وnginx Laravel يسجل access JSON، وLaravel يربطه بسياق application log والاستجابة. تحقق الإصلاح: focused Node+Control ‏29/29، Laravel ‏6/6، typecheck/security/infra وCompose للملفين، ثم `pnpm verify` كاملًا: reproducibility ‏32/32، Next ‏122/122 مع build، وLaravel ‏529 ناجحًا (2477 assertion)، مع التخطيين والتحذير القديم نفسيهما.
- أضيف تسجيل JSON إلى Laravel web/worker/Reverb عبر stderr وإلى Caddy access logs، مع middleware يمرر `X-Request-ID` الآمن أو يولد UUID ويضيفه إلى سياق السجل والاستجابة. بقي Next ضمن stdout/stderr الملتقط محليًا من Docker دون telemetry خارجية.
- طبقت خدمتا Compose القانونيتان Docker `local` logging على جميع الخدمات بحد دوران 10MB وخمسة ملفات. بقيت probes العميقة الحالية لـDB/Redis/storage بلا تكرار، وتغطي فحوص المشغل حالة الخدمات بما فيها worker/Reverb، عمق Redis queue، ضغط القرص، عمر النسخة/RPO، وتكرار الأخطاء.
- أضيف أمرا Control Center عابرا Windows/Linux: `observability` لفحوص وتنبيهات JSON محلية، و`support-bundle` لحزمة JSON بصلاحية 0600 وallow-list من versions/config/health/logs/manifests. الحزمة محدودة بـ200 سطر و1MB، تنقح الأسرار والاعتمادات والتوكنات والمسارات، ولا تجمع محتوى الأرشيف أو ملفات المستخدم.
- التحقق: observability+Control Center ‏22/22، HealthApiTest ‏5/5، security baseline، infra gate وCompose config للملفين، ثم `pnpm verify` كاملًا: reproducibility ‏32/32، Next ‏122/122 مع build، وLaravel ‏528 ناجحًا (2473 assertion)، تحذير قديم واحد واختبارا DB integration متخطيان. بيئة التشغيل Node 24 أظهرت تحذير engine لأن العقد القانوني Node 22.13.x.

## مفتاح الأولويات

| الوسم | المعنى | الأفق الزمني |
|---|---|---|
| `[P0]` | حرج — يحجب النشر الإنتاجي الآمن | 1–2 أسبوع |
| `[P1]` | عالٍ — مخاطرة أو فجوة وظيفية مهمة | 2–6 أسابيع |
| `[P2]` | متوسط — تحسين جوهري | 1–2 شهر |
| `[P3]` | مستقبلي — توسّع أو تحسين اختياري | 3–6 أشهر |

**تقدير الجهد:** ⏱️S (<يوم) · ⏱️M (1–3 أيام) · ⏱️L (أسبوع) · ⏱️XL (أسابيع).

---

## حزمة التثبيت دون اتصال (V1-206) — مكتملة 2026-07-13

- إصلاح مراجعة P1/P2: أصبح `SHA256SUMS` الأعلى يستخدم basename الحقيقي للـasset القابل للتنزيل، وأصبح verifier داخل الحزمة closed-world يرفض الملفات الزائدة/الناقصة والتكرار ويفرض تطابق IDs والمراجع وarchives وSHA لكل صورة one-to-one مع المخزون. يستدعي مثبتا Windows/Linux هذا verifier قبل أي load، ويوجب الدليل فحص checksum الأعلى قبل الفك ويشرح rollback آمنًا عبر backup/restore متوافق schema بدل تشغيل إصدار أقدم فوق migrations أحدث.
- أصبح أمر `rehearse` نفسه ينفذ load ثم `compose up -d --wait` وHTTPS، ويضمن `finally` متداخلًا يحذف secret env حتى عند فشل `down`، ثم يفحص غياب containers/volumes/networks بالـproject label ويجمع أخطاء التنظيف. evidence المنقح الملتزم في `docs/v1-206-rehearsal-evidence.json` يربط source commit وSHA للـmanifest والـtar النهائي والعدد الدقيق 14 ملفًا/5 صور بالصحة وHTTPS وغياب الموارد، بينما بقيت logs/PID خارج payload المتحقق منه.
- أضيفت حمولة إصدار Docker فقط تحت `infra/offline/`: ملف Compose مرقّم يستخدم tags محلية خاصة بالإصدار مع `pull_policy: never` ولا يحتوي `build`، ومخزون صور آلي يغطي Next وLaravel وpgvector وRedis وCaddy المثبتة. لا تشمل الحزمة OCR غير المنشور ضمن صورتي التطبيق القانونيتين، ولا تدّعي مثبتًا native؛ بقي V1-208 وما بعده مفتوحًا.
- يبني `scripts/offline-bundle.mjs` الحزمة من مراجع تطبيقيّة `image@sha256` متحقق منها وصور runtime المثبتة، ويصدر كل صورة عبر `docker save`، ثم ينشئ `manifest.json` يحصي كل ملف وصورة مع SHA-256 و`SHA256SUMS` مفحوصًا، وأرشيف `tar.gz` مرقّمًا. يرفض مولد البيئة الكتابة فوق ملف موجود، ويولد الأسرار عبر randomness تشفيري ولا يطبع قيمها.
- أضيف مدخلا تثبيت Windows PowerShell وLinux shell يقومان بالتحقق قبل `docker load` ولا يستدعيان registry، مع دليل عربي موجز للتثبيت والتحقق والترقية/الرجوع والإزالة وروابط الوثائق القانونية. حدّث release workflow لبناء الحزمة فقط بعد Cosign signature verification وإرفاقها في GitHub Release وإدراجها ضمن `SHA256SUMS` الأعلى.
- أضيفت 6 اختبارات static لتغطية الحمولة والصور ومنع pull/build وتسرب defaults وربط الإصدار. التحقق: reproducibility 25/25، infra config، release-readiness، Next 122/122 وproduction build وrepo hygiene، وLaravel gate (نجح في الإعادة؛ المحاولة الأولى كشفت test-state عابرًا في اختبارات الوسائط غير المعدلة). البيئة المحلية تستخدم Node 24 وأظهرت تحذير engine لأن العقد القانوني Node 22.13.x، دون فشل.
- بُني artifact فعلي من 5 صور وتحقق من 14 ملفًا/5 صور. حُمّلت archives الخمسة من artifact، ثم شُغّلت الخدمات الثماني عبر مشروع معزول على منافذ معزولة ونجح `compose up -d --wait` وHTTPS المحلي. بعد النجاح حُذفت حاويات وشبكة وvolumes المشروع ذي labels المطابقة فقط، وتحقق عدم بقاء موارده، دون حذف أي صورة مستخدم. لم يُستخدم firewall أو daemon منفصل؛ عدم الاتصال أثناء التثبيت مثبت بـlocal images و`pull_policy: never` ومنع build/pull static.

## سلسلة توريد الإصدار (V1-205) — مكتمل 2026-07-13

- أُكمل توقيع digest الصورتين القانونيتين (Next وLaravel) عبر Cosign keyless وGitHub OIDC داخل release workflow، يتبعه تحقق صريح من signature باستخدام هوية ملف workflow الخاصة بالـtag وissuer الرسمي قبل إنشاء GitHub Release. لم يُنشأ توقيع محلي ولم تُضف مفاتيح أو أسرار خاصة.
- حُفظت attestations الحالية (`sbom: true` و`provenance: mode=max`) وملف `release-images.txt` غير القابل للتعويم، وأضيف ملف SPDX JSON قابل للتنزيل لكل صورة مبني على `image@digest`.
- أضيف inventory إنتاجي منفصل لتبعيات pnpm/Next وComposer/Laravel، مع سياسة تراخيص صريحة تسمح بتراخيص محددة وتفشل عند forbidden أو unknown. البدائل المزدوجة تُقبل فقط إن وُجد مسار ترخيص مسموح، وتعبيرات AND تتطلب قبول كل مكون؛ لا توجد استثناءات حالية.
- يولّد الإصدار `SHA256SUMS` لكل artifact قابل للتنزيل (`release-images.txt` وSBOMs وlicense inventories) ويتحقق منه قبل الإرفاق، ثم يرفق الملفات والmanifest معًا. حُصرت صلاحيات verify في `contents: read` وpublish في `contents/packages/id-token: write` فقط.
- أضيف فحص static مركّز إلى بوابة reproducibility. التحقق: focused 5/5، release-readiness، reproducibility 13/13، inventory policy على تبعيات الإنتاج الحالية، وكل مراحل `pnpm verify` (122 Next + build + hygiene و526 Laravel)؛ احتاج Laravel إلى إعادة تشغيل Docker خارج sandbox بعد منع الوصول إلى إعداد Docker، ونجح. بقي V1-206 مفتوحًا ولم تُنفذ الحزمة غير المتصلة.

## صور إصدار ثابتة وغير قابلة للتعويم (V1-204) — مكتمل 2026-07-13

- إصلاح مراجعة P1: ثُبتت صور pgvector وRedis وCaddy في Compose القانوني بـ`version@sha256` موثقة من registry، وثُبت PostgreSQL وRedis في موارد Kustomize القابلة للتطبيق. حُذفت Deployments القديمة غير القانونية (`archive-server`/`archive-frontend`/worker placeholder) من Kustomize ومن المستودع بدل اختراع digests لصور غير منشورة؛ K8s موثق الآن كمرجع data-services فقط، بينما يبقى Laravel+Next عبر Compose مسار التطبيق القانوني.
- وُسع فحص immutability ليقرأ كل `image:` في ملفي Compose وموارد `kustomization.yaml` الفعلية ويمنع صورة بلا `version@digest` أو مورد تطبيق legacy. تحقق إصلاح المراجعة: 8/8 focused، Compose config للملفين، وinfra verification؛ كما نجحت مراحل Next الكاملة (typecheck و122 اختبارًا وproduction build وrepo hygiene). آخر Laravel كامل موثق قبل إصلاح manifests نجح 526/526؛ محاولة البوابة بعده قوطعت أثناء Laravel بلا فشل ظاهر، ولم يُعد تشغيلها لأن الإصلاح لا يغير PHP.
- ثُبتت صور الأساس القانونية في `archive-next/Dockerfile` و`archive-laravel/Dockerfile.worker` بصيغة مقروءة `tag@sha256` لـNode وPHP وComposer. كشف البناء أن pnpm 11.9 يتطلب Node 22.13، فحُدّث عقد toolchain المتسق من 22.12.0 إلى 22.13.0 وثُبت Corepack 0.31.0 وpnpm 11.9.0 داخل صورة Next.
- أزيل إنتاج `latest` من مساري release والنشر اليدوي. أصبح `release-images.txt` يرفق مرجعي التطبيق بصيغة `image:version@digest`، من دون ادعاء نشر خارجي محلي.
- أضيف smoke للصورتين بعد دفع tag الإصدار: Next عبر HTTP 200 وLaravel عبر boot حقيقي لـArtisan مع production cookie guard. أضيف Trivy للصورتين بسياسة صريحة: يفشل الإصدار على ثغرات `CRITICAL` القابلة للإصلاح (`ignore-unfixed: true`, `exit-code: 1`). بقي signing ضمن V1-205 والحزمة غير المتصلة ضمن V1-206 بلا تغيير.
- أضيف `scripts/verify-immutable-images.test.mjs` إلى بوابة reproducibility لمنع Dockerfile غير مثبت أو `latest` في workflows الإنتاجية، ولتثبيت smoke/scan وmanifest. التحقق: focused tests 6/6؛ بناء صورتي Next وLaravel؛ smoke Next HTTP 200 وLaravel 13.17.0؛ و`pnpm verify` كاملًا (122 اختبار Next و526 اختبار Laravel، بلا فشل؛ تحذير قديم واحد واختبارا قاعدة بيانات متخطيان).

## تشغيل Laravel الإنتاجي عبر nginx وPHP-FPM (V1-202) — مكتمل 2026-07-13

- استُبدل خادم PHP التطويري أحادي العملية بطبقتين من الصورة القانونية نفسها: `laravel` يشغّل nginx ويحافظ على عقد DNS/المنفذ العام `laravel:8000`، و`laravel-fpm` يشغّل PHP-FPM على 9000 داخل شبكة Compose فقط من دون `ports` أو `expose` للمضيف.
- أضيف endpoint صحة عميق يفحص قاعدة البيانات وRedis وقراءة/كتابة التخزين المحلي، ويعيد 503 منظماً عند فشل أي اعتماد. أصبح uptime مستقلاً عن Redis كي يبقى endpoint قابلاً للتشخيص عند تعطل cache، وأضيفت اختبارات نجاح وفشل storage وRedis.
- أضيفت healthchecks ذات معنى لـPHP-FPM والعامل وReverb، وأصبح Next ينتظر صحة Reverb لا مجرد بدء الحاوية. وُحّدت التغييرات في `infra/docker-compose.yml` و`infra/docker-compose.laravel-next.yml` مع إبقاء حل localhost الحالي في الملف الافتراضي (Caddy `DOMAIN=localhost` و`ACME_EMAIL` fallback) دون تغيير.
- عُدلت صلاحيات `storage` و`bootstrap/cache` إلى `www-data` داخل الصورة؛ كشف smoke الأول أن FPM لا يستطيع كتابة health artifact، ثم أثبتت إعادة البناء نجاح nginx→FPM واستجابة 200 مع `db/redis/storage=true`. أكد `docker port` عدم نشر 9000، ونجح `nginx -t`.
- التحقق: Compose config للملفين؛ بناء `archive-laravel/Dockerfile.worker`؛ smoke مع حاويتي nginx/FPM مؤقتتين؛ اختبارات الصحة والعقد 5/5 (43 assertion)؛ و`pnpm verify` كاملًا: 19 ملف/122 اختبار Next، Next production build، و526 اختبار Laravel (2468 assertion) بلا فشل. بقي تحذير قديم واحد `mkdir(): File exists` واختبارَا تكامل MySQL/PostgreSQL متخطيين لغياب الإعداد، وهما غير ناجمين عن V1-202.

## إصلاح بوابة الأمن في Git worktree — مكتمل 2026-07-12

## توافق المنصات المقيد V1-005a — مكتمل 2026-07-12

- أضيف عقد JSON قابل للقراءة آلياً لمنصات Docker على Windows 10/11 وLinux (conditional) ولمسارات Native على Windows وLinux (planned فقط)، مع schema وprofiles والمنافذ ومسارات البيانات والموارد المؤقتة.
- أصبح `control doctor --mode=docker|native` و`control doctor --platform=<id>` يعرضان العقد وفحصاً read-only؛ Native يصرح بأنه مخطط فقط ولا ينفذ تثبيتاً أو بدء خدمات.

- [x] **مسار safe.directory محلي** — أصبحت بوابة security baseline تثق فقط في مسار الـcheckout الحالي لكل استدعاء Git، فتعمل من clone عادي أو linked worktree من دون إعداد global.

## إزالة الحزم legacy النهائية (Phase B) — مكتملة 2026-07-12

- [x] **Phase A (سابقة، commit a53b666)** — نُقلت الأصول القانونية (Docker compose/deploy) إلى `infra/` ومواصفات Next e2e إلى `archive-next/e2e`، تمهيداً لحذف الحزم legacy بأمان.
- [x] **حذف ثلاث حزم legacy كاملة (~760MB)** — `git rm -r` على `archive-app/` (Vite SPA)، `archive-server/` (خادم Node/Prisma؛ أصوله القانونية منقولة سلفاً إلى `infra/`)، و`archive-core/` (مكتبة مشتركة تحقق أنها كانت تُستهلك حصراً من archive-app وarchive-server؛ archive-next لا يعتمد عليها). أُزيلت أيضاً بقايا غير متتبَّعة (node_modules، ملفات .env). الحزم متاحة عبر تاريخ git عند الحاجة.
- [x] **مسح اتساق شامل** — `pnpm-workspace.yaml` أصبح يضم `archive-next` فقط (وallowBuilds أصبح esbuild+sharp فقط بعد تحقق `pnpm why`)؛ حُذفت أوامر package.json الخاصة بـ legacy (dev/build/verify/typecheck/audit:ui)؛ حُذفت 6 ملفات infra legacy-only (`docker-compose.postgres.yml`، `docker-compose.sqlserver.yml`، `deploy/render.yaml`، `deploy/railway.json`، `deploy/digitalocean-app.yaml`، `deploy/backup-cron.sh`) مع تحديث `verify-infra-config.mjs`؛ حُذف `scripts/verify-cloud-deploy.mjs` (فقد غرضه بحذف قوالب النشر) و`scripts/pb-init.mjs` (PocketBase legacy-only)؛ نُظّف `scripts/control-center.mjs` (حذف أمر `legacy:db-provider` و`legacy:migrate*` و`LEGACY_SERVER_DIR`)، و`scripts/verify-release-readiness.mjs`، و`scripts/verify-dependency-audit.mjs` (أُزيل allowlist لـ xlsx بعد زوال archive-app/archive-server)، و`scripts/verify-cutover-defaults.mjs` (أصبح يتحقق من **غياب** أوامر legacy بدل وجودها)؛ نُظّفت `.gitignore`/`.dockerignore`/`tsconfig.json`/`archive-next/Dockerfile` من مسارات archive-app/archive-core/archive-server؛ أُعيدت كتابة `CLAUDE.md`/`README.md`/`TASKS.md` لتعكس أن `archive-next` + `archive-laravel` هما الطبقتان الوحيدتان، مع جملة واحدة تُشير إلى أن الحزم legacy حُذفت بتاريخ 2026-07-12 ومتاحة عبر تاريخ git. أُصلح تعليق المسار الوحيد في `archive-laravel/config/media.php` (`archive-server/ocr-service` → `infra/ocr-service`).

## سلامة تشغيلية لمراجعة الوسائط والتعاون والحقوق — مكتملة محلياً 2026-07-11

- [x] **عقد سلامة pure واختبارات TDD** — أضيف `buildOperationalSafety` مع خمس حالات مثبتة: معاينة dry-run بلا تغيير، تأكيد صريح للإجراء عالي التأثير، منع واضح عند الحقوق المحظورة، إفصاح ثقة بوصفه تقديراً، ورابط لسجل التدقيق.
- [x] **شريحة UX موحدة ومحدودة** — تعرض صفحات التشغيل والمقارنة والمراجعة والتعاون والبث والأتمتة والمساعد والحقوق ملخصاً تشغيلياً يوضح الوضع والخطوة التالية. تتضمن الشريحة معاينات جافة، دلالة حقوق محظورة عند نتيجة الإنفاذ، مستوى الثقة، ورابط `/activity`، بلا تغيير API أو backend. لا يظهر تأكيد عالي الأثر إلا عند تمرير callback يملك الإجراء نفسه؛ أما شاشات العرض فتبقى إفصاحاً فقط.
- [x] **التحقق** — RED لغياب الوحدة ثم GREEN: `pnpm --filter @archive/next test -- lib/operational-safety.test.ts` (5/5)، ونجاح `pnpm --filter @archive/next run typecheck`.

## رحلة أول تشغيل وصحة موحدة — مكتملة ومتحقق منها 2026-07-11

- [x] **نموذج جاهزية pure** — أضيف `deriveSetupJourney` بأربع خطوات ثابتة (الخادم، الحساب، الإعدادات، بدء العمل) ويعيد الخطوة الحالية والمنجزة والإجراء التالي ونسبة الجاهزية، مع مسار تخطي صريح للخبير وإجراء إصلاح قابل للتنفيذ عند تدهور الصحة.
- [x] **أول تشغيل تدريجي** — أصبحت صفحة أول تشغيل تفحص الصحة تلقائياً وتعرض نسبة الجاهزية والخطوة الحالية والإجراء التالي فوق أدوات Control Center الحالية دون تغيير عقود API.
- [x] **لغة رحلة واحدة** — رُبطت أخطاء الدخول واختبارات الإعدادات وإدارة المستخدمين والمساعدة وحالة النظام ونتائج التحكم بروابط متابعة أو إصلاح واضحة ضمن الرحلة نفسها، بلا backend أو دخول خارجي جديد.
- [x] **TDD والتحقق** — ثُبت RED لغياب الوحدة أولاً ثم GREEN لأربع حالات: خادم غير مكتمل، خادم سليم مع جلسة مصادقة، تخطي الخبير، وإجراء التعافي.

## أساس RTL متجاوب لمساحة العمل — مكتمل ومتحقق منه 2026-07-11

- [x] **منع الإزاحة الأفقية** — حُصنت حاويات `AppShell` والمحتوى وشريط الأوامر والتنقل المحمول بعقود `min-inline-size: 0` و`max-inline-size: 100%` و`overflow-x: clip` مع إبقاء توسعة سطح المكتب داخل breakpoint الحالي.
- [x] **أهداف لمس ونص هاتف آمنة** — أصبحت عناصر الإدخال والأزرار وأوامر التنقل المحمول بارتفاع أدنى 44px، وبقي نص الحقول 16px على الهاتف، مع السماح لعناصر النص والشبكات بالانكماش دون كسر RTL.
- [x] **عقد مصدر قابل للتراجع** — أضيف `responsive-layout.test.ts` لتثبيت قواعد viewport وmobile-first وسمات مناطق التخطيط الدلالية في الغلاف والرأس وشريط الأوامر.

## تنقل يومي وحالات صفحات موحدة — مكتمل ومتحقق منه 2026-07-11

- [x] **تنقل يركز على المهمة الحالية** — أضيف `getDailyNavigation(section, role)` لاشتقاق أربعة مسارات يومية بحسب مساحة العمل والدور، مع تجميع بقية المسارات تحت «المزيد» وإبقاء `primaryNav` كاملًا كمصدر لوحة الأوامر.
- [x] **حالات نشاط دقيقة للمسارات الشقيقة** — ثُبت استقلال «البحوث المحفوظة» عن البحث و«وارد المشاركة» عن المشاركات باختبارات تمنع تفعيل المسار الأب خطأً.
- [x] **سطح موحد للحالات غير المتزامنة** — أضيف `AsyncStateSurface` بعقود loading/empty/error/success، ومنطقة إعلان حية، وحالة busy، وإجراء أساسي واحد اختياري لإعادة المحاولة أو الاسترداد.

## إزالة Sentry من المسار القانوني — مكتمل ومتحقق منه 2026-07-11

- [x] **إلغاء اعتماد Sentry كشرط تشغيل** — أُزيل تكامل Sentry النشط من Next.js وLaravel بناءً على قرار تقليل الاعتمادات الخارجية والتكلفة: لا `@sentry/nextjs` في الواجهة، ولا `sentry/sentry-laravel` في الخلفية، ولا DSN/source maps في Docker أو أمثلة البيئة للمسار القانوني.
- [x] **إبقاء معالجة الأخطاء محلية** — صفحات الخطأ في Next.js بقيت موجودة وتعرض مرجع الخطأ عند توفره، مع تسجيل محلي عبر `console.error` بدلاً من إرسال خارجي.
- [x] **تحديث بوابات الجاهزية** — أصبحت `verify-release-readiness` و`verify-infra-config` تتحقق من غياب Sentry في المسار القانوني بدلاً من فرضه. التحقق: `pnpm build:next`، `pnpm --filter @archive/next run typecheck`، `pnpm --filter @archive/next run test`، `pnpm run verify:api-contracts`، وفحص Laravel المركز (17 passed، 1 skipped لغياب `ext-ftp` في صورة الاختبار).

## الكتالوج العام — مكتمل ومتحقق منه 2026-07-11

- [x] **بوابة عامة read-only** — أضيف `GET /api/v1/public/catalog` لعرض السجلات المنشورة فقط (`workflowStatus/status = published`) دون جلسة، مع فلاتر `q/type/tag` وpagination، ومخرجات allowlist فقط (`id/uid/title/description/type/subtype/tags/createdAt/updatedAt`) بلا ملفات أو metadata داخلية.
- [x] **واجهة `/catalog` العامة** — أضيفت صفحة كتالوج عربية عامة تستخدم `PublicHeader`/`PublicFooter` وفلاتر بسيطة وبطاقات سجلات وزر تحميل المزيد، وأضيف المسار إلى public prefixes في proxy وAuthProvider.
- [x] **العقود والاختبارات** — وُثق المسار في OpenAPI وأضيفت schemas للكتالوج العام. التحقق: اختبار `PublicCatalogApiTest`، `pnpm run verify:api-contracts`، وبوابات Next.

## محاكاة البث المحلي — مكتملة ومتحقق منها 2026-07-11

- [x] **غرفة بث تشغيلية داخل Next** — أضيفت صفحة `/broadcast` authenticated تجمع مشغل الوسائط، ساعة بث، timecode حي، إعداد غرفة، حالة حضور، وقفل تحكم فوق APIs التعاون والمراجعة القائمة بلا خدمات خارجية جديدة.
- [x] **Rundown وملاحظات زمنية** — تستخدم الشاشة مستند التعاون المشترك بإصدار متفائل لحفظ الراندون، وتضيف ملاحظات مراجعة مرتبطة بزمن المشغل الحالي مع عرضها زمنيًا، ما يجعلها محاكاة عملية لغرفة مراجعة/بث محلية.
- [x] **ربط تجربة الاستخدام** — أضيفت الشاشة إلى تنقل المشاركة بعنوان «البث» وأعيد استخدام `MediaPlayer` ومكونات Metric UI المحلية بدل إدخال نظام تصميم جديد.

## سوق الإضافات الآمن — مكتمل برمجياً ومتحقق بعقد/Next 2026-07-11

- [x] **كتالوج محلي بلا تنفيذ كود** — أضيف `GET /api/v1/plugins` ككتالوج read-only للمشرفين يعرض سياسة runtime صريحة: catalog-only، لا تنزيل خارجي، لا تنفيذ كود، ومراجعة مشرف مطلوبة لأي توسعة مستقبلية.
- [x] **مراجعة صلاحيات ومخاطر** — أضيفت نمذجة صلاحيات لكل إضافة (`scope/risk/reason`) مع مصفوفة صلاحيات مجمعة ومراجعة أمنية تشمل الشبكة، نظام الملفات، تنفيذ الكود، وخروج البيانات.
- [x] **واجهة `/plugins`** — أضيفت صفحة عربية ضمن النظام تعرض الفلاتر، حالة كل إضافة، المخاطر، وأعلام المراجعة، مع توثيق OpenAPI واختبار Laravel مخصص. التحقق المنفذ: `verify-api-contracts`، وNext typecheck/build/test؛ تشغيل اختبار Laravel المخصص ينتظر توفر Docker/PHP في البيئة.

## قرار المنتج: تأجيل SSO وتكاملات M365/Google — موثق 2026-07-11

- [x] **إبقاء الهوية محلية حالياً** — بناءً على اتجاه المنتج نحو الشركات وغرف العمل والتشغيل المحلي، أُزيل بند M365/Google Workspace + SSO من قائمة العمل النشطة. سيظل أي تكامل هوية خارجي قراراً مؤسسياً لاحقاً عند وجود سياسة هوية واعتمادات وبيئة اختبار، وليس جزءاً من هدف التطوير المحلي الحالي.

## إثراء البحث المحلي والوسوم المقترحة — مكتمل ومتحقق منه 2026-07-11

- [x] **استخراج محلي بلا مزود خارجي** — أضيف `deriveLocalSearchEnrichment` في Next لاستخراج كيانات بسيطة (أماكن/سنوات/أنواع/حالات) واقتراح وسوم تشغيلية من نتائج البحث الحالية فقط، دون embeddings أو vision أو إرسال بيانات خارج الجهاز.
- [x] **واجهة بحث أوضح** — تعرض `/search` لوحة “Local semantic fallback” للوسوم والكيانات المقترحة، وتسمح بتطبيق وسم مقترح كفلتر سريع مع توضيح أنها لا تعدّل السجلات تلقائياً.
- [x] **تغطية اختبارية** — أضيف اختبار Vitest يثبت استخراج Riyadh/Jeddah/2026 واقتراح city/interview/sports من سجلات محلية. تبقى embeddings/vision/visual duplicate detection كبنود خارجية تحتاج مزوداً أو بنية معالجة معتمدة.

## تلميع التشغيل المحلي والتعريب — مكتمل ومتحقق منه 2026-07-11

- [x] **تعريب نصوص يومية مشوهة** — صُححت بقايا mojibake في النشاط، الأرشيف، التعاون، أول تشغيل، التفريغ، وبعض تسميات الإعدادات وODBC.
- [x] **سلوك تشغيل محلي أوضح** — أصبح فحص التخزين يقبل payload فارغاً لاختبار القرص المحلي الافتراضي، وأصبح `/health` يعرض uptime فعلياً منذ أول فحص بعد الإقلاع/تفريغ cache بدل قيمة ثابتة.
- [x] **اختبارات وحراس** — حُدث اختبار health لقبول uptime غير سالب، وأُصلح اختبار سوق الإضافات لاستخدام مستخدم admin صريح بعد جعل الكتالوج admin-only. التحقق: اختبارات Laravel المركزة عبر Docker نجحت (16 passed، 1 skipped لغياب `ext-ftp`)، مع نجاح Next typecheck/build/test في نفس الشريحة.

## إغلاق قائمة المهام المحلية — موثق 2026-07-11

- [x] **لا توجد مهام تطوير محلية مفتوحة** — أُغلق `TASKS.md` كقائمة عمل نشطة بعد تنفيذ البنود المحلية في Laravel + Next وتوثيقها ودمجها.
- [x] **تحققات خارجية مؤجلة وليست مهام محلية** — تبقى العناصر التالية خارج نطاق التنفيذ المحلي إلى حين توفر بيئة/اعتمادات حية:
  - تفريغ عربي حي على GPU بعينة عربية معتمدة ومقاييس دقة.
  - اختبار حي لاعتمادات Dropbox/S3/DB.
  - Kubernetes live validation مع context وصلاحيات نشر.
  - Windows ODBC live smoke مع DSN/driver وبيانات اختبار.
  - embeddings/vision/visual duplicate detection عبر مزود أو فهرس متجهات أو خط معالجة صور معتمد.
- [x] **قاعدة إعادة الفتح** — لا يعود أي بند إلى `TASKS.md` إلا بعد توفر شرطه الخارجي أو تحوله إلى شريحة محلية قابلة للتحقق.

## دعم مزودي تخزين وذكاء اصطناعي متعددين — مكتمل ومتحقق منه 2026-07-11

- **تخزين سحابي متعدد (Laravel):** أقراص Dropbox وAzure Blob وGoogle Cloud Storage مسجّلة عبر `Storage::extend` في `AppServiceProvider`، بالإضافة إلى S3 القياسي (يغطي أيضاً الخدمات المتوافقة مع S3 مثل Cloudflare R2 وDigitalOcean Spaces وMinIO وBackblaze B2 عبر `AWS_ENDPOINT`) وSFTP/FTP الأصليين. اختبار `CloudStorageConfigTest` (11 حالة) يتحقق من تحليل كل قرص بدون اتصال شبكة فعلي.
- **مزودو Copilot متعددون (Next.js):** `copilot-provider.ts` يوجّه بين Anthropic وOpenAI وGoogle وGroq وMistral وxAI وDeepSeek وOpenRouter وأي endpoint متوافق مع OpenAI، عبر Vercel AI SDK، مع تبديل بمتغيرات بيئة (`ARCHIVE_COPILOT_PROVIDER`/`ARCHIVE_COPILOT_MODEL`) ورجوع متوافق مع الإعداد القديم. 20 اختبار وحدة تغطي القرار.
- التحقق: 406 اختبار Laravel ناجح، 33 اختبار Vitest ناجح، وtypecheck كامل (core + next) ناجح.

## موجة تطوير Metric UI المحلية — مكتملة ومتحقق منها 2026-07-10

> يعتمد التنفيذ على النظام المحلي الحالي (`MetricStrip` + مكونات `components/ui` + CSS tokens)، ولا يضيف Metro/Metronic أو Tailwind. تُوثَّق كل شريحة منجزة هنا بعد التحقق وCommit مستقل.

### خط الأساس المثبت حيًا

- 39 صفحة مصادقة فُحصت على 1280 و930 و375؛ الصفحات تصيّر داخل shell موحد بلا page-level overflow.
- البناء وtypecheck وHTTP routes ناجحة. المشكلة الحالية تجربة الاستخدام اليومي، لا قابلية تشغيل التطبيق.
- أفضل سطح عمل حاليًا هو `/archive`: فلاتر، أوضاع عرض، كثافات، وعدادات واضحة. نماذج الإدخال بنيويًا سليمة لكن لا تظهر فوق الطية بالسرعة المطلوبة.

### أولويات التنفيذ

- [x] **أدوات الرأس والاختصارات ووضع التركيز** — أُظهرت أدوات الحساب والإشعارات وتسجيل الخروج على sidebar المكتبي، وربط زر التنبيهات في شريط الأوامر، وأصبح اختصار لوحة الأوامر يقبل Ctrl أو Cmd ويُحدَّث بعد التخصيص، وأضيف زر «إنهاء التركيز» ثابت للمس.
- [x] **إعادة بناء الأنواع** — أُزيل اعتماد `/types` على Tailwind غير الموجود، وأصبحت تستخدم Metric UI المحلية مع قائمة دلالية قابلة للوصول، إنشاء/تحرير/حذف/معاينة، وحالات تحميل وحفظ وأخطاء واضحة. أضيفت methods typed للأنواع إلى عميل API المركزي.
- [x] **تجربة الهاتف وسطح العمل فوق الطية** — أضيف شريط تنقل سفلي للوحة/الأرشيف/البحث/الإضافة/المزيد، وأُصلحت ترويسة الهاتف بإخفاء subtitle والاسم اللاتيني وتخفيف أدواتها، وخُفف padding العام. أصبح تذكير أول تشغيل قابلًا للإخفاء بصورة مستقلة دون وضع الجولة في حالة مكتملة كذبًا.
- [x] **دقة التنقل النشط** — صار `/search/saved` و`/shares/with-me` يفعّلان الرابط الأدق فقط، بدل وضع رابط الأب والابن معًا في `aria-current="page"`.
- [x] **واجهة مهام الوسائط** — صُحح mojibake وعُربت النصوص التشغيلية، وأصبح رمز الوصول خيارًا متقدمًا للمسؤول، مع حالات تحميل/خطأ/فراغ وإعادة محاولة وشريط تقدم دلالي.
- [x] **حوارات وإجراءات آمنة** — أصبحت الإشعارات والنصائح قابلة للإغلاق بـEscape والنقر الخارجي مع إدارة تركيز وARIA سليمة. تحسن جدول البيانات للوحة المفاتيح وقارئات الشاشة، وأصبح تفريغ cache يتطلب تأكيد Radix.
- [x] **حالات البيانات غير المتزامنة** — وُحدت حالات loading/ready/error وإعادة المحاولة في القوائم والإشعارات ومراجعة الوسائط ولوحات الرفع؛ لم تعد حالات الفراغ تظهر قبل اكتمال التحميل، وتعطلت الأفعال أثناء الإنشاء والحذف والإلغاء.
- [x] **الثيم والوصولية المشتركة** — أُضيفت لوحة فاتحة كاملة عبر CSS tokens و`data-theme`/`color-scheme`، وصححت الجدولة تبديل التوكنز، وأضيف رابط تخطٍ ومعلم `main` وحلقات تركيز موحدة، مع 44px لعناصر التحكم و16px لحقول الهاتف. حُوّل OfflineStatusBanner إلى CSS Metric UI محلي بلا Tailwind.
- [x] **التحقق النهائي للموجة** — نجح `pnpm --filter @archive/next run typecheck` و`pnpm build:next`. فحص حي على 375px و1440px أكد شريط التنقل السفلي بلا overflow، وخلو `/types` من Tailwind، وسلامة ترميز `/media/jobs`.
- [x] **تخطيط إضافة المادة** — صار معالج الرفع هو السطح الأساسي بعرض مساحة العمل كاملة، ونُقلت أدوات الرابط والقوالب وروابط الرفع إلى منطقة مساندة متوازنة من ثلاثة أعمدة على سطح المكتب وعمود واحد على الهاتف. أزيل تمدد العمود المساند الفارغ، والتحقق الحي أكد عدم وجود overflow عند 1440px أو 375px.

### نتائج تدقيق موثقة

- على desktop لا يظهر زر تسجيل خروج أو إشعارات قابلة للتفاعل لأن `.topbar-actions` مخفية؛ زر التنبيهات البديل بلا سلوك.
- عند 375px ينضغط subtitle العلامة عموديًا وترتفع الترويسة إلى نحو 245px، ثم يدفع شريط الأوامر ولافتة أول تشغيل وhero المحتوى الحقيقي تحت الطية.
- يعرض التطبيق حرفيًا `Ctrl + Cmd + K`، والاختصار لا يعمل على Windows أو macOS لأنه يتطلب المفتاحين معًا.
- هناك تكرار في إجراءات hero وصناديق البحث، وتسريبات إنجليزية في الواجهات اليومية.
- `/types` أفقر صفحة حاليًا، و`/media/jobs` يحتوي نصًا عربيًا مشوه الترميز وحقل Access token غير مناسب للمستخدم النهائي.

### توضيح الحالة الحالية للسجل

> النقاط أعلاه هي نتائج خط الأساس قبل موجة Metric UI وقد عولجت ببنود `[x]` السابقة، وليست عيوبًا نشطة. كذلك فإن علامات `[~]` في الأقسام التاريخية تسجل حالة الشريحة وقت توثيقها ولا تمثل قائمة عمل حية أو تفويضًا للعمل على المسارات القديمة. المصدر الوحيد للعمل غير المنجز هو [`TASKS.md`](TASKS.md): البنود الخارجية فيه معلّمة صراحةً بأنها محظورة على اعتماد/سياق حي، أما التوسعات القانونية غير المنفذة فتظل مدرجة هناك فقط.

- [x] **فحص اتصالات الإعدادات** — رُبطت واجهة الإعدادات بنقاط فحص التخزين وقاعدة البيانات القائمة في Laravel. تدعم SQLite وMySQL وPostgreSQL، مع حالات انتظار ونجاح وفشل وإعادة محاولة وإشعارات وصولية؛ كلمة المرور تبقى مؤقتة ولا تُحفظ في الصفحة. التحقق: `pnpm --filter @archive/next run typecheck` و`pnpm build:next`.
- [x] **توقيت النصوص في الوسائط المجزأة** — أصبحت كل قطعة تفريغ تكتب مخرجاتها في مسار مستقل قبل الدمج، وتُزاح طوابع SRT/VTT/TTML بموضع القطعة على الخط الزمني. يحافظ الدمج على ترقيم SRT وتسلسل رأس VTT وحاوية TTML. التحقق: `node scripts/laravel-docker.mjs test tests/Unit/RealMediaProcessorTest.php --display-warnings` (9 اختبارات، 29 assertion).
- [x] **نطاقات بث الملفات البعيدة** — أصبح بث الملفات من الأقراص غير المحلية يدعم طلب Range واحد: `206` للنطاق الصحيح و`416` للنطاق غير القابل للتحقيق، مع الحفاظ على التفويض وحماية المسار وسلوك الأقراص المحلية. التحقق: `FilesApiTest` (17 اختباراً، 73 assertion) باستخدام قرص S3 مقلد بلا بيانات خارجية.
- [x] **بوابة اختبارات Next** — أضيف Vitest محلياً دون تنزيل، وحُولت اختبارات طابور العمل غير المتصل اليدوية إلى ستة اختبارات مكتشفة تلقائياً، مع أمر `test:next` ضمن بوابة التحقق القانونية. التحقق: 8 اختبارات Vitest ناجحة.
- [x] **سطح Copilot آمن** — أضيفت `/copilot` ونقطة حالة خادمية لا تعيد سوى الجاهزية غير الحساسة. لا توجد مفاتيح أو طلبات AI من العميل، ويظل إدخال المحادثة معطلاً إلى أن يُبنى endpoint محمي وتُراجع الصلاحيات. التحقق: اختباران للحاجز الأمني والبناء الإنتاجي.
- [x] **شجرة مشتقات الوسائط** — تعرض تفاصيل السجل الآن شجرة أصل → مهام التحويل → المخرجات من `media_jobs` المحفوظة، وتربط التحويلات اللاحقة بالمخرج الذي استعملته مصدراً عبر أي عمق. تتضمن حالات تحميل وخطأ وإعادة محاولة وفراغ. التحقق: 4 اختبارات Vitest مخصصة و`typecheck`.
- [x] **محرك الاقتراحات** (2026-07-10) — `GET /api/v1/suggestions` بسياقات discover/search/detail و`PUT /suggestions/{key}/feedback` مع جدول `suggestion_feedback` لكل مستخدم؛ الاقتراحات المخفية لا تعود. لوحة `SuggestionsPanel` مربوطة في الاكتشاف والبحث وتفاصيل السجل. التحقق: 4 اختبارات PHPUnit والعقد وبوابة verify الكاملة.
- [x] **محرك تقارير الامتثال** (2026-07-10) — `GET /api/v1/reports/compliance` مع تصدير CSV (للمشرفين فقط) فوق `audit_logs` بفلاتر التاريخ/الحدث/المورد/النتيجة، وصفحة `/reports` أُعيد بناؤها كتقرير حي بدل الصفحة التجريبية (أزال نص mojibake القديم). التحقق: 3 اختبارات PHPUnit والعقد وبوابة verify الكاملة.
- [x] **الوسم الجغرافي (Geotagging)** (2026-07-10) — لوحة `GeotagPanel` في تفاصيل السجل: إضافة/تحرير/إزالة موقع (`metadata.location` ضمن حمولة السجل الحرة — بلا تغيير عقد أو Laravel)، تحقق إحداثيات صارم، خريطة OpenStreetMap مضمّنة ورابط خارجي، وقسم «سجلات قريبة» يرتب أقرب 5 سجلات موسومة بمسافة haversine. الحفظ عبر مسار upsert القائم مع الحفاظ على كامل الحقول. التحقق: 26 اختبار Vitest وtypecheck وbuild.
- [x] **الوسم الجغرافي (Geotagging)** (2026-07-10) — لوحة `GeotagPanel` في تفاصيل السجل: إضافة/تحرير/إزالة موقع (`metadata.location` ضمن حمولة السجل الحرة — بلا تغيير عقد أو Laravel)، تحقق إحداثيات صارم، خريطة OpenStreetMap مضمّنة ورابط خارجي، وقسم «سجلات قريبة» يرتب أقرب 5 سجلات موسومة بمسافة haversine. الحفظ عبر مسار upsert القائم مع الحفاظ على كامل الحقول. التحقق: 26 اختبار Vitest وtypecheck وbuild.
- [x] **محادثة Copilot المحمية** (2026-07-10) — أُكمل سطح Copilot: مسار Next خادمي `POST /api/copilot/chat` يتحقق من جلسة المستخدم عبر Laravel `/auth/me` قبل أي نداء للمزود، مع provider gating (503 عند غياب المفاتيح)، تحقق مدخلات صارم (حد 20 رسالة/4000 حرف)، مهلة 30 ثانية، وأخطاء عربية عامة لا تسرب المفاتيح. فُعّل إدخال المحادثة في `/copilot` عند الجاهزية مع حالات تحميل وخطأ وإعادة محاولة. التحقق: 13 اختبار Vitest جديد، مراجعة أمنية، typecheck وbuild.

## موجة P2 + ترقية التفريغ — 2026-07-09

> نُفّذت عبر 11 عميلاً متوازياً ودُمجت إلى `master`. Email/Push/Slack/Teams للإشعارات وDropbox OAuth الحي والتحقق الحي على GPU خارج النطاق (انظر TASKS.md).

- [x] **ترقية خط التفريغ** — device لكل مهمة (gpu/cpu/auto مع float16/int8)، استخراج صوت 16kHz + تقسيم على الصمت (~5 دقائق)، تقدم مرحلي لكل مقطع، endpoint إلغاء، واختيار صيغ المخرجات (SRT/VTT/TTML/TXT/JSON).
- [x] **Montage advanced editor** — multi-track، markers/comments، transitions، ومشاريع دائمة في Laravel (`/montage-projects`).
- [x] **Advanced tags + vocabulary** — ألوان، ترتيب، merge، move مع حارس الدوران، ومسارات `/tag-nodes/*`.
- [x] **Field ACL في الأنواع** — قواعد view/edit لكل حقل مع `FieldAclService` وإنفاذ خادمي + hooks للواجهة.
- [x] **Notifications center** — جدول إشعارات + CRUD + جرس بشارة غير المقروء + صفحة كاملة، وربط ingest/backup.
- [x] **Offline/degraded mode** — probe على `/health`، طابور إعادة تشغيل بـ last-write-wins، وبانر حالة RTL.
- [x] **Shortcuts customization** — إعادة ربط المفاتيح من الإعدادات مع حفظ محلي وربط لوحة الأوامر.
- [x] **Focus/contextual guide** — focus mode (F11/Ctrl+Shift+F) ونصائح سياقية لكل صفحة رئيسية.
- [x] **Backup hardening** — SHA-256 sidecar + verify، تشفير اختياري، retention مع سجل تدقيق، وأمرا `backup:cleanup`/`backup:dr-drill`.
- [x] **Appearance/theme management** — 4 presets، تصدير/استيراد JSON بتحقق صارم، وجدولة زمنية.
- [x] **Settings/Admin extras (الجزء البرمجي)** — test-connection للتخزين وDB، setup checklist، وربط hub.

## إغلاق بنود P1 المعلّقة على بوابة Docker — 2026-07-08

> شُغّلت بوابة `pnpm run verify:laravel` (Docker) في هذه البيئة بعد أن كانت البنود التالية منجزة برمجياً ومنتظرة فقط لهذا التحقق. النتيجة: 315 اختبار Laravel ناجح (1536 تأكيد)، و`pnpm run verify` الكامل أخضر (typecheck + build:next + verify:api-contracts + verify:repo-hygiene + verify:laravel).

- [x] **Activity/history دائم مع undo/diffs** — `/api/v1/activity` متصل بصفحة `/activity`، مع diff/restore metadata في `/archive/[id]`. أُغلق بعد نجاح بوابة Laravel.
- [x] **تخزين Laravel دائم للكيانات المحلية** — Collections، Inbox، Vocabulary، وTags hierarchy منقولة بالكامل (انظر قسم 2026-07-07 أدناه). Saved views وAutomation drafts مخزّنة سلفاً عبر `/saved-searches` و`/automation/rules`؛ Workflow presets وDashboard widgets لم تكن موجودة كسطح localStorage أصلاً. أُغلق البند الأب بعد نجاح بوابة Laravel.
- [x] **Search/archive power features** — فلاتر `/search` وfacets، وربط بحوث `/search`/عروض `/archive` المحفوظة بـ `/saved-searches`، و`PATCH /relations/{id}` مع محرر علاقات داخل `/archive/[id]`. أُغلق بعد نجاح بوابة Laravel.
- [x] **Automation backend** — جداول `automation_rules`/`automation_rule_runs`، مسارات CRUD + dry-run/run، وربط صفحة `/automation` بـ Laravel مع سجل تشغيل. أُغلق بعد نجاح بوابة Laravel.
- التحقق: `pnpm run verify:laravel` (315 اختبار ناجح)، ثم `pnpm run verify` الكامل أخضر.

---

## تخزين Laravel دائم للكيانات المحلية (شرائح 1–4) — 2026-07-07

> شرائح من بند P1 المفتوح "تخزين Laravel دائم للكيانات المحلية" في [`TASKS.md`](TASKS.md). أُنجزت الكيانات المحلية الحقيقية (Collections, Inbox, Vocabulary, Tags hierarchy). أما بقية الكيانات المذكورة فقد تبيّن أنها إمّا مخزّنة سلفاً (Saved views عبر `/saved-searches`، Automation drafts عبر `/automation/rules`) أو غير موجودة كسطح localStorage (Workflow presets, Dashboard widgets). البند الأب يبقى مفتوحاً فقط حتى تُشغَّل بوابة Laravel/PHPUnit عبر Docker.

- [x] **Collections على Laravel بدل localStorage** — أُضيف جدول `collections` (migration `2026_07_07_000001`)، و`CollectionsController` (index/store/destroy) مُسيَّج لكل مستخدم عبر `archive_user`، ومسارات `/api/v1/collections` + `/{id}` داخل مجموعة auth. وُثّق العقد في `docs/api/archive-contract.openapi.json` (مسارات + مخططات `Collection`/`CollectionCreateRequest`/`CollectionsResponse`/`CollectionResponse`) وأُضيف إلى allowlist المدقق `scripts/verify-api-contracts.mjs`. أُضيف `CollectionsApiTest` (6 حالات: CRUD، عزل المستخدم، رفض payload غير صالح، رفض حذف مفقود، رفض غير مصادق). حُوّلت صفحة `/collections` في Next لاستهلاك API بدل التخزين المحلي، مع توسيع `recordMatches` لقبول `query: string | null`.
- [x] **Inbox على Laravel بدل localStorage** — أُضيف جدول `inbox_items` (migration `2026_07_07_000002`)، و`InboxController` (index/store/**patch**/destroy) مع تحقق حالة مقيّد بـ `new|triage|ready|done`، ومسارات `/api/v1/inbox` + `/{id}`. وُثّق العقد (مسارات + مخططات `InboxStatus`/`InboxItem`/`InboxItemCreateRequest`/`InboxItemUpdateRequest`/`InboxItemsResponse`/`InboxItemResponse`) وأُضيف إلى المدقق. أُضيف `InboxItemsApiTest` (6 حالات تشمل تحديث الحالة وعزل المستخدم). حُوّلت صفحة `/inbox` لاستهلاك API بدل localStorage.
- [x] **Vocabulary على Laravel بدل localStorage** — أُضيف جدول `vocabulary_terms` (migration `2026_07_07_000003`)، و`VocabularyController` (index/store/destroy) مُسيَّج لكل مستخدم مع تحقق نوع مقيّد بـ `type|tag|custom`، ومسارات `/api/v1/vocabulary` + `/{id}`. وُثّق العقد (مسارات + مخططات `VocabularyTerm`/`VocabularyTermCreateRequest`/`VocabularyTermsResponse`/`VocabularyTermResponse`) وأُضيف إلى المدقق. أُضيف `VocabularyApiTest` (7 حالات: CRUD، افتراض `custom`، عزل المستخدم، رفض payload/نوع غير صالح، رفض حذف مفقود، رفض غير مصادق). حُوّلت صفحة `/vocabulary` لاستهلاك API بدل `masar:vocabulary:v1`، مع الإبقاء على إزالة التكرار حسب المصطلح في الواجهة.
- [x] **Tags hierarchy على Laravel بدل localStorage** — أُضيف جدول `tag_nodes` (migration `2026_07_07_000004`)، و`TagNodesController` (index/store/**patch**/destroy) لإسناد/تغيير/إزالة أب الوسم لكل مستخدم، ومسارات `/api/v1/tag-nodes` + `/{id}`. وُثّق العقد (مسارات + مخططات `TagNode`/`TagNodeCreateRequest`/`TagNodeUpdateRequest`/`TagNodesResponse`/`TagNodeResponse`) وأُضيف إلى المدقق. أُضيف `TagNodesApiTest` (6 حالات تشمل إعادة الإسناد عبر PATCH وعزل المستخدم). حُوّلت صفحة `/tags` لاستهلاك API بدل `masar:tags:parents:v1` (العقدة تُنشأ فقط عند إسناد أب للوسم).
- التحقق: `node scripts/verify-api-contracts.mjs` → `ok`، و`pnpm run typecheck` خضراء. **معلّق:** بوابة Laravel/PHPUnit عبر Docker (نفس بوابة بقية بنود P1) لم تُشغَّل في هذه البيئة.

---

## إصلاح بوابات pnpm verify — 2026-07-05

- [x] **إصلاح `verify:cutover` بعد إعادة هيكلة TASKS.md** — كان `scripts/verify-cutover-defaults.mjs` يتحقق من وجود نص إنجليزي حرفي قديم ("Laravel API + Next.js TypeScript") داخل `TASKS.md`، وهو نص أُزيل عند إعادة تنظيم الملف (موجة 2026-07-04، بند "توحيد مصدر المهام") ونُقل خلاصته إلى `ChangeLog.md` (بند 5e.2-cutover). عُدّل السكربت ليتحقق من العبارة الفعلية الحالية في `TASKS.md` ("Laravel + Next.js هما المنتج القانوني") ومن وجود بند `[x] 5e.2-cutover` منجز في `ChangeLog.md`، بما يطابق اتفاقية المشروع بنقل البنود المنجزة من TASKS إلى ChangeLog.
- [x] **إصلاح اختبار `ActivityApiTest` (توقع كود حالة خاطئ)** — الاختبار كان يتوقع `201 Created` من `POST /api/v1/media/jobs`، بينما الـ controller (`MediaJobsController::store`) يُرجع عمداً `202 Accepted` لأن إنشاء مهمة الوسائط غير متزامن (يُدفع إلى queue عبر `ProcessMediaWorkflow::dispatch`) — وهو السلوك المُتحقق منه فعلاً في `MediaJobsApiTest` عبر `assertAccepted()` في عدة اختبارات. صُحّح `ActivityApiTest` ليستخدم `assertAccepted()` مطابقاً للسلوك الفعلي والمقصود.
- [x] **تنظيف ملف تفريغ عطل مُتتبَّع بالخطأ** — حُذف `bash.exe.stackdump` (ناتج تعطّل bash.exe محلي كان مُلتزماً في Git سابقاً).
- التحقق: `pnpm run verify` بالكامل خضراء (verify:cutover + verify:api-contracts + typecheck + build:next + verify:repo-hygiene + verify:laravel عبر Docker، 290 اختبار Laravel ناجح).

---

## موجة توحيد المهام والخطط — 2026-07-04

- [x] **تأسيس Masar Command Workspace** — اعتُمد تصور UI/UX حديث للنظام وحُفظ كوثيقة تصميم وخطة تنفيذ، مع صورة مرجعية داخل `docs/superpowers/specs/`. بدأت أول دفعة تنفيذ على Next: أيقونات التنقل، Sidebar يمين بملمس تشغيل حديث، tokens مفقودة، PageToolbar/EmptyState مطوّرة، MetricStrip جديد، وتحديث صفحات `/`, `/archive`, `/uploads` كنماذج مرجعية.
- [x] **إكمال تمريرة Masar Command Workspace للصفحات التشغيلية** — حُدثت صفحات `/files`, `/types`, `/settings`, `/media/jobs`, و`/errors` لتستخدم PageToolbar بالأيقونات، MetricUI/MetricStrip عند الحاجة، أسطح workspace موحدة، حالات empty/error أوضح، وبطاقات تشغيلية للحالات الحساسة مثل queue الوسائط وسجل الأخطاء. التحقق: `pnpm --filter @archive/next run typecheck`, `pnpm run build:next`.
- [x] **تصحيح RTL وتخطيط الصفحة الرئيسية في Masar** — نُقل sidebar إلى موضع RTL الصحيح على سطح المكتب، وأُصلحت شبكة `PageToolbar` حتى لا تنكسر الأزرار في عمود منفصل، ووُسعت مساحة المحتوى إلى workspace عريض. أُعيد ترتيب الصفحة الرئيسية إلى grid تفاعلي بمناطق مؤشرات/تنبيهات/سجلات/مهام/اختصارات، وأُصلح سبب 422 في مؤشرات الأرشيف عبر مواءمة `search limit` مع حد Laravel. التحقق: `pnpm --filter @archive/next run typecheck`, `pnpm run build:next`, `node scripts/verify-repo-hygiene.mjs`, `git diff --check`.
- [x] **إضافة Workspace Command Bar** — أضيف شريط أوامر علوي داخل مساحة العمل يعرض المستخدم والبحث السريع والتنبيهات والثيم، مع إبقاء sidebar على اليمين للتنقل فقط في سطح المكتب، لتقريب واجهة Masar من الصورة المرجعية المعتمدة. التحقق: `pnpm --filter @archive/next run typecheck`, `pnpm run build:next`.
- [x] **تحسين Setup / Control Center لكلمات المرور** — وُحدت تجربة القائمة بحيث صار `1` هو Quick start و`q`/`0` للخروج، وأضيفت أوامر `generate-password` و`change-admin-password` إلى `Setup-Archive.bat`/`setup.sh`. أمر تغيير كلمة المرور يحدّث `.env` مع نسخة احتياطية، ويطبّق الكلمة على مستخدم Laravel الموجود عبر `archive:admin-password` عند تشغيل الحاوية، مع اختبارات CLI وتوثيق الاستخدام.
- [x] **Reading lists** — أضيفت صفحة مستقلة `/reading-lists` داخل Next، مع إنشاء قوائم قراءة محلية، اختيار سجلات من الأرشيف، متابعة المتبقي/المكتمل، فتح السجل مباشرة، وحذف القوائم/العناصر. وُثق القرار داخل واجهة الصفحة: Reading Lists سطح مراجعة شخصي منفصل عن Collections الرسمية.
- [x] **Shared-with-me** — أضيفت صفحة `/shares/with-me` للمشاركات الواردة داخل Next: إدخال token أو رابط `/share/{token}`، فتح المشاركة عبر API العام، عرض السجلات والصلاحية، حفظ تاريخ محلي للروابط الواردة، وروابط رجوع من `/shares` والتنقل الرئيسي.
- [x] **Media transcript helper** — أضيف في `/media/play` استيراد مباشر لملفات SRT/VTT داخل مشغل Next، مع قراءة الملف من المتصفح، تحقق من وجود cues زمنية، عدّ المقاطع، عرض اسم الملف، ورسالة حالة، مع بقاء اللصق اليدوي متاحاً ومسح التفريغ بزر مستقل.
- [x] **Add archive / AddVideo wizard** — حُوّلت `/uploads` إلى مسار إضافة أرشيف كامل: اختيار متعدد الملفات، وضع سريع/موجه، تطبيق قوالب الإدخال، metadata أساسية، وسوم، مجلد وجهة، حقول فيديو مخصصة، ومراجعة قبل الإنشاء. يحافظ السطح نفسه على import preview وروابط الرفع الخارجية، ويرفع الملفات عبر API ثم يثبت metadata عبر `bulkRecords` بدل ترك صفحة مؤقتة.
- [x] **First-run / onboarding في Masar** — أُضيفت صفحة `/first-run` العامة لمسار أول تشغيل مع preset سريع/متقدم، حفظ تقدّم محلي، فحص صحة Laravel API، وأوامر نسخ آمنة لـ `setup.bat`/Control Center دون تشغيل أوامر من المتصفح. أُضيف تذكير onboarding داخل AppShell حتى إكمال الجولة، وروابط إعادة فتح من `/help` و`/settings` و`/login` والتنقل/لوحة الأوامر. أُضيف أمر `setup first-run` كدليل غير تخريبي في Control Center مع اختبار CLI.
- [x] **توحيد مصدر المهام** — أُعيد تنظيم `TASKS.md` ليصبح المصدر الوحيد للمهام المفتوحة في Masar، بعد دمج خلاصات خطط TypeScript، Laravel/Next cutover، CI/CD+Sentry، UI redesign/rich UI، وlegacy parity.
- [x] **نقل المنجز من الخطط الفرعية إلى سجل التغييرات** — وُثق أن المكدس القانوني Laravel + Next.js أصبح معتمداً، وأن واجهة Masar الموحدة وهوية النظام ومكتبات UI الغنية اكتملت، وأن شرائح parity الكبيرة دُمجت: history/comments/sync، intake templates/import preview/upload links/saved searches، data-center/status/system-control/DR/user export، media source picker/montage export/broadcast metadata.
- [x] **تنظيف ملفات الخطط الفرعية** — حُذفت ملفات `docs/superpowers/plans/*.md` ووثائق تدقيق/رؤية Masar القديمة بعد نقل المهام المفتوحة إلى `TASKS.md` والمنجز إلى هذا السجل.
- [x] **إبقاء المتبقي فقط في TASKS** — صارت المهام المفتوحة مصنفة إلى P1/P2/P3، وتشمل: first-run، activity undo/diffs، التخزين الدائم للكيانات المحلية، Add archive wizard، search/archive facets، automation backend، GPU transcription validation، وميزات AI/offline/settings/montage المتقدمة.

---

## موجة توحيد النظام واستعادة الميزات — 2026-07-03

- [x] **نسخ احتياطي واستعادة في Laravel + صفحة Data Center** — أُضيفت نقاط `/api/v1/system/backups` (list/run/preview/restore) عبر `BackupService` مع حماية من path traversal وقصرها على الأدمن، وصفحة `/backup` في Next بجدول النسخ ومعاينة لكل مخزن وتأكيد استعادة بكتابة اسم النسخة. التحقق: `pnpm verify` (222 اختبار Laravel).
- [x] **استعادة Projects/Montage** — صفحة `/projects` في Next منقولة من الواجهة القديمة: مشاريع محفوظة محلياً، خط زمني للمقاطع بنقاط دخول/خروج وإعادة ترتيب، وتصدير JSON وEDL (CMX3600) عبر وحدة `lib/montage.ts` النقية. تصدير MP4 معطّل حتى تتوفر عملية تصدير في العقد.
- [x] **Dashboard حقيقي** — أعيدت كتابة `/` كلوحة حية: إحصاءات حسب النوع والحالة، أحدث السجلات، مهام الوسائط الأخيرة، وروابط سريعة، بجلب متوازٍ وحالات خطأ لكل ودجت.
- [x] **صفحة الحقوق `/rights`** — قائمة الحقوق عبر `/rights/expiring` بنوافذ 30/90/365 يوماً مع تمييز المنتهي، وفحص إنفاذ لكل عنصر، ونموذج upsert مطابق للعقد.
- [x] **شجرة مجلدات في `/files`** — وضع عرض "مجلدات" جديد موصول بـ `/files/browser` مع breadcrumb وتنقل بالنقر.
- [x] **صفحة الاستيراد `/ingest`** — واجهات Scan وFTP وSMB وفق مخططات العقد، دون تخزين كلمات المرور محلياً.
- [x] **حذف جماعي للسجلات** — endpoint جديد `POST /records/bulk-delete` بنتائج لكل عنصر، موصول بزر الحذف الجماعي في `/archive` مع تأكيد وعدّ الفشل بالاسم.
- [x] **تحصينات أمنية** — `throttle:10,1` على تسجيل الدخول (يطابق 429 في العقد)، قصر `/system/security-settings` على الأدمن مع اختبارات، وتوحيد `requireAdmin` في `Controller` الأساس. التحقق من entropy رموز الدعوات (Str::random(80) + SHA-256) وحد الرفع 600MB — سليمة دون تغيير.
- [x] **توحيد العقد OpenAPI** — أُضيفت المسارات الجديدة (backups، bulk-delete) والمسارات المنفّذة غير الموثقة (`/users`، `/invitations/{token}/accept`، `/system/security-settings`) مع 16 مخططاً جديداً، وتوسيع `scripts/verify-api-contracts.mjs` للتحقق منها. التحقق: `pnpm verify` كاملة خضراء (عقد + typecheck + بناء Next + اختبارات Laravel).

---

## موجة Laravel + Next.js — 2026-07-01

- [x] **استعادة صفحات إدارة الأنواع وسجل الأخطاء في Next** — أُضيف مسارا `/types` و`/errors` إلى `archive-next` بعد أن كانا متاحين فقط داخل `archive-app` legacy. صفحة الأنواع تحفظ في مخزن Laravel `content_types` عبر `/api/v1/records` و`/api/v1/records/bulk`، وصفحة سجل الأخطاء تسجل أعطال المتصفح محلياً مع التقاط مركزي من layout. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **تأسيس نظام تصميم Next موحد** — أُضيف `archive-next/app/theme.css` كملف tokens تفصيلي للألوان، typography، spacing، حالات النظام، الظلال، الحركة، dark mode، وreduced-motion، وأُعيدت صياغة `globals.css` لتستخدم هذه tokens مع توافق خلفي لأسماء classes الحالية (`panel`, `badge`, `button`, `hero`, `auth-layout`). التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **توحيد رأس التطبيق والتنقل** — أُضيف `archive-next/components/AppHeader.tsx` كخريطة تنقل مركزية مع تمييز المسار الحالي عبر `aria-current`، واستُبدلت الرؤوس المتكررة في صفحات Next القانونية المستقرة (`/`, `/archive`, `/files`, `/types`, `/errors`, `/settings`, `/reports`, `/help`, `/media/jobs`, `/media/play`, `/collaboration`, `/share/[token]`, `/review/[token]`). التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **تحسين صفحات التشغيل الأساسية** — أضيفت utilities تصميم مشتركة في `globals.css` للانقسام responsive، الجداول القابلة للتمرير، الأزرار الخطرة، النصوص الطويلة، والفواصل؛ واستُخدمت في `/settings`, `/types`, `/errors`, `/files`, و`/archive/[id]` لتقليل التداخل وinline styles، تحسين RTL، ونقل إجراء مسح سجل الأخطاء إلى زر خطر مع تأكيد. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **تحسين صفحات الوسائط والمراجعة** — أُعيدت صياغة `/media/review` و`/media/compare` باستخدام classes التصميم الحقيقية بدلاً من Tailwind utility classes غير المفعّلة، وأضيفت layouts responsive للمقارنة والمراجعة، وإطار ثابت للمشغل/الـ annotation. حُدث `MediaPlayer` ليقبل أحداث time/play عبر props React بدلاً من listeners يدوية، وخُففت تفاصيل `/media/jobs` بتحويل JSON الخيارات إلى `details`. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **تحسين الصفحات الثانوية والعامة** — حُدثت `/collaboration`, `/reports`, `/help`, `/share/[token]`, و`/review/[token]` لتستخدم لغة منتج مستقرة بدلاً من ملاحظات الترحيل، مع تعريب metadata العامة، حالات loading/error/empty أكثر وضوحاً، وإزالة inline styles/tokens القديمة من التعاون عبر `status-pill` وlayouts مشتركة. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **تنظيف لغة المنتج وتفاصيل الأنماط** — أُزيلت بقايا عبارات التحويل والتقنيات الداخلية من الصفحات الظاهرة (`/`, `/archive`, `/files`, `/login`, `/settings`, `/media/jobs`, `/help`) واستُبدلت بلغة تشغيل مستقرة. اكتملت تعريبة إعدادات النظام، ونُقلت أنماط متفرقة إلى classes مشتركة للملفات، سجل الأخطاء، ODBC، والـ annotation overlay. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **اعتماد هوية مسار / Masar في واجهة Next** — أضيفت أصول SVG للعلامة، wordmark، lockup، وfavicon داخل `archive-next/public/brand/`، وأضيفت ثوابت هوية مركزية في `archive-next/lib/brand.ts`. حُدثت metadata والهيدر والصفحات الظاهرة لاستخدام اسم مسار، وتوسعت tokens في `theme.css` إلى palette مؤسسية دافئة مع dark mode، وأضيف قسم “هوية النظام” إلى `/settings`. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **إكمال CRUD ODBC المقيد في Laravel + Next** — توسع جسر ODBC من فحص/قراءة فقط إلى عمليات إنشاء/تحديث/حذف محمية على الجداول الأساسية المسموحة (`items`, `users`, `settings`, `audit`) عبر Laravel، مع حصر مفاتيح التحديث/الحذف ومنع كتابة أعمدة الأسرار وقبول قيم scalar/null فقط. حُدّثت بطاقة ODBC في `/settings` لتنفيذ العمليات وإعادة تحميل المعاينة، ووُثق المسار الجديد في OpenAPI. التحقق: `node scripts/laravel-docker.mjs test --filter=Odbc`, `node scripts/verify-api-contracts.mjs`, `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **إغلاق smoke العلامة المائية الحي** — أضيف `scripts/smoke-watermark-ffmpeg.mjs` وأمر `pnpm run smoke:watermark` لتوليد فيديو وPNG مؤقتين، تركيب watermark overlay عبر ffmpeg، فحص الناتج بـ ffprobe، ومقارنة crop منطقة العلامة للتأكد من أن overlay أثّر فعلياً. التحقق: `pnpm run smoke:watermark` نجح (`outputSize=43182`, `cropDifference=95.83`).

- [x] **إضافة waveform والتفريغ المتزامن في مشغل Next** — نُقل منطق تحليل VTT/SRT وpeaks من legacy إلى helpers قانونية داخل `archive-next/lib/media/`، وتوسع `MediaPlayer` ليعرض timeline قابل للنقر، cue نشط، وقائمة تفريغ تقفز إلى مواضع التشغيل. صفحة `/media/play` صارت تقبل نص VTT/SRT اختياريًا بجانب path/disk. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **إضافة مسودة مورد مشتركة للتعاون الحي** — أضيفت `collaboration_documents` في Laravel مع `GET/POST /api/v1/collaboration/rooms/{roomKey}/documents/{resourceId}`، حفظ بإصدار متفائل، تعارض 409 عند النسخ القديمة أو قفل مستخدم آخر، وحدث Reverb `document.updated`. صفحة `/collaboration` تعرض المسودة وتدمج التحديثات الحية. التحقق: `node scripts/laravel-docker.mjs test --filter=Collaboration`, `node scripts/verify-api-contracts.mjs`, `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **موجة استعادة الذكاء والقوة: Whisper حقيقي + OCR موصول + Transcriber + قوة الأرشيف** — اكتُشف أن صورة العامل بلا Python/Whisper CLI إطلاقاً رغم أن الكود منقول؛ أُضيف `whisper-ctranslate2` (المتوافق مع أعلام `WhisperTranscriber`) بافتراضيات محلية CPU/int8، ووُصلت خدمة `ocr-service` القائمة كخدمة compose (:8788) مع عملية `ocr` جديدة في خط مهام الوسائط (`RealMediaProcessor` → HTTP، وFake للاختبارات). واجهات: صفحة `/transcriber` (نموذج → متابعة كل 3ث → عرض cues بأكواد زمنية + نسخ) وزر OCR في `/archive/[id]` (يتعطل بأمان بلا مسار ملف)، واستعادة قوة `/archive` القديمة: تحديد جماعي وإجراءات bulk وسم/نوع/حالة عبر `records/bulk` بتجميع per-store، رقائق حالات workflow الست الحقيقية (من `itemStatus.ts` القديم)، وviews محفوظة بمزامنة URL. التحقق: Laravel ‏207 اختبار/839 assertion، `verify:api-contracts`، `verify:infra`، `verify:release-readiness`، `docker:config`×2، `typecheck:next`، `build:next`.

- [x] **تدقيق تكافؤ الصفحات + موجة النقل 1 (6 صفحات)** — دُققت 41 صفحة legacy مقابل Next (وكيلا Haiku): 12 مغطاة، والباقي صُنّف (قابل للنقل فوراً / يحتاج backend / لن يُنقل بقرار cutover — وُثقت الخطة في TASKS.md). نُقلت فوراً على API الموجود: `/search` (فلاتر يحترمها الخادم + مزامنة URL + Suspense boundary)، `/timeline` (تجميع يوم/شهر/سنة برسم rail)، `/analytics` (تجميع عميل + رسوم CSS + تصدير CSV)، `/status` (فحص صحي بتحديث تلقائي 30ث)، `/shares` (إدارة الروابط الممنوحة بتخزين محلي + تسجيل تلقائي عند الإنشاء في `/files`)، `/favorites` (مخزن محلي + زر نجمة في `/archive/[id]`)، وأُدرجت الست في تنقل AppHeader. التحقق: `pnpm run typecheck:next`, `pnpm run build:next` (23 مساراً).

- [x] **رفع صفحات Next المنقولة إلى التصميم المعتمد** — أُعيدت صياغة 17 صفحة (الرئيسية كلوحة تشغيل، الأرشيف/التفاصيل بـ split-layout وkv-grid، الملفات كجدول بيانات بتحديد جماعي، الوسائط الأربع بتخطيطات مسرحية/مراجعة احترافية عبر 4 CSS Modules جديدة، الإعدادات/الأنواع/الأخطاء بهيكلة panel-section-header، وصفحتا المشاركة/المراجعة العامتان بهوية موثوقة) باستخدام tokens `theme.css` وclasses `globals.css` الموجودة حصراً — صفر ألوان مثبتة، RTL منطقي، حالات hover/focus/فارغ/خطأ مصممة، وكل السلوك والـ API calls محفوظة. نُفذت عبر 3 وكلاء Haiku متوازيين بملفات غير متداخلة. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.

- [x] **نقل مركز التحكم وsetup.bat إلى المكدّس القانوني** — `setup.bat`/`setup.sh` → `control-center.mjs` صار يشغّل `archive-server/docker-compose.yml` (Laravel + Next + Reverb + Caddy): نشر خفيف يولّد أسرار `.env` تلقائياً (POSTGRES/REDIS/REVERB/LARAVEL_APP_KEY بصيغة `base64:`)، فحص صحي عبر `/api/v1/health` من بروكسي Next :3000، ترحيلات `php artisan migrate --force`، تشخيص عبر `pnpm verify`، وتدوير أسرار Reverb (استُثني APP_KEY لحماية البيانات المشفرة). معالج Node القديم وأوامر Prisma بقيت خلف `deploy-legacy`/`legacy:*` صراحة، وحُدثت README/INSTALL/DEPLOYMENT/docs. التحقق: `node --check`, `node --test scripts/control-center.test.mjs` (7/7), `node scripts/control-center.mjs help|doctor`, `pnpm run docker:config`.

- [x] **تنظيف ملفات المستودع وتحصين بوابة hygiene** — أُزيلت مخلفات `.superpowers/` المتتبَّعة (11 ملفاً)، حُذف السكربت اليتيم `verify-detail-media-fallback.mjs` من الجذر بعد إثبات عدم الإشارة إليه، وأُضيف تجاهل `output/`/`.fallow/`/`.agents/`. وُسّع `scripts/verify-repo-hygiene.mjs` ليفشل إن عادت هذه المسارات للتتبع أو ظهر `verify-*.mjs` يتيم في الجذر. التحقق: `node scripts/verify-repo-hygiene.mjs`.

- [x] **بث حي لتعليقات المراجعة المرئية** — أضيف حدث Laravel `ReviewCommentBroadcasted` على قناة `review.media.{mediaUid}` باسم `.review-comment.updated` عند إنشاء/تحديث التعليقات، وأصبحت صفحة `/media/review` تشترك عبر Reverb وتدمج التعليقات الواردة دون تكرار مع بقاء التحميل اليدوي fallback. التحقق: `node scripts/laravel-docker.mjs test --filter=ReviewComments`, `pnpm run typecheck:next`.

- [x] **تصحيح مسار Docker الافتراضي لعرض مسار / Masar** — حُوّل `archive-server/docker-compose.yml` من PocketBase + Vite SPA إلى Laravel + Next.js كمسار افتراضي، وضُبط Caddy على `next:3000`، وأصبحت صورة `archive-next/Dockerfile` تمرر `ARCHIVE_API_BASE_URL` أثناء build وتنسخ `public/` حتى تظهر أصول Masar داخل الحاوية. أضيفت متغيرات Reverb الناقصة إلى `.env.example` وفحوص ثابتة تمنع رجوع Docker الافتراضي إلى `archive-app` legacy.

- [x] **إضافة CI/CD وSentry للمسار القانوني** — أضيفت GitHub Actions كبوابة CI/CD افتراضية (`ci.yml`, `docker.yml`) مع أوامر root `pnpm run ci` و`pnpm run ci:docker`. أضيف تكامل Sentry اختياري لـ Next.js (`@sentry/nextjs`, instrumentation, global error) وLaravel (`sentry/sentry-laravel`, config, exception integration)، مع تمرير متغيرات Docker وترك الإرسال معطلاً بدون DSN.

- [x] **إغلاق خطة تجربة UI الغنية في Masar** — اكتملت طبقة مزودات Next (`next-themes`, React Query, Tooltip/Toast)، ومكتبة `components/ui` فوق Radix، وجداول TanStack في الأرشيف/الملفات/الأخطاء/المستخدمين، ونماذج React Hook Form/Zod في الأنواع/المستخدمين/مهام الوسائط، وKanban بالسحب عبر dnd-kit+motion، وتحليلات Recharts، ولوحة أوامر cmdk. وُثق الإغلاق والمتبقي غير الحاجب في `docs/design/masar-rich-ui-completion-audit.md`.

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
  - الملفات (أمثلة): `archive-app/src/components/navigation/Sidebar.jsx`، `components/common/EmptyState.jsx`، `components/forms/TagAutocomplete.jsx`، و50 ملفًا آخر (الصفحات، features، ui).
  - استُبدلت جميع الفئات المستقلة: `va-accent-text`، `va-accent-text-on-soft`، `va-accent-bg`، `va-accent-bg-soft`، `va-accent-border` (بالإضافة إلى `va-tone-accent`).
  - الحالات التفاعلية (hover/focus) لا تزال تستخدم emerald لكنها محجوبة بواسطة جسر CSS في v1-identity.css بـ `var(--va-action)`.
  - المصدر: improvement-proposals (UI-2)، comprehensive-audit، uiux-report (CRITICAL).

- [x] `[P1]` ⏱️M **React Error Boundaries** (مستوى التطبيق + الأقسام) مع واجهة استرداد.
  - الملفات: `archive-app/src/App.jsx`، shell الصفحات.
  - المصدر: dev-proposals (S2)، improvement-proposals (FE-4).

- [x] `[P1]` ⏱️M **Code splitting عبر `React.lazy`** لكل صفحة.
  - الملفات: `archive-app/src/app/pageRegistry.js`، `pageManifest.js`.
  - المصدر: audit-report، comprehensive-audit.

- [x] `[P1]` ⏱️L **إعادة هيكلة `App.jsx` الضخمة** (632 سطرًا، 15+ `useEffect`) إلى وحدات: Provider / Router / Notifications / Sync.
  - الملفات: `archive-app/src/App.jsx`.
  - المصدر: improvement-proposals (FE-3)، audit-report.

- [x] `[P2]` ⏱️L **إعادة هيكلة CSS بـ `@layer`** لإزالة 150+ `!important`. — ✅ **2026-06-13:** ترتيب طبقات صريح في `tailwind.css` (`@layer app-overrides, v1-identity, v2-identity, v3-identity, v4-identity;`) يتحكّم بالأسبقية عبر الطبقات بدل `!important`؛ انخفض العدد من +150 إلى **30** فقط على مستوى `archive-app/src` (6 من 7 ملفات CSS تستخدم `@layer`).
  - الملفات: `archive-app/src/styles/v1-identity.css` … `v4-identity.css`، `app-overrides.css`، `tailwind.css`.
  - طبقات: reset → tokens → components → themes → utilities (مُطبَّقة عبر طبقات الهوية v1–v4 + app-overrides).
  - المصدر: improvement-proposals (UI-1)، uiux-report (CRITICAL).

- [x] `[P2]` ⏱️L **PWA** — manifest + service worker + كشف الاتصال + background sync (غير موجودة حاليًا).
  - الملفات: `archive-app/` (vite config، public)، storage adapters للـ sync.
  - المصدر: dev-proposals (S6)، audit-report.

- [x] `[P2]` ⏱️S **مقياس مسافات** (`--va-space-1`..`--va-space-8`: 4→64px) بدل القيم المبعثرة.
  - الملفات: `archive-app/src/styles/*`.
  - المصدر: improvement-proposals (UI-4)، comprehensive-audit.

- [x] `[P2]` ⏱️M **إدارة حالة التحميل** — hook عام + تعطيل الأزرار لمنع الإرسال المزدوج.
  - الملفات: `archive-app/src/stores/`، مكوّنات common.
  - المصدر: improvement-proposals (FE-5).

- [x] `[P3]` ⏱️S **تحليل الحزمة** (esbuild-visualizer) وتقليل الحجم الابتدائي (~3MB حاليًا).
  - الملفات: `archive-app/vite.config.js`.
  - ✅ **تم (2026-06-11):** مسار `pnpm --filter @archive/app run analyze` يولد تقرير `dist/bundle-stats.html` عبر `rollup-plugin-visualizer`. فُصل Sentry عن الرسم البياني الافتراضي بتحميل ديناميكي مشروط عند وجود `VITE_SENTRY_DSN` فقط، فانخفض بناء SPA إلى `dist/index.html` بحجم 4.077MB / 1.320MB gzip، وانخفض عدد الوحدات المحوّلة في البناء الافتراضي من 2689 إلى 2467. كما أُصلح سكربت `verify` ليخرج صراحة بعد آخر فحص بدل التعليق بعد طباعة كل نتائج `ok`.
  - المصدر: dev-proposals (P3).

---

## 4. تجربة وواجهة المستخدم (UI/UX & a11y)

- [x] `[P0]` ⏱️M **تأكيد متدرّج للعمليات المدمّرة** — `emptyTrash`/حذف مشروع/حذف وسوم بلا تأكيد.
  - مستويات: عادي «هل أنت متأكد؟» / كتابة نص تأكيد / عدّاد + نص.
  - الملفات: `archive-app/src/components/common/ConfirmDialog.js` ومواضع الاستدعاء.
  - المصدر: improvement-proposals (UX-1)، uiux-report (CRITICAL).

- [x] `[P1]` ⏱️S **إصلاح تباين accent في V4** — `#064e3b` على خلفية داكنة = 1.8:1 (يفشل WCAG AA).
  - غيّر خلفية الزر إلى `#10b981` (5.6:1).
  - الملفات: `archive-app/src/styles/v4-identity.css`.
  - المصدر: improvement-proposals (UI-5)، uiux-report.

- [x] `[P1]` ⏱️L **DialogManager موحّد** — حاليًا 3 أنظمة حوار غير متوافقة (z-index مختلف، Escape غير متوقّع، تعارض scroll lock).
  - تكديس تلقائي، focus trap للأعلى فقط، scroll lock مرجعي، Escape يغلق الأعلى.
  - الملفات: `archive-app/src/components/common/` (ConfirmDialog، EntityFormModal، ForceChangePasswordDialog).
  - المصدر: improvement-proposals (UI-3)، uiux-report.

- [x] `[P1]` ⏱️M **مسار تنقّل (breadcrumbs) تفاعلي** — حاليًا نص واحد غير قابل للنقر.
  - الملفات: PageContextBar / shell التنقّل.
  - المصدر: improvement-proposals (UX-2).

- [x] `[P1]` ⏱️M **واجهة تقدّم للعمليات الطويلة** — نسخ احتياطي/تصدير/رفع بلا مؤشر (%، الوقت المتبقي، إلغاء).
  - استخدم `ProgressEvent` لرفع الملفات.
  - المصدر: improvement-proposals (UX-3).

- [x] `[P1]` ⏱️L **إصلاحات a11y أساسية** — skip link، focus trap في النوافذ، `role`/`aria-label` للأقسام، تسلسل عناوين سليم، `alt` للصور، `aria-live` للمحتوى الديناميكي.
  - الملفات: عبر `archive-app/src/components` و`pages` (موجود اختبار Playwright a11y يكشفها).
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
  - ✅ **مُنجز ومتحقق (2026-06-11):** `useVirtualList` أصبح يفعّل virtualization عند أكثر من 20 عنصرًا على شاشات الموبايل مع الإبقاء على عتبة سطح المكتب الأكبر، وفحص viewport آمن للـ SSR. أضيف `archive-app/src/hooks/useVirtualList.test.js` لتغطية 20/21 عنصرًا على الموبايل وسلوك سطح المكتب، ومرّ `pnpm --filter @archive/app run test`.

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
  - ✅ **مُنجز ومتحقق (2026-06-11):** `vitest-axe` مضاف في `archive-app/package.json`، والـ matcher مسجل في `archive-app/src/test-setup.js`، وتوجد تغطية مكونات في `archive-app/src/__tests__/a11y/components.a11y.test.jsx`. تم تشغيل `pnpm --filter @archive/app run test:a11y` بنجاح: 21 اختبارًا مرّ.

- [x] `[P2]` ⏱️M **توسيع تغطية E2E (Playwright)** — حاليًا ملفّا a11y فقط؛ أضف مسارات وظيفية (رفع، بحث، مشاركة).
  - الملفات: `archive-app/tests/`.
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
  - ✅ **مُنجز ومتحقق (2026-06-11):** أُضيفت معاينة مكبرة في `PreviewPanel` مع `role="dialog"` وزر إغلاق وتوسيع وتنقل سابق/لاحق عبر الأسهم و`Escape` للإغلاق، مع دعم مستند/صورة/فيديو عبر `DocumentViewer` عند الحاجة. أضيف اختبار `archive-app/src/features/archive/PreviewPanel.fullscreen.test.jsx`، ومرّ `pnpm --filter @archive/app run test -- src/features/archive/PreviewPanel.fullscreen.test.jsx` و`pnpm --filter @archive/app run test`.

- [x] `[P3]` ⏱️M **واجهة إدارة API Keys** — **(مكتملة ✅ — مُنجَزة ضمن §20.5)** إنشاء/إلغاء مفاتيح API لتكامل الخدمات الخارجية.
  - جدول: `api_keys` (hash, name, scopes[], lastUsed, expiresAt). ✅ مُطبَّق في `archive-server/prisma/schema.prisma` (`model ApiKey` → `@@map("api_keys")`: `keyHash`/`name`/`scopes[]`/`lastUsedAt`/`expiresAt` + `prefix`/`active`/`ownerId`).
  - الخادم: `archive-server/src/auth/apiKeyService.js` (إصدار/تجزئة/تحقّق/إلغاء بنطاقات scoped). الواجهة: `archive-app/src/components/settings/ApiKeysSettings.jsx` (إصدار/قائمة/إلغاء + كشف المفتاح مرة واحدة) + `ApiKeysSettings.test.jsx`، مدمجة في تبويب الإعدادات. مرجع: commits b8155b0 / a8626e3 / c89b801.

- [x] `[P3]` ⏱️L **حقول بيانات وصفية مخصصة** — إضافة حقول مُعرَّفة من المستخدم (نص/رقم/تاريخ/قائمة) لكل نوع محتوى.
  - ✅ **مكتملة 2026-06-13:** صفحة الأنواع تنشئ حقولاً لكل نوع محتوى، ونماذج الإضافة/التفاصيل تحفظ القيم في `metadata` وتعرضها؛ أُكمل دعم القوائم المتعددة كنوع قابل للاختيار مع واجهة `select multiple` واختبار وحدة يثبت قبول النوع وخياراته.

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
  - الملف: `archive-app/scripts/verify-modules.mjs`.

- [x] `[P1]` ⏱️M **معاينة مباشرة للثيم واللون في معالج الإعداد** — استدعاء `applyAccentColor` و`setTheme` داخل `useEffect` مرتبط بـ `accentColor` و`themeChoice` لمعاينة فورية أثناء الإعداد.
  - الملف: `archive-app/src/features/onboarding/V1OnboardingWizard.jsx`.
  - ✅ **مُنجز مسبقاً:** السطران 446-453 في V1OnboardingWizard.jsx يُطبّقان بالفعل المعاينة الفورية عبر `useEffect` لكل من `accentColor` و`themeChoice`.

- [x] `[P1]` ⏱️M **تصميم حديث لخطوات معالج الإعداد**:
  - خلفية توهّج شبكي (mesh radial glow) بألوان `--va-accent-*` متحركة.
  - أيقونة ✓ للخطوات المكتملة بدل الرقم + توهّج على الخطوة النشطة.
  - تحويل `scale` عند التمرير/النقر على بطاقات الاختيار (dynamic `color-mix`).
  - شريط قوة كلمة المرور بتصميم حديث.
  - الملف: `archive-app/src/features/onboarding/V1OnboardingWizard.jsx`.
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
| غياب اختبارات a11y | موجود Playwright + `@axe-core/playwright` | `archive-app/tests/a11y.spec.ts`, `a11y.v4-contrast.spec.ts` |
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
  - الملفات: `archive-server/src/auth/totpService.js`، `server.js` (مسارات `/api/totp/*`)، `archive-app/src/components/settings/SecuritySettings.jsx`
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
  - الملف: `archive-app/src/hooks/usePresence.js`
  - الإصلاح: أضف exponential backoff (500ms -> 1s -> 2s -> max 30s مع jitter) عند كل محاولة إعادة اتصال.
  - المصدر: deep-audit-v2 (FE-01).

- [x] `[P1]` ⏱️S **`useProgress` — `setTimeout` غير مُنظَّف (Memory Leak)** — المؤقت يُطلق `setState` على مكوّن unmounted.
  - الملف: `archive-app/src/hooks/useProgress.js`
  - الإصلاح: احفظ معرّف `setTimeout` وأضف `return () => clearTimeout(id)` كـ cleanup لـ `useEffect`.
  - المصدر: deep-audit-v2 (FE-02).

- [x] `[P1]` ⏱️S **`useKeyboardListNav` — Stale Closure** — الـ callback يُصبح قديمًا مع تغيّر البيانات.
  - الملف: `archive-app/src/hooks/useKeyboardListNav.js`
  - الإصلاح: استخدم `useRef` للاحتفاظ بآخر نسخة من callback: `const cbRef = useRef(cb); useEffect(() => { cbRef.current = cb; }, [cb]);`.
  - المصدر: deep-audit-v2 (FE-03).

- [x] `[P1]` ⏱️S **`DialogManager` — `role="presentation"` يتعارض مع `aria-modal`** — يُلغي الدلالة الدلالية ويكسر شجرة Accessibility.
  - الملف: `archive-app/src/components/ui/DialogManager.jsx`
  - الإصلاح: احذف `role="presentation"` من العنصر الخارجي (overlay)؛ استخدم `role="dialog"` مع `aria-modal="true"` على الحاوية الداخلية فقط.
  - المصدر: deep-audit-v2 (FE-04).

- [x] `[P1]` ⏱️S **`AutoTagSuggestions` — تنظيف `AbortController` خاطئ** — `controller.abort()` يُستدعى في `finally` قبل اكتمال المعالجة.
  - الملف: `archive-app/src/components/tags/AutoTagSuggestions.jsx`
  - الإصلاح: انقل `abort()` لـ `useEffect` cleanup فقط: `return () => controller.abort()`.
  - المصدر: deep-audit-v2 (FE-05).

- [x] `[P1]` ⏱️S **`DocumentViewer` — Race Condition عند تصيير PDF** — تحميل ملفات متعددة بسرعة يعرض نتيجة رد خاطئ.
  - الملف: `archive-app/src/components/viewer/DocumentViewer.jsx`
  - الإصلاح: استخدم `AbortController` لإلغاء الطلب السابق عند تغيير الملف؛ أو احتفظ بـ `requestId` وتجاهل responses القديمة.
  - المصدر: deep-audit-v2 (FE-06).

- [x] `[P1]` ⏱️S **`RecordVersionHistory` — `window.confirm` يكسر PWA** — لا يعمل في وضع PWA Standalone.
  - الملف: `archive-app/src/components/records/RecordVersionHistory.jsx`
  - الإصلاح: استبدل `window.confirm(...)` بـ `DialogManager` المخصص (Task 19).
  - المصدر: deep-audit-v2 (FE-07).

- [x] `[P1]` ⏱️S **`PresenceIndicator` — يُعطب عند `username` فارغ** — `username?.charAt(0)` يُلقي استثناءً عند سلسلة فارغة.
  - الملف: `archive-app/src/components/collaboration/PresenceIndicator.jsx`
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
  - الملف: `archive-app/src/store/storeCore.js`
  - الإصلاح: استبدل بدمج عميق انتقائي: احتفظ بمفاتيح root غير المُعدَّلة وادمج القواميس المتداخلة (`metadata`، `tags`) بدل استبدالها كاملًا.
  - المصدر: deep-audit-v2 (FE-BE-01).

- [x] `[P1]` ⏱️S **إصلاح `loadAllData` — Race Condition في React StrictMode** — `useEffect` المزدوج يُشغّل تحميلين متزامنين يتعارضان في الحالة.
  - الملف: `archive-app/src/app/archiveSlice.js`
  - الإصلاح: استخدم `useRef` كـ guard: `if (loadingRef.current) return; loadingRef.current = true;`.
  - المصدر: deep-audit-v2 (FE-BE-02).

- [x] `[P1]` ⏱️S **إصلاح `selectors.js` — مراجع جديدة عند كل استدعاء تُسبب Re-Renders زائدة** — الـ selectors تُنشئ مصفوفات/كائنات جديدة حتى لو البيانات لم تتغيّر.
  - الملف: `archive-app/src/store/selectors.js`
  - الإصلاح: اربط الـ selectors بـ `useMemo` مع dependency arrays دقيقة، أو استخدم مكتبة `reselect`.
  - المصدر: deep-audit-v2 (FE-BE-03).

---

### 12.6 تجربة المستخدم — P1

- [x] `[P1]` ⏱️L **توحيد `TagAutocomplete` في جميع حقول الوسوم** — 4 من أصل 5 مواضع تستخدم `input` عادي.
  - الملفات:
    - `archive-app/src/pages/AddVideoPage.jsx:603`
    - `archive-app/src/components/bulk/BulkActionBar.jsx:38-47`
    - `archive-app/src/components/dialogs/QuickAddDialog.jsx:301-303`
    - `archive-app/src/features/wizard/FileArchiveWizard.jsx`
  - الإصلاح: استبدل حقول الوسوم العادية بـ `<TagAutocomplete value={tags} onChange={setTags} />`.
  - المصدر: uiux-deep-audit (UX-01).

- [x] `[P1]` ⏱️M **ربط صفحة التفريغ النصي (Transcription) بالعناصر المؤرشفة** — صفحة التفريغ منفصلة ولا تُنتج `archive_items`.
  - الملف: `archive-app/src/pages/TranscriberPage.jsx`
  - الإصلاح: بعد اكتمال التفريغ أضف زر "حفظ كعنصر أرشيف" يُنشئ `archive_item` بالنص والعنوان والوسوم المستخرجة.
  - ✅ **تم (2026-06-09):** أضيف زر "حفظ كعنصر أرشيف" في شريط نتائج التفريغ؛ يستدعي `addVideoItem` بالعنوان من اسم الملف والنص الكامل في `notes` ونوع الملف (video/audio)؛ يتحول إلى شارة خضراء "تم الحفظ" بعد النجاح.
  - المصدر: uiux-user-journey (UJ-04).

- [x] `[P1]` ⏱️M **إضافة إيماءات اللمس على الجوّال** — لا يوجد swipe أو إجراءات سريعة لمسية.
  - الملفات: `archive-app/src/components/records/RecordCard.jsx`، `archive-app/src/pages/ArchivePage.jsx`
  - الإصلاح: استخدم `@use-gesture/react` أو Pointer Events API: swipe-right للفتح، swipe-left لقائمة الإجراءات، pull-to-refresh.
  - المصدر: uiux-user-journey (UJ-08).

- [x] `[P1]` ⏱️L **واجهة إدارة Field ACL** — `fieldAcl.js` موجود على الخادم بلا واجهة إدارة.
  - الملفات: `archive-server/src/permissions/fieldAcl.js`، `archive-app/src/components/settings/`
  - الإصلاح: أنشئ `FieldPermissionsSettings.jsx` تعرض لكل `contentType` الحقول مع مستوى وصول per-role (قراءة/كتابة/مخفي).
  - المصدر: deep-audit-2026 (UX-05).

- [x] `[P1]` ⏱️L **واجهة مستخدم للتعليقات** ✅ مُنجزة مسبقاً — نموذج بيانات التعليقات موجود في DB بلا واجهة.
  - الملفات: `archive-app/src/pages/DetailPage.jsx`
  - الإصلاح: أضف قسم تعليقات في تفاصيل السجل: عرض القائمة + إضافة تعليق + حذف تعليق المستخدم نفسه مع RBAC.
  - المصدر: deep-audit-2026 (FE-09).
  - ✅ **مُنجزة مسبقاً:** `DetailPage.jsx` يحتوي بالفعل على تبويب "التعليقات" كامل: `addItemComment` / `deleteItemComment` من المتجر؛ `getItemComments` / `canDeleteComment` من viewModel؛ حقل إدخال + قائمة تعليقات + حذف + RBAC.

---

### 12.7 تجربة المستخدم — P2

- [x] `[P2]` ⏱️L **تفعيل Inline Editing في عرض الجدول** — عرض الجدول للقراءة فقط، كل تعديل يتطلب فتح نافذة.
  - الملف التاريخي: `archive-app/src/components/views/TableView.jsx` غير موجود؛ التنفيذ الحالي في `archive-app/src/features/archive/ArchiveViews.jsx`.
  - الإصلاح: خلايا الأعمدة البسيطة المتاحة حالياً (العنوان، النوع، الوسوم) أصبحت قابلة للتعديل المباشر عبر `InlineCellEditor`.
  - المصدر: uiux-deep-audit (UX-02).
  - ✅ **مُنجز ومتحقق (2026-06-11):** `InlineCellEditor.jsx` يدعم نص/وسوم/رقم/تاريخ/قائمة، وجدول `VideoTableView` يربط العنوان/النوع/الوسوم مع حفظ `ArchivePageResults.jsx` عبر `updateVideoItem`. أُضيف تنقل `Tab` / `Shift+Tab` بين الخلايا القابلة للتعديل الحالية، مع اختبارات jsdom: `InlineCellEditor.test.jsx` و`ArchiveViews.inline-edit.test.jsx` (4/4 مرّت). نطاق الأعمدة الإضافية والتراجع الكامل متابع في §13.3.

- [x] `[P2]` ⏱️S **رفع حد `TagCloud` من 40 إلى 200 وسم مع "عرض المزيد"** — يعرض أول 40 وسمًا فقط.
  - الملف: `archive-app/src/features/archive/TagCloud.jsx`
  - الإصلاح: حد افتراضي 200 مع انهيار تدريجي (collapse) للوسوم النادرة وزر "عرض المزيد".
  - المصدر: uiux-deep-audit (UX-03).
  - ✅ **تم (2026-06-09):** Task #2.

- [x] `[P2]` ⏱️S **مؤشر تقدم لأزرار التصدير** — التصدير يبدأ صامتًا بلا مؤشر مرئي.
  - الملف: `archive-app/src/components/archive/ExportButton.jsx`
  - الإصلاح: أضف حالة `loading` للزر مع شريط تقدم يُحدَّث عبر `useProgress` أو SSE.
  - المصدر: uiux-user-journey (UJ-06).
  - ✅ **تم (2026-06-09):** الزر يعرض spinner + "جاري التصدير..." عبر `isLoading("export")`؛ ChevronDown مخفي أثناء التصدير.

- [x] `[P2]` ⏱️M **إضافة تراجع (Undo) بعد الاستيراد** ✅ 2026-06-09 — السجلات تُضاف بصورة دائمة فور التأكيد بلا إمكانية تراجع.
  - الملفات: `archive-app/src/features/archive/FileArchiveWizard.jsx`
  - الإصلاح: احتفظ بـ IDs السجلات المُضافة في state لمدة 30 ثانية مع زر "تراجع" يستدعي `deleteBatch`.
  - المصدر: uiux-user-journey (UJ-07).
  - ✅ **تم (2026-06-09):** `createItems` يجمع IDs قبل الحفظ؛ بعد النجاح يستدعي `showNotification` مع action `{ label: "تراجع", run: () => bulkDeleteItems(ids) }`.

- [x] `[P2]` ⏱️S **تفعيل Virtual List على سطح المكتب** — مُفعَّل للجوّال فقط رغم أن الحزمة مثبتة.
  - الملف: `archive-app/src/hooks/useVirtualList.js`
  - الإصلاح: أزل شرط `isMobile` أو اجعل الحد الأدنى للتفعيل 50 عنصرًا على كل الأجهزة.
  - المصدر: uiux-deep-audit (UX-04).
  - ✅ **تم (2026-06-09):** حُذف شرط `isMobile`؛ الحد رُفع إلى 50 عنصرًا على جميع الأجهزة.

- [x] `[P2]` ⏱️M **رسائل خطأ بلغتين (عربي + إنجليزي)** ✅ 2026-06-09 — رسائل الخطأ عربية فقط.
  - الملف: `archive-app/src/utils/errorMessages.js`
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

- [x] `[P0]` ⏱️XL **رفع الملفات الفعلي مع رفع مقسم وطابور في الخلفية** — النظام يخزن بيانات وصفية فقط، لا يرفع ملفات حقيقية.
  - 🔄 **تقدّم 2026-06-13 (الأساس العامل):** أُنشئت الطبقة الأساسية فوق `FileStore` الموجود (`PUT /api/files/{key}`):
    - `archive-app/src/hooks/useChunkedUpload.js` — رفع فعلي بتقدّم دقيق عبر `XMLHttpRequest` (fetch لا يعطي تقدّم رفع)، بصمة `SHA-256` بمقاطع 5MB لمفتاح محتوى-معنون (دمج تكرارات)، إلغاء عبر `AbortController`.
    - `archive-app/src/stores/slices/uploadSlice.js` — طابور خلفي في المتجر (`enqueueUploads`/`updateUpload`/`retryUpload`/`clearFinishedUploads` + `selectUploadProgress`)، مُركَّب في `appStore.js`.
    - `archive-app/src/components/upload/UploadQueue.jsx` — لوحة طابور حيّة (تقدّم إجمالي + لكل ملف، إعادة/إزالة/مسح المكتمل).
    - ✅ كل الملفات تُحلَّل (esbuild/node) والربط في المتجر مكتمل.
  - 🔄 **تقدّم 2026-06-14 (ربط التدفقات):**
    - `archive-app/src/features/upload/uploadLink.js` يربط إدخال الطابور بـ `metadata.localFile` ويثبّت مفتاح الملف في `metadata.fileKey`/`storageKey`/`media.sourceKey` عند اكتمال الرفع.
    - `archive-app/src/components/upload/UploadQueueController.jsx` يعمل عالمياً من طبقة الإشعارات حتى لا تُلغى الرفعات عند مغادرة صفحة الإضافة/الاستيراد.
    - `AddVideoPage.jsx` يضيف الملف المختار إلى الطابور ويحفظ `uploadId` داخل المادة، ثم يربط إدخال الطابور بـ `linkedItemId` بعد الحفظ.
    - `FileArchiveWizard.jsx` يضيف كل ملف مستورد إلى الطابور بعد إنشاء عنصره مع `linkedItemId`.
    - ✅ اختبارات: `uploadLink.test.js`، `UploadQueueController.test.jsx`، `AddVideoPage.upload.test.jsx`، `FileArchiveWizard.upload.test.jsx`.
  - ✅ **تقدّم 2026-06-14 (endpoints الرفع المقسّم)**:
    - `archive-server/src/api/chunkedUpload.js` — مدير جلسات الرفع (`initSession`/`receiveChunk`/`completeSession`/`abortSession`/`sessionStatus`)؛ الأجزاء تُخزَّن في `os.tmpdir()` وتُجمَّع عند الاكتمال؛ كنس تلقائي للجلسات المنتهية (TTL 24 ساعة).
    - 4 endpoints جديدة في `server.js`: `POST /api/upload-sessions` (init) · `PUT /api/upload-sessions/:id/chunks/:index` (جزء) · `POST /api/upload-sessions/:id/complete` (تجميع وكتابة) · `DELETE /api/upload-sessions/:id` (إلغاء).
    - `useChunkedUpload.js` محدَّث: ملفات > 5MB تستخدم API الجلسة مع استئناف تلقائي (تخطّي الأجزاء المُرفوعة)؛ الملفات الصغيرة تبقى على PUT واحد.
    - اختبارات: `useChunkedUpload.test.js` (9 اختبارات: hashBlob × 5، putBlobChunked × 4) — **249 اختبار يمرّ**.
  - ⬜ **المتبقّي (اختياري مستقبلاً):** تحقق بصري نهائي للطابور على الجوال/سطح المكتب.
  - الملفات الجديدة: `archive-app/src/stores/slices/uploadSlice.js`، `archive-app/src/hooks/useChunkedUpload.js`، `archive-app/src/components/upload/UploadQueue.jsx`، `archive-app/src/components/upload/UploadQueueController.jsx`، `archive-app/src/features/upload/uploadLink.js`.
  - التغييرات: `archive-app/src/pages/AddVideoPage.jsx`، `archive-app/src/features/archive/FileArchiveWizard.jsx`، `archive-app/src/app/AppNotifications.jsx`.
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
  - الملفات الجديدة: `archive-app/src/components/media/VideoPlayer.jsx`، `archive-app/src/components/media/SubtitleRenderer.jsx`، `archive-app/src/features/media/subtitleParser.js`، `archive-app/src/features/media/transcriptToSrt.js`.
  - التنفيذ: شريط تقدم مخصص مع معاينة مصغرات (thumbnails)؛ دعم SRT/VTT مع عرض على الفيديو وتخصيص الخط واللون؛ تحكم بالسرعة (0.5x–2x)؛ اختصارات لوحة مفاتيح (Space/←→/↑↓/F)؛ Picture-in-Picture؛ تحويل ناتج Whisper تلقائياً إلى SRT؛ مزامنة مع `TranscriptSyncWorkbench`.
  - الجهد: 6-8 أسابيع. يرفع درجة مرحلة الميديا من 58 إلى 85+.
  - المصدر: feature-proposals-2026 (محور 4 — ميزة #20).

- [x] `[P0]` ⏱️XL **محرر خط زمني بصري للمونتاج مع موجة صوتية** — المحرر الحالي يعتمد على إدخال أرقام بلا معاينة بصرية.
  - الملفات الجديدة: `archive-app/src/features/projects/TimelineEditor.jsx`، `WaveformTrack.jsx`، `VideoTrack.jsx`، `SubtitleTrack.jsx`، `TransitionsPanel.jsx`، `ExportDialog.jsx`.
  - تغييرات: `archive-server/src/export/ffmpegPlan.js`.
  - التنفيذ: عرض موجة صوتية عبر `wavesurfer.js`؛ سحب حواف المقاطع لتعديل نقاط البداية/النهاية؛ معاينة فورية؛ مسارات متعددة (فيديو + صوت + ترجمة)؛ تصدير محسّن مع اختيار الدقة/الترميز/الجودة؛ انتقالات بسيطة (crossfade/cut/dissolve)؛ Undo/Redo.
  - **✅ مُنجَز (شريحة، 2026-06-15):** نموذج خطّ زمني نقي + مساعد موجة صوتية + مكوّن مرئي مدمج في صفحة المونتاج، إضافيًا ومتوافقًا مع الخلف (التصدير JSON/EDL/MP4 سليم).
    - الملفات: `archive-app/src/features/montage/timelineModel.js` (`buildClipLayout`/`moveClip`/`trimClip`/`totalDuration`/`timeToPx`/`pxToTime`) + `timelineModel.test.js`؛ `archive-app/src/features/montage/waveform.js` (`downsamplePeaks`/`peaksToBars`/`placeholderPeaks`) + `waveform.test.js`؛ `archive-app/src/components/montage/TimelineTrack.jsx` (كتل مقاطع متناسبة + مسطرة زمنية + شريط موجة + تحديد + سحب بالماوس لإعادة الترتيب)؛ دمج في `archive-app/src/pages/ProjectsPage.jsx` بجانب مدخلات الأرقام (محفوظة).
    - 628 اختبارًا ناجحًا (593 قائمة + 35 جديدًا)، و`build:spa` أخضر.
    - مؤجَّل: فكّ ترميز صوتي حقيقي عبر `wavesurfer.js`؛ سحب حواف للتقليم (trim) في الواجهة (المنطق `trimClip` جاهز ومختبَر)؛ مسارات ترجمة/فيديو متعددة؛ انتقالات؛ Undo/Redo؛ تغييرات `ffmpegPlan.js`.
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

- [x] `[P1]` ⏱️L **التعديل المضمّن في عرض الجدول (InlineCellEditor)** — كل تعديل يتطلب فتح صفحة التفاصيل والعودة. **(المرحلة 1 منجزة ✅)**
  - الملفات الجديدة: `archive-app/src/components/data/InlineCellEditor.jsx` ✅ (مكوّن عام: نص/وسوم/رقم/تاريخ/قائمة، Enter يحفظ، Escape يلغي، blur يحفظ، RTL، وTab/Shift+Tab يطلب الانتقال).
  - تغييرات: `archive-app/src/features/archive/ArchiveViews.jsx` ✅ (ربط InlineCellEditor بخلايا العنوان/النوع/الوسوم في `VideoTableView` عبر أيقونة قلم/نقر مزدوج؛ خلية واحدة قيد التحرير في كل مرة؛ تنقل Tab/Shift+Tab بين الأعمدة القابلة للتعديل)، `ArchivePageResults.jsx` ✅ (الحفظ عبر `updateVideoItem` مع سجل التغييرات + toast نجاح/فشل).
  - ✅ المرحلة 1 (2026-06-10): تحرير العنوان والوسوم مضمّنًا؛ حفظ عند Enter/مغادرة الخلية؛ Escape للإلغاء؛ تجاهل القيم غير المتغيّرة/الفارغة.
  - ✅ تحديث (2026-06-11): محرر النوع كقائمة + نقر مزدوج للخلايا المدعومة + تنقل `Tab` / `Shift+Tab` بين العنوان/النوع/الوسوم، مع اختبارات `InlineCellEditor.test.jsx` و`ArchiveViews.inline-edit.test.jsx`.
  - ✅ **2026-06-13:** Ctrl+Z للتراجع مُنجَز — `undoLastActivity` نُقل من `activityLogSlice` عبر `useArchivePageState` إلى `ArchivePageResults` حيث يُعالج `keydown` Ctrl+Z عالمياً (يتجاهل الحقول النصية والـ contentEditable).
  - ✅ **مُنجز ومتحقق (2026-06-13):** يدعم `VideoTableView` الآن أعمدة metadata مخصصة بصيغة `metadata:<key>` مع `InlineCellEditor` لأنواع `text/tags/number/date/select`، ويحفظ التعديل داخل `metadata` مع استمرار تنقل Tab بين الأعمدة القابلة للتحرير. تحقق: `ArchiveViews.inline-edit.test.jsx`.
  - الجهد: 3-4 أسابيع (المتبقي ~1-2 أسبوع).
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #3). ملاحظة: P2 placeholder موجود في §12.7 — هذه الميزة الكاملة.

- [x] `[P1]` ⏱️L **Service Worker ذكي — Workbox strategies + Background Sync كامل** — SW الحالي cache-first بسيط (Task #39). هذه ترقية لـ Workbox كامل.
  - الملف: `archive-app/public/sw.js`، `archive-app/vite.config.js`.
  - التنفيذ: `precacheAndRoute` لـ app shell؛ `StaleWhileRevalidate` لـ `/api/`؛ `CacheFirst` للصور والخطوط؛ `BackgroundSync Queue` لعمليات الكتابة أوفلاين تُرسل عند عودة الاتصال؛ `Periodic Background Sync` للمزامنة التلقائية. التطبيق يعمل أوفلاين بشكل كامل (تصفح + إنشاء + تعديل).
  - ✅ **مُنجز (2026-06-14):** `archive-app/public/sw.js` أُعيد بناؤه كليًا (v3): App-shell CacheFirst، API-GET Network-first مع cache fallback، API-mutations BackgroundSync queue، CacheFirst للخطوط/الأيقونات، StaleWhileRevalidate للـ JS/CSS/images، PeriodicBackgroundSync. لا يتطلب مكتبة خارجية. إشعارات push (§20.2) محفوظة.
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #5).

- [x] `[P1]` ⏱️L **تنقل سفلي ذكي للجوال (Smart Bottom Tabs)** — الشريط الجانبي يتخفّى على الجوال بلا بديل تنقل سفلي.
  - الملفات الجديدة: `archive-app/src/components/layout/BottomTabBar.jsx`.
  - تغييرات: `archive-app/src/components/layout/MobileActionBar.jsx` → ترقية أو استبدال.
  - التنفيذ: 4-5 أقسام رئيسية تتكيف مع الاستخدام (الأكثر استخداماً أولاً)؛ سحب لإعادة الترتيب؛ ضغط مطوّل لفتح الأقسام الفرعية؛ `safe-area-inset-bottom` للـ notch؛ يحل محل `MobileActionBar`.
  - الجهد: 2-3 أسابيع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #6).

- [x] `[P1]` ⏱️M **إصلاح تبديل الباكند فوري بلا إعادة تشغيل** — تبديل الباكند (محلي↔سحابي) يتطلب إعادة تشغيل التطبيق.
  - الملفات: `archive-app/src/app/App.jsx` أو `registerByBackendChoice.js`، صفحة الإعدادات.
  - التنفيذ: عند تغيير `backendChoice` → `flushPendingWrites()` → `registerByBackendChoice()` ديناميكياً → `loadAllData()` من الباكند الجديد → `showToast("تم التبديل بنجاح")`؛ مؤشر "جاري التبديل…" أثناء العملية.
  - الجهد: 1-2 أسبوع.
  - المصدر: feature-proposals-2026 (محور 1 — ميزة #8).
  - ✅ **تم (2026-06-09):** `switchBackendHot.js` مُنشأ يُسلسل: persist → `registerByBackendChoice()` → `loadAllData()`؛ `LocalStorageEngineSettings.jsx` محدَّث لاستخدامه بدلاً من `setBackendChoice` + رسالة إعادة التحميل.

---

### 13.4 P1 — التشغيل والنشر والبنية التحتية

- [x] `[P1]` ⏱️L **لوحة تحكم صحة السيرفر المدمجة (ServerStatusPage)** — لا توجد واجهة لحالة السيرفر؛ يتطلب CLI.
  - الملفات الجديدة: `archive-app/src/pages/ServerStatusPage.jsx`.
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

- [x] `[P1]` ⏱️L **طابور مهام وسائط مستمر — Redis-persisted job store** — مهام FFmpeg في الذاكرة فقط، تُفقد عند إعادة تشغيل السيرفر.
  - الملفات: `archive-server/src/media/mediaJobs.js` → استبدال `createInMemoryMediaJobStore`.
  - التنفيذ: `Queue('media-jobs', { connection: redisConnection })`؛ `Worker` بـ concurrency قابل للإعداد (`MEDIA_JOB_CONCURRENCY`)؛ المهام تنجو من إعادة التشغيل؛ أولويات (probe > thumbnail > transcode)؛ إعادة محاولة تلقائية عند الفشل؛ متابعة تقدم المهمة من أي جلسة.
  - ✅ **مُنجز (2026-06-14):** `archive-server/src/media/redisMediaJobStore.js` — مخزن مهام هجين (in-memory عند التشغيل + Redis للاستمرارية): يُحمَّل من Redis عند بدء التشغيل ليستعيد المهام المعلقة، ويكتب لـ Redis بعد كل تعديل (fire-and-forget)؛ أولويات صريحة (probe>thumbnail>transcode)؛ تنظيف دوري (hourly prune للمهام المنتهية >7 أيام)؛ يعود تلقائيًا لـ createInMemoryMediaJobStore() عند غياب REDIS_URL. `index.js` يستدعي `tryCreateRedisMediaJobStore()` قبل بدء الخادم ويمرره كـ `mediaJobStore`. 249 اختبار أخضر.
  - الجهد: 3-4 أسابيع.
  - المصدر: feature-proposals-2026 (محور 3 — ميزة #17).

- [x] `[P1]` ⏱️L **استعادة النسخ الاحتياطية من الواجهة مع استعادة جزئية** — ✅ 2026-06-12: `BackupManager.jsx` أُعيد بناؤه بالكامل: معاينة محتوى النسخة (store counts)، اختيار مخازن فردية (partial restore)، تأكيد مزدوج بكتابة "استعادة"، دعم كلمة مرور للنسخ المشفّرة. `previewBackup()` export جديد في `backupScheduler.js`، `POST /api/admin/backups/preview` endpoint جديد، `stores` filter في `restoreBackup()` + `if (!(domainKey in payload)) continue` في كلا المحوّلَين.
  - الملفات: `archive-app/src/pages/DataCenterPage.jsx`، `archive-server/src/backup/backupScheduler.js`.
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

- [x] `[P2]` ⏱️XL **مساعد ذكي مدمج (AI Copilot) — لوحة جانبية قابلة للطي** — مزودو AI متاحون لكن معزولون في صفحة منفصلة.
  - الملفات الجديدة: `archive-app/src/components/ai/AICopilotPanel.jsx`، `archive-app/src/components/ai/AICopilotButton.jsx`.
  - التنفيذ: اقتراحات ذكية أثناء إدخال العنوان/الوصف؛ توليد وسوم تلقائية من المحتوى؛ تلخيص عنصر أو مجموعة بنقرة؛ إجابة أسئلة بالعربية عن المحتوى المؤرشف؛ توليد تقارير ذكية (إحصائيات/أنماط/توصيات)؛ لوحة جانبية قابلة للطي لا تعيق العمل.
  - الصلاحية: admin + editor.
  - الجهد: 6-8 أسابيع.
  - المصدر: feature-proposals-2026 (محور 4 — ميزة #22).
  - **✅ مُنجَز (2026-06-14):** شريحة عمودية أولى للوحة المساعد الجانبية القابلة للطي، تُعيد استخدام منفذ `AiProvider` الموجود عبر `useAiAssist().chat` (يوكّل إلى `cloud-ai → /api/ai/rpc`) بدل بناء عميل ذكاء جديد.
    - الملفات: `archive-app/src/features/copilot/copilotModel.js` (نموذج محادثة نقي: `createMessage`/`appendMessage`/`trimHistory`/`buildSuggestedPrompts`) + `copilotModel.test.js`؛ `archive-app/src/stores/slices/copilotSlice.js` (شريحة `copilotOpen`/`copilotMessages` + `toggleCopilot`/`setCopilotOpen`/`addCopilotMessage`/`clearCopilot`) مركّبة في `appStore.js`؛ `archive-app/src/components/copilot/CopilotPanel.jsx` (درج منزلق RTL + قائمة رسائل + إدخال + رقائق اقتراحات + زر إغلاق)؛ زرّ عائم عالمي + تركيب اللوحة في `app/AppRouter.jsx`؛ إضافة `chat` إلى `features/ai/useAiAssist.js`.
    - مسار الإرسال آمن من الفشل: يتدهور إلى ردّ عربي «المساعد غير مُهيّأ» عند غياب مزوّد، دون تعطّل التطبيق أو رفض وعود غير مُلتقَط.
    - التحقق: 494 اختبارًا ناجحًا (منها 19 جديدًا)، و`build:spa` أخضر.
    - مؤجّل (XL): البثّ المباشر (streaming)، توليد الوسوم/الملخّص بنقرة من داخل اللوحة وربطها بحقول العنصر، تقارير ذكية كاملة، وبوابة صلاحيات admin+editor على مستوى اللوحة.

- [x] `[P2]` ⏱️L **سير عمل المراجعة والموافقة (Draft → Review → Approved → Published)** — لا حالات للمحتوى؛ أي مستخدم بإذن تعديل يمكنه نشر مباشرة.
  - الملفات: حقل `status` في `StorageRow.data`؛ `archive-app/src/components/review/ReviewWorkflow.jsx`؛ تكامل مع نظام RBAC الموجود.
  - التنفيذ: 4 حالات (مسودة/قيد المراجعة/معتمد/منشور)؛ إشعارات للمراجعين عند تقديم عنصر؛ تعليقات مراجعة منظمة مع طلب تعديلات؛ سجل مراجعة كامل؛ تكامل مع ACL + Comments.
  - ✅ **مُنجز ومتحقق (2026-06-13):** أصبحت صفحة التفاصيل تعرض `StatusTransitionMenu` في رأس السجل حسب `workflowStatus` ودور المستخدم، وتطبّق الانتقال عبر API سير العمل ثم تحفظ الحالة الجديدة في السجل المحلي مع تحديث النسخة. تحقق: `DetailPage.relations.test.jsx` و`StatusTransitionMenu.test.jsx`.
  - الجهد: 4-6 أسابيع.
  - المصدر: feature-proposals-2026 (محور 4 — ميزة #24).

- [x] `[P2]` ⏱️L **صفحة مساعدة تفاعلية مع جولة إرشادية react-joyride** — صفحة المساعدة الحالية أساسية بلا توجيه.
  - الملفات: `archive-app/src/pages/HelpPage.jsx` (موجود → ترقية)؛ `archive-app/src/components/onboarding/OnboardingTour.jsx` جديد.
  - التنفيذ: جولة إرشادية (onboarding tour) عبر `react-joyride` للمستخدمين الجدد؛ دليل استخدام تفاعلي مع لقطات شاشة؛ بحث في المحتوى التعليمي؛ تلميحات سياقية (tooltips) على كل ميزة؛ اختصارات لوحة مفاتيح قابلة للاكتشاف.
  - ✅ **مُنجز ومتحقق (2026-06-13):** صفحة المساعدة أصبحت مركزًا تفاعليًا قابلًا للبحث مع فهرس، روابط أقسام مباشرة، إعادة تشغيل الجولة الحالية، اختصارات فعلية، وطبقة جديدة من التلميحات السياقية المبنية من `PAGE_MANIFEST` لكل صفحة. لم تُضف `react-joyride` لأن التطبيق يملك جولة مدمجة بالفعل في `RuntimeShellApp`/`ShellParts` و`V1OnboardingWizard`. تحقق: `help/viewModel.test.js`، `pnpm --filter @archive/app run verify`، و`pnpm --filter @archive/app run build:spa`.
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
    - `archive-app/src/features/activityLog/viewModel.js` — `createActivityEntry`, `buildDiff`, `describeActivity`
    - `archive-app/src/features/activityLog/undoManager.js` — `withActivityLog`, `undoActivityEntry`, `redoActivityEntry`
    - `archive-app/src/components/activity/ActivityTimeline.jsx` — شريط النشاط الزمني مجمّع حسب اليوم
    - `archive-app/src/components/activity/ActivityEntry.jsx` — عنصر نشاط واحد مع زر تراجع/استعادة
    - `archive-app/src/components/activity/DiffView.jsx` — عرض الفروقات قبل/بعد
    - `archive-app/src/components/activity/ActivityFilterBar.jsx` — فلترة حسب نوع/تاريخ/مستخدم
    - `archive-app/src/pages/ActivityPage.jsx` — صفحة سجل النشاط الكاملة
    - `archive-app/src/stores/slices/activityLogSlice.js`
  - **تعديل ملفات:**
    - `archive-app/src/services/storage/schema.js` — إضافة store `activity_log`
    - `archive-server/prisma/schema.prisma` — نموذج `ActivityLog` مع فهارس
    - `archive-app/src/pages/ArchivePage.jsx` — زر "سجل النشاط" في الشريط العلوي
    - `archive-app/src/pages/DetailPage.jsx` — `<ActivityForTarget targetType="item" targetId={id} />`
    - `archive-app/src/components/navigation/Sidebar.jsx` — رابط صفحة السجل
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
    - `archive-app/src/features/notifications/pushManager.js` — `requestNotificationPermission`, `showBrowserNotification`
    - `archive-app/src/components/notifications/NotificationCenter.jsx` — لوحة الإشعارات الرئيسية مع فلترة
    - `archive-app/src/components/notifications/NotificationCard.jsx` — بطاقة إشعار مع شريط تقدم + أزرار إجراء
    - `archive-app/src/components/notifications/NotificationBell.jsx` — جرس الشريط العلوي مع badge عداد
    - `archive-app/src/stores/slices/notificationsSlice.js`
  - **تعديل ملفات:**
    - `archive-app/src/features/notifications/viewModel.js` — توسيع `createNotification` + `NOTIFICATION_TYPES` + `shouldGroupNotifications`
    - `archive-app/src/services/storage/schema.js` — إضافة `notifications`, `notification_prefs`
    - `archive-app/src/pages/ArchivePage.jsx` — ربط التصدير/الاستيراد بإشعارات التقدم
    - `archive-app/src/components/layout/TopBar.jsx` — إضافة `<NotificationBell>`
  - **التنفيذ:** 4 فئات (operation/collaboration/system/smart)؛ تجميع ذكي للإشعارات المتشابهة؛ شريط تقدم للعمليات الطويلة؛ Push API للتنبيه حتى لو التطبيق في الخلفية؛ أزرار إجراءات سريعة.
  - ملاحظة: `viewModel.js` موجود بالفعل في `features/notifications/` لكن يحتاج توسيع جوهري.
  - الجهد: 3-5 أسابيع. ~9 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-daily-use-proposals (المقترح 2 — P0).

---

### 14.3 P0 — نظام المجلدات الهرمي (Folder Tree)

- [x] `[P0]` ⏱️XL **بناء نظام مجلدات هرمي كمستكشف الملفات** — الأرشيف قائمة مسطحة؛ لا تنظيم هرمي؛ لا يمكن إنشاء بنية مثل `أرشيف 2024/محاضرات/الفصل الأول`.
  - **الملفات الجديدة:**
    - `archive-app/src/features/folders/viewModel.js` — `createFolderValue`, `buildFolderTree`, `getAllItemsInFolder`
    - `archive-app/src/components/folders/FolderTree.jsx` — شجرة المجلدات (ARIA tree role)
    - `archive-app/src/components/folders/FolderTreeNode.jsx` — عقدة مع توسيع/طي وقائمة سياق
    - `archive-app/src/components/folders/FolderBreadcrumb.jsx` — مسار التنقل
    - `archive-app/src/stores/slices/foldersSlice.js`
    - `archive-app/src/pages/FoldersPage.jsx` (يمكن دمج مع ArchivePage)
  - **تعديل ملفات:**
    - `archive-app/src/services/storage/schema.js` — store `archive_folders`
    - `archive-server/prisma/schema.prisma` — نماذج `ArchiveFolder` + `FolderItem`
    - `archive-app/src/pages/ArchivePage.jsx` — `<FolderTree>` في الشريط الجانبي مع تبويب وسوم/مجلدات
    - `archive-app/src/pages/AddVideoPage.jsx` — حقل اختيار المجلد
    - `archive-app/src/pages/DetailPage.jsx` — عرض المسار الكامل للمجلد الحاوي
  - **التنفيذ:** مجلدات فرعية غير محدودة؛ مسار breadcrumb تفاعلي؛ سحب وإفلات العناصر؛ عداد العناصر + الحجم؛ RTL عربي كامل؛ لا تعارض مع المجموعات الموجودة.
  - الجهد: 5-7 أسابيع. ~11 ملف جديد/معدَّل.
  - المصدر: archive-suite-new-feature-proposals (المقترح 1 — P0).

---

### 14.4 P1 — نظام القوالب والتعبئة السريعة (Templates & Quick Fill)

- [x] `[P1]` ⏱️L **بناء نظام القوالب المرنة لتسريع الإدخال اليومي** — لا قوالب؛ نفس البيانات (نوع/وسوم/مجلد) تُدخَل يدوياً في كل مرة.
  - **الملفات الجديدة:**
    - `archive-app/src/features/templates/viewModel.js` — `createItemTemplate`, `resolveDynamicFields`, `BUILT_IN_TEMPLATES`
    - `archive-app/src/components/templates/TemplatePicker.jsx` — اختيار القالب عند الإضافة
    - `archive-app/src/components/templates/QuickAddBar.jsx` — شريط الإضافة السريعة (Enter لكل عنصر)
    - `archive-app/src/components/templates/TemplateEditor.jsx` — محرر القوالب المخصصة
    - `archive-app/src/stores/slices/templatesSlice.js`
  - **تعديل ملفات:**
    - `archive-app/src/pages/AddVideoPage.jsx` — `<TemplatePicker>` قبل النموذج + وضع QuickAdd
    - `archive-app/src/services/storage/schema.js` — store `templates`
  - **التنفيذ:** حقول ثابتة + ديناميكية (`today()`, `autoNumber()`, `concat()`)؛ 3 قوالب مدمجة (محاضرة/مستند/صوت)؛ وضع الإضافة السريعة لعشرات العناصر متتالية؛ تتبع الاستخدام.
  - الجهد: 3-4 أسابيع. ~7 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-daily-use-proposals (المقترح 3 — P1).

---

### 14.5 P1 — نظام الحفظ التلقائي وجلسات العمل (Auto-save & Work Sessions)

- [x] `[P1]` ⏱️L **بناء نظام حفظ تلقائي شامل مع استعادة جلسات العمل** — لا حفظ تلقائي؛ مغادرة صفحة الإضافة تُفقد كل البيانات؛ لا استئناف للعمليات الجماعية المنقطعة.
  - **الملفات الجديدة:**
    - `archive-app/src/features/autosave/viewModel.js` — `createDraft`, `createWorkSession`, `createBulkProgress`
    - `archive-app/src/features/autosave/autosaveEngine.js` — `createAutosaveEngine` (30s interval + beforeunload guard)
    - `archive-app/src/features/autosave/sessionManager.js` — `createSessionManager` (استعادة جلسة <1 ساعة)
    - `archive-app/src/components/autosave/AutosaveIndicator.jsx` — مؤشر حالة (محفوظ / غير محفوظ / جاري)
    - `archive-app/src/components/autosave/DraftRecoveryDialog.jsx` — حوار استعادة المسودة
    - `archive-app/src/components/autosave/SessionRestoreBanner.jsx` — شعار استعادة الجلسة
    - `archive-app/src/components/autosave/BulkProgressPanel.jsx` — لوحة استئناف العمليات الجماعية
  - **تعديل ملفات:**
    - `archive-app/src/pages/AddVideoPage.jsx` — `startTracking` + `DraftRecoveryDialog`
    - `archive-app/src/pages/DetailPage.jsx` — حفظ تلقائي بمفتاح `edit_item_${id}`
    - `archive-app/src/pages/ArchivePage.jsx` — `SessionManager` + حفظ الفلاتر/التمرير/المجلد
    - `archive-app/src/services/storage/schema.js` — stores: `drafts`, `work_sessions`, `bulk_progress`
  - **التنفيذ:** حفظ تلقائي كل 30 ثانية؛ تحذير beforeunload؛ استعادة المسودات؛ استئناف العمليات الجماعية المنقطعة.
  - الجهد: 3-4 أسابيع. ~11 ملف جديد/معدَّل.
  - المصدر: archive-suite-daily-use-proposals (المقترح 4 — P1).

---

### 14.6 P1 — نظام الارتباطات والعلاقات بين العناصر (Item Relations & Links)

- [x] `[P1]` ⏱️L **بناء نظام علاقات مرن لربط العناصر بعلاقات ذات معنى** — العناصر معزولة؛ لا طريقة لربط محاضرات سلسلة أو مستند بفيديو معيّن.
  - **الملفات الجديدة:**
    - `archive-app/src/features/relations/viewModel.js` — `createRelation`, `RELATION_TYPES`, `getItemRelations`, `buildRelationsGraph`
    - `archive-app/src/components/relations/RelationsPanel.jsx` — لوحة العلاقات في صفحة التفاصيل
    - `archive-app/src/components/relations/AddRelationDialog.jsx` — حوار إضافة علاقة مع بحث + نوع
    - `archive-app/src/components/relations/RelationsGraph.jsx` — رسم بياني تفاعلي (D3/cytoscape)
    - `archive-app/src/stores/slices/relationsSlice.js`
  - **تعديل ملفات:**
    - `archive-app/src/pages/DetailPage.jsx` — إضافة تبويب `<RelationsPanel>`
    - `archive-app/src/pages/ArchivePage.jsx` — زر "عرض العلاقات" + دعم سحب/إفلات
    - `archive-app/src/services/storage/schema.js` — store `item_relations`
    - `archive-server/prisma/schema.prisma` — نموذج `ItemRelation`
  - **التنفيذ:** 9 أنواع علاقات (is_part_of/references/related_to/depends_on/copy_of/precedes/follows/contains/alternative_of)؛ علاقات أحادية وثنائية الاتجاه؛ رسم بياني تفاعلي حتى عمق 2؛ إنشاء علاقات بالسحب والإفلات.
  - الجهد: 4-5 أسابيع. ~9 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-daily-use-proposals (المقترح 5 — P1).

---

### 14.7 P1 — نظام المجموعات/الحاويات الافتراضية المُحسّن (Enhanced Virtual Collections)

- [x] `[P1]` ⏱️XL **ترقية المجموعات من قوائم ثابتة إلى حاويات افتراضية غنية متعددة المصادر** — المجموعات الحالية قوائم ثابتة (itemIds فقط)؛ لا تدعم مصادر متعددة ولا فلترة متقدمة.
  - **✅ مُنجَز (2026-06-14):** شريحة عمودية لمحرّك العضوية متعدد المصادر. أُضيف `archive-app/src/features/collections/collectionSources.js` (`resolveMultiSourceItems` + `createCollectionSource` + `normalizeSources` + `describeSources`) يوحّد عناصر من مصادر `manual`/`rules`/`query` مع إزالة التكرار، استبعاد المحذوف، وترتيب ثابت (أول ظهور للمعرّف يفوز). أعاد استخدام `evaluateSmartCollection` و`getFilteredArchiveItems`. رُبط في `viewModel.js`: `resolveCollectionItems` يستدعي المحلّل عند وجود `collection.sources` غير فارغ وإلا يُبقي السلوك السابق دون تغيير (متوافق رجعياً)؛ و`createVirtualCollectionValue` يمرّر `sources`. اختبار مرافق `collectionSources.test.js` (اتحاد+إزالة تكرار عبر الأنواع، استبعاد المحذوف، مصادر فارغة/غير صالحة، ثبات الترتيب). **466 اختباراً ناجحاً، build:spa أخضر.** **مؤجَّل (XL):** واجهة المستخدم (ContainerContentsPanel/FilterRuleBuilder/تبويبات CollectionsPage)، `applyFilterRules.js`، `cycleDetection.js` (منع الحلقات المرجعية)، مصادر المجلدات/المجموعات المرجعية، وتحديثات `archiveSlice.js`.
  - **الملفات الجديدة:**
    - `archive-app/src/components/collections/ContainerContentsPanel.jsx` — تبويبات مصادر متعددة
    - `archive-app/src/features/collections/applyFilterRules.js` — فلترة متقدمة متعددة الشروط
    - `archive-app/src/features/collections/cycleDetection.js` — `detectCollectionCycle`
    - `archive-app/src/components/collections/FilterRuleBuilder.jsx` — منشئ قواعد الفلترة المرئي
  - **تعديل ملفات:**
    - `archive-app/src/features/collections/viewModel.js` — `createVirtualCollectionValue` + `resolveCollectionContents`
    - `archive-app/src/pages/CollectionsPage.jsx` — دعم نوع "mixed" + لوحة المحتويات
    - `archive-app/src/stores/slices/archiveSlice.js` — تحديث وظائف المجموعات
  - **التنفيذ:** مصادر: عناصر + مجلدات + مجموعات مرجعية + بحوث محفوظة + لقطات فلترة؛ فلترة AND/OR متعددة الشروط؛ منع الحلقات المرجعية؛ عرض مخصص لكل حاوية.
  - يتطلب: §14.3 (المجلدات) اختياري.
  - الجهد: 4-6 أسابيع. ~7 ملفات جديدة/معدَّلة.
  - المصدر: archive-suite-new-feature-proposals (المقترح 2 — P1).

---

### 14.8 P1 — مركز تحكم النظام (System Control Center)

- [x] `[P1]` ⏱️XL **بناء مركز تحكم موحد للنظام عبر واجهة ويب** — لا واجهة للتحكم بالسيرفر؛ يتطلب CLI بـ25+ أمر؛ لا دعم لنظام Windows خارج Docker.
  - 🔄 **شريحة مراقبة آمنة (2026-06-16):** صفحة `SystemControlPage` للقراءة فقط («مركز تحكم النظام») تعرض الحالة العامة (ok/degraded/down) ومقاييس الموارد (CPU/ذاكرة/قرص مع عتبات تحذير/حرج) ونظرة عامة على الخدمات، باستهلاك نقطة `/api/health` الموجودة وعميل `serverHealthClient` (لم تُكرَّر). أزرار التحكم (تشغيل/إيقاف/إعادة تشغيل) تُعرض **معطّلة** بتلميح «قيد التطوير — يتطلب صلاحيات النظام».
    - **ملفات جديدة:** `archive-app/src/features/systemControl/systemControlModel.js` (نموذج نقي: `buildSystemControlModel`/`classifyMetric`/`deriveOverallState`/`formatBytes`/`formatPercent`/`buildServiceList`)؛ `systemControlModel.test.js` (31 اختباراً)؛ `archive-app/src/pages/SystemControlPage.jsx`.
    - **تعديل ملفات:** `archive-app/src/app/pageManifest.js` + `pageRegistry.js` (تسجيل `system-control` في مجموعة `maintenance`).
    - **معاد استخدامه:** `/api/health` و`serverHealthClient.fetchServerHealth` و`connectionStatus` من المتجر — لا نقطة أو عميل جديد.
    - 772 اختباراً ناجحاً (741 أساس + 31 جديد)، و`build:spa` أخضر.
    - **كان مؤجَّلاً (خطر عالٍ — صلاحيات نظام التشغيل):** `controlAgent.js` و`controlRoutes.js` للتشغيل/الإيقاف/إعادة التشغيل/apply-config وأي تنفيذ فعلي لأوامر الخدمات عبر طلب ويب. أُغلق لاحقاً في 2026-06-18 بتنفيذ مشروط خلف admin + allowlist + تفعيل صريح من الخادم.
  - 🔄 **متابعة آمنة (2026-06-18):** أُضيفت طبقة خادم read-only فعلية خلف صلاحية admin: `archive-server/src/control/controlAgent.js` يجمع حالة محلية آمنة (platform/uptime/CPU load/ذاكرة/قرص/خدمات) مع تنقيح الأسرار في السجلات، و`archive-server/src/api/controlRoutes.js` يقدّم `GET /api/control/status` و`GET /api/control/logs`. أوامر `POST /api/control/start|stop|restart|apply-config` أُدخلت كعقود HTTP وكانت ترجع `501` افتراضياً قبل تفعيل allowlist. الواجهة صارت تفضّل `fetchControlStatus` عبر `archive-app/src/features/systemControl/systemControlClient.js` عند الضغط على "فحص الآن" أو التحديث التلقائي، مع fallback إلى `/api/health`. تحقق: اختبارات HTTP admin-only/read-only في `verify-api.mjs` + 3 اختبارات vitest للعميل.
  - ✅ **إغلاق كامل آمن (2026-06-18):** يدعم `createControlAgent` الآن أوضاع `docker` و`linux-native` و`windows-native` لأوامر `start`/`stop`/`restart`/`apply-config` لكن خلف بوابة صريحة: `CONTROL_AGENT_ACTIONS=enabled` + allowlist في `CONTROL_AGENT_SERVICES`. التنفيذ يستخدم `spawn` بدون shell ولا يقبل أسماء خدمات من الطلب إلا إذا طابقت allowlist. الواجهة تفعّل أزرار الخدمة فقط عندما يعيد الخادم `actionsEnabled=true` وتسمح الخدمة بالفعل، وإلا تبقى معطلة مع رسالة إعداد واضحة. أضيف توثيق المفاتيح في `archive-server/.env.example`. تحقق: `verify:api` يثبت admin-only، الإغلاق الافتراضي، allowlist، تنقيح الأسرار، ورفض الخدمات/الأفعال غير المسموحة؛ و35 اختباراً مستهدفاً لمركز التحكم في الواجهة.
  - **الملفات/العقود المنجزة:**
    - `archive-server/src/control/controlAgent.js` — `createControlAgent` (docker/linux-native/windows-native)
    - `archive-server/src/api/controlRoutes.js` — `/api/control/status|start|stop|restart|logs|apply-config`
    - `archive-app/src/features/systemControl/systemControlClient.js` — `fetchControlStatus`/`fetchControlLogs`/`runControlAction`
    - `archive-app/src/pages/SystemControlPage.jsx`
  - **تعديل ملفات:**
    - `archive-server/src/api/server.js` — تسجيل controlRoutes بـ `requireAdmin`
    - `archive-server/.env.example` — توثيق `CONTROL_AGENT_MODE` و`CONTROL_AGENT_ACTIONS` و`CONTROL_AGENT_SERVICES`
    - `archive-app/src/app/pageRegistry.js` — تسجيل SystemControlPage
  - **التنفيذ:** تشغيل/إيقاف/إعادة تشغيل الخدمات؛ 3 أوضاع (Docker/Linux/Windows)؛ مراقبة CPU/ذاكرة/قرص/DB كل 5 ثوانٍ؛ عرض سجلات الخدمات.
  - **خطر:** متوسط-عالٍ (صلاحيات نظام التشغيل).
  - الجهد: 8-12 أسبوعاً.
  - المصدر: archive-suite-new-feature-proposals (المقترح 3 — P1).

---

### 14.9 P1 — الملء التلقائي لمعالج بدء التشغيل (Onboarding Pre-fill)

- [x] `[P1]` ⏱️L **قراءة إعدادات .env تلقائياً في معالج بدء التشغيل** ✅ 2026-06-12: `presetConfig.js` (server) يقرأ BACKEND/POCKETBASE_URL/DATABASE_URL/ADMIN_EMAIL ويختبر الاتصال بـ DB؛ `GET /api/setup/preset-config` endpoint (يُحجب بعد اكتمال الإعداد)؛ `PresetConfigScreen.jsx` يعرض ملخص الإعدادات مع مؤشرات الحالة؛ `V1OnboardingWizard.jsx` يجلب الإعداد المسبق عند بدء التشغيل ويعرض شاشة "استخدام الإعدادات المكتشفة" بنقرة واحدة.
  - **الملفات الجديدة:**
    - `archive-server/src/api/presetConfig.js` — `createPresetConfigHandler` (قراءة .env + اختبار DB)
    - `archive-app/src/features/onboarding/PresetConfigScreen.jsx` — شاشة تأكيد الإعدادات المسبقة
  - **تعديل ملفات:**
    - `archive-app/src/features/onboarding/V1OnboardingWizard.jsx` — `mapPresetToFormValues` + `PresetConfigScreen`
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

- [x] `[P0]` ⏱️XL **بناء دليل مستخدم تفاعلي متعدد الطبقات داخل التطبيق** — المستخدم الجديد لا يحصل على جولة إرشادية أو تلميحات سياقية أو مركز مساعدة قابل للبحث، فتظل ميزات مهمة مثل الوسوم الهرمية والبحث المتقدم غير مكتشفة.
  - **✅ مُنجَز (شريحة، 2026-06-15):** طبقة اكتشاف ميزات تكمّل معالج الإعداد وقائمة الأرشيف الفارغ دون تكرارهما: جولة تفاعلية بخطوات على صفحات حقيقية + تلميحات سياقية لكل صفحة + إعادة استخدام بحث المساعدة الموجود.
    - **ملفات جديدة:** `archive-app/src/features/guide/tourModel.js` (نموذج نقي: `createTourStep`/`PRODUCT_TOUR`/`nextStep`/`prevStep`/`getStepIndex`/`isTourComplete`)؛ `tourDriver.js` (تشغيل تلقائي + لقطات إعدادات `tourSeenSteps`/`tourDismissed`)؛ `contextualTips.js` (`getTipsForPage`/`shouldShowTip` معاد استخدامها من `pageManifest.meta.hint/helpSection`)؛ `components/guide/GuidedTour.jsx` (نافذة خطوات قابلة للتخطي: التالي/السابق/تخطّي + مؤشر تقدم + «اذهب للصفحة»، تشغيل تلقائي للمستخدم الجديد، احترام reduced-motion)؛ `components/guide/ContextualTip.jsx` (تلميح مضمّن قابل للإخفاء في شريط سياق الصفحة يربط بقسم المساعدة).
    - **تعديل ملفات:** `app/AppNotifications.jsx` (تركيب `GuidedTourController`)؛ `components/navigation/PageContextBar.jsx` (تركيب `ContextualTip`)؛ `pages/HelpPage.jsx` (زر «ابدأ الجولة» اليدوي).
    - **معاد استخدامه:** بحث المساعدة القائم (`filterHelpSections`/`filterHelpFaqItems`) وأقسام `features/help` — لم يُنشأ `helpSearch.js` جديد. الجولة مكمّلة لـ`usageOnboarding` (قائمة الأرشيف الفارغ) ولجولة المعالج `V1ProductTour` دون تكرار أيٍّ منهما.
    - **اختبارات:** 45 اختباراً جديداً (tourModel 17، tourDriver 19، contextualTips 9) — الإجمالي 593 اختباراً ناجحاً، و`build:spa` أخضر.
    - **مؤجَّل:** coachmarks مثبّتة على عناصر DOM بـ spotlight (الشريحة الحالية نافذة خطوات مركزية قوية مع `data-tour` selectors جاهزة للترقية)؛ جولة حسب الدور (admin/editor/viewer)؛ مستويات إزعاج التلميحات (مختصر/مفصل/معطّل)؛ ربط نهاية معالج الإعداد مباشرة بهذه الجولة.
  - **الملفات الجديدة:**
    - `archive-app/src/components/help/InteractiveGuideTour.jsx` — جولة ترحيب مع spotlight وخطوات قابلة للتخطي.
    - `archive-app/src/components/help/ContextualTooltip.jsx` — تلميحات تظهر عند أول استخدام للميزة.
    - `archive-app/src/components/help/HelpCenterSearch.jsx` — بحث داخل محتوى المساعدة.
    - `archive-app/src/features/help/guideRegistry.js` — تعريف خطوات الجولة حسب الصفحة والدور.
    - `archive-app/src/stores/slices/helpPrefsSlice.js` — تخزين حالة التلميحات المكتشفة ومستوى الإزعاج.
  - **تعديل ملفات:**
    - `archive-app/src/pages/HelpPage.jsx` — ترقية الصفحة إلى مركز مساعدة دائم.
    - `archive-app/src/components/navigation/TopBar.jsx` أو shell التنقل — زر مساعدة دائم.
    - `archive-app/src/features/onboarding/V1OnboardingWizard.jsx` — ربط نهاية الإعداد بجولة الاستخدام.
  - **التنفيذ:** جولة Onboarding حسب الدور؛ تلميحات لا تتكرر بعد الاستخدام؛ مستويات تلميح (مختصر/مفصل/معطّل)؛ FAQ قابل للتحديث؛ بحث في المساعدة.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 1 — P0).

---

### 15.2 P0 — تحسين استقرار المزامنة السحابية (Cloud Sync Stabilization)

- [x] `[P0]` ⏱️XL **بناء طبقة مزامنة سحابية موثوقة مع كشف تعارضات وطابور مرئي** — المزامنة بين IndexedDB وPrisma قد تخفي التعارضات، ولا تعرض حالة الاتصال أو العمليات المعلقة بشكل واضح.
  - **✅ مُنجَز (شريحة، 2026-06-15):** كشف تعارضات + طابور مرئي قابل للاشتراك فوق طبقة المزامنة الحالية دون المساس بمسار الكتابة.
    - **ملفات جديدة/معدّلة:** `archive-app/src/features/sync/conflictDetection.js` (إضافة `detectConflict`/`classifyConflicts`/`resolveConflict` + `CONFLICT_RESOLUTION_STRATEGIES` بجانب `detectConflicts` الموجود دون تعديله)؛ `syncQueueModel.js` (نموذج عمليات نقي: `createSyncOp`/`summarizeQueue`/`nextPendingOp`/`transitionOp`)؛ `syncStatusStore.js` (مخزن قابل للاشتراك: حالة الاتصال عبر `navigator.onLine`، طابور معلّق محفوظ، تعارضات مكتشفة)؛ تحسين `pages/SyncLogPage.jsx` بلوحة `SyncStatusPanel` (متصل/معلّق/مكتمل + طابور + أزرار حل لكل تعارض keepLocal/keepRemote/newest).
    - **اختبارات:** 38 اختبار جديد (conflictDetection 17، syncQueueModel 11، syncStatusStore 10) — الإجمالي 548 اختباراً ناجحاً، و`build:spa` أخضر.
    - **مؤجَّل (تكامل حلقة المزامنة الحيّة):** تعبئة الطابور والتعارضات من حلقة `local-sync`/Prisma الفعلية وتطبيق السجل المحلول على المخزن الحيّ؛ exponential backoff لإعادة المحاولة؛ إشعارات اكتمال/تعارض. الشريحة الحالية تعرض الطابور فارغاً حتى يغذّيه مصدر حقيقي أو لقطة بعيدة.
  - **الملفات الجديدة:**
    - `archive-app/src/features/sync/conflictResolver.js` — كشف التعارضات بمراجعات وطوابع زمنية.
    - `archive-app/src/components/sync/ConflictResolutionDialog.jsx` — عرض نسختين جنباً إلى جنب مع تمييز الفروقات.
    - `archive-app/src/components/sync/ConnectionStatusIndicator.jsx` — مؤشر متصل/معلّق/تعارض/أوفلاين.
    - `archive-app/src/components/sync/SyncQueueDashboard.jsx` — لوحة عمليات المزامنة المعلقة والفاشلة والمكتملة.
    - `archive-app/src/features/sync/autoSyncEngine.js` — مزامنة تلقائية مع exponential backoff.
  - **تعديل ملفات:**
    - `archive-app/src/services/storage/registerByBackendChoice.js` — إدخال طبقة المزامنة بين المحلي والسحابي.
    - `archive-app/src/stores/slices/archiveSlice.js` — إضافة revision metadata وعمليات pending.
    - `archive-server/prisma/schema.prisma` — حقول revision/updatedBy عند الحاجة.
  - **التنفيذ:** revisions لكل تعديل؛ سجل تعارضات قابل للاسترجاع؛ طابور مرئي مع إعادة محاولة؛ مزامنة تلقائية عند عودة الاتصال؛ إشعارات عند اكتمال المزامنة أو وجود تعارض.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 2 — P0).

---

### 15.3 P1 — مركز الإعدادات المتقدمة الموحد (Unified Settings Hub)

- [x] `[P1]` ⏱️L **توحيد الإعدادات المبعثرة في مركز واحد قابل للبحث والاستيراد/التصدير** — الإعدادات موزعة بين Onboarding وSidebar وDataCenterPage وبعضها غير ظاهر من الواجهة.
  - **الملفات الجديدة:**
    - `archive-app/src/pages/SettingsHubPage.jsx` — صفحة مركز الإعدادات الموحد.
    - `archive-app/src/features/settings/settingsRegistry.js` — تعريف الفئات والقيم الافتراضية والوصف.
    - `archive-app/src/components/settings/SettingsSearch.jsx` — بحث في أسماء الإعدادات ووصفها.
    - `archive-app/src/components/settings/SettingsImportExport.jsx` — تصدير/استيراد JSON مع استثناء الأسرار.
    - `archive-app/src/components/settings/SettingDiffPreview.jsx` — معاينة اختلافات الاستيراد قبل التطبيق.
  - **تعديل ملفات:**
    - `archive-app/src/components/navigation/Sidebar.jsx` — توجيه إعدادات Sidebar للمركز الجديد.
    - `archive-app/src/pages/DataCenterPage.jsx` — نقل إعدادات التخزين/النسخ الاحتياطي للمركز أو ربطها به.
    - `archive-app/src/app/pageRegistry.js` — تسجيل صفحة SettingsHubPage.
  - **التنفيذ:** فئات عام/حساب/أرشفة/بحث/مزامنة/وسائط/أمان/متقدم؛ بحث فوري؛ Smart Defaults مع شرح؛ إعادة أي إعداد للقيمة الافتراضية؛ تعليم واضح للإعدادات التي تحتاج إعادة تشغيل.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 3 — P1).

---

### 15.4 P1 — لوحة المعلومات الرئيسية المحسّنة (Enhanced Dashboard)

- [x] `[P1]` ⏱️L **بناء لوحة معلومات رئيسية قابلة للتخصيص بدل الدخول المباشر لقائمة الأرشيف** — ArchivePage تعرض قائمة عناصر طويلة بلا ملخص حالة أو إجراءات سريعة أو نشاط حديث.
  - **الملفات الجديدة:**
    - `archive-app/src/pages/DashboardPage.jsx` — الصفحة الرئيسية الافتراضية القابلة للتعطيل.
    - `archive-app/src/components/dashboard/StatsCards.jsx` — إجمالي العناصر، المجموعات، الوسوم، التخزين، آخر نسخة احتياطية.
    - `archive-app/src/components/dashboard/QuickActionsPanel.jsx` — إضافة/استيراد/تصدير/نسخ احتياطي.
    - `archive-app/src/components/dashboard/RecentActivityPanel.jsx` — آخر العمليات.
    - `archive-app/src/components/dashboard/SmartSuggestionsPanel.jsx` — اقتراحات تنظيمية قابلة للتنفيذ.
  - **تعديل ملفات:**
    - `archive-app/src/app/pageRegistry.js` — تسجيل DashboardPage كوجهة بدء اختيارية.
    - `archive-app/src/stores/slices/archiveSlice.js` — selectors للإحصائيات والاقتراحات.
  - **التنفيذ:** بطاقات إحصائية محدثة تلقائياً؛ إجراءات سريعة مرتبة حسب الاستخدام؛ نشاط آخر 5-10 عمليات؛ اقتراحات مثل عناصر بلا وسوم/نسخة احتياطية متأخرة/مكررات؛ إعادة ترتيب أقسام اللوحة بالسحب والإفلات.
  - الجهد: 3-5 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 4 — P1).

---

### 15.5 P1 — نظام الاختصارات القابلة للتخصيص (Customizable Keyboard Shortcuts)

- [x] `[P1]` ⏱️L **بناء نظام اختصارات مركزي قابل للتخصيص مع وضع لوحة مفاتيح كامل** — الاعتماد الحالي على الفأرة يبطئ المستخدمين المكثفين، والاختصارات القليلة غير موثقة وغير قابلة للتعديل.
  - **الملفات الجديدة:**
    - `archive-app/src/features/shortcuts/shortcutRegistry.js` — تعريف الاختصارات حسب السياق.
    - `archive-app/src/hooks/useGlobalShortcuts.js` — التقاط الاختصارات العامة والصفحية.
    - `archive-app/src/components/shortcuts/ShortcutExplorer.jsx` — نافذة Ctrl+/ لعرض اختصارات السياق الحالي.
    - `archive-app/src/pages/ShortcutSettingsPage.jsx` — تعديل واستيراد/تصدير خريطة الاختصارات.
    - `archive-app/src/features/shortcuts/vimMode.js` — وضع Vim الاختياري.
  - **تعديل ملفات:**
    - `archive-app/src/components/navigation/Sidebar.jsx` — اختصارات التنقل بين الأقسام.
    - `archive-app/src/pages/ArchivePage.jsx` و`DetailPage.jsx` — اختصارات تحديد/حذف/تعديل/التالي/السابق.
  - **التنفيذ:** منع تعارض الاختصارات؛ عرض الاختصار كتلميح على الأزرار؛ Ctrl+N/Ctrl+K/Ctrl+S/Ctrl+E/Ctrl+B/F2/Delete؛ وضع Vim اختياري؛ حفظ التفضيلات ومزامنتها.
  - ✅ **مُنجز ومتحقق (2026-06-13):** النظام المركزي موجود عبر `SHORTCUT_ACTIONS`/`shortcutMatches`/`KeyboardShortcutsDialog` ومدير الاختصارات في الإعدادات مع منع التعارضات والتعطيل والاستعادة. أضيف استيراد/تصدير JSON لخريطة الاختصارات مع تنظيف المفاتيح والقيم غير المسموحة حتى يمكن نقل التفضيلات بين الأجهزة. تحقق: `keyboardShortcuts.test.js`.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 5 — P1).

---

### 15.6 P0 — تحسين تجربة الإعداد الأولي والتشغيل (Enhanced Onboarding & Setup Experience)

- [x] `[P0]` ⏱️L **إعادة تصميم الإعداد الأولي حول تجربة فورية ووضع تجريبي قبل الإعداد التقني** — المعالج الحالي يطلب قرارات تقنية قبل أن يرى المستخدم قيمة التطبيق.
  - **الملفات الجديدة:**
    - `archive-app/src/features/onboarding/InstantTryScreen.jsx` — خيار “ابدأ فوراً” مقابل “إعداد سحابي”.
    - `archive-app/src/features/onboarding/DemoModeSeeder.js` — بيانات نموذجية قابلة للحذف.
    - `archive-app/src/features/onboarding/ProgressiveCloudSetup.jsx` — تهيئة سحابية مبسطة بعد التجربة.
    - `archive-app/src/components/onboarding/SetupErrorMessage.jsx` — رسائل خطأ مفهومة مع تفاصيل تقنية اختيارية.
  - **تعديل ملفات:**
    - `archive-app/src/features/onboarding/V1OnboardingWizard.jsx` — فصل المسار العادي عن المتقدم.
    - `archive-app/src/services/storage/schema.js` — وسم بيانات demo لمنع اختلاطها بالبيانات الحقيقية.
  - **التنفيذ:** لحظة قيمة خلال أقل من 30 ثانية؛ بيانات نموذجية؛ إعداد متقدم مخفي خلف رابط واضح؛ تهيئة تدريجية للسحابة بعد الاستكشاف؛ حذف بيانات demo عند الخروج.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 6 — P0).

---

### 15.7 P2 — نظام التخصيص البصري والسمات (Theming & Visual Customization)

- [x] `[P2]` ⏱️XL **بناء محرر سمات وتخصيص كثافة وتخطيط الواجهة** — التطبيق لا يمنح المستخدم تحكماً كافياً في الألوان والخطوط والكثافة وحجم البطاقات وتخطيط الشريط الجانبي.
  - **✅ مُنجَز (شريحة، 2026-06-16):** `themePresets.js` (DENSITY_OPTIONS/getStoredDensity/applyDensityToDocument)؛ `themeExportImport.js` (exportThemeConfig/importThemeConfig/downloadThemeFile)؛ `DensitySelector.jsx`؛ `ThemePreviewCard.jsx`؛ `AppearanceSettingsPage.jsx` (شبكة 34 سمة + كثافة + محرر ألوان مخصص + استيراد/تصدير)؛ مسجَّلة في pageManifest/pageRegistry. `build:spa` أخضر 1.09s.
  - **مؤجَّل:** ربط متغيرات v*-identity.css بالسمة المخصصة، تخصيص حجم البطاقات وعرض الشريط الجانبي، مزامنة سحابية للسمة.
  - **الملفات الجديدة:**
    - `archive-app/src/pages/AppearanceSettingsPage.jsx` — صفحة التخصيص البصري.
    - `archive-app/src/features/theme/themePresets.js` — سمات جاهزة: فاتح/داكن/عالي التباين/باستيل/دافئ.
    - `archive-app/src/components/theme/ThemeEditor.jsx` — محرر ألوان ونصف قطر وظلال وحركة.
    - `archive-app/src/components/theme/DensitySelector.jsx` — Compact/Balanced/Comfortable.
    - `archive-app/src/features/theme/themeExportImport.js` — مشاركة السمات كـ JSON.
  - **تعديل ملفات:**
    - `archive-app/src/styles/v*-identity.css` — ربط أعمق بمتغيرات CSS الدلالية.
    - `archive-app/src/components/views/*` — دعم حجم البطاقات وكثافة الجداول.
  - **التنفيذ:** معاينة حية قبل التطبيق؛ سمة مخصصة؛ وضع عالي التباين؛ تخصيص عرض الشريط الجانبي وحجم البطاقات وأعمدة الجدول؛ حفظ محلي ومزامنة سحابية عند التفعيل.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 7 — P2).

---

### 15.8 P1 — تحسين نظام التعامل مع الأخطاء والاسترداد (Error Handling & Recovery)

- [x] `[P1]` ⏱️L **بناء طبقة استرداد أخطاء شاملة فوق رسائل الخطأ الحالية** — الرسائل الودّية وحدها لا تكفي إذا فشلت عملية كتابة أو مزامنة وتركت بيانات معلقة أو حالة غير متسقة.
  - **✅ مُنجَز (2026-06-14):** (1) `features/storage/transactionalWrite.js` — `runTransactionalWrite` يشغّل خطوات متعددة مع **تراجع عكسي عند الفشل** (+5 اختبارات). (2) `features/errors/recoveryQueue.js` — طابور مُخزَّن للعمليات الفاشلة بمشغّلات حسب النوع، `retry/retryAll`، سقف محاولات، اشتراك (+10 اختبارات). (3) `features/errors/errorReportBuilder.js` — تقرير منظّم (رسالة/سياق/خطورة/جهاز) + نص قابل للنسخ (+5). (4) `features/errors/errorLogStore.js` — سجل مركزي مُخزَّن قابل للاشتراك بفلترة خطورة/صفحة/بحث (+5). (5) `components/errors/ErrorDetailsPanel.jsx` — **طبقات الرسالة** (مبسّطة → حل مقترح → تفاصيل تقنية قابلة للطي) + نسخ التقرير. (6) `pages/ErrorLogPage.jsx` — سجل قابل للفلترة + شريط «عمليات معلّقة» بإعادة محاولة بضغطة، مسجَّل في `pageManifest`/`pageRegistry` (مجموعة administration). (7) `utils/errorHandling.handleAppError` يسجّل كل خطأ مُعالَج في السجل المركزي (failure-safe، اختياري عبر `options.log`). **متاح للتوسيع:** `runTransactionalWrite` جاهز لتغليف عمليات `archiveSlice` المركّبة عند الحاجة (لم يُفرض على مسارات حسّاسة في هذه الجلسة). التحقق: 292 اختبار يمرّ + `build:spa` أخضر.
  - **الملفات الجديدة:**
    - `archive-app/src/features/errors/recoveryQueue.js` — حفظ عمليات الكتابة الفاشلة لإعادة المحاولة.
    - `archive-app/src/components/errors/ErrorDetailsPanel.jsx` — طبقات الرسالة: مبسطة/حل مقترح/تفاصيل تقنية.
    - `archive-app/src/pages/ErrorLogPage.jsx` — سجل أخطاء مركزي قابل للفلترة.
    - `archive-app/src/features/errors/errorReportBuilder.js` — إنشاء تقرير خطأ مع السياق وبيانات الجهاز.
    - `archive-app/src/features/storage/transactionalWrite.js` — تغليف عمليات متعددة الخطوات بتراجع عند الفشل.
  - **تعديل ملفات:**
    - `archive-app/src/utils/errorHandling.js` — ربط الرسائل الحالية بالاسترداد والسجل.
    - `archive-app/src/stores/slices/archiveSlice.js` — استخدام transactional writes للعمليات المركبة.
  - **التنفيذ:** إعادة محاولة عمليات محددة؛ سجل خطأ مع الصفحة والعملية والنوع؛ إبلاغ ذكي عن الخطأ؛ حماية من عنصر بلا ملف أو مجموعة بلا عناصر؛ إشعار “عمليات معلقة”.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 8 — P1).

---

### 15.9 P0 — تحسين رحلة المستخدم في سير العمل المتكرر (Daily Workflow Journey Optimization)

- [x] `[P0]` ⏱️XL **إزالة احتكاكات الإضافة والتعديل والبحث عبر تدفق عمل متصل** — المستخدم الذي يضيف أو يعدّل عشرات العناصر يضيع وقتاً في فتح صفحات منفصلة وفقدان السياق.
  - ✅ **مُنجَز 2026-06-15:** أُضيفت `features/workflow/recentDefaults.js` (تذكّر نوع/وسوم/مجلد/مجموعة في localStorage بـ11 اختبار)، `components/workflow/ContextualQuickAddBar.jsx` (شريط طي/فتح يلف QuickAddBar مع استعادة الإعدادات الأخيرة)، `components/workflow/SideEditPanel.jsx` (لوحة جانبية لتعديل العنوان/الوسوم/الملاحظات/النوع مع Ctrl+S وAnimatePresence). رُبطت في `ArchivePage.jsx` مع عنصر "تعديل سريع" في قائمة السياق.
  - **الملفات الجديدة:**
    - `archive-app/src/components/workflow/ContextualQuickAddBar.jsx` — شريط إضافة سريع قابل للطي من أي صفحة.
    - `archive-app/src/components/workflow/SideEditPanel.jsx` — تعديل سريع دون مغادرة القائمة.
    - `archive-app/src/components/workflow/InlineSearchRefinement.jsx` — تحسين البحث داخل السياق الحالي.
    - `archive-app/src/features/workflow/recentDefaults.js` — تذكّر آخر مجلد/وسوم/نوع.
  - **تعديل ملفات:**
    - `archive-app/src/pages/ArchivePage.jsx` — دمج QuickAdd وSideEdit.
    - `archive-app/src/pages/AddVideoPage.jsx` — دعم “تفاصيل إضافية” بدلاً من صفحة كاملة عند الحاجة.
    - `archive-app/src/stores/slices/archiveSlice.js` — إنشاء عناصر بإعدادات افتراضية وسياقية.
  - **التنفيذ:** Enter لإضافة متتابعة؛ لوحة تعديل جانبية؛ حفظ السياق بعد الحفظ؛ اقتراح قيم من آخر استخدام؛ اختصار “إضافة عنصر مشابه”.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 9 — P0).

---

### 15.10 P1 — نظام الملاحظات والتعليقات على العناصر (Item Notes & Annotations)

- [x] `[P1]` ⏱️XL **إضافة ملاحظات شخصية وتعليقات تعاونية مرتبطة بالزمن أو المنطقة داخل العنصر** — العناصر المؤرشفة لا تدعم تدوين ملاحظات زمنية على الفيديو/الصوت أو ملاحظات مرئية على الصور والمستندات.
  - **✅ مُنجَز (2026-06-14):** شريحة عمودية أولى للملاحظات الشخصية المرتبطة بالزمن/المنطقة (تخزين محلي عبر IndexedDB على غرار باقي الميزات):
    - نموذج نقي `archive-app/src/features/itemNotes/itemNotesModel.js` (`createItemNote`/`sortNotes`/`filterNotesForItem`/`describeNoteAnchor`/`formatNoteTime`) مع اختبارات `itemNotesModel.test.js`.
    - شريحة متجر `archive-app/src/stores/slices/itemNotesSlice.js` (`addItemNote`/`updateItemNote`/`removeItemNote`/`loadItemNotesFromStorage`) على نمط `activityLogSlice`، مع تسجيل متجر `item_notes` في `services/storage/schema.js` ودمجها في `stores/appStore.js`.
    - لوحة `archive-app/src/components/itemNotes/ItemNotesPanel.jsx` مدمجة كتبويب «ملاحظاتي» في `pages/DetailPage.jsx` (إضافة/حذف، ربط اختياري باللحظة الزمنية الحالية للوسائط، قفز للوقت).
    - 480 اختباراً ناجحاً (14 جديداً)، و`build:spa` أخضر.
    - **مؤجَّل (XL):** التعليقات المتداخلة (Threaded) و@mentions، تحديد المناطق المرئية على الصور/المستندات (`VisualAnnotationLayer`)، علامات شريط الفيديو (`TimelineNoteMarkers`)، تصدير Markdown/PDF (`ExportNotesDialog`)، فلترة «ملاحظاتي/الكل» والبحث داخل الملاحظات، ومزامنة سحابية تعاونية لحظية (جدول `notes/comments` في Prisma).
  - **الملفات الجديدة:**
    - `archive-app/src/features/notes/notesModel.js` — نموذج الملاحظات والردود والربط الزمني/المكاني.
    - `archive-app/src/components/notes/NotesSidebar.jsx` — لوحة جانبية للملاحظات والتعليقات.
    - `archive-app/src/components/notes/TimelineNoteMarkers.jsx` — علامات على شريط الفيديو/الصوت.
    - `archive-app/src/components/notes/VisualAnnotationLayer.jsx` — تحديد مناطق في الصور/المستندات.
    - `archive-app/src/components/notes/ExportNotesDialog.jsx` — تصدير Markdown/PDF/Text.
  - **تعديل ملفات:**
    - `archive-app/src/pages/DetailPage.jsx` — تبويب/لوحة ملاحظات.
    - `archive-app/src/components/media/VideoPlayer.jsx` و`DocumentViewer.jsx` — ربط الملاحظات بالنقطة الزمنية أو المنطقة.
    - `archive-server/prisma/schema.prisma` — جدول notes/comments عند الوضع السحابي.
  - **التنفيذ:** ملاحظات شخصية؛ تعليقات Threaded؛ @mentions؛ فلترة ملاحظاتي/الكل؛ بحث داخل الملاحظات؛ تصدير مع روابط للعناصر الأصلية.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 10 — P1).

---

### 15.11 P1 — المزامنة الانتقائية وذكاء النطاق الترددي (Selective Sync & Bandwidth Intelligence)

- [x] `[P1]` ⏱️XL **تمكين مزامنة انتقائية حسب المجلد/المجموعة مع سياسات نطاق ترددي وتخزين مؤقت ذكي** — المزامنة الحالية تعمل بمنطق الكل أو لا شيء، وهو غير مناسب للأرشيفات الكبيرة أو الجوال.
  - **✅ مُنجَز (شريحة، 2026-06-16):** نموذج سياسة نقي `selectiveSyncPolicy.js` (createSyncPolicy/isItemIncluded/filterSyncableItems/shouldSyncNow/summarizePolicy) + **26 اختبار**؛ `smartCacheManager.js` (rankForEviction/evictToFitQuota/recordAccess) + **9 اختبارات**؛ مكوّنات واجهة `PerItemSyncBadge.jsx`/`SyncScopeToggle.jsx`/`BandwidthSettings.jsx`. 675 اختبار يمرّ + `build:spa` أخضر.
  - **مؤجَّل (XL):** دعم metadata-only في storage adapters، download-on-demand، ربط CollectionsPage/FoldersPage، مزامنة المفضلة دائماً محلياً، جدولة تلقائية.
  - **الملفات الجديدة:**
    - `archive-app/src/features/sync/selectiveSyncPolicy.js` — قواعد مزامنة لكل مجلد/مجموعة.
    - `archive-app/src/components/sync/SyncScopeToggle.jsx` — زر “مزامنة محلياً”.
    - `archive-app/src/components/sync/BandwidthSettings.jsx` — WiFi/بيانات جوال/اتصال بطيء.
    - `archive-app/src/features/sync/smartCacheManager.js` — إبقاء الأكثر استخداماً وتنظيف القديم.
    - `archive-app/src/components/sync/PerItemSyncBadge.jsx` — حالة العنصر: محلي/سحابي/جاري/تعارض.
  - **تعديل ملفات:**
    - `archive-app/src/services/storage/*` — دعم metadata-only وdownload-on-demand.
    - `archive-app/src/pages/CollectionsPage.jsx` و`FoldersPage.jsx` — زر المزامنة للمجموعات والمجلدات.
  - **التنفيذ:** مزامنة metadata فقط على بيانات الجوال؛ تنزيل ملفات عند الطلب؛ سقف تخزين محلي؛ إبقاء المفضلة دائماً محلية؛ جدولة مزامنة يدوية/كل ساعة/على WiFi فقط.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 11 — P1).

---

### 15.12 P2 — لوحة إحصائيات الاستخدام الشخصي وتحليلات الأرشيف (Personal Analytics & Archive Insights)

- [x] `[P2]` ⏱️XL **بناء لوحة تحليلات شخصية تكشف نمو الأرشيف وصحته وأنماط الاستخدام** — لا توجد رؤية كافية حول النمو الشهري، أكثر الوسوم، العناصر غير المصنفة، المكررات، أو نشاط المستخدم.
  - **✅ مُنجَز (2026-06-14):** شريحة عمودية مُختبَرة من المهمة XL. وحدة محددات نقية `archive-app/src/features/analytics/analyticsSelectors.js` (النمو الشهري بنافذة متتالية كثيفة، أكثر الوسوم، العناصر غير المصنفة = بلا وسوم وخارج أي مجلد/مجموعة، مجموعات المكررات المحتملة بالعنوان المُطبَّع مع رجوع لمسار الميتاداتا، التوزيع حسب النوع، ومقاييس الصحة بالنِّسَب) + اختبار مُرافق `analyticsSelectors.test.js` (13 حالة). صفحة `archive-app/src/pages/AnalyticsPage.jsx` (بطاقات إحصائية + شريط نمو شهري + قوائم الوسوم/غير المصنفة/المكررات بأسلوب jsx/jsxs). تسجيل الصفحة `analytics` في `pageManifest.js` (مجموعة administration) و`pageRegistry.js`. ‏443 اختباراً ينجح، و`build:spa` أخضر. **مؤجَّل:** المكوّنات المنفصلة (GrowthCharts/TagAnalyticsPanel/ArchiveHealthScore)، `periodicReports.js` والتقارير الدورية بالإشعار/البريد، أكثر العناصر مشاهدة/تعديلاً (يتطلب نشاط/سجل)، توحيد الوسوم المتشابهة، وربط `DataCenterPage`.
  - **الملفات الجديدة:**
    - `archive-app/src/pages/PersonalAnalyticsPage.jsx` — لوحة التحليلات الشخصية.
    - `archive-app/src/components/analytics/GrowthCharts.jsx` — نمو العناصر والمساحة عبر الزمن.
    - `archive-app/src/components/analytics/TagAnalyticsPanel.jsx` — أكثر الوسوم وتوحيد الوسوم المتشابهة.
    - `archive-app/src/components/analytics/ArchiveHealthScore.jsx` — درجة صحة الأرشيف.
    - `archive-app/src/features/analytics/periodicReports.js` — تقارير أسبوعية/شهرية.
  - **تعديل ملفات:**
    - `archive-app/src/pages/DataCenterPage.jsx` — ربط التحليلات العامة بالشخصية أو فصلها.
    - `archive-app/src/stores/slices/archiveSlice.js` — selectors للتحليل والإحصاءات.
  - **التنفيذ:** عناصر مضافة شهرياً/أسبوعياً؛ توزيع الأنواع؛ وسوم مكررة أو ناقصة؛ عناصر بلا وصف/مجموعة/وسوم؛ أكثر العناصر مشاهدة/تعديلاً؛ تقارير دورية بإشعار أو بريد.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-cloud-ux-improvements (المقترح 12 — P2).

---

### 15.13 P0 — لوحة القيادة الشخصية (Personal Dashboard)

- [x] `[P0]` ⏱️L **إضافة لوحة قيادة شخصية موجهة للاستخدام اليومي مع “يحتاج اهتمامك”** — المستخدم يبدأ من أرشيف مسطح ولا يرى ما أضافه اليوم أو الملفات الناقصة أو العمليات الفاشلة.
  - **الملفات الجديدة:**
    - `archive-app/src/components/dashboard/PersonalGreeting.jsx` — تحية وسياق زمني ونشاط اليوم/الأسبوع.
    - `archive-app/src/components/dashboard/NeedsAttentionPanel.jsx` — عناصر بلا وصف، ملفات لم تُرفع، عمليات فاشلة، مسودات.
    - `archive-app/src/components/dashboard/MiniStatsPanel.jsx` — إحصائيات مصغرة.
    - `archive-app/src/features/dashboard/actionRanking.js` — ترتيب الإجراءات حسب الاستخدام.
  - **تعديل ملفات:**
    - `archive-app/src/pages/DashboardPage.jsx` — دمج الطبقة الشخصية فوق لوحة §15.4.
    - `archive-app/src/components/dashboard/QuickActionsPanel.jsx` — إجراءات تتكيف مع عادات المستخدم.
  - **التنفيذ:** تحية باسم المستخدم؛ أرقام اليوم/الأسبوع؛ إجراءات مباشرة لكل تنبيه؛ آخر نشاط مع تراجع سريع عند الإمكان؛ إحصائيات مصغرة محدثة تلقائياً.
  - يتطلب: §15.4 أو يُنفّذ كأول نسخة منها.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 1 — P0).

---

### 15.14 P0 — سير عمل الإضافة الموجّه خطوة بخطوة (Guided Add Workflow)

- [x] `[P0]` ⏱️L **تحويل نموذج الإضافة الطويل إلى معالج 3-4 خطوات حسب نوع المحتوى** — AddVideoPage يعرض حقولاً كثيرة دفعة واحدة، ما يربك المستخدم الجديد ويزيد البيانات الناقصة.
  - **الملفات الجديدة:**
    - `archive-app/src/components/add/GuidedAddWizard.jsx` — معالج الإضافة الرئيسي.
    - `archive-app/src/components/add/ContentTypeStep.jsx` — اختيار فيديو/صوت/مستند/صورة.
    - `archive-app/src/components/add/BasicInfoStep.jsx` — عنوان/وصف/وسوم.
    - `archive-app/src/components/add/PlacementStep.jsx` — مجلد/مجموعة مع مقترحات.
    - `archive-app/src/components/add/AdvancedDetailsStep.jsx` — حقول اختيارية مطوية.
  - **تعديل ملفات:**
    - `archive-app/src/pages/AddVideoPage.jsx` — استبدال النموذج الكامل بالمعالج مع وضع متقدم.
    - `archive-app/src/features/templates/*` — تعبئة الخطوات من القوالب إن وُجدت.
  - **التنفيذ:** حفظ كافٍ بعد الخطوات الأساسية؛ مؤشر تقدم؛ “حفظ ومتابعة لاحقاً”؛ اقتراح المجلد الأخير؛ تأكيد بعد الحفظ مع “إضافة عنصر مشابه”.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 2 — P0).

---

### 15.15 P1 — نظام التنقل السياقي الذكي (Contextual Smart Navigation)

- [x] `[P1]` ⏱️L **استبدال التنقل الثابت بتنقل يتغير حسب الصفحة والنشاط والجهاز** — الشريط الجانبي يعرض نفس الخيارات دائماً، وصفحة التفاصيل والجوال يحتاجان إجراءات مختلفة.
  - **الملفات الجديدة:**
    - `archive-app/src/components/navigation/ContextualSidebar.jsx` — sidebar حسب الصفحة.
    - `archive-app/src/components/navigation/DetailNavigationPanel.jsx` — التالي/السابق/إجراءات/علاقات/مشابهات.
    - `archive-app/src/components/navigation/SmartBottomTabs.jsx` — تنقل سفلي للجوال.
    - `archive-app/src/features/navigation/navigationContext.js` — تحديد السياق الحالي.
  - **تعديل ملفات:**
    - `archive-app/src/components/navigation/Sidebar.jsx` — التحول إلى wrapper ذكي.
    - `archive-app/src/pages/DetailPage.jsx` — تمكين التنقل بين العناصر دون العودة للأرشيف.
    - `archive-app/src/pages/AddVideoPage.jsx` — عرض مسودة العنصر والمقترحات في الشريط.
  - **التنفيذ:** قسم الأكثر زيارة ومؤخراً في الأرشيف؛ أزرار التالي/السابق في التفاصيل؛ إجراءات سريعة؛ تنقل سفلي ذكي للجوال؛ شريط اختصارات أسفل الشاشة حسب السياق.
  - ✅ **تحسين جزئي 2026-06-13:** تثبيت منطق إظهار/إخفاء الشريط الجانبي عبر أحجام الشاشة؛ Drawer الجوال صار منفصلاً عن طي سطح المكتب، وتُصفّر حالة فتح الجوال عند الرجوع لشاشات أكبر حتى لا يظهر الشريط بحالة عالقة.
  - **✅ مُنجَز (2026-06-14):** بُنيت طبقة التنقل السياقي كـ vertical slice عامل:
    - وحدة منطق نقية `archive-app/src/features/navigation/navigationContext.js` (إجراءات سريعة لكل صفحة، حساب موضع العنصر، حلّ التالي/السابق، وبناء سياق التنقل الكامل) مع اختبارات `navigationContext.test.js` (24 اختباراً).
    - التنقل التالي/السابق في صفحة التفاصيل دون العودة للأرشيف: يُحفظ ترتيب القائمة المُصفّاة في المتجر عند فتح عنصر (`navItemIds` + `setNavItemIds` في `uiSlice.js`، وربطها في `useArchivePageState.js openItem`)، وتستهلكه `DetailPage.jsx` عبر مكوّن `components/navigation/DetailNavigationPanel.jsx` (عدّاد ١/ن + أزرار سابق/تالٍ مع تعطيل عند الحواف، وارتداد لكامل القائمة عند الوصول العميق).
    - شريط إجراءات سريعة سياقي في الشريط الجانبي `components/navigation/ContextualSidebar.jsx` مدفوع بـ `getQuickActions` ومربوط في `Sidebar.jsx`.
    - **النتيجة:** 348 اختباراً يمرّ (٢٤ جديداً)، و`build:spa` أخضر.
    - **مؤجَّل:** إعادة كتابة `SmartBottomTabs.jsx` للجوال، وتحويل `Sidebar.jsx` لـ wrapper ذكي كامل، ولوحة العلاقات/المشابهات الموسّعة في `DetailNavigationPanel`، وعرض مسودة العنصر والمقترحات داخل شريط `AddVideoPage.jsx` (شريط الإجراءات السريعة يغطّي اختصارات صفحة الإضافة فقط).
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 3 — P1).

---

### 15.16 P0 — تجربة البحث الشاملة الموحّدة (Unified Search Experience)

- [x] `[P0]` ⏱️L **بناء واجهة بحث عالمية Command Palette تعمل من أي صفحة مع نتائج غنية** — البحث الحالي مقيّد بسياق محدود ولا يحفظ السياق أو يعرض نتائج مصنفة بتمييز مطابقات.
  - **الملفات الجديدة:**
    - `archive-app/src/components/search/GlobalSearchPalette.jsx` — نافذة Ctrl+K أو `/`.
    - `archive-app/src/components/search/SearchSuggestionList.jsx` — اقتراحات عناصر/مجموعات/مجلدات/إجراءات.
    - `archive-app/src/components/search/RichSearchResult.jsx` — نتيجة مع تمييز النص ونوع المحتوى والوسوم.
    - `archive-app/src/features/search/savedSearches.js` — حفظ الاستعلامات المتكررة.
    - `archive-app/src/features/search/contextualSearchHints.js` — اقتراح “بحث في نفس المجلد/المجموعة”.
  - **تعديل ملفات:**
    - `archive-app/src/pages/ArchivePage.jsx` — ربط البحث القديم بالواجهة العالمية.
    - `archive-server/src/api/server.js` أو search endpoint الموجود — دعم مقتطفات OCR/transcript عند توفرها.
  - **التنفيذ:** بحث من أي صفحة؛ تبويبات كل النتائج/فيديو/صوت/مستندات/مجموعات؛ تمييز المطابقات؛ بحث محفوظ ديناميكي؛ نتائج داخل OCR والتفريغ مع رابط للموضع أو الزمن.
  - الجهد: 4-5 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 4 — P0).

---

### 15.17 P1 — نظام العرض التكيفي (Adaptive View System)

- [x] `[P1]` ⏱️XL **إضافة عروض Timeline/Map/Kanban وتذكر تفضيلات العرض حسب السياق** — أوضاع الشبكة/القائمة/الجدول ثابتة ولا تتكيف مع عدد العناصر أو نوعها أو شاشة المستخدم.
  - **✅ مُنجَز (2026-06-14):** شريحة عرض Kanban حسب حالة سير العمل. وحدة نقية `archive-app/src/features/views/kanbanModel.js` (`buildKanbanColumns`/`moveItemStatus`/`listKanbanStatuses`) تعيد استخدام تصنيف الحالات وتسمياتها من `features/archive/itemStatus.js` دون اختراع تصنيف جديد، مع اختبارات `kanbanModel.test.js` (11 حالة). صفحة `archive-app/src/pages/KanbanPage.jsx` (jsx/jsxs مثل TimelinePage) تعرض الأعمدة وبطاقات العناصر، النقر يفتح التفاصيل، وقائمة منسدلة لكل بطاقة تنقل الحالة عبر `getAvailableTransitions` + `updateVideoItem`. مُسجَّلة في `pageManifest.js` و`pageRegistry.js` (group "daily"، id `kanban`). 454 اختباراً تمر، build:spa أخضر. **مؤجَّل:** عرض Timeline موجود مسبقاً (TimelinePage)؛ عرض Map، وحفظ تفضيلات العرض لكل سياق (`viewPreferenceStore`)، والتخصيص التكيفي للأعمدة، وسحب البطاقات بين الأعمدة (drag-move) — لاحقاً.
  - **الملفات الجديدة:**
    - `archive-app/src/components/views/TimelineView.jsx` — عرض زمني يوم/أسبوع/شهر/سنة.
    - `archive-app/src/components/views/MapView.jsx` — خريطة للعناصر ذات الإحداثيات.
    - `archive-app/src/components/views/KanbanView.jsx` — أعمدة حسب الحالة أو النوع أو حقل تصنيفي.
    - `archive-app/src/components/views/TableColumnCustomizer.jsx` — اختيار وترتيب أعمدة الجدول.
    - `archive-app/src/features/views/viewPreferenceStore.js` — حفظ التفضيلات لكل مجلد/مجموعة.
  - **تعديل ملفات:**
    - `archive-app/src/pages/ArchivePage.jsx` — اختيار العرض التكيفي وتخزينه.
    - `archive-app/src/components/views/TableView.jsx` — أعمدة مخصصة وحفظ الترتيب.
  - **التنفيذ:** اختيار تلقائي حسب العدد؛ حفظ العرض والفلاتر والأعمدة؛ Timeline للعناصر المؤرخة؛ Map للعناصر الجغرافية؛ Kanban مع سحب لتغيير الحالة.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 5 — P1).

---

### 15.18 P0 — نظام الإجراءات الجماعية المتقدم (Advanced Bulk Actions)

- [x] `[P0]` ⏱️L **ترقية العمليات الجماعية من تحديد يدوي إلى تحديد شرطي مع معاينة وتراجع** — العمليات الجماعية الأساسية موجودة، لكنها لا تكفي للسيناريوهات الشرطية أو تتبع النجاح والفشل أو التراجع الجزئي.
  - **الملفات الجديدة:**
    - `archive-app/src/components/bulk/SmartSelectionBuilder.jsx` — تحديد حسب نوع/تاريخ/حالة/وسوم/حجم.
    - `archive-app/src/components/bulk/BulkPreviewDialog.jsx` — معاينة التغييرات والعناصر المتأثرة.
    - `archive-app/src/components/bulk/BulkProgressTracker.jsx` — تقدم ونجاح/فشل لكل عنصر.
    - `archive-app/src/features/bulk/bulkUndoManager.js` — تراجع جماعي.
    - `archive-app/src/pages/BulkOperationsHistoryPage.jsx` — سجل العمليات الجماعية.
  - **تعديل ملفات:**
    - `archive-app/src/components/bulk/BulkActionBar.jsx` — إضافة التحديد الذكي والمعاينة.
    - `archive-app/src/stores/slices/archiveSlice.js` — حفظ snapshots قبل العملية للتراجع.
    - `archive-server/src/api/server.js` — إعادة نتيجة تفصيلية per-item في bulk endpoints.
  - **التنفيذ:** “حدد العناصر بدون وصف/المضافة هذا الأسبوع/الأكبر من 100MB”؛ دمج شروط AND/OR؛ معاينة قبل التنفيذ؛ أخطاء لا توقف كامل العملية؛ إعادة محاولة للفاشل فقط؛ تراجع خلال 30 ثانية وسجل دائم.
  - يتطلب: يبني فوق مهمة العمليات الجماعية الأساسية المكتملة في §9.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 6 — P0).

---

### 15.19 P1 — تجربة العنصر الأول والتهيئة الموجّهة (First-Item Onboarding)

- [x] `[P1]` ⏱️L **إضافة تهيئة استخدام بعد الإعداد التقني تقود المستخدم لإضافة وتنظيم أول عنصر** — صفحة الأرشيف الفارغة لا تشرح ما الذي يجب أرشفته أولاً أو كيف تُنظّم المجلدات والوسوم.
  - **✅ مُنجَز (2026-06-14):** شريحة عمودية أولى لتهيئة الاستخدام في الحالة الفارغة للأرشيف. منطق نقي قابل للاختبار في `archive-app/src/features/onboarding/usageOnboarding.js` (`computeUsageSteps` / `shouldShowUsageOnboarding` / `computeUsageProgress` / `getUsageOnboardingDismissPatch` / `isUsageOnboardingDismissed`) مع `usageOnboarding.test.js` (19 اختباراً). مكوّن `archive-app/src/components/onboarding/UsageOnboarding.jsx` يعرض قائمة مهام من 3 خطوات (أضف عنصراً → أنشئ مجلداً → أضف وسوماً) مع شرح الفرق بين المجلدات والمجموعات الذكية، وشريط تقدّم، وزر إخفاء؛ غلاف `UsageOnboardingPanel` يقرأ `videoItems`/`folders`/الوسوم المشتقة من المتجر، ويتنقّل عبر `setCurrentPage`، ويحفظ الإخفاء عبر `settings.ui.usageOnboardingDismissed` باستخدام `updateSettings`. مربوط في الحالة الفارغة بـ `archive-app/src/features/archive/ArchivePageResults.jsx` (يظهر فقط عند أرشيف فارغ غير مُخفى وليس في السلة/نتائج الفلترة). 367 اختباراً تمر، build:spa أخضر. **مؤجَّل:** مسار الإعداد العشري الموجّه واختيار حالة الاستخدام وقوالب المجلدات/الوسوم المقترحة وشاشة النجاح الاحتفالية (FirstItemOnboarding / UseCasePicker / suggestedStructures / FirstItemSuccess) لم تُنفَّذ في هذه الشريحة.
  - **الملفات الجديدة:**
    - `archive-app/src/features/onboarding/FirstItemOnboarding.jsx` — مسار أول 10 دقائق.
    - `archive-app/src/components/onboarding/UseCasePicker.jsx` — اختيار محاضرات/عمل/وسائط/مؤسسي/أخرى.
    - `archive-app/src/features/onboarding/suggestedStructures.js` — قوالب مجلدات ووسوم حسب حالة الاستخدام.
    - `archive-app/src/components/onboarding/FirstItemSuccess.jsx` — تأكيد احتفالي وخطوات تالية.
  - **تعديل ملفات:**
    - `archive-app/src/features/onboarding/V1OnboardingWizard.jsx` — الانتقال إلى مسار الاستخدام بعد الإعداد.
    - `archive-app/src/pages/ArchivePage.jsx` — حالة فارغة ذكية عند عدم وجود عناصر.
  - **التنفيذ:** اختيار حالة الاستخدام؛ إنشاء مقترحات مجلدات ووسوم؛ إضافة أول عنصر عبر §15.14؛ شرح الفرق بين المجلدات والمجموعات؛ جولة قصيرة للأدوات؛ إخفاء الخطوات تدريجياً بعد الخبرة.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 7 — P1).

---

### 15.20 P1 — قائمة الأوامر واكتشاف الاختصارات (Command Palette & Shortcut Discovery)

- [x] `[P1]` ⏱️L **توسيع نظام الاختصارات بقائمة أوامر واكتشاف تدريجي لا يحتاج حفظ الاختصارات** ✅ 2026-06-12 — ShortcutHintBubble + shortcutLearningState (MAX_SHOWS=3, localStorage "va:shortcut:learned") — حتى مع وجود اختصارات، يحتاج المستخدم طريقة لاكتشاف الأوامر وتنفيذها من لوحة المفاتيح.
  - **الملفات الجديدة:**
    - `archive-app/src/components/command/CommandPalette.jsx` — Ctrl+Shift+P للبحث في الأوامر.
    - `archive-app/src/features/command/commandRegistry.js` — ربط الأوامر بالإجراءات والصلاحيات والسياق.
    - `archive-app/src/components/shortcuts/ShortcutHintBubble.jsx` — تلميح يظهر بعد استخدام الفأرة لعملية لها اختصار.
    - `archive-app/src/features/shortcuts/shortcutLearningState.js` — إيقاف التلميح بعد تعلّم المستخدم.
  - **تعديل ملفات:**
    - `archive-app/src/features/shortcuts/shortcutRegistry.js` — مشاركة نفس المصدر بين الاختصارات وقائمة الأوامر.
    - `archive-app/src/components/common/Button.jsx` أو مكونات الأزرار المشتركة — عرض التلميحات عند الحاجة.
  - **التنفيذ:** أوامر عامة وصفحية؛ بحث باسم الأمر؛ عرض الاختصار بجانبه؛ تلميحات تعلم تدريجي تتوقف بعد 3 مرات؛ استيراد/تصدير إعدادات الاختصارات.
  - يتطلب: §15.5 أو يُدمج معه كمرحلة ثانية.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 8 — P1).

---

### 15.21 P2 — نظام التغذية الراجعة السياقية والتعلم الذاتي (Contextual Feedback & Self-Learning)

- [x] `[P2]` ⏱️L **بناء طبقة اقتراحات ذكية تساعد المستخدم على تحسين طريقة استخدامه تدريجياً** — النظام لا يرشد المستخدم عند تكرار سلوك غير مثالي مثل إضافة عناصر بلا وسوم أو عدم استخدام المجموعات الذكية.
  - **الملفات الجديدة:**
    - `archive-app/src/features/feedback/contextualRules.js` — قواعد النصائح حسب السلوك.
    - `archive-app/src/components/feedback/ContextualNudge.jsx` — نصيحة غير مزعجة في اللحظة المناسبة.
    - `archive-app/src/components/feedback/WeeklySuggestionsPanel.jsx` — 2-3 اقتراحات أسبوعية.
    - `archive-app/src/features/feedback/usagePatternAnalyzer.js` — تحليل سلوك المستخدم محلياً.
    - `archive-app/src/stores/slices/feedbackPrefsSlice.js` — عدم الإظهار مرة أخرى وحالة النصائح.
  - **تعديل ملفات:**
    - `archive-app/src/pages/DashboardPage.jsx` — قسم اقتراحات التحسين.
    - `archive-app/src/components/forms/TagAutocomplete.jsx` و`AddVideoPage.jsx` — تلميحات عند الاستخدام المتكرر بلا وسوم/وصف.
  - **التنفيذ:** نصائح سياقية مرة واحدة؛ اقتراحات تنظيم أسبوعية؛ مؤشرات استخدام شخصية؛ كشف ميزات متقدمة تدريجياً؛ تعلم من الأخطاء المتكررة لتعديل القيم الافتراضية المقترحة.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 9 — P2).

---

### 15.22 P1 — تجربة عدم الاتصال الشاملة (Comprehensive Offline Experience)

- [x] `[P1]` ⏱️L **تحويل تجربة الأوفلاين إلى نمط عمل كامل مع طابور تغييرات ومزامنة تعارضات** — وجود PWA أو cache لا يكفي إذا توقفت الإضافة والتعديل والرفع عند فقدان الاتصال أو لم تظهر حالة واضحة للمستخدم.
  - **الملفات الجديدة:**
    - `archive-app/src/components/offline/OfflineBanner.jsx` — شريط حالة واضح.
    - `archive-app/src/features/offline/offlineQueue.js` — طابور إضافة/تعديل/حذف محلي.
    - `archive-app/src/components/offline/PendingSyncBadge.jsx` — مؤشر على العناصر المعدلة أوفلاين.
    - `archive-app/src/features/offline/connectivityProbe.js` — ping دوري للسيرفر بجانب navigator.onLine.
    - `archive-app/src/features/offline/precachePolicy.js` — تخبئة آخر 100 عنصر ومجلدات محددة.
  - **تعديل ملفات:**
    - `archive-app/public/sw.js` — ربط العمليات طويلة الأمد بالـ background sync إن أمكن.
    - `archive-app/src/stores/slices/archiveSlice.js` — قبول عمليات كتابة محلية عند الانقطاع.
    - `archive-app/src/features/sync/conflictResolver.js` — استخدام حوار تعارضات §15.2.
  - **التنفيذ:** تصفح وبحث محلي أوفلاين؛ إضافة/تعديل/حذف في الطابور؛ مزامنة زمنية عند عودة الاتصال؛ حفظ طلبات الرفع/التصدير للمعالجة لاحقاً؛ مؤشرات per-item؛ تخبئة مسبقة للمحتوى الأكثر استخداماً.
  - الجهد: 4-5 أسابيع.
  - المصدر: archive-suite-daily-ux-proposals (المقترح 10 — P1).

---

## 16. أفكار الميزات الجديدة — مهام تنفيذية مستخرجة

> المصدر: `archive-suite-new-feature-ideas.md`.
> المنهجية: حُوّلت الأفكار المقترحة إلى مهام تنفيذية بنفس صيغة ملف المهام. البنود التي لها أصل سابق في الملف الحالي صيغت كتوسعة أو مرحلة تنفيذ إضافية بدل تكرار مباشر.

### 16.1 P1 — المجموعات الذكية التلقائية بقواعد مركبة (Smart Auto-Collections)

- [x] `[P1]` ⏱️L **توسيع المجموعات الذكية لتُدار بقواعد تلقائية عند إضافة/تعديل العناصر** — المهمة الحالية في §9 تغطي مجموعات مبنية على استعلام محفوظ، لكنها لا تغطي محرّك قواعد حي يربط العناصر تلقائياً عند كل تغيير.
  - **✅ مُنجَز (2026-06-14):** محرّك DSL `features/collections/smartCollectionRules.js` (حقول: tags/type/subtype/status/folder/title/notes/favorite/createdAt/updatedAt/size، عمليات per-field، AND/OR) + `createSmartRuleset/matchItemAgainstRules/evaluateSmartCollection/countSmartMatches/describeRuleset` و**19 اختبار وحدة**. `viewModel.resolveCollectionItems` يقيّم `filterRules.kind==="rules"` **لحظياً** فتُعاد العضوية تلقائياً عند كل إضافة/تعديل عنصر (لا itemIds يدوية). محرّر بصري `components/collections/SmartCollectionRuleBuilder.jsx` (تبديل وضع المطابقة، إضافة/حذف شروط، **معاينة عدد المطابقات الحية**). دُمج في `CollectionsPage.jsx` (زر «مجموعة ذكية» + توجيه تعديل مجموعات القواعد للمحرّر). **قرار تصميم:** القواعد تُحفَظ ضمن `filterRules` JSON على سجل المجموعة وتُزامَن عبر تخزين المجموعات الموجود (IndexedDB/Postgres/PocketBase) — فأُلغيت الحاجة لجدول `smart_collection_rules` منفصل ومقيّم خادمي مستقل (إعادة استخدام/YAGNI؛ التقييم يجري على العميل في الأوضاع الثلاثة). التحقق: 268 اختبار يمرّ + `build:spa` أخضر.
  - **حالة حالية (2026-06-11):** يبقى هذا البند مفتوحاً بعد إغلاق §9؛ الموجود حالياً saved filters حيّة، وليس DSL قواعد مركبة ولا جدول `smart_collection_rules` ولا مقيّم خادمي يشتغل عند إضافة/تعديل العناصر.
  - **الملفات الجديدة:**
    - `archive-app/src/features/collections/smartCollectionRules.js` — تعريف DSL القواعد: وسوم، نوع، تاريخ، مجلد، حجم، شروط AND/OR.
    - `archive-app/src/components/collections/SmartCollectionRuleBuilder.jsx` — محرر قواعد بصري.
    - `archive-server/src/collections/smartCollectionEvaluator.js` — تقييم القواعد في الخادم أو عند المزامنة.
    - `archive-server/prisma/migrations/*_smart_collection_rules/` — جدول `smart_collection_rules`.
  - **تعديل ملفات:**
    - `archive-app/src/pages/CollectionsPage.jsx` — تمييز المجموعات الذكية بأيقونة ⚡ وإدارة قواعدها.
    - `archive-app/src/stores/slices/collectionsSlice.js` — إعادة حساب العضوية بعد الإضافة/التعديل.
    - `archive-server/src/api/server.js` — مسارات إنشاء/تحديث/اختبار القواعد.
  - **التنفيذ:** قواعد بسيطة ومركبة؛ معاينة عدد العناصر المطابقة قبل الحفظ؛ تطبيق تلقائي عند إضافة عنصر جديد أو تعديل وسومه؛ تحويل مجموعة ذكية لعادية والعكس؛ سجل آخر تشغيل للقاعدة.
  - يرتبط بـ: §9.د “مجموعات ذكية”.
  - المصدر: archive-suite-new-feature-ideas (الميزة 1 — P1).

---

### 16.2 P0 — المفضلات والوصول السريع (Favorites & Quick Access)

- [x] `[P0]` ⏱️M **إضافة نظام مفضلات شامل للعناصر والمجموعات والمجلدات والبحث المحفوظ** — لا يوجد حالياً مسار سريع ثابت للوصول للعناصر المتكررة، ما يجعل المستخدم يعيد البحث أو التنقل لنفس المحتوى يومياً.
  - **الملفات الجديدة:**
    - `archive-app/src/features/favorites/favoritesStore.js` — إدارة المفضلات محلياً وسحابياً.
    - `archive-app/src/components/favorites/FavoriteButton.jsx` — زر نجمة موحد لكل كيان.
    - `archive-app/src/components/favorites/FavoritesSidebarSection.jsx` — قسم أعلى الشريط الجانبي.
    - `archive-app/src/pages/FavoritesPage.jsx` — صفحة مفضلات موحدة.
    - `archive-server/prisma/migrations/*_favorites/` — جدول `favorites` بنوع الكيان والمالك والترتيب.
  - **تعديل ملفات:**
    - `archive-app/src/components/navigation/Sidebar.jsx` — عرض المفضلات والأكثر استخداماً.
    - `archive-app/src/pages/ArchivePage.jsx` و`RecordDetailsPage.jsx` — إظهار زر المفضلة.
    - `archive-app/src/features/search/savedSearches.js` — دعم حفظ البحث كمفضلة.
  - **التنفيذ:** مفضلات يدوية؛ قسم “الأكثر استخداماً” تلقائي حسب الفتح/التعديل؛ ترتيب المفضلات بالسحب؛ مزامنة عبر الأجهزة؛ اختصار لوحة مفاتيح لإضافة/إزالة المفضلة.
  - الجهد: 1-2 أسبوع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 2 — P0).

---

### 16.3 P1 — كشف المكررات الذكي ودمجها (Smart Duplicate Detection & Merge)

- [x] `[P1]` ⏱️L **بناء نظام كشف مكررات متعدد الطبقات مع واجهة دمج آمنة** — التحليلات الحالية قد تشير لصحة الأرشيف، لكنها لا تقدم فحصاً عملياً للمكررات ولا عملية دمج قابلة للتراجع.
  - **الملفات الجديدة:**
    - `archive-server/src/duplicates/duplicateScanner.js` — فحص hash والحجم والنوع والعنوان.
    - `archive-server/src/duplicates/mergeService.js` — دمج البيانات الوصفية والملفات المرتبطة.
    - `archive-app/src/pages/DuplicatesPage.jsx` — لوحة مراجعة المكررات.
    - `archive-app/src/components/duplicates/DuplicatePairCard.jsx` — عرض الزوج ودرجة التشابه.
    - `archive-server/prisma/migrations/*_duplicate_candidates/` — جدول نتائج الفحص وجدول قرارات المستخدم.
  - **تعديل ملفات:**
    - `archive-server/src/files/fileStorageService.js` — حفظ hash للملفات الجديدة.
    - `archive-app/src/pages/PersonalAnalyticsPage.jsx` — ربط “صحة الأرشيف” بالمكررات.
    - `archive-app/src/stores/slices/archiveSlice.js` — إجراءات دمج/تجاهل/حذف.
  - **التنفيذ:** مطابقة تامة عبر hash؛ مطابقة حجم/نوع؛ تشابه عناوين؛ درجة ثقة؛ تشغيل يدوي أو أسبوعي؛ خيارات: دمج، حذف النسخة الأقدم، تجاهل؛ حفظ قرار “ليسا مكررَين”.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 3 — P1).

---

### 16.4 P1 — شاهد لاحقاً وقوائم القراءة/المراجعة (Watch Later & Reading Lists)

- [x] `[P1]` ⏱️M **إضافة قوائم شخصية مؤقتة لتجميع العناصر المراد الرجوع إليها لاحقاً** — المفضلات لا تكفي لأنها تعبّر عن “مهم دائماً” لا “أريد مراجعته لاحقاً”.
  - **الملفات الجديدة:**
    - `archive-app/src/features/lists/readingListsSlice.js` — قوائم المستخدم وحالة التقدم.
    - `archive-app/src/components/lists/WatchLaterButton.jsx` — إضافة سريعة للقائمة الافتراضية.
    - `archive-app/src/pages/ReadingListsPage.jsx` — إدارة القوائم.
    - `archive-app/src/components/lists/ReadingListProgressBadge.jsx` — مكتمل/غير مكتمل/قيد القراءة.
    - `archive-server/prisma/migrations/*_reading_lists/` — جداول `reading_lists` و`reading_list_items`.
  - **تعديل ملفات:**
    - `archive-app/src/components/cards/RecordCard.jsx` — زر “شاهد لاحقاً”.
    - `archive-app/src/pages/RecordDetailsPage.jsx` — تحديث التقدم عند مشاهدة الفيديو/فتح المستند.
    - `archive-app/src/components/navigation/Sidebar.jsx` — عداد العناصر غير المنتهية.
  - **التنفيذ:** قائمة افتراضية؛ قوائم مخصصة؛ ترتيب بالسحب؛ نقل تلقائي إلى “مكتمل” عند انتهاء مشاهدة/قراءة؛ فلاتر للمنتهي وغير المنتهي.
  - الجهد: 1-2 أسبوع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 4 — P1).

---

### 16.5 P1 — الاستيراد من مصادر خارجية (External Source Import)

- [x] `[P1]` ⏱️XL **بناء منظومة استيراد من يوتيوب وGoogle Drive وروابط الويب والمجلدات المحلية** — ✅ **مكتمل 2026-06-18:** اكتملت منظومة الاستيراد الآمنة كمرجع + metadata: روابط YouTube/Google Drive/الويب، معاينة metadata من الخادم مع حماية SSRF، واستيراد manifest لمجلدات محلية كدفعة عناصر.
  - 🔄 **شريحة استيراد الروابط (2026-06-16):** كشف مصادر نقي من جانب العميل + واجهة استيراد. نموذج `detectImportSource`/`parseImportLines`/`buildImportDraft` يصنّف روابط يوتيوب/Drive/الويب ويبني مسودات لـ `createVideoItemValue`، وحوار `ImportFromUrlDialog` يتيح لصق روابط متعددة مع معاينة وإنشاء عناصر تشير إلى الرابط. الملفات: `archive-app/src/features/import/importSources.js` (+`importSources.test.js`)، `archive-app/src/features/import/ImportFromUrlDialog.jsx`، ومربوط في `archive-app/src/pages/ArchivePage.jsx` (زر "استيراد من روابط"). 794 اختبارًا ينجح، build:spa أخضر. مؤجّل: مصادقة Drive OAuth للملفات الخاصة، تنزيل الوسائط الفعلي، واستيراد المجلدات المحلية دفعة واحدة.
  - 🔄 **شريحة metadata آمنة من الخادم (2026-06-18):** أضيف `archive-server/src/import/importPreview.js` وخط `POST /api/import/preview`/`/api/v1/import/preview` خلف صلاحية editor. الخدمة تجلب عناوين/أوصاف/صور صفحات الويب فقط بعد فحص SSRF أساسي (رفض localhost/private IP)، وتتعامل مع YouTube/Google Drive كمرجع metadata بدون تنزيل وسائط أو OAuth. الواجهة أضافت `importPreviewClient.js` وربطت `ImportFromUrlDialog` بحيث تستخدم العنوان/الوصف/الصورة من الخادم عند توفرها مع fallback للمسودة المحلية. تحقق: `verify:api` يغطي البوابة والصلاحيات ورفض private hosts، و24 اختباراً مستهدفاً للاستيراد + `build:spa` خضراء.
  - ✅ **شريحة المجلدات المحلية (2026-06-18):** أضيف `parseLocalFolderManifest()` لقبول manifest JSON آمن (`files[]` مع `relativePath/path/title/tags/size/mimeType`) ورفض المسارات الفارغة/المطلقة/الخارجة (`..`). `ImportFromUrlDialog` يدعم الآن رفع ملف manifest واستيراده مع الروابط في نفس العملية، ويحفظ المراجع فقط دون قراءة ملفات المستخدم مباشرة. تحقق: 25 اختبار استيراد مستهدف + `build:spa` + `pnpm run verify`.
  - **الملفات الجديدة:**
    - `archive-app/src/pages/ImportSourcesPage.jsx` — مركز ربط المصادر.
    - `archive-app/src/components/import/ExternalImportDialog.jsx` — إدخال رابط أو اختيار مصدر.
    - `archive-server/src/importers/youtubeImporter.js` — حفظ مرجع أو تنزيل اختياري مع بيانات وصفية.
    - `archive-server/src/importers/googleDriveImporter.js` — استيراد ملفات Drive بعد OAuth.
    - `archive-server/src/importers/webPageImporter.js` — حفظ صفحة HTML/PDF وmetadata.
    - `archive-server/src/importers/localFolderManifestImporter.js` — استيراد manifest لمجلدات محلية.
    - `archive-server/prisma/migrations/*_import_sources/` — إعدادات المصادر وحالة الاستيراد.
  - **تعديل ملفات:**
    - `archive-app/src/pages/AddVideoPage.jsx` أو AddItemPage — خيار “استيراد من مصدر”.
    - `archive-server/src/auth/oauthService.js` — نطاقات OAuth للمصادر الخارجية.
    - `archive-server/src/jobs/jobQueue.js` — تنفيذ الاستيراد كمهام طويلة.
  - **التنفيذ المكتمل:** استيراد روابط مفردة/متعددة؛ استيراد دفعة manifest لمجلد محلي؛ استخراج عنوان/وصف/صورة حيث يسمح المصدر؛ سياسة “مرجع + metadata” كافتراضي آمن؛ رسائل خطأ للروابط/manifest؛ بدون تنزيل وسائط أو OAuth خاص.
  - ملاحظة: تنزيل محتوى من منصات خارجية أو Drive الخاص يجب أن يحترم شروط الاستخدام وحقوق الوصول؛ لذلك تُرك كتحسين موصلات اختياري منفصل عند توفر متطلبات قانونية/تشغيلية واضحة.
  - الجهد: 5-7 أسابيع (أُغلق كنظام استيراد آمن تدريجي).
  - المصدر: archive-suite-new-feature-ideas (الميزة 5 — P1).

---

### 16.6 P1 — تاريخ إصدارات العناصر والملفات المرفقة (Item Version History)

- [x] `[P1]` ⏱️L **توسيع سجل الإصدارات ليشمل الحقول والملفات والمقارنة والاستعادة الجزئية** — §9.ج يغطي snapshot للسجل، وهذه المهمة توسّعه إلى تجربة مستخدم كاملة مع ملفات مشتقة وسياسات احتفاظ.
  - **الملفات الجديدة:**
    - `archive-app/src/components/versions/VersionTimeline.jsx` — خط زمني للإصدارات.
    - `archive-app/src/components/versions/VersionDiffViewer.jsx` — مقارنة حقول ووسوم ووصف.
    - `archive-app/src/components/versions/RestoreVersionDialog.jsx` — استعادة كاملة أو جزئية.
    - `archive-server/src/versions/versionRetentionService.js` — تنظيف الإصدارات القديمة حسب السياسة.
    - `archive-server/prisma/migrations/*_item_versions_extended/` — توسيع `record_versions` لدعم fileRevision وdiff metadata.
  - **تعديل ملفات:**
    - `archive-server/src/api/server.js` — نقاط compare/restore/list.
    - `archive-app/src/pages/RecordDetailsPage.jsx` — تبويب “الإصدارات”.
    - `archive-server/src/files/fileStorageService.js` — الاحتفاظ بنسخ ملفات عند الاستبدال حسب policy.
  - **التنفيذ:** نسخة عند كل تعديل جوهري؛ عرض من عدّل ومتى وما تغيّر؛ استعادة حقل واحد؛ استعادة ملف سابق؛ مقارنة نسختين؛ سياسة احتفاظ: آخر 10 / آخر 90 يوم / الكل.
  - يرتبط بـ: §9.ج “سجل إصدارات السجل”.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 6 — P1).

---

### 16.7 P1 — المشاركة والتعاون المحدود بصلاحيات دقيقة (Limited Sharing & Collaboration)

- [x] `[P1]` ⏱️XL **توسيع المشاركة من روابط snapshot إلى مشاركة عناصر ومجموعات بدعوات وصلاحيات وتعليقات** — روابط المشاركة الحالية لا تكفي لسيناريوهات الفريق ولا توفر صلاحيات مثل تعليق/تعديل/تحميل فقط.
  - **الملفات الجديدة:**
    - `archive-app/src/components/share/ShareDialog.jsx` — مشاركة عنصر أو مجموعة.
    - `archive-app/src/pages/SharedWithMePage.jsx` — المحتوى المشترك مع المستخدم.
    - `archive-app/src/components/comments/CommentThread.jsx` — تعليقات على العنصر أو المجموعة.
    - `archive-server/src/share/sharePermissionService.js` — صلاحيات عرض/تحميل/تعليق/تعديل.
    - `archive-server/src/share/invitationService.js` — دعوات بريدية وروابط مؤقتة.
    - `archive-server/prisma/migrations/*_sharing_permissions/` — جداول shares, share_invites, comments.
  - **تعديل ملفات:**
    - `archive-server/src/share/` — دعم كلمة مرور للرابط، انتهاء صلاحية، إلغاء فوري، صلاحيات دقيقة.
    - `archive-server/src/api/server.js` — middleware صلاحيات للموارد المشتركة.
    - `archive-app/src/pages/RecordDetailsPage.jsx` و`CollectionsPage.jsx` — أزرار المشاركة والتعليقات.
  - **التنفيذ:** مشاركة عنصر/مجموعة؛ رابط خاص؛ دعوة مستخدم بالبريد؛ صلاحيات: metadata فقط، عرض، تنزيل، تعليق، تعديل؛ انتهاء صلاحية؛ كلمة مرور اختيارية؛ سجل نشاط المشاركة.
  - 🔄 **شريحة آمنة 2026-06-18:** أُضيف نموذج صلاحيات SPA نقي (`sharePermissions.js`) وحوار مشاركة DaisyUI (`ShareDialog.jsx`) يتيح اختيار `view/comment/download/edit` ويمرر `scope.permission` عند سكّ الرابط. رُبط الحوار بزر مشاركة المجموعات في `CollectionsPage.jsx` مع الحفاظ على بوابة `canShare` والنسخ/الإشعار السابقين.
  - 🔄 **تقدّم 2026-06-18:** وُحّدت صيغة نطاق مشاركة العنصر بين العميل والخادم: يقبل العميل `item` كاختصار واجهة لكنه يرسل `items` إلى الخادم، ويحفظ الخادم `permission` داخل token ويعرض `share.permission` و`share.capabilities` في payload العام. رُبط `DetailPage.jsx` بزر مشاركة السجل في سطح المكتب وشريط الجوال، مع إخفائه في الوضع المحلي أو دون token. التحقق: `sharePermissions`، `ShareDialog`، `DetailPage.relations`، و`archive-server verify:share`.
  - 🔄 **تحسين واجهة 2026-06-18:** تعرض شاشة الرابط العام `SharedView.jsx` مستوى الصلاحية وقدرات الرابط (`تعليق`/`تنزيل`/`تعديل`) من payload العام حتى يفهم المستلم حدود الوصول بدقة. التحقق: `SharedView.test.jsx`.
  - 🔄 **تحسين أمان 2026-06-18:** أضيفت كلمة مرور اختيارية لروابط المشاركة: الخادم يوقّع حالة الحماية داخل token دون حفظ كلمة المرور الخام، ويتطلب `x-share-password` عند فتح الرابط العام؛ حوار المشاركة يرسل الكلمة اختيارياً، و`SharedView` يعرض نموذج إدخال ثم يعيد المحاولة. كما يوجد endpoint إبطال خادمي بـ `jti` (`POST /api/share/revoke`) يحتاج لاحقاً واجهة إدارة/قائمة روابط. التحقق: `archive-server verify:share` + اختبارات `ShareDialog`/`SharedView` + عقد `shareClient` في `verify-modules`.
  - 🔄 **إدارة إبطال 2026-06-18:** صار `shareClient` يعيد `jti` عند سك الرابط ويضيف `revokeShareLink` لاستدعاء `POST /api/share/revoke`، ويعرض `ShareDialog` زر "إلغاء الرابط" مباشرة بعد إنشاء رابط قابل للإبطال مع حالة نجاح/خطأ. التحقق: `shareClient.test.js` و`ShareDialog.test.jsx`.
  - 🔄 **شريحة آمنة 2026-06-19:** أُضيف `mintedLinksStore.js` (localStorage بحد أقصى 200 إدخال) يحفظ كل رابط يُسكّ مع `jti/url/permission/scopeType/label/expiresAt/passwordProtected/mintedAt/revoked`. أُضيفت صفحة `SharedLinksPage.jsx` (route `shared-links`) تعرض الروابط النشطة والملغاة/المنتهية مع نسخ وإلغاء وحذف لكل رابط. رُبط `handleSharedItem` في `DetailPage.jsx` و`handleSharedCollection` في `CollectionsPage.jsx` بـ `saveMintedLink` تلقائياً عند سكّ أي رابط. التحقق: `build:spa` + 845 اختباراً.
  - 🔄 **شريحة آمنة 2026-06-19:** أُضيفت `SharedWithMePage.jsx` (route `shared-with-me`, مجموعة `daily`) — تتيح للمستخدمين فتح روابط مشاركة بلصق رابط/JWT وتحتفظ بسجل localStorage بحد أقصى 50 إدخالاً مع بيانات `token/url/label/permission/lastAccessedAt`. أُضيف `sharePermissionService.js` (مصنع `createSharePermissionService`) يوفّر `fromRequest()` (استخراج التوكن من header/query/Bearer) و`allows()` و`capabilities()` و`scopeIncludesItem()`؛ وُصّل في `server.js` بإضافة endpoint `GET /api/share-access` (فحص الصلاحيات) و`POST /api/share-access/comments` (نشر تعليق مُؤمَّن بصلاحية `canComment`). كذلك أُضيف endpoint `GET /api/media/derived` لجلب `derived_files` من `conversionSvc`. التحقق: `SharedWithMePage.test.jsx` + `archive-server verify:share`.
  - 🔄 **تحسين UI/UX 2026-06-19:** أُضيف `archive-app/src/components/comments/CommentThread.jsx` كمكوّن مستقل لتعليقات المادة مع حالة فارغة أوضح، عدّاد، DaisyUI buttons، وحذف مشروط حسب صلاحيات المستخدم؛ واستُبدلت كتلة التعليقات الداخلية في `DetailPage.jsx` بالمكوّن. كما أُضيفت أيقونات واضحة لـ`shared-links` و`shared-with-me` في `Sidebar.jsx`، وأُضيفت الصفحتان إلى Command Palette في `ShellParts.jsx` لسهولة الاكتشاف. التحقق: `CommentThread.test.jsx` + `DetailPage.relations.test.jsx`.
  - 🔄 **شريحة دعوات 2026-06-19:** أُضيف `archive-server/src/share/invitationService.js` لتوليد رابط مشاركة مؤقت من نفس عقد `mintShareToken`، تطبيع البريد، إرسال رسالة عبر `sendMail`/nodemailer عند توفر SMTP، وحفظ سجل `share_invitations` best-effort. أُضيف endpoint محمي `POST /api/share/invitations` يعيد `{ invitation, token, path, url, emailStatus }` ويتحقق من البريد والصلاحيات. التحقق: `archive-server verify:share` يغطي الخدمة مباشرة ومسار HTTP كامل (auth required + بريد + تخزين).
  - 🔄 **واجهة الدعوات 2026-06-19:** أُضيف `inviteShareByEmail()` في `shareClient.js` وربط `ShareDialog.jsx` بحقول بريد المستلم ورسالة اختيارية؛ عند إدخال بريد يستخدم الحوار `POST /api/share/invitations` ويعرض حالة "تم إرسال الدعوة" مع بقاء رابط المشاركة قابلاً للنسخ والإبطال. التحقق: `shareClient.test.js` + `ShareDialog.test.jsx` + `build:spa`.
  - ✅ **إغلاق التخزين الدائم 2026-06-19:** أُضيفت نماذج Prisma `ShareInvitation` و`ShareComment` مع migration `20260619133000_share_invitations_comments`، وأُعيد توليد Prisma client ليشمل النماذج الجديدة. صار `invitationService` يفضّل `db.shareInvitation.create()` عند توفر Prisma مع fallback إلى `StorageProvider`، وصار `POST /api/share-access/comments` يكتب في `db.shareComment.create()` عند توفره. التحقق: `archive-server verify:share` يغطي تخزين الدعوات والتعليقات عبر Prisma.
  - يرتبط بـ: مهام إبطال روابط المشاركة وRBAC في §1 و§9.
  - الجهد: 5-8 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 7 — P1).

---

### 16.8 P1 — عمليات البحث المحفوظة والتنبيهات التلقائية (Saved Searches & Alerts)

- [x] `[P1]` ⏱️L **تحويل البحث المحفوظ إلى كيان كامل مع تنبيهات عند ظهور عناصر مطابقة** — البحث المحفوظ مذكور ضمن المجموعات الذكية، لكن لا توجد تجربة مستقلة لحفظه وتشغيله والتنبيه عليه.
  - **الملفات الجديدة:**
    - `archive-app/src/features/search/savedSearchesSlice.js` — إدارة الاستعلامات المحفوظة.
    - `archive-app/src/components/search/SaveSearchButton.jsx` — حفظ من نتائج البحث.
    - `archive-app/src/pages/SavedSearchesPage.jsx` — إدارة البحث والتنبيهات.
    - `archive-server/src/search/savedSearchAlertService.js` — فحص العناصر الجديدة المطابقة.
    - `archive-server/prisma/migrations/*_saved_search_alerts/` — جداول saved_searches وsaved_search_alerts.
  - **تعديل ملفات:**
    - `archive-app/src/components/navigation/Sidebar.jsx` — قسم “عمليات البحث المحفوظة”.
    - `archive-server/src/notifications/` — ربط التنبيهات بمركز الإشعارات والبريد الاختياري.
    - `archive-server/src/api/searchRoutes.js` أو `server.js` — CRUD للبحث المحفوظ.
  - **التنفيذ:** حفظ استعلام مع اسم وأيقونة؛ تشغيل بنقرة؛ تحويله لتنبيه؛ إشعار عند إضافة عنصر مطابق؛ digest يومي/أسبوعي؛ احترام صلاحيات المستخدم في النتائج.
  - يرتبط بـ: §9.د و§15.4.
  - الجهد: 2-3 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 8 — P1).

---

### 16.9 P2 — تلخيص المحتوى واستخلاص النقاط الرئيسية (Content Summarization & Key Insights)

- [x] `[P2]` ⏱️XL **إضافة طبقة تلخيص AI للعناصر والمجموعات اعتماداً على OCR والتفريغ الصوتي** — البحث داخل المحتوى يصبح أقوى عندما توجد ملخصات ونقاط رئيسية قابلة للعرض والفهرسة.
  - **✅ مُنجَز (شريحة، 2026-06-16):** نموذج نقي `itemSummary.js` (createItemSummary/hasValidSummary/describeStatus/extractTextForSummary) + **25 اختبار**؛ `summarySlice.js` مُخزَّن في `item_summaries` مُدمج في `appStore`؛ `SummaryPanel.jsx` (ملخص قصير + نقاط رئيسية + تفاصيل قابلة للطي + حالة تحميل/خطأ)؛ `SummarySnippet.jsx` للبطاقات. 700 اختبار يمرّ + `build:spa` أخضر.
  - **مؤجَّل (XL):** `summarizationService.js` من جانب الخادم، `groupSummaryService.js`، هجرة Prisma (جدول summaries)، تشغيل خلفية بعد OCR/Transcription، ربط RecordDetailsPage بزر "تلخيص".
  - **الملفات الجديدة:**
    - `archive-server/src/ai/summarizationService.js` — توليد ملخص قصير ونقاط وملخص مفصل.
    - `archive-server/src/ai/groupSummaryService.js` — تلخيص مجموعة عناصر.
    - `archive-app/src/components/ai/SummaryPanel.jsx` — عرض الملخص في صفحة التفاصيل.
    - `archive-app/src/components/cards/SummarySnippet.jsx` — ملخص قصير في بطاقة العنصر.
    - `archive-server/prisma/migrations/*_content_summaries/` — حقول/جدول summaries مع language/model/status.
  - **تعديل ملفات:**
    - `archive-server/src/ai/sdkProvider.js` — حماية prompt وقيود طول.
    - `archive-app/src/pages/RecordDetailsPage.jsx` — زر “تلخيص/تحديث الملخص”.
    - `archive-server/src/jobs/jobQueue.js` — تشغيل التلخيص كخلفية بعد OCR/Transcription.
  - **التنفيذ:** ملخص فقرة؛ 5-10 نقاط رئيسية؛ ملخص مفصل بعناوين؛ تلخيص مجموعة؛ تحديث عند تغيير المحتوى؛ دعم العربية؛ عدم تشغيل التفريغ/OCR إلا بموافقة أو إعداد واضح.
  - يرتبط بـ: §7 “بحث دلالي” و§16.15 “تحويل الصيغ”.
  - الجهد: 4-6 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 9 — P2).

---

### 16.10 P2 — أتمتة سير العمل بقواعد إذا-ثم (Workflow Automation Rules)

- [x] `[P2]` ⏱️XL **بناء محرر قواعد أتمتة بصري للأحداث والإجراءات المتكررة** — بدون أتمتة، تبقى خطوات مثل إضافة وسوم أو تشغيل تفريغ أو إرسال تذكير عمليات يدوية سهلة النسيان.
  - **✅ مُنجَز (شريحة، 2026-06-15):** نموذج `features/automation/automationModel.js` (قواعد trigger→conditions→actions، تقييم نقي) + **16 اختبار**؛ `stores/slices/automationSlice.js` يخزّن في store `automation_rules` الجديد (schema + appStore)؛ صفحة `pages/AutomationPage.jsx` مسجّلة في `pageManifest`/`pageRegistry` (مجموعة administration). 510 اختبار يمرّ + `build:spa` أخضر. **مؤجَّل (XL):** تنفيذ الإجراءات الفعلي عند أحداث الإضافة/التعديل في `archiveSlice`، إجراءات التفريغ/التذكير، وسجل تشغيل القواعد.
  - **الملفات الجديدة:**
    - `archive-app/src/pages/AutomationRulesPage.jsx` — إدارة القواعد.
    - `archive-app/src/components/automation/RuleBuilder.jsx` — محرر إذا/ثم.
    - `archive-server/src/automation/ruleEngine.js` — تقييم الأحداث والشروط.
    - `archive-server/src/automation/actionRunner.js` — تنفيذ الإجراءات بأمان.
    - `archive-server/src/automation/ruleExecutionLog.js` — سجل التنفيذ.
    - `archive-server/prisma/migrations/*_automation_rules/` — جداول rules وexecutions.
  - **تعديل ملفات:**
    - `archive-server/src/events/domainEvents.js` — بث أحداث item.created/item.updated/storage.threshold.
    - `archive-server/src/jobs/jobQueue.js` — جدولة القواعد المؤجلة.
    - `archive-app/src/components/navigation/Sidebar.jsx` — رابط الأتمتة.
  - **التنفيذ:** أحداث: عنصر أضيف/عُدّل/وُسّم/مساحة تخزين تجاوزت حد؛ إجراءات: أضف وسم، انقل، أرسل إشعار، شغّل OCR/تفريغ، أنشئ نسخة احتياطية؛ تفعيل/تعطيل؛ اختبار القاعدة على عينة؛ سجل تنفيذ قابل للمراجعة.
  - الجهد: 5-7 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 10 — P2).

---

### 16.11 P2 — الخط الزمني البصري للأرشيف (Visual Archive Timeline)

- [x] `[P2]` ⏱️L **إضافة عرض خط زمني تفاعلي يكشف توزيع العناصر عبر الزمن** — العرض الزمني مذكور ضمن نظام العرض التكيفي، وهذه مهمة تنفيذ تفصيلية له كصفحة/وضع عرض مستقل.
  - **✅ مُنجَز (2026-06-14):** `features/timeline/timelineSelectors.js` — `buildTimeline` يجمّع العناصر بدقّة يوم/أسبوع/شهر/سنة (عدّاد لكل فترة، تفصيل `byType`، نطاق التواريخ) + `timelineTypeTotals` للأسطورة (+**9 اختبارات وحدة**). `pages/TimelinePage.jsx` صفحة مستقلة: مبدّل الدقّة، أعمدة توزيع مكدّسة ملوّنة حسب النوع (ارتفاع حسب العدد)، أسطورة الأنواع، ونقر الفترة لعرض عناصرها وفتحها. مسجَّلة في `pageManifest`/`pageRegistry` (مجموعة daily، id: `timeline`). **ملاحظة:** نُفّذت كصفحة مستقلة (المواصفة تقبل «صفحة/وضع مستقل»)؛ دمج وضع Timeline داخل `ArchivePage` وendpoint التجميع الخادمي للأحجام الكبيرة يبقيان توسعة لاحقة. التحقق: 301 اختبار يمرّ + `build:spa` أخضر.
  - **الملفات الجديدة:**
    - `archive-app/src/components/views/TimelineView.jsx` — عرض العناصر على محور زمني.
    - `archive-app/src/components/views/TimelineZoomControls.jsx` — يوم/أسبوع/شهر/سنة.
    - `archive-app/src/components/views/TimelineLane.jsx` — صفوف حسب النوع أو المجموعة.
    - `archive-app/src/features/timeline/timelineSelectors.js` — تجميع حسب الزمن.
  - **تعديل ملفات:**
    - `archive-app/src/pages/ArchivePage.jsx` — إضافة وضع Timeline.
    - `archive-app/src/features/views/viewPreferencesSlice.js` — حفظ تفضيل العرض.
    - `archive-server/src/api/searchRoutes.js` — endpoint تجميع زمني عند الأحجام الكبيرة.
  - **التنفيذ:** تكبير/تصغير؛ ألوان/أيقونات حسب النوع؛ حجم النقطة حسب حجم الملف؛ فلاتر وسوم/أنواع/مجموعات؛ خطوط متعددة للمقارنة؛ فتح العنصر من النقطة الزمنية.
  - يرتبط بـ: §15.10 “نظام العرض التكيفي”.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 11 — P2).

---

### 16.12 P2 — الاقتراحات الذكية والمحتوى المرتبط (Smart Suggestions & Related Content)

- [x] `[P2]` ⏱️L **إضافة قسم محتوى مرتبط واقتراحات تحسين مبنية على التشابه والسلوك** — الاقتراحات العامة في اللوحة لا تكفي إذا لم تظهر أيضاً داخل صفحة العنصر وفي لحظة اتخاذ القرار.
  - ✅ **مكتملة 2026-06-13:** تبويب العلاقات في صفحة التفاصيل يعرض مواد مرتبطة محسوبة بالتشابه، ويعرض اقتراحات تحسين عملية: تثبيت أفضل عنصر مشابه كعلاقة، إضافة وسوم مستنتجة من المواد المشابهة، اقتراح جمع المواد المتشابهة في مجموعة، والتنبيه إلى المصدر/الملف الناقص. لوحة التحكم تعرض اقتراحات تحسين على مستوى الأرشيف. أضيفت تغطية اختبارية لمحرك الاقتراحات وواجهة التبويب وfeedback.
  - **الملفات الجديدة/المكتملة:**
    - `archive-server/src/recommendations/relatedContentService.js` — حساب التشابه واقتراحات جودة الأرشيف في الخادم.
    - `archive-app/src/features/archive/relatedItems.js` — محرك الارتباط والاقتراحات داخل التطبيق.
    - `archive-app/src/components/recommendations/RelatedContentPanel.jsx` — عناصر مرتبطة في صفحة التفاصيل.
    - `archive-app/src/components/recommendations/ArchiveImprovementSuggestions.jsx` — اقتراحات تنظيف وتنظيم للعنصر ولوحة التحكم.
    - `archive-app/src/features/recommendations/recommendationFeedback.js` — إخفاء/مفيد/غير مفيد مع منع تكرار الاقتراحات المخفية.
  - **تعديل ملفات:**
    - `archive-app/src/pages/DetailPage.jsx` — تبويب العلاقات والمحتوى المرتبط والاقتراحات الإجرائية.
    - `archive-app/src/pages/DashboardPage.jsx` — اقتراحات تحسين على مستوى الأرشيف.
  - **التنفيذ:** 5-10 عناصر مشابهة؛ تفسير سبب الاقتراح؛ اقتراح جمع عناصر في مجموعة؛ اقتراح إضافة مصدر/وسوم؛ إمكانية تجاهل الاقتراح أو تقييمه؛ عدم إظهار اقتراحات مخفية مرة أخرى.
  - يرتبط بـ: §15.21 و§16.9.
  - الجهد: 3-4 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 12 — P2).

---

### 16.13 P1 — الالتقاط السريع من الجوال وصندوق الوارد (Mobile Quick Capture)

- [x] `[P1]` ⏱️XL **بناء تجربة التقاط سريع للجوال عبر PWA مع Inbox للتنظيم لاحقاً** — نموذج الإضافة الكامل غير مناسب للحظات السريعة مثل تصوير وثيقة أو تسجيل ملاحظة صوتية.
  - **الملفات الجديدة:**
    - `archive-app/src/pages/MobileCapturePage.jsx` — واجهة التقاط مبسطة.
    - `archive-app/src/components/mobile/FloatingCaptureButton.jsx` — زر + عائم للجوال.
    - `archive-app/src/features/capture/captureInboxSlice.js` — عناصر “بريد الوارد”.
    - `archive-app/src/components/capture/CaptureReviewQueue.jsx` — تنظيم العناصر الملتقطة لاحقاً.
    - `archive-app/public/manifest.webmanifest` — shortcuts للتقاط صورة/صوت إن أمكن.
  - **تعديل ملفات:**
    - `archive-app/src/serviceWorker.js` أو `public/sw.js` — دعم offline capture queue.
    - `archive-app/src/pages/AddVideoPage.jsx` أو AddItemPage — وضع “حفظ الآن وتعديل لاحقاً”.
    - `archive-server/src/uploads/uploadRoutes.js` — قبول uploads من الطابور المتأخر.
  - **التنفيذ:** التقاط صورة/فيديو/صوت/ملاحظة نصية؛ عنوان تلقائي بالوقت؛ حفظ في Inbox؛ حقل عنوان واحد فقط؛ تفريغ الملاحظة الصوتية عند توفر الخدمة؛ عمل أوفلاين ثم رفع لاحق.
  - يرتبط بـ: §15.22 “الأوفلاين الشامل” و§15.8 “تجربة الجوال”.
  - الجهد: 5-6 أسابيع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 13 — P1).

---

### 16.14 P1 — العلامات المرجعية الزمنية للفيديو والصوت (Time-Based Bookmarks)

- [x] `[P1]` ⏱️M **إضافة علامات زمنية داخل مشغل الفيديو/الصوت مع ملاحظات وتصدير** — **(مكتملة ✅ — 12 يونيو 2026)**
  - **✅ منجز ومُدمج:** `archive-app/src/components/media/TimeBookmarks.jsx` (يصدّر `TimeBookmarkButton` + `TimeBookmarkList`: التقاط الوقت الحالي، عنوان+ملاحظة، نقر للانتقال، حذف، تصدير Markdown/CSV، RTL+a11y)؛ مدمج في `DetailPage.jsx` (التقاط من `videoRef.currentTime`، `seekToBookmark`)؛ الحفظ عبر slice `addBookmark`/`removeBookmark` (`archiveSlice.js:266,281`) إلى مخزن `BOOKMARKS` (IndexedDB + محوّل sqlite + import/export portability).
  - **⬜ المتبقي (مهام الإكمال):**
    - ✅ **تم جزئياً (2026-06-11):** أضيف `TimeBookmarkTimelineMarkers` كخط زمني مصغّر قابل للنقر أسفل المشغّل الحالي، مع helper نقي `buildTimeBookmarkMarkers` واختبار في `verify-modules.mjs`. سيبقى دمجه داخل شريط تقدّم مشغّل مخصّص عند تنفيذ §13.1 #20.
    - ✅ **محسوم معماريًا (2026-06-12):** لا حاجة لجدول prisma مخصّص `time_bookmarks`. مخزن `BOOKMARKS` مُسجَّل ضمن `DATA_STORES` في `services/storage/index.js`، فيُحفظ ويُزامَن على الخادم عبر طبقة التخزين الموحّدة `storage_rows` (`store`+`uid`+`data` JSON) ودوال RPC `putBatch`/`deleteBatch`/`getAll`/`snapshot`/`replaceAll` — تمامًا كبقية المجموعات (items/types/relations) على محوّلَي Postgres وPocketBase. إنشاء جدول منفصل كان سيجعل العلامات الكيان الوحيد الذي يتجاوز الطبقة الموحّدة (هجرة زائدة + مسار مزامنة ثانٍ)، فتُرك عمدًا.
    - ✅ **تم (2026-06-11):** ربط تلقائي بفقرة transcript: عند فتح نموذج علامة زمنية يُقترح عنوان وملاحظة من مقطع التفريغ النشط عبر `createTranscriptBookmarkDraft`.
    - ✅ **تم (2026-06-11):** اختبار وحدة لـ slice العلامات يغطي `addBookmark`/`removeBookmark` وتطبيع الوقت/العنوان/الوصف.
  - الجهد المتبقي: ~1 أسبوع.
  - المصدر: archive-suite-new-feature-ideas (الميزة 14 — P1).

---

### 16.15 P2 — تحويل المحتوى بين الصيغ والملفات المشتقة (Content Format Conversion)

- [x] `[P2]` ⏱️L **بناء نظام تحويل صيغ داخلي يحفظ النتائج كملفات مشتقة مرتبطة بالأصل** — وجود FFmpeg وOCR يصبح أكثر قيمة إذا استطاع المستخدم توليد صيغ بديلة من داخل التطبيق.
  - **الملفات الجديدة:**
    - `archive-server/src/conversion/conversionService.js` — تحويل فيديو/صوت/صورة/مستند.
    - `archive-server/src/conversion/conversionJobRunner.js` — تشغيل التحويلات الطويلة.
    - `archive-app/src/components/conversion/ConversionPanel.jsx` — واجهة التحويل في التفاصيل.
    - `archive-app/src/components/conversion/DerivedFilesList.jsx` — الملفات المشتقة المرتبطة بالأصل.
    - `archive-server/prisma/migrations/*_derived_files/` — جدول `derived_files`.
  - **تعديل ملفات:**
    - `archive-server/src/media/ffmpegService.js` — استخراج الصوت وضغط الفيديو وتغيير الصيغة.
    - `archive-server/src/ocr/` — OCR للصورة/المستند كتحويل قابل للطلب.
    - `archive-app/src/pages/RecordDetailsPage.jsx` — قسم “الملفات المشتقة”.
    - `archive-server/src/jobs/jobQueue.js` — شريط تقدم وإلغاء.
  - **التنفيذ:** فيديو → صوت؛ فيديو → صيغة/حجم أصغر؛ صورة → نص OCR؛ صوت → نص transcript؛ مستند → PDF؛ حفظ الناتج كملف مرتبط لا كعنصر جديد؛ سجل تحويلات؛ حذف ملف مشتق دون حذف الأصل.
  - 🔄 **شريحة آمنة 2026-06-18:** أُضيف نموذج `derivedFiles` داخل `metadata.media` يربط مخرجات `transcode` المكتملة بالأصل تلقائياً من مهام الوسائط (`buildDerivedFileRecordsFromJobs` + `mergeDerivedFiles`) ويحافظ على `derivedKey` القديم للتوافق. تعرض صفحة التفاصيل قسم "الملفات المشتقة" في تبويب الوسائط مع مفاتيح التخزين وزر نسخ. التحقق: `features/media/viewModel.test.js`، `DetailPage.relations.test.jsx`، و`build:spa`.
  - 🔄 **تحسين إدارة الملفات المشتقة 2026-06-18:** أضيف حذف مشتق منفرد من صفحة التفاصيل: يؤكد المستخدم العملية، يحذف مفتاح FileStore للمشتق فقط، ثم يحدّث `metadata.media.derivedFiles`/`derivedKey` دون لمس الأصل. أُضيف `removeDerivedFile` وتحديث `createMediaMetadataPatch` لدعم تصفير آخر مشتق. التحقق: `features/media/viewModel.test.js`، `DetailPage.relations.test.jsx`، و`build:spa`.
  - 🔄 **شريحة آمنة 2026-06-19:** أُضيف `ConversionPanel.jsx` في `features/media/` — مكوّن قابل لإعادة الاستخدام يعرض خيارات التحويل حسب نوع الملف (فيديو: صوت/ويب/GIF؛ صوت: MP3؛ صورة: OCR؛ مستند: PDF) ويرسل المهام عبر `mediaClient.transcode()` أو `mediaClient.audio()` مع عرض حالة آخر مهمة. التحقق: `build:spa` + 845 اختباراً.
  - 🔄 **شريحة آمنة 2026-06-19:** أُضيف endpoint `GET /api/media/derived?sourceItemId=<id>` في `server.js` يستدعي `conversionSvc.listForItem()` أو `conversionSvc.listForKey()` ويعيد سجلات `derived_files` بهيكل `{ id, sourceItemId, sourceKey, conversionType, label, status, outputKey, mimeType, fileSizeBytes, errorMessage, jobId, createdBy, createdAt, completedAt }`. دُمج `ConversionPanel.jsx` في `DetailPage.jsx` وأُضيف حفظ `derived_files` من جانب الخادم (راجع commit الأحدث). التحقق: `verify:server` أخضر + 845 اختباراً.
  - ✅ **إغلاق 2026-06-19:** `20260619120000_derived_files` موجودة لإنشاء جدول `derived_files`، و`schema.prisma` يحتوي `DerivedFile`، وتم تشغيل `pnpm --filter archive-server run prisma:generate` لتجديد العميل. أُضيف `archive-server/src/conversion/conversionJobRunner.js` كجسر صريح بين طابور `mediaJobStore` و`conversionService`: يعلّم السجل `processing` عند التقاط المهمة ويزامن `done/error` عند نشر حدث الوسائط. يستخدمه `server.js` الآن لإنشاء worker الافتراضي. التحقق: `archive-server verify:media`.
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

- [x] `[P1]` ⏱️XL **تبنّي DaisyUI كنظام تصميم موحّد فوق Tailwind v4 وترحيل المكوّنات تدريجياً** — ✅ **مكتمل 2026-06-18:** اكتمل الترحيل التدريجي لمكوّنات DaisyUI بما فيها آخر بند مفتوح: غلاف `drawer` للشريط الجانبي على الجوال.
  - **التثبيت:** `npx skills add saadeghi/daisyui --agent claude-code --yes` ثم إضافة `daisyui` كـ plugin في `archive-app/src/styles/tailwind.css` (Tailwind v4 `@plugin "daisyui";`).
  - **تعديل ملفات:** `archive-app/src/styles/tailwind.css` (ملف Tailwind الجذري)، `archive-app/src/components/ui/*` (الأزرار، البطاقات، الحقول، النوافذ)، `archive-app/tailwind.config.*` إن وُجد.
  - **التنفيذ التدريجي:** المرحلة 1 المكوّنات الأساسية (`btn`, `input`, `card`)؛ المرحلة 2 المكوّنات المركّبة (`navbar`, `menu`, `drawer`)؛ المرحلة 3 الصفحات الكاملة. دعم RTL أصيل، توحيد الأحجام والمسافات.
  - 🔄 **تقدم 2026-06-12:** `daisyui` مثبت ومفعّل في `archive-app/src/styles/tailwind.css`؛ أُضيف تبنٍّ تدريجي لمكوّنات `btn`/`card`/`badge`/`alert`/`skeleton`/`progress`/`dock` داخل primitives المشتركة (`V1Primitives.jsx`, `EmptyState.jsx`, `ProgressBar.jsx`, `MobileActionBar.jsx`) مع إبقاء طبقة `va-*` والثيمات الحالية. تقدمت §17.10 أيضاً بمعرض 34 سمة ومحرر حي مرتبطين بـ `SettingsPage`. لا تزال المهمة مفتوحة لأن ترحيل الصفحات الكاملة و`navbar/menu/drawer` كعمل شامل لم يكتمل بعد.
  - 🔄 **تقدم 2026-06-16 (المرحلة 2):** اكتملت ترحيلات المرحلة الثانية — `navbar`/`navbar-start`/`navbar-end` في `PageContextBar.jsx`؛ `menu`/`menu-sm`/`menu-title`/`active` في `Sidebar.jsx`؛ `stats`/`stat`/`stat-figure`/`stat-title`/`stat-value`/`stat-desc` في `ReportStrip` بـ`V1Primitives.jsx`؛ `toggle toggle-accent` في `NotificationPreferences.jsx`. تم دمجها في `master` بعد التحقق من البناء والاختبارات (700+ اختبار). المتبقي: `drawer` للشريط الجانبي على الجوال (يتطلب إعادة هيكلة AppRouter).
  - 🔄 **مرحلة 3 (2026-06-16):** ترحيل مكوّنات ورقية منخفضة الخطورة إلى DaisyUI مع الحفاظ على السلوك وRTL والسمات وإمكانية الوصول: `badge badge-sm/badge-xs` في `archive/StatusBadge.jsx` و`offline/PendingSyncBadge.jsx`؛ `btn btn-ghost btn-circle btn-sm` (نمط زر الأيقونة) في `favorites/FavoriteButton.jsx` و`lists/WatchLaterButton.jsx`؛ `join` + `btn join-item` في `common/Pagination.jsx`. حُفظت تدرّجات الألوان المخصّصة وحالة الصفحة النشطة. **709 اختبار تمرّ، build:spa أخضر.** المتبقي للمراحل القادمة: ترحيل الصفحات الكاملة، و`drawer` للجوال، وحقول `input`/`select` المتبقية، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 4 (2026-06-16):** ترحيل دفعة متماسكة من حقول النماذج المخصّصة إلى أصناف DaisyUI مع الحفاظ على السلوك وRTL والسمات وحالات التحقّق وإمكانية الوصول: `input input-bordered` + `select select-bordered` في `activity/ActivityFilterBar.jsx` (بحث + قائمتا إجراء/نوع + حقلا تاريخ)؛ `select select-bordered` و`input input-bordered` في `relations/AddRelationDialog.jsx` (نوع العلاقة + بحث + ملاحظة)؛ `input/select` (+ `input-sm`/`select-sm`) في `collections/SmartCollectionRuleBuilder.jsx` (الرمز/الاسم + حقل/عملية/قيمة لكل شرط)؛ `input input-bordered` في حقل كلمة المرور المشترك `common/PasswordField.jsx`. أُبقيت طبقة `va-surface-deep` وتدرّجات التركيز (emerald/cyan) فوق أساس DaisyUI لحفظ المظهر. **709 اختبار تمرّ، build:spa أخضر.** المتبقي للمراحل القادمة: ترحيل الصفحات الكاملة، و`drawer` للجوال، وبقية حقول النماذج (settings/onboarding/bulk)، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 5 (2026-06-16):** ترحيل دفعة متماسكة من التنبيهات/النوافذ/البطاقات الورقية إلى أصناف DaisyUI مع الحفاظ على السلوك وRTL والسمات وتدرّجات الألوان وإمكانية الوصول: `modal modal-open` + `modal-box` وتنبيه `alert alert-warning` في `versions/RestoreVersionDialog.jsx`؛ `modal modal-open` + `modal-box` وتنبيه `alert alert-warning` في `bulk/BulkPreviewDialog.jsx`؛ `card card-border` لبطاقة المجموعة الورقية في `collections/SavedFilterCard.jsx`. أُبقيت تدرّجات amber/emerald والحواف المخصّصة فوق أساس DaisyUI لحفظ المظهر تماماً. **709 اختبار تمرّ، build:spa أخضر.** المتبقي للمراحل القادمة: ترحيل الصفحات الكاملة، و`drawer` للجوال، وترحيل نظام `ConfirmDialog`/`DialogModal` المركزي إلى `modal` (يتطلب احتراساً لمنطق التركيز/المفاتيح)، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 6 (2026-06-16):** ترحيل دفعة متماسكة من صناديق التنبيه/الإشعار الورقية (إعلامية/تحذير/خطأ) إلى صنف DaisyUI `alert` مع المُعدِّل الدلالي المناسب (`alert-warning`/`alert-error`/`alert-success`) و`role="alert"`، مع إبقاء تدرّجات الألوان المخصّصة وRTL وإمكانية الوصول بلا تغيير بصري: تحذيرات الإقلاع وخطأ تسجيل الدخول في `app/shell/ShellParts.jsx`؛ تنبيها فشل تحميل التفضيلات وعدم دعم Web Push في `settings/NotificationPreferences.jsx`؛ ملاحظة قيود الحقول في `settings/FieldPermissionsSettings.jsx`؛ رسالة خطأ العلاقة في `relations/AddRelationDialog.jsx`؛ رسالة خطأ التحقّق الثنائي في `settings/TwoFactorSettings.jsx`؛ شريطا نجاح/خطأ الاستيراد في `settings/SettingsImportExport.jsx`. أُضيف `block` على التنبيهات النصّية المفردة/المكدّسة حتى لا يُعيد تخطيط `alert` (grid) ترتيب محتواها. تُجُنّب نظام `ConfirmDialog` المركزي وحاوية رموز الاسترداد في `TwoFactorSettings` (محتوى تفاعلي متداخل). **709 اختبار تمرّ، build:spa أخضر.** المتبقي للمراحل القادمة: ترحيل الصفحات الكاملة، و`drawer` للجوال، ونظام `ConfirmDialog`/`DialogModal` المركزي، وبقية صناديق التنبيه التفاعلية، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 7 (2026-06-16):** ترحيل دفعة متماسكة من لوحات الإشعار/الحالة الورقية المتبقية إلى أصناف DaisyUI مع الحفاظ على السلوك وRTL والسمات وتدرّجات الألوان وإمكانية الوصول بلا تغيير بصري: صندوق حالة النسخ الاحتياطية إلى `alert` (`alert-error`/`alert-success` + `block` + `role="alert"`) وشارة عدّاد المخزن إلى `badge` في `admin/BackupManager.jsx`؛ تنبيه خطأ الاقتراحات إلى `alert alert-warning alert-sm block` في `upload/AutoTagSuggestions.jsx`؛ شارات شدّة الاقتراح إلى `badge badge-sm` في `suggestions/SuggestionsPanel.jsx` و`recommendations/ArchiveImprovementSuggestions.jsx`؛ شارة تسمية الخطأ إلى `badge badge-sm` في `errors/ErrorDetailsPanel.jsx`؛ شريط تقدّم العملية الجماعية إلى `progress progress-info` (مع `aria-label`) في `bulk/BulkProgressTracker.jsx`. أُبقيت تدرّجات الألوان المخصّصة (أحمر/أخضر/كهرماني/أزرق) فوق أساس DaisyUI لحفظ المظهر تماماً، وأُبقيت الأزرار التفاعلية ضمن الرقائق دون لفّها بـ`alert`. **709 اختبار تمرّ، build:spa أخضر.** المتبقي للمراحل القادمة: ترحيل الصفحات الكاملة، و`drawer` للجوال، ونظام `ConfirmDialog`/`DialogModal` المركزي، وحاوية رموز الاسترداد في `TwoFactorSettings`، و`ActivityEntry` (تحتوي تحكّمات تفاعلية)، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 8 (2026-06-16):** ترحيل قشرة نظام `ConfirmDialog`/`DialogModal` المركزي (المؤجَّل سابقاً لخطورته) إلى بنية DaisyUI `modal` مع الحفاظ على 100% من السلوك: الخلفية → `modal modal-open`، اللوحة → `modal-box`، صفّ الإجراءات → `modal-action`، وشارة العدّ التنازلي للمستوى 3 → `alert alert-error` (مع `role="alert"`). صُنّفت الأصناف فوق طبقة `va-dialog-*` القائمة دون لمس أي منطق: وعود `showConfirm`/`appAlert`/`appConfirm`/`appPrompt` (التواقيع والقيم المُعادة كما هي)، Escape=إلغاء، Enter=تأكيد، التركيز عند الفتح، منطق العدّ التنازلي/تعطيل الزر، النقر على الخلفية، `dir=rtl`، أدوار ARIA (`alertdialog`/`dialog`/`aria-modal`/`aria-labelledby`)، وz-index `9999` — كلها دون تغيير. الملف: `archive-app/src/components/common/ConfirmDialog.js`. **709 اختبار تمرّ، build:spa أخضر.** لم يُتحقّق عبر المتصفّح (تغيير أصناف بصرية بحت مغطّى بمجموعة a11y والبناء). المتبقي للمراحل القادمة: ترحيل الصفحات الكاملة، و`drawer` للجوال، وحاوية رموز الاسترداد في `TwoFactorSettings`، و`ActivityEntry`، وبقية حقول النماذج، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 9 (2026-06-16):** ترحيل أسطح صفحتين كاملتين منخفضتي الخطورة (تقديميتان غالباً) إلى أصناف DaisyUI مع الحفاظ على السلوك وRTL والسمات وإمكانية الوصول: في `pages/HistoryPage.jsx` — زر مسح السجل → `btn`، بطاقات مقاييس الإجراءات → `card`، شارة تسمية الإجراء → `badge badge-sm`، حقل البحث → `input input-bordered`، قائمتا الفلترة/حجم الصفحة → `select select-bordered`؛ في `pages/ServerStatusPage.jsx` — زر التحديث → `btn btn-ghost`، بطاقات المقاييس → `card`، صندوق `lastError` → `alert alert-error` (مع `role="alert"`). أُبقيت تدرّجات الألوان (emerald/red/amber) وحدود التركيز المخصّصة فوق أساس DaisyUI لحفظ المظهر، وحُفظت جميع المعالجات والتوجيه. **709 اختبار تمرّ، build:spa أخضر.** المتبقي للمراحل القادمة: مزيد من الصفحات الكبيرة (Dashboard/DataCenter/Users)، و`drawer` للجوال، وحاوية رموز الاسترداد في `TwoFactorSettings`، و`ActivityEntry`، وبقية حقول النماذج، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 10 (2026-06-16):** ترحيل أسطح صفحتين كاملتين منخفضتي الخطورة (تقديميتان) إلى أصناف DaisyUI مع الحفاظ على السلوك وRTL والسمات وإمكانية الوصول: في `pages/SavedSearchesPage.jsx` — بطاقة البحث `SearchCard` → `card`، شرائح الفلاتر → `badge badge-xs`، أزرار أيقونات التنبيه/التشغيل/الحذف → `btn btn-ghost btn-circle btn-sm`، أزرار تبويب الفلترة → `btn btn-sm btn-ghost`، صندوقا الخطأ/المعلومات → `alert` (مع `role="alert"` و`block` للخطأ)؛ في `pages/DuplicatesPage.jsx` — بطاقتا `PairCard`/`ItemMini` → `card`، شارة نسبة التطابق → `badge badge-sm`، زر الفحص وزرّا الحذف/الرفض → `btn` (+`btn-error`/`btn-ghost`)، زر التوسيع → `btn btn-ghost btn-circle btn-sm`، شريط الحالة → `alert` (`alert-success`/`alert-warning` + `role="alert"`)، حقل فلترة العنوان → `input input-bordered`. أُبقيت تدرّجات الألوان (amber/red/green/blue) والحدود المخصّصة فوق أساس DaisyUI لحفظ المظهر، وحُفظت جميع المعالجات والتوجيه وlocalStorage. **709 اختبار تمرّ، build:spa أخضر.** المتبقي للمراحل القادمة: الصفحات الكبيرة (Dashboard/DataCenter/Users/Reports)، و`drawer` للجوال، وحاوية رموز الاسترداد في `TwoFactorSettings`، و`ActivityEntry`، وبقية حقول النماذج، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 11 (2026-06-16):** ترحيل أسطح صفحتين كبيرتين تقديميتين إلى أصناف DaisyUI مع الحفاظ على السلوك وRTL والسمات وإمكانية الوصول: في `pages/ReportsPage.jsx` — أزرار التصدير (CSV/JSON/Excel) → `btn` (+`btn-ghost`/`btn-primary`)، بطاقات المؤشرات التنظيمية وصفوف آخر النشاط → `card`؛ في `pages/ReadingListsPage.jsx` — شرائح الفلترة وزر «قائمة جديدة» → `btn` (+`btn-xs btn-ghost`/`btn-sm`)، عدّادا المتبقّي/المكتمل → `badge badge-sm`، صندوق الخطأ → `alert alert-error block` (مع `role="alert"`)، نافذة `NewListDialog` → `modal modal-open`/`modal-box`/`modal-action` + `input input-bordered`، صفوف عناصر القائمة → `card` (مع `flex-row`)، أزرار أيقونات الحذف → `btn btn-ghost btn-circle btn-sm`. أُبقيت تدرّجات الألوان (blue/green/red) وطبقة `va-*` فوق أساس DaisyUI لحفظ المظهر، وحُفظت جميع المعالجات والتوجيه وحالة الفلترة. **709 اختبار تمرّ، build:spa أخضر.** المتبقي للمراحل القادمة: الصفحات الكبيرة المتبقية (Dashboard/DataCenter/Users)، و`drawer` للجوال، وحاوية رموز الاسترداد في `TwoFactorSettings`، و`ActivityEntry`، وبقية حقول النماذج، وإزالة طبقة `va-*` (مرتبط بـ§1982 عالي الخطورة).
  - 🔄 **مرحلة 12 (2026-06-16):** ترحيل أسطح صفحتين كبيرتين (Dashboard + Users) — **709 اختبار تمرّ، build:spa أخضر.**
  - 🔄 **مرحلة 13 (2026-06-17):** ترحيل `pages/DataCenterPage.jsx` + `features/data-center/DataCenterViews.jsx` — `ActionButton` → `btn btn-primary/btn-warning/btn-error`؛ `SegmentedButton` → `btn btn-sm`؛ `PageCard` → `card card-border`؛ نماذج الاستيراد/النقل → `input input-bordered`/`select select-bordered`؛ رسائل الخطأ → `alert alert-error`. **709 اختبار تمرّ، build:spa أخضر.**
  - 🔄 **مرحلة 14 (2026-06-17):** ترحيل `components/settings/TwoFactorSettings.jsx` (رموز استرداد → `alert alert-warning`) + `components/activity/ActivityEntry.jsx` (أزرار تراجع/إعادة → `btn btn-xs`). **709 اختبار تمرّ، build:spa أخضر.**
  - 🔄 **مرحلة 15 (2026-06-17):** ترحيل `pages/TypesPage.jsx` + `pages/ProjectsPage.jsx` — جميع `va-primary-button` → `btn btn-primary`. **709 اختبار تمرّ، build:spa أخضر.**
  - 🔄 **مرحلة 16 (2026-06-17):** ترحيل `pages/SettingsPage.jsx` — 7 أزرار `va-primary-button` → `btn btn-primary`. **709 اختبار تمرّ، build:spa أخضر.**
  - 🔄 **مرحلة 17 (2026-06-17):** ترحيل `app/shell/ShellParts.jsx` — أزرار نماذج تسجيل الدخول/كلمة المرور/معالج البداية → `btn btn-primary`. **709 اختبار تمرّ، build:spa أخضر.**
  - 🔄 **مرحلة 24 (2026-06-17):** ترحيل حقول إعدادات الخادم — `DatabaseSettings`/`FileStoreSettings`/`SettingsControls` → `input input-bordered`/`select select-bordered`/`textarea textarea-bordered`/`btn btn-ghost`. **709 اختبار تمرّ.**
  - 🔄 **مرحلة 25-26 (2026-06-17):** مسح كل 77 نمطاً متبقياً (`outline-none focus:border-emerald`) عبر 24 ملفاً — جميع صفحات الإعدادات والمحتوى والمكوّنات + V1OnboardingWizard. **صفر نمط متبقٍ. 709 اختبار تمرّ.**
  - ✅ **مرحلة 27 (2026-06-18):** إغلاق آخر بند متبقٍ: ترحيل غلاف الشريط الجانبي على الجوال إلى بنية DaisyUI `drawer drawer-end` مع إبقاء منطق الفتح/الإغلاق، Escape، منع تمرير الصفحة، وRTL كما هي. أضيف helper نقي `getSidebarDrawerFrame` في `sidebarLayoutModel.js` واختبار عقد له. تحقق: اختبار `sidebarLayoutModel.test.js` و`build:spa`، ثم `pnpm run verify`.
  - يرتبط بـ: §4 (UI/UX)، §17.10 (السمات)، §19.4 (تثبيت daisyUI).
  - الجهد: 6-8 أسابيع (تدريجي).
  - المصدر: daisyui-ux-proposals (المقترح 1 — P1).

### 17.2 P1 — لوحة الأوامر الشاملة (Command Palette / Ctrl+K)

- [x] `[P1]` ⏱️L **بناء لوحة أوامر مركزية (Ctrl+K) للوصول لأي إجراء/صفحة/عنصر/إعداد عبر الكتابة** — التنقل يتطلب حالياً المرور بالقوائم والصفحات.
  - **الملفات الجديدة:** `archive-app/src/components/command/CommandPalette.jsx`، `archive-app/src/features/command/commandRegistry.js` (تعريف الأوامر السياقية حسب الصفحة)، `archive-app/src/hooks/useCommandPalette.js`.
  - **تعديل ملفات:** `archive-app/src/app/App.jsx` (مزوّد عام + اختصار Ctrl+K)، `archive-app/src/app/pageManifest.js` (مصدر للصفحات القابلة للتنقل).
  - **التنفيذ:** فلترة فورية، تصنيف (أوامر/صفحات/عناصر/إعدادات)، أوامر سياقية حسب الصفحة الحالية، تنقّل بلوحة المفاتيح، عرض الاختصارات.
  - 🔄 **مُنجَز (موجود في الكود):** `CommandPalette` في `ShellParts.jsx` (لوحة Ctrl+K كاملة: تنقل/أوامر/عناصر/مشاريع/مجموعات/إعدادات، تذكّر الأوامر الأخيرة، تنقل بلوحة المفاتيح، ربط `RuntimeShellApp`).
  - الجهد: 3-4 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 2 — P1).

### 17.3 P1 — السحب والإفلات متعدد المناطق (Multi-Zone Drag & Drop)

- [x] `[P1]` ⏱️L **تعزيز السحب والإفلات عبر كل مناطق التطبيق (قائمة←مجلد، سطح المكتب←صفحة، بين المجموعات)** — السحب والإفلات محدود جداً حالياً.
  - **الملفات الجديدة:** `archive-app/src/features/dnd/dndController.js`، `archive-app/src/components/dnd/DropZone.jsx`، `archive-app/src/components/dnd/DragPreview.jsx`.
  - **تعديل ملفات:** `archive-app/src/features/archive/ArchiveViews.jsx`، `Sidebar.jsx`، صفحات المجموعات/المجلدات.
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

- [x] `[P2]` ⏱️XL **إتاحة تقسيم الشاشة إلى أجزاء مستقلة (مثل VS Code) للمقارنة والعمل المتوازي** — يُعرض جزء واحد فقط حالياً في كل لحظة.
  - ✅ **مُنجَز 2026-06-16:** `SplitView.jsx` (حتى 3 أجزاء + مقابض تغيير الحجم + منتقي الصفحة + DaisyUI)، `paneManager.js` (منطق نقي + localStorage `va.paneLayout.v1`)، `usePaneLayout.js` (hook تفاعلي). 9 اختبارات في `paneManager.test.js`. مسجّل في `pageRegistry.js` كصفحة `splitview`.
  - **الملفات الجديدة:** `archive-app/src/components/layout/SplitView.jsx`، `archive-app/src/features/layout/paneManager.js`، `archive-app/src/hooks/usePaneLayout.js`.
  - **التنفيذ:** سحب تبويب لجزء جانبي، حتى 3 أجزاء، مقابض تغيير حجم، تذكّر التخطيط عبر الجلسات، تحوّل لتبويبات على الجوال.
  - يرتبط بـ: §17.15 (الجوال).
  - الجهد: 5-7 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 5 — P2).

### 17.6 P1 — القوائم السياقية الذكية (Smart Context Menus)

- [x] `[P1]` ⏱️M **قوائم نقر-يمين / ضغط-مطوّل غنية وسياقية لكل عنصر/مجلد/وسم/مساحة فارغة** — النقر الأيمن لا يقدّم شيئاً حالياً.
  - **الملفات الجديدة:** `archive-app/src/components/context-menu/ContextMenu.jsx`، `archive-app/src/features/context-menu/menuRegistry.js`، `archive-app/src/hooks/useContextMenu.js`.
  - **تعديل ملفات:** `ArchiveViews.jsx`، `Sidebar.jsx`، بطاقات العناصر.
  - **التنفيذ:** إجراءات حسب نوع الهدف، إجراءات جماعية عند تعدد التحديد، DaisyUI `dropdown` styling، ضغط مطوّل على الجوال، عرض اختصارات.
  - 🔄 **مُنجَز (موجود في الكود):** `ContextMenu.jsx` (portal + framer-motion + focus trap + keyboard nav)؛ `buildItemContextMenu` في `ArchivePageResults.jsx`؛ `onContextMenu` على بطاقات العناصر في ArchiveViews؛ `FolderTree` + `FolderTreeNode` يستخدمانه.
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 6 — P1).

### 17.7 P2 — وضع التركيز والعرض الخالي من الإلهاء (Focus Mode)

- [x] `[P2]` ⏱️M **وضع تركيز (F11) يخفي العناصر غير الضرورية للتركيز على المحتوى (مشغّل فيديو/قارئ مستند/نموذج إضافة)** — **(مكتملة ✅ — 12 يونيو 2026)**
  - **الملفات الجديدة:** `archive-app/src/features/focus/focusMode.js` ✅ (منطق نقي: ثوابت التوقيت، صفحات موصى بها، آلة حالة بومودورو focus⇄break — قابلة للاختبار بالكامل)، `archive-app/src/components/focus/FocusShell.jsx` ✅ (شريط تحكّم عائم عبر portal + framer-motion، يحترم `prefers-reduced-motion`).
  - **التنفيذ المنجَز:** اختصار **F11** (مُسجّل في `keyboardShortcuts.js` + `globalShortcuts.js` + معالج في `RuntimeShellApp.js`)؛ **Escape** للخروج (capture listener)؛ إخفاء تلقائي للتحكّمات بعد 3 ثوانٍ خمول (`FOCUS_AUTO_HIDE_MS`)؛ **مؤقّت بومودورو** (25/5 دقيقة، تشغيل/إيقاف/إعادة، عدّ الجولات)؛ **“عدم الإزعاج”** (`focusDoNotDisturb` في `uiSlice` — يكتم التوست مع إبقاء السجل، الأخطاء تظهر دائماً)؛ إخفاء الـ chrome عبر `body.va-focus-active` في `tailwind.css` (sidebar/context-bar/bottom-tabs)؛ تنظيف الحالة عند الخروج.
  - **الاختبارات:** `features/focus/focusMode.test.js` — **12 اختبار يمرّ** (بومودورو، formatClock، الصفحات الموصى بها، اللاتغيير/immutability). build:spa أخضر.
  - المصدر: daisyui-ux-proposals (المقترح 7 — P2).

### 17.8 P1 — التحميل الهيكلي (Skeleton) والتغذية الراجعة الفورية

- [x] `[P1]` ⏱️M **استبدال مؤشّرات التحميل الدوّارة بهياكل (skeleton) تحاكي شكل المحتوى + تغذية راجعة فورية لكل تفاعل** — الفجوة بين الفعل والاستجابة تسبب ارتباكاً وضغطات متكررة.
  - **الملفات الجديدة:** `archive-app/src/components/ui/Skeleton.jsx` (DaisyUI `skeleton`)، `archive-app/src/components/ui/CardSkeleton.jsx`، `DetailSkeleton.jsx`.
  - **تعديل ملفات:** `ArchivePageResults.jsx`، `DetailPage.jsx`، الأزرار (حالة `btn-active`/علامة نجاح/اهتزاز عند الفشل).
  - **التنفيذ:** هياكل بأشكال البطاقات/التفاصيل، fade-in عند اكتمال التحميل، تأكيد بصري فوري لكل ضغطة زر.
  - 🔄 **مُنجَز (موجود في الكود):** `SkeletonBlock` في `V1Primitives.jsx`؛ `ArchiveResultsSkeleton` في `ArchivePageResults.jsx` (skeleton شبكة/قائمة)؛ `UXStateBlock` يستخدم SkeletonBlock لحالة التحميل؛ `showSkeleton` يشغّل الهيكل عند أول تحميل.
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 8 — P1).

### 17.9 P1 — البطاقات التكيّفية حسب نوع المحتوى (Adaptive Content Cards)

- [x] `[P1]` ⏱️M **بطاقات عرض تتكيّف شكلاً ومعلوماتٍ حسب نوع المحتوى (فيديو/صوت/مستند/صورة)** — كل العناصر تظهر بنفس شكل البطاقة حالياً.
  - **تعديل ملفات:** `ArchiveViews.jsx`، مكوّن بطاقة العنصر، `archive-app/src/features/archive/itemCard*`.
  - **التنفيذ:** بطاقة فيديو (مصغّرة + مدّة + شارة تشغيل)، صوت (موجة + مدّة)، مستند (صفحة أولى + عدد صفحات + صيغة)، صورة (معاينة + أبعاد)؛ ألوان DaisyUI مميّزة لكل نوع؛ توسّع طفيف عند hover.
  - 🔄 **مُنجَز:** `getContentKind()` يستنتج النوع من الامتداد + إشارة `item.type`؛ `VideoThumb` تعرض: صورة (`<img>` أو ImageIcon زمرد)، صوت (Music icon بنفسجي)، مستند (FileText icon أزرق + شارة الامتداد)، فيديو (العرض الأصلي).
  - الجهد: 3-4 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 9 — P1).

### 17.10 P1 — نظام سمات DaisyUI المتعددة مع محرّر حيّ (Theme System + Live Editor)

- [x] `[P1]` ⏱️M **توسيع نظام السمات للتوافق مع سمات DaisyUI (30+ سمة جاهزة) + محرّر سمة حيّ** — يعتمد على §17.1.
  - **الملفات الجديدة:** `archive-app/src/features/theme/daisyThemes.js`، `archive-app/src/components/settings/ThemeGallery.jsx`، `archive-app/src/components/settings/LiveThemeEditor.jsx`.
  - **تعديل ملفات:** `archive-app/src/theme/useTheme.js`، `SettingsPage.jsx` (تبويب السمات).
  - **التنفيذ:** معاينات مصغّرة لكل سمة، تبديل فوري عبر `data-theme`، محرّر ألوان حيّ، حفظ سمة مخصّصة، جدولة فاتح/داكن حسب `prefers-color-scheme`، تصدير/استيراد JSON.
  - 🔄 **تقدم 2026-06-12:** أُضيفت الملفات المطلوبة فعلياً: `features/theme/daisyThemes.js` (34 سمة جاهزة + normalize/store/apply)، `components/settings/ThemeGallery.jsx` (معرض radio + `theme-controller` + معاينة `data-theme` لكل بطاقة)، و`components/settings/LiveThemeEditor.jsx` (select/range عبر DaisyUI). تم توسيع `@plugin "daisyui"` ليضم السمات الجاهزة، وربط `settings.ui.daisyTheme` بـ `SettingsPage`, `AppRouter`, boot helper `applyInitialDaisyTheme.js`, وتصدير/استيراد ملف المظهر.
  - ✅ **جدولة فاتح/داكن مُنجَزة 2026-06-12:** أُضيف `features/theme/themeSchedule.js` (محرك نقي: `relativeLuminance`/`getDaisyThemeTone`/`normalizeSchedule`/`resolveScheduledTheme` + تخزين `videoArchive:themeSchedule`) مع `themeSchedule.test.js` (12 اختبار). يدعم وضع `manual` (يحترم اختيار `daisyTheme` الحالي — لا ارتداد للمستخدمين) و`auto` (سمة فاتحة/داكنة حسب `prefers-color-scheme`). رُبط في `theme/applyInitialDaisyTheme.js` مع `watchSystemThemeChange` لتتبّع تبدّل النظام وقت التشغيل.
  - 🔄 **تقدم إضافي 2026-06-12:** أضيفت واجهة تبديل `manual/auto` داخل `LiveThemeEditor` باستخدام DaisyUI `toggle` و`select` لاختيار سمة فاتحة وداكنة، وصارت الجدولة جزءاً من مسودة المظهر: تُعاين فورياً، وتُحفظ عبر `storeSchedule()` عند تطبيق المظهر، وتُضمّن في تصدير/استيراد JSON لملف المظهر.
  - ✅ **السمة المخصصة مُنجَزة 2026-06-12:** أُضيف `features/theme/customDaisyTheme.js` لحفظ وتطبيع وتطبيق CSS vars كاملة لرموز DaisyUI والتطبيق، مع `customDaisyTheme.test.js` (6 اختبارات). رُبطت الطبقة في boot helper و`AppRouter` و`SettingsPage`، وأضيفت واجهة `toggle` + `input` ألوان داخل `LiveThemeEditor`، وصار ملف المظهر يصدّر/يستورد `customDaisyTheme`.
  - ✅ **تحسين معاينة المظهر 2026-06-18:** صارت معاينة “استوديو المظهر” في `SettingsPage` مبنية على أصناف DaisyUI الدلالية (`base-*`/`primary`/`accent`) بدل ألوان داكنة ثابتة، مع view-model مختبر في `features/theme/appearancePreview.js` يضبط تسميات الكثافة وأنماط البطاقات وملخص السمة.
  - يرتبط بـ: §17.1، §15.3 (مركز الإعدادات).
  - الجهد: 2-3 أسابيع (بعد §17.1).
  - المصدر: daisyui-ux-proposals (المقترح 10 — P1).

### 17.10.1 P1 — توحيد الثيمات على DaisyUI كنظام وحيد افتراضي (Theme Consolidation)

- [x] `[P1]` ⏱️L **إزالة أنظمة الهوية `v1–v4` وجعل DaisyUI النظام الوحيد الافتراضي، مع جعل التباين عبر قوالب لونية (سمات DaisyUI) بدل إصدارات هوية منفصلة** — ✅ **مُنجز 2026-06-18:** أُزيلت ملفات `v1–v4` و`ThemeVersionPicker` وboot helper القديم ومفتاح `themeVersion` من الإعدادات/السجل/البذور، وصار `FirstRunPage` يحفظ `daisyTheme` مباشرة. أُضيف حارس `verify-modules` يمنع عودة `data-theme-version` ومراجع theme-version داخل `src`، وحُدّثت بذور Playwright/a11y و`migrationStatus` لحالة manifest الحالية (37 صفحة native بعد صفحات المشاركة). التحقق: `pnpm --filter @archive/app run verify`، `pnpm --filter @archive/app run test` (816/816)، `pnpm --filter @archive/app run build:spa`، و`E2E_BASE_URL=http://127.0.0.1:4173 pnpm --filter @archive/app exec playwright test tests/navigation.spec.ts --project=mobile-chrome` (17/17).
  - **يبني على §17.10 (مُنجَز جزئياً):** `features/theme/daisyThemes.js` (34 سمة)، `ThemeGallery.jsx`، `LiveThemeEditor.jsx`، و`settings.ui.daisyTheme` مربوطة في `SettingsPage`/`AppRouter`/`applyInitialDaisyTheme.js` موجودة بالفعل.
  - **الإزالة:** `styles/v1-identity.css`، `v2-identity.css`، `v3-identity.css`، `v4-identity.css`؛ سمة `data-theme-version` من `AppRouter.jsx` وأي مُطبِّق؛ `features/settings/ThemeVersionPicker.jsx` ومنطق اختيار الإصدار؛ مفاتيح `themeVersion`/`v4` الافتراضية في `stores/settingsDefaults.js` و`theme/useTheme.js`.
  - **النقل:** ترحيل الرموز البصرية المتبقية في طبقات v1–v4 (ألوان الأسطح/الحدود/التركيز الخاصة بكل إصدار) إلى رموز DaisyUI (`--color-base-*`/`--color-primary`…) أو طبقة `va-*` موحّدة واحدة فوق DaisyUI؛ الحفاظ على `data-accent`/`data-density`/`data-font-scale`/`data-motion`/`data-card-style` كمحاور تخصيص مستقلة عن السمة.
  - **الافتراضي:** ضبط سمة DaisyUI افتراضية واحدة (مثل `dark` أو سمة مخصّصة للعلامة) في `settingsDefaults` + `@plugin "daisyui"` (`--default`)؛ هجرة إعدادات المستخدمين الحاليين من `themeVersion` إلى `daisyTheme` عبر migration في تحميل الإعدادات.
  - **التحقق:** `verify-modules.mjs` (لا مراجع متبقية لـ`data-theme-version`/`v*-identity`)، `build:spa` أخضر، اختبارات `useTheme`/الإعدادات، فحص بصري للصفحات الرئيسية في الوضعين فاتح/داكن.
  - **مخاطرة:** عالية — تمسّ كل سطح بصري؛ يجب فحص بصري شامل (Playwright matrix 320/768/1024/1440). يُنفَّذ في **جلسة جديدة نظيفة** على فرع مخصّص.
  - يرتبط بـ: §17.10، §17.1 (تبنّي DaisyUI)، §15.7 (محرر السمات)، §15.3 (مركز الإعدادات).

### 17.11 P2 — رحلة اكتشاف المحتوى (Content Discovery Journey)

- [x] `[P2]` ⏱️L **أقسام “استكشف/رائج/عشوائي/الأكثر نشاطاً/المنسيّون” لإحياء المحتوى المؤرشف** — لا توجد طريقة لاكتشاف محتوى لم يبحث عنه المستخدم.
  - **الملفات الجديدة:** `archive-app/src/pages/DiscoverPage.jsx` (DaisyUI `hero` + card grid)، `archive-app/src/features/discover/discoveryEngine.js`.
  - **تعديل ملفات:** `Sidebar.jsx`، `pageManifest.js`.
  - **التنفيذ:** مُضاف حديثاً، مقترحات حسب آخر مشاهدة، عشوائي (“أفاجئني”)، الأكثر نشاطاً أسبوعياً، المنسيّون (لم يُفتحوا منذ مدة).
  - **✅ مُنجَز 2026-06-12:** أُضيفت صفحة `DiscoverPage.jsx` بواجهة DaisyUI (`hero`/`tabs`/`stats`/`card`/`badge`) ومحرك `discoveryEngine.js` للأقسام الخمسة مع استبعاد المحذوفات، عشوائية حتمية قابلة للاختبار، وترتيب النشاط الأسبوعي والمنسيّات. رُبطت الصفحة في `pageManifest.js`, `pageRegistry.js`, `Sidebar.jsx`, و`ShellParts.jsx`، وأُضيف route `#/discover` لاختبار التنقل.
  - الجهد: 3-4 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 11 — P2).

### 17.12 P1 — نظام الإشعارات المنبثقة المحسّن (Toast & Snackbar — DaisyUI)

- [x] `[P1]` ⏱️M **toast/alert محسّن بـ DaisyUI مع إجراءات سريعة وتراجع وشريط تقدّم** — toasts الحالية بدائية بلا تفاعل.
  - **الملفات الجديدة:** `archive-app/src/components/ui/ToastSystem.jsx` (DaisyUI `toast`/`alert`)، `archive-app/src/features/toast/toastStore.js`.
  - **التنفيذ:** أولوية حسب النوع، تجميع المتشابهة (“3 عناصر أُضيفت”)، إجراء سريع داخل toast (تراجع/تنزيل/إعادة)، إبقاء الأخطاء حتى تُقرأ، DaisyUI `progress` للعمليات الطويلة، سجل إشعارات.
  - 🔄 **مُنجَز:** `uiSlice.showNotification` يدعم `groupKey`/`groupTemplate` (تجميع)، أخطاء persistent تلقائياً، `progress: 0-100`، فرز حسب الأولوية (error>warning>success>info)، `updateNotificationProgress(id, progress)`؛ `ToastNotification` يعرض شارة العدد ×N وشريط تقدّم.
  - يرتبط بـ: §18.2 (مركز الإشعارات)، `AppNotifications.jsx`.
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 12 — P1).

### 17.13 P1 — التنقّل المتكامل مع مسار الخبز الديناميكي (Dynamic Breadcrumb)

- [x] `[P1]` ⏱️M **مسار خبز محفوص ديناميكي + تاريخ تنقّل (رجوع/تقدّم) + قائمة المواقع الأخيرة** — لا breadcrumb يوضّح الموقع في التسلسل ولا تاريخ تنقّل.
  - **الملفات الجديدة:** `archive-app/src/components/navigation/Breadcrumb.jsx` (DaisyUI `breadcrumbs`)، `archive-app/src/features/navigation/navHistory.js`، `RecentLocations.jsx`.
  - **تعديل ملفات:** `AppRouter.jsx`، `TopBar.jsx`، `pageManifest.js` (مصدر breadcrumb موجود بالحقل `meta.breadcrumb`).
  - **التنفيذ:** مسار قابل للنقر لكل مستوى، أزرار رجوع/تقدّم عبر تاريخ التنقّل، آخر 10 مواقع، تقلّص ذكي على الجوال.
  - 🔄 **مُنجَز (موجود في الكود):** `Breadcrumb.jsx` + `useBreadcrumbs.js` + `PageContextBar.jsx` مدمجة في `AppRouter.jsx`.
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 13 — P1).

### 17.14 P2 — مدجات لوحة المعلومات القابلة للتخصيص (Customizable Dashboard Widgets)

- [x] `[P2]` ⏱️L **لوحة معلومات قابلة للتخصيص بالكامل عبر مدجات تُضاف/تُزال/تُرتّب/تُكبّر (react-grid-layout موجود)** — اللوحة ثابتة التخطيط حالياً.
  - ✅ **مُنجز ومتحقق (2026-06-13):** لوحة التحكم تستخدم `DashboardGrid` فوق `react-grid-layout` مع وضع تخصيص، إخفاء/إظهار المدجات، تبديل الارتفاع التلقائي، حفظ/إلغاء، وسحب/تحجيم. أضيف `resetDashboardLayout()` لضمان أن استعادة التخطيط الافتراضي تعيد كل المدجات المخفية وتطبّع التخطيط حسب قائمة المدجات المتاحة. تحقق: `dashboardLayoutModel.test.js`، `pnpm --filter @archive/app run verify`، و`pnpm --filter @archive/app run build:spa`.
  - **الملفات الجديدة:** `archive-app/src/features/dashboard/widgetRegistry.js`، `archive-app/src/components/dashboard/WidgetStore.jsx`، `WidgetFrame.jsx`.
  - **تعديل ملفات:** `DashboardPage.jsx` (يستخدم `react-grid-layout` بالفعل).
  - **التنفيذ:** متجر مدجات، سحب لإعادة الترتيب، توسيع/تصغير، مدجات قابلة للتهيئة (إحصائيات/نشاط/عشوائي)، DaisyUI `stat`/`timeline`، تخطيط متجاوب.
  - الجهد: 4-6 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 14 — P2).

### 17.15 P1 — إصلاح شامل لتجربة الجوال المتجاوبة (Mobile-First Responsive Overhaul)

- [x] `[P1]` ⏱️XL **إعادة تصميم تجربة الجوال بأدوات DaisyUI المتجاوبة مع أولوية المحتوى والإيماءات** — الجوال نسخة مصغّرة من سطح المكتب لا تجربة مصمّمة.
  - ✅ **مُنجَز 2026-06-16:** `BottomNav.jsx` (DaisyUI dock + شارات عدد غير المقروء)، `useSwipeGesture.js` (document-level: رجوع/تحديث)، `MobileShell.jsx` (wrapper: swipe + BottomNav). وُصّل في `AppRouter.jsx` (يغلّف `<main>` داخل `MobileShell`).
  - **الملفات الجديدة:** `archive-app/src/components/navigation/BottomNav.jsx`، `archive-app/src/hooks/useSwipeGesture.js`، `MobileShell.jsx`.
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
  - **الملفات الجديدة:** `archive-app/src/features/archive/itemStatus.js`، `archive-app/src/components/archive/StatusBadge.jsx`.
  - **تعديل ملفات:** بطاقة العنصر، عمود الحالة في الجدول، `archiveSlice.js`، فلاتر البحث.
  - **التنفيذ:** badge ملوّن (info/warning/success/error/neutral)، فلترة حسب الحالة، تغيير تلقائي للحالة (عنصر بلا وسم→“يحتاج مراجعة”)، اقتراحات تلقائية.
  - ✅ **مُنجز ومتحقق (2026-06-11):** `StatusBadge.jsx` جديد يعرض حالة `workflowStatus` مع تنبيه الاستحقاق المتأخر؛ `ArchiveViews.jsx` يعرض الشارة في البطاقات/البلاطات/القائمة ويضيف عمود `الحالة` للجدول؛ `tableColumns.js` يعرّف العمود؛ `viewModel.js` يدعم فلتر `filterStatus` ورابط `status=`؛ `ArchivePageDetailedFilters.jsx` و`ArchiveFilterChips` يضيفان اختيار/مسح الحالة؛ `createVideoItemValue` يحفظ `workflowStatus` ويقترح `review` للعناصر الجديدة بلا وسوم و`archived` للمحذوفة مع حفظ حقول workflow عند التعديل. تحقق: `itemStatus.test.js` و`viewModel.test.js` و`StatusBadge.test.jsx` (12/12 مرّت).
  - يرتبط بـ: §17.16، §18.1 (سجل النشاط).
  - الجهد: 2-3 أسابيع.
  - المصدر: daisyui-ux-proposals (المقترح 17 — P1).

### 17.18 P2 — مسار التنقّل الموجّه حسب الدور (Role-Based Guided Journey)

- [x] `[P2]` ⏱️L **تكييف الواجهة حسب دور المستخدم ونمط استخدامه (مسؤول/محرّر/مشاهد) — تخصيص واجهي لا نظام صلاحيات** — نفس الواجهة للجميع حالياً.
  - **الملفات الجديدة:** `archive-app/src/features/onboarding/roleProfiles.js`، `archive-app/src/components/onboarding/RoleSelectionStep.jsx`.
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

- [x] `[P0]` ⏱️L **سجل نشاط مركزي + تراجع متعدد المستويات يغطّي الإضافة/التعديل/الحذف/النقل/التعديل الجماعي مع Redo** — `undoManager` الحالي يدعم صفحة التفاصيل فقط ولا يغطّي الحذف/النقل/التعديل الجماعي.
  - **الملفات الجديدة:** `archive-app/src/features/activityLog/viewModel.js` (createActivityEntry/buildDiff/describeActivity)، `undoManager.js` (توسعة)، `archive-app/src/components/activity/ActivityTimeline.jsx`، `ActivityEntry.jsx`، `DiffView.jsx`، `ActivityFilterBar.jsx`، `archive-app/src/pages/ActivityPage.jsx`، `archive-app/src/stores/slices/activitySlice.js`.
  - **تعديل ملفات:** `ArchivePage.jsx`، `DetailPage.jsx`، `Sidebar.jsx`، `archiveSlice.js`، `services/storage/schema.js` (store `activity_log`)، `undoManager`.
  - **مخطط:** store `activity_log` (IndexedDB) + جدول Prisma `ActivityLog` (before/after/diff JSON، فهارس على timestamp/userId/targetType/action) للباك-إند السحابي.
  - **التنفيذ:** snapshot before/after + diff، شريط زمني مجمّع حسب اليوم، فلترة حسب النوع/التاريخ/المستخدم، Bulk Undo بضغطة، Redo؛ توسعة `undoManager` لا استبداله.
  - يرتبط بـ: §17.17 (الحالات)، §1 (سجل التدقيق في الخادم).
  - الجهد: 4-6 أسابيع.
  - المصدر: daily-use-proposals (المقترح 1 — P0).
  - **حالة التنفيذ (المرحلة 1 — محلي فقط، 11 يونيو 2026):**
    - ✅ منجز: `features/activityLog/viewModel.js` (createActivityEntry/buildDiff/describeActivity/filterActivityEntries/groupActivitiesByDay) + اختبارات وحدة (`viewModel.test.js`، 13 اختبار)؛ `features/activityLog/undoManager.js` (توسعة withActivityLog فوق SimpleUndoRedoManager)؛ store `activity_log` في `schema.js` مع مرايا DATA_STORES/SNAPSHOT_STORES/الاستيراد في `services/storage/index.js` و`storage/adapters/local-sqlite/index.js`؛ `stores/slices/activityLogSlice.js` (add/remove/load/clear/filters + undoActivityEntryById/redoActivityEntryById) مركّب في `appStore.js`؛ صفحة `ActivityPage.jsx` + `components/activity/` (ActivityTimeline/ActivityEntry/DiffView/ActivityFilterBar) مسجّلة في pageManifest/pageRegistry (id: `activity`)؛ توثيق نشاط تلقائي في `archiveSlice.updateVideoItem` (snapshot before/after، failure-safe، خيار skipActivityLog).
    - ✅ **مُنجَز المرحلة 2 (2026-06-12):** أُضيف `addActivityEntry` لعمليات `addVideoItem` (create)، `deleteVideoItem` (delete + skipActivityLog)، `restoreVideoItem` (restore + skipActivityLog)، `bulkDeleteItems` (bulk_delete)، `bulkRestoreItems` (restore جماعي) — جميعها failure-safe (try/catch + .catch()). الـ undo/redo lambdas تمرّر الآن `skipActivityLog: true`.
    - ✅ **مُنجَز المرحلة 3 (2026-06-13):** (1) نموذج `ActivityLog` في `archive-server/prisma/schema.prisma` (فهارس على timestamp/userId/targetType/action/targetId). (2) فلترة التاريخ: `ActivityFilterBar.jsx` أُضيفت حقول من/إلى؛ `ActivityPage.jsx` وُسّع state + memo. 215 اختبار ✅.
    - ✅ **مُنجَز المرحلة 4 (2026-06-14) — إغلاق المهمة:** migration `20260613120000_add_activity_log` مطبّق؛ تمّ توثيق عمليات **المجلدات** (create/update/delete/move في `foldersSlice.js` عبر مساعد `logFolderActivity` آمن الفشل) و**المجموعات** (create/update/delete في `archiveSlice.js` عبر `logCollectionActivity` يربط المستخدم من auth store). الـ viewModel يدعم مسبقاً `targetType: folder|collection` و`action: move`. ✅ 249 اختبار يمرّ.

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
  - **الملفات الجديدة:** `archive-app/src/features/autosave/viewModel.js`، `autosaveEngine.js`، `sessionManager.js`، `archive-app/src/components/autosave/AutosaveIndicator.jsx`، `DraftRecoveryDialog.jsx`، `SessionRestoreBanner.jsx`، `BulkProgressPanel.jsx`، `archive-app/src/stores/slices/autosaveSlice.js`.
  - **تعديل ملفات:** `AddVideoPage.jsx`، `DetailPage.jsx`، `ArchivePage.jsx`، `schema.js` (stores `drafts`, `work_sessions`, `bulk_progress`).
  - **التنفيذ:** مؤشّر حالة الحفظ، `beforeunload` guard، استعادة المسودة/الجلسة، حفظ موضع التمرير والفلاتر، استئناف العمليات الجماعية بعد الانقطاع.
  - 🔄 **مُنجَز 2026-06-12:** `DetailPage.jsx` — تكامل `createAutosaveEngine` بمفتاح `edit_item_${id}` (30ث + beforeunload)؛ `DraftRecoveryDialog` يعرض عند اكتشاف مسودة محفوظة؛ `AutosaveIndicator` بجانب زر التحرير؛ تنظيف localStorage عند الحفظ. البنية التحتية (engine/viewModel/slice/components) كانت جاهزة.
  - يرتبط بـ: §18.1، §18.3.
  - الجهد: 3-4 أسابيع.
  - المصدر: daily-use-proposals (المقترح 4 — P1).

### 18.5 P1 — الارتباطات والعلاقات بين العناصر (Item Relations & Links)

- [x] `[P1]` ⏱️L **نظام علاقات ذات معنى بين العناصر (جزء من/يرتبط مع/نسخة من/يعتمد على/يشير إلى/بديل عن/يسبق/يتبع) مع رسم بياني تفاعلي** — العناصر معزولة ولا يمكن ربطها بعلاقة دلالية.
  - **الملفات الجديدة:** `archive-app/src/features/relations/viewModel.js` (createRelation/RELATION_TYPES/getItemRelations/buildRelationsGraph)، `archive-app/src/components/relations/RelationsPanel.jsx`، `AddRelationDialog.jsx`، `RelationsGraph.jsx`، `archive-app/src/stores/slices/relationsSlice.js`.
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

> **تحديث 11 يونيو 2026 — توسيع النطاق:** بدل دعم Firebase/SQLite في aistudio فقط، تقرّر **التقارب نحو إصدار واحد شامل**: نسخة cloud هي الإصدار القانوني، كل المحرّكات (IndexedDB/SQLite/Firebase/Postgres/PocketBase) خيارات وقت تشغيل، وspa/aistudio مجرد قوالب تغليف بلا تفرّع سلوكي. **📋 الخطة الحاكمة:** [`archive-app/docs/unified-edition-plan.md`](archive-app/docs/unified-edition-plan.md) (مراحل أ–هـ، ⏱️XL). الخطة أدناه تبقى مرجعاً تفصيلياً لمحوّل Firebase ومواءمة AI Studio.

- [x] `[P1]` ⏱️XL **استبدال هدف بناء `aistudio` ليدعم Firebase وSQLite، ومواءمة نسخة السيرفر مع أحدث AI Studio Apps** — ✅ **مُنجَز 2026-06-18:** `aistudio` يدعم الآن SQLite المحلي وFirebase client-side؛ `resolveBackendChoice` يسمح داخل AI Studio بـ `local`/`firebase` فقط ويعيد Postgres/PocketBase إلى المحلي. اكتملت المراحل أ–هـ: Firestore StorageProvider، Firebase Auth SessionProvider، Firebase Storage FileStore، واجهة تهيئة Firebase في المعالج والإعدادات، وتبديل ساخن مع ترحيل اختياري عبر `snapshot()`/`replaceAll()`. — **📋 الخطة الكاملة:** [`archive-app/docs/aistudio-firebase-sqlite-plan.md`](archive-app/docs/aistudio-firebase-sqlite-plan.md) (مُحدّثة 2026-06-18).
  - ✅ **المرحلة ب مُنجَزة (2026-06-16):** محوّل `StorageProvider` فوق Firestore يعمل عميل-جانب عبر HTTPS (يصله iframe الـ AI Studio). **ماذا:** المنافذ الـ11 (`get`/`getAll`/`put`/`add`/`delete`/`clear`/`putBatch`/`deleteBatch`/`snapshot`/`replaceAll`) فوق Firestore، مع dynamic-import لـ `firebase/app` و`firebase/firestore` (لا يُحمَّل firebase إلا عند اختيار الباك-إند)، و`writeBatch` مُقسَّم على دفعات (حد 450) لذرّية `replaceAll`/`putBatch`. خيار `"firebase"` في `backendChoice.js` + `getFirebaseConfig()`، وفرع تسجيل في `registerByBackendChoice.js`. **الملفات:** `storage/adapters/cloud-firebase/index.js` + `firestoreMapping.js` (منطق نقي مُختبَر) + `firestoreMapping.test.js` + `firestoreProvider.test.js`؛ `bootstrap/backendChoice.js`؛ `bootstrap/registerByBackendChoice.js`؛ تبعية `firebase@^12.14.0` (+ تعطيل سكربتات بناء `@firebase/util`/`protobufjs` غير اللازمة في `pnpm-workspace.yaml`/`package.json`). **Firestore الحيّ غير مُتحقَّق منه وقت التشغيل** (لا يوجد مشروع Firebase حقيقي؛ المنطق النقي مُختبَر بالكامل والمحوّل مُختبَر بضِعف Firestore داخلي).
  - **تصحيح بعد تشخيص الكود:**
    - **SQLite:** المحوّل موجود (`archive-app/src/storage/adapters/local-sqlite/index.js`، و`LOCAL_ENGINES=["indexeddb","sqlite"]`) وأصبح متاحاً لـ AI Studio عبر احترام `localEngine`.
    - **Firebase:** اكتمل كخيار باك-إند عميل-جانب عبر HTTPS (بخلاف pocketbase/postgres اللذين يحتاجان خادماً لا يصله iframe).
  - ✅ **المراحل ج–هـ مُنجَزة (2026-06-18):** أضيفت `firebaseSession.js` و`firebaseFileStore.js`، واكتمل فرع Firebase في `registerByBackendChoice.js` لكل من Storage/Auth/Files، مع ضبط `switchBackendHot.js` لقبول `firebaseConfig` وترحيل اللقطة اختيارياً. الواجهة الآن تعرض خيار Firebase في `V1OnboardingWizard.jsx` وبطاقة إعداد في `FirebaseBackendSettings.jsx`، وتتيح `LocalStorageEngineSettings.jsx` اختيار SQLite في AI Studio.
  - ✅ **التحقّق:** اختبارات العقد المستهدفة نجحت: `backendChoice.aistudio.test.js`، `firebaseConfig.test.js`، `registerByBackendChoice.firebase.test.js`، `switchBackendHot.test.js`، `firebaseSession.test.js`، `firebaseFileStore.test.js`، `firestoreProvider.test.js`، `firestoreMapping.test.js` (40 اختباراً). كذلك نجح `build:aistudio` و`build:spa`. **ملاحظة:** لم يُجرّب مشروع Firebase حي لعدم توفر مفاتيح/مشروع فعلي؛ التحقق تم بمضاعفات Firebase وباختبارات المنطق.
  - الجهد: XL (مكتمل).
  - المصدر: توجيه المستخدم (10 يونيو 2026) + تشخيص الكود.

### 19.3 P1 — إزالة المسافة من اسم مجلد التطبيق (Folder Rename)

- [x] `[P1]` ⏱️M **إعادة تسمية مجلد التطبيق إلى `archive-app` (إزالة المسافة) وتحديث كل المراجع** — المسافة في اسم المجلد كانت تسبّب مشاكل في المسارات والأدوات والسكربتات.
  - ✅ **مكتملة 2026-06-13:** نُقل مجلد الواجهة إلى `archive-app`، وتحدّثت مراجع `pnpm-workspace.yaml`، Dockerfiles، سكربتات release، الوثائق، CI، وخطط/روابط docs من الاسم القديم ذي المسافة وترميزه URL إلى الاسم الجديد.
  - **ملاحظة خطر:** العملية نُفذت على فرع مستقل بعد تنظيف حالة العمل وإيقاف عمليات Vite preview القديمة التي كانت تقفل المجلد.
  - **تعديل ملفات/خطوات:** نقل المجلد إلى `archive-app` عبر Git، وتحديث `pnpm-workspace.yaml`، أي مسارات حرفية في الجذر، `playwright.config`، سكربتات `scripts/*.mjs`، الوثائق، CI.
  - **التحقّق:** `pnpm install` ثم `pnpm verify` + `pnpm build:spa` بعد إعادة التسمية.
  - الجهد: 1-3 أيام.
  - المصدر: توجيه المستخدم (10 يونيو 2026).

### 19.4 P1 — تثبيت daisyUI وتحسين المظهر العام (DaisyUI Install + Polish)

- [x] `[P1]` ⏱️M **تثبيت إضافة daisyUI وتحسين المظهر العام حسب مهارة daisyui/frontend-design** — `daisyui` مثبت ومفعّل كـ Tailwind v4 plugin + تطبيق سمات وتحسينات بصرية أولية.
  - **تعديل ملفات:** `archive-app/src/styles/tailwind.css` (`@plugin "daisyui";`)، مكوّنات `components/ui/*` الأساسية أولاً.
  - **✅ مُنجَز 2026-06-12:** الاعتماد الفعلي موجود في `archive-app/src/styles/tailwind.css` (`@plugin "daisyui"` مع `light/dark` و`logs:false`)؛ طبقة primitives المشتركة تستخدم الآن `btn`/`card`/`badge`/`alert`/`skeleton`/`progress`/`dock` في `components/ui/*` و`components/common/*` بدون إزالة نظام الثيم `va-*`.
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

### 19.6 P1 — جعل معالج الإعداد الطرفي بالإنجليزية افتراضياً والعربية اختيارية (Setup Wizard — English-default, Arabic optional)

- [x] `[P1]` ⏱️M **تحويل نصوص معالج الإعداد (bash/terminal) إلى الإنجليزية كلغة افتراضية، مع العربية كخيار صريح** — حالياً يطبع المعالج العربية مباشرةً (`scripts/deploy-wizard.mjs` ~75 سطراً عربياً، `scripts/setup.mjs` ~50 سطراً)، وهذا يسبّب تشوّه العرض في كثير من الطرفيات (RTL + ترميز/خطوط في Windows Console/PowerShell وبعض طرفيات SSH)، ما يربك المستخدم أثناء التثبيت.
  - **✅ مُنجَز (2026-06-14):** وحدة i18n مشتركة `scripts/wizard-i18n.mjs` (كتالوج رسائل `{ en, ar }` + مترجم مع استيفاء، `resolveWizardLang`: `--lang=ar`/`ARCHIVE_WIZARD_LANG`/افتراضي `en`، fallback إنجليزي لا يغيب أبداً) + **9 اختبارات `node:test`**. حُوِّل كلا المعالجَين (`deploy-wizard.mjs` الذي يشغّله `setup.sh`/`Setup-Archive.bat`، و`setup.mjs` لـ`pnpm setup`) لتمرير كل سلسلة عبر المترجم، مع **مُنتقي لغة بأول سؤال آمن ASCII** وعناوين إنجليزية. العربية ما زالت متاحة بالكامل لكنها لم تعد الافتراضي. `Setup-Archive.bat`/`setup.sh` لا تحتويان عربية. التحقق: `node --check` للملفّين + 9/9 اختبارات i18n.
  - **السبب:** مشاكل الطرفية مع العربية (اتجاه RTL معكوس، محارف متقطّعة، مواءمة أعمدة مكسورة).
  - **الملفات:** `scripts/deploy-wizard.mjs` (المعالج الرئيسي، يُشغَّل عبر `setup.sh` و`Setup-Archive.bat`)، `scripts/setup.mjs`، وأي رسائل عربية في `setup.sh`/`Setup-Archive.bat`.
  - **التنفيذ المقترح:**
    - استخراج كل سلاسل المعالج إلى جدول رسائل `{ en, ar }` (أو ملف `scripts/wizard-i18n.mjs`) بدل النصوص المضمّنة.
    - **الإنجليزية هي الافتراضي**؛ تفعيل العربية فقط عبر اختيار صريح: علم `--lang=ar` و/أو متغير بيئة `ARCHIVE_WIZARD_LANG=ar` و/أو سؤال أول «Language / اللغة: [E]nglish (default) / [ع]ربية».
    - الإبقاء على ASCII آمن للأطر/الأعمدة بحيث لا يعتمد العرض على محارف عربية.
  - **التحقق:** تشغيل `bash setup.sh` و`Setup-Archive.bat` افتراضياً يعرض إنجليزية نظيفة بلا تشوّه؛ `--lang=ar` يعرض العربية؛ لا انحدار في تدفّق الإعداد (نفس الأسئلة/الأعلام).
  - **المصدر:** توجيه المستخدم المباشر (14 يونيو 2026) — مشاكل الطرفية مع العربية.

### 19.7 P1 — إصلاح عدم تطبيق سمات daisyUI عند اختيارها من الإعدادات (DaisyUI Theme Not Applying)

- [x] `[P1]` ⏱️M **اختيار سمة daisyUI من الإعدادات لا يطبّقها فعلياً على الواجهة** — المستخدم يختار سمة من معرض السمات/محرّر السمات الحيّ لكن المظهر لا يتغيّر (أو يتغيّر فقط بعد إعادة تحميل الصفحة)، ما يجعل ميزة السمات تبدو معطّلة.
  - **✅ مُنجَز (2026-06-14):** **السبب الجذري** — `SettingsPage.selectDaisyTheme` كان يطبّق معاينة حيّة (`applyDaisyTheme`) ويحدّث **draft المظهر فقط**؛ القيمة لا تُكتب في `settings.ui.daisyTheme` ولا `localStorage[videoArchive:daisyTheme]` إلا عند زرّ «حفظ المظهر» الصريح — فتُفقد عند إعادة التحميل وتبدو «غير مطبَّقة». **الإصلاح:** `selectDaisyTheme` الآن يثبّت فوراً عبر `storeDaisyTheme(daisyTheme)` + `patchUi({ daisyTheme })` إضافةً للمعاينة الحيّة وتحديث الـdraft؛ فتُطبَّق فوراً وتبقى بعد التحديث، ويعكسها effect السمة في `AppRouter`. يغطّي أيضاً `LiveThemeEditor` (يمرّ عبر نفس الدالة). التحقق: 301 اختبار يمرّ + `build:spa` أخضر. (السمات كلها مفعّلة مسبقاً في `@plugin "daisyui"` ضمن `tailwind.css`.)
  - **التشخيص المتوقّع:** `applyInitialDaisyTheme.js` يضبط `data-theme` على عنصر الجذر **عند الإقلاع فقط**؛ تحديث `settings.ui.daisyTheme` من الإعدادات لا يُعاد تطبيقه حيّاً على `document.documentElement[data-theme]`. يلزم مؤثّر/اشتراك يراقب `settings.ui.daisyTheme` (وربما `data-theme-version`) ويحدّث السمة فوراً عند التغيير.
  - **الملفات للفحص/التعديل:** `archive-app/src/theme/applyInitialDaisyTheme.js`، `archive-app/src/app/AppRouter.jsx` (تطبيق `data-theme`)، `archive-app/src/components/settings/ThemeGallery.jsx` و`LiveThemeEditor.jsx` (مُعالِج الاختيار)، `archive-app/src/features/settings/settingsRegistry.js`، `archive-app/src/features/theme/daisyThemes.js`، `archive-app/src/stores/settingsDefaults.js`، `archive-app/src/utils/settings.js`.
  - **التنفيذ المقترح:** ربط تغيّر `settings.ui.daisyTheme` بتأثير يضبط `document.documentElement.setAttribute("data-theme", value)` فوراً (وأي طبقة قوالب لونية)؛ التأكد من حفظ القيمة في الإعدادات واستمرارها بعد إعادة التحميل؛ تغطية المعاينة الحيّة في `LiveThemeEditor`.
  - **التحقق:** اختيار سمة من المعرض يغيّر المظهر فوراً بلا إعادة تحميل؛ يستمر بعد التحديث؛ اختبار وحدة لمنطق تطبيق السمة + فحص بصري.
  - **المصدر:** توجيه المستخدم المباشر (14 يونيو 2026).

### 19.8 P1 — النقر المزدوج/اللمس لفتح التفاصيل وتحسين السحب والإفلات للترتيب (Open-on-DoubleClick + Touch + Reorder DnD)

- [x] `[P1]` ⏱️L **فتح تفاصيل العنصر بالنقر المزدوج (سطح المكتب) والنقر باللمس (الجوال)، مع تحسين السحب والإفلات لإعادة ترتيب العناصر** — حالياً فتح التفاصيل/التفاعل غير متّسق بين سطح المكتب والجوال، والسحب والإفلات لإعادة الترتيب محدود.
  - **✅ مُنجَز (2026-06-14):** نقرة مزدوجة (ماوس) ولمسة واحدة (touch/pen) تفتحان التفاصيل مع إبقاء النقرة المفردة للمعاينة، عبر دوال نقية `openInteraction.js` (كشف نوع المؤشّر) المطبّقة في بطاقات `ArchiveViews.jsx`؛ وإعادة ترتيب بالسحب والإفلات لعرض الشبكة بالماوس واللمس (long-press) مع مؤشّر إفلات في `useReorderDnd.js` و`ArchivePageResults.jsx`، وحفظ الترتيب المخصّص في الإعدادات وتطبيقه كطبقة فرز عبر `reorderItems.js` + `viewModel.js` + `useArchivePageState.js`. اختبارات وحدة لمنطق إعادة الترتيب وقرارات المؤشّر (reorderItems.test.js + openInteraction.test.js). 325 اختباراً ينجح، وبناء build:spa أخضر.
  - **المتطلّبات:**
    - **نقر مزدوج (سطح المكتب):** double-click على بطاقة/صف العنصر يفتح صفحة التفاصيل (مع إبقاء النقرة المفردة للتحديد/المعاينة).
    - **لمس (الجوال):** نقرة لمس واحدة تفتح التفاصيل (أو وفق نمط الجوال المناسب)، مع تمييز سلوك اللمس عن سلوك الماوس.
    - **سحب وإفلات للترتيب:** تحسين DnD لإعادة ترتيب العناصر داخل العرض (وربما النقل بين المجلدات/المجموعات) مع مؤشّرات إفلات واضحة ودعم اللمس.
  - **الملفات للفحص/التعديل:** `archive-app/src/features/archive/ArchiveViews.jsx` (شبكة/قائمة/جدول العناصر)، بطاقات/صفوف العنصر، `archive-app/src/pages/ArchivePage.jsx`، معالِجات `onClick/onDoubleClick/onPointer*`، وأي طبقة DnD حالية (event delegation عبر `data-archive-item-id`).
  - **التنفيذ المقترح:** فصل معالِج النقر المفرد (تحديد) عن المزدوج (فتح) مع كشف نوع المؤشّر (pointer type) للتمييز بين اللمس والماوس؛ منطق إعادة ترتيب قابل للاختبار (دالة نقية لإعادة ترتيب مصفوفة العناصر) + تكامل DnD يدعم اللمس؛ حفظ الترتيب المخصّص إن لزم.
  - **التحقق:** نقر مزدوج/لمس يفتح التفاصيل عبر الأوضاع؛ إعادة الترتيب بالسحب تعمل بالماوس واللمس؛ اختبار وحدة لمنطق إعادة الترتيب؛ فحص بصري على 320/768/1024.
  - **المصدر:** توجيه المستخدم المباشر (14 يونيو 2026).

### 19.9 🔴 عاجل P0 — فتح التعديل/المشروع/العنصر في صفحة/عرض مخصّص بدل التبويب الجانبي (Open in Dedicated View, not Side Panel)

- [x] `[P0]` ⏱️L 🔴 **عاجل: تحسين واجهات صفحتَي الأرشيف والأنواع بحيث يكون السلوك الافتراضي عند فتح التعديل أو المشروع أو أي عنصر هو فتح صفحة/عرض (view) مخصّص كامل، وليس تبويباً/لوحة جانبية** — حالياً بعض إجراءات الفتح (تعديل العنصر، المشروع، إلخ) تظهر كلوحة منزلقة جانبية (side panel/drawer مثل `SideEditPanel` من §1300) ما يربك المستخدم؛ المطلوب أن يكون الافتراضي صفحة مستقلة واضحة.
  - **المتطلّبات:**
    - فتح **تعديل العنصر** من صفحة الأرشيف يذهب إلى صفحة تعديل مخصّصة (أو وضع عرض كامل) بدل اللوحة الجانبية افتراضياً.
    - فتح **المشروع/المونتاج** وأي كيان من صفحتَي الأرشيف/الأنواع يفتح في صفحته الخاصة.
    - الإبقاء على اللوحة الجانبية كخيار ثانوي اختياري فقط (أو إزالتها كافتراضي)، مع تذكّر تفضيل المستخدم إن لزم.
    - مراجعة عامة لواجهتَي **صفحة الأرشيف** و**صفحة الأنواع** لتحسين الوضوح والاتساق في إجراءات الفتح.
  - **الملفات للفحص/التعديل:** `archive-app/src/pages/ArchivePage.jsx`، `archive-app/src/features/archive/ArchivePageResults.jsx`، `archive-app/src/features/archive/useArchivePageState.js` (`openItem`/مسار الفتح)، `SideEditPanel`/`ContextualQuickAddBar` (§1300)، `archive-app/src/pages/TypesPage.jsx`، وأي مسار يفتح لوحة جانبية بدل `setCurrentPage("detail"/"edit"/"projects")`.
  - **التحقق:** فتح التعديل/المشروع من الأرشيف والأنواع يفتح صفحة مخصّصة؛ لا تظهر لوحة جانبية كافتراضي؛ فحص بصري؛ اختبارات لا تنكسر + build:spa أخضر.
  - **المصدر:** توجيه المستخدم المباشر العاجل (15 يونيو 2026).
  - **✅ مُنجَز (2026-06-15):** الافتراضي الآن فتح صفحة/عرض مخصّص. `openItem` كان يذهب أصلاً إلى صفحة `detail` المخصّصة، وفتح المشروع/المونتاج إلى صفحة `projects`. التغيير الأساسي: إجراء "تعديل" في قائمة سياق الأرشيف صار يوجّه إلى الصفحة المخصّصة عبر دالة قرار نقية جديدة `resolveOpenTarget({ action, editInSidePanel })`، ولوحة `SideEditPanel` المنزلقة (§1300) خُفِّضت إلى خيار ثانوي اختياري فقط خلف `settings.ui.editInSidePanel` (افتراضي FALSE) يظهر كعنصر "تعديل سريع جانبي" عند تفعيله. لم يُحذف مكوّن `SideEditPanel`. **الملفات:** `archive-app/src/features/archive/resolveOpenTarget.js` (جديد) + `resolveOpenTarget.test.js` (جديد، 12 اختبار)، `archive-app/src/pages/ArchivePage.jsx`. صفحة الأنواع (`TypesPage`) تفتح محرّر نوع كامل ضمن الصفحة لا لوحة جانبية — مطابقة للمطلوب. **التحقق:** 637/637 اختبار vitest يمرّ، و`build:spa` أخضر. **تحقق المتصفح:** التطبيق يُحمَّل ويوجّه عبر `#/archive` و`#/detail`، وتأكّد أن `SideEditPanel` غير مُركَّب افتراضياً؛ لم يُجرَّب النقر على عنصر فعلي لأن أرشيف الجلسة التجريبية كان فارغاً. **مؤجَّل لاحقاً:** ~~زر/مفتاح في الإعدادات لتفعيل `editInSidePanel` صراحةً.~~ ✅ **مُنجَز (2026-06-20):** أُضيف `ToggleRow` في بطاقة "الإعدادات اليومية" بـ `SettingsPage.jsx` يقرأ/يحفظ `settings.ui.editInSidePanel` عبر `patchUi`؛ أُضيف `editInSidePanel` في `settingsRegistry.js` (category: general، tab: general، type: boolean، default: false) ليظهر في بحث الإعدادات ومعاينة الاستيراد. التحقق: `build:spa` أخضر + 870 اختباراً.
  - **✅ مُتابعة (2026-06-17): صفحتا المجموعات والمشاريع.** كانت صفحتا `CollectionsPage` و`ProjectsPage` لا تزالان تستخدمان شبكة عمودين تعرض الكيان المفتوح في `<aside>` جانبي ضيّق (360px/460px). الآن: عند فتح مجموعة/مشروع يملأ التفصيل الصفحة بعرض كامل (`<section>` بدل `<aside>`) مع زر "← رجوع للمجموعات"/"← رجوع للمشاريع" بارز في الأعلى يعيد لعرض القائمة؛ شبكة العمودين أُزيلت وقائمة البطاقات صارت بعرض كامل (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). الحالة المضافة: `openedCollectionId`/`openedId` محلية فقط — لا تغيير في نموذج البيانات أو إجراءات المتجر أو النوافذ المنبثقة. إنشاء مشروع جديد يفتحه مباشرة في محرّره الكامل. **الملفات:** `archive-app/src/pages/CollectionsPage.jsx`، `archive-app/src/pages/ProjectsPage.jsx`. **التحقق:** 709/709 اختبار vitest يمرّ، و`build:spa` أخضر، وتحقق متصفّحي كامل: فتح ↦ عرض كامل بزر رجوع + إخفاء القائمة، ورجوع ↦ استعادة القائمة (للصفحتين).
  - **✅ مُتابعة (2026-06-17): صفحة الأنواع + مسح صفحات التصنيف/المجلدات.** امتداداً للمبدأ نفسه إلى صفحات التصنيف:
    - **`TypesPage` (تم التغيير):** محرّر النوع (`TypeEditor`: الأساسيات/الفروع/الحقول المخصصة/المراجعة) كان يُعرض بعرض كامل لكن تبقى تحته شبكة القائمة + لوحة المعاينة الجانبية (`xl:grid-cols-[minmax(0,1fr)_420px]`) ظاهرة، فيظهر المحرّر مكدّساً فوق القائمة بدل أن يحلّ محلّها. الآن: عند فتح المحرّر يُخفى قسم القائمة + اللوحة الجانبية بالكامل (`!showEditor && …`) فيصبح المحرّر عرضاً كاملاً مخصّصاً يحلّ محلّ القائمة، والعودة تتم عبر زر "إلغاء" الموجود داخل المحرّر. لا تغيير في نموذج البيانات أو إجراءات المتجر (`addContentType`/`updateContentType`/`deleteContentType` كما هي)؛ نافذة أثر الأرشفة (`TypeImpactSheet`) تبقى تعمل. **الملف:** `archive-app/src/pages/TypesPage.jsx`.
    - **`VocabularyPage` و`HierarchicalTagsPage` (سليمتان — لم تتغيّرا):** كلتاهما تفتحان التعديل/الإنشاء عبر نافذة `EntityFormModal` مركزية (لا لوحة جانبية ضيّقة)، فهما مطابقتان للمطلوب أصلاً.
    - **مجلدات الأرشيف (لا يوجد سطح تحرير حيّ):** مكوّنا `FolderTree.jsx`/`FolderTreeNode.jsx` وإجراءات المتجر (`addFolder`/`updateFolder`/`deleteFolder` في `foldersSlice.js`) موجودة، لكنها **غير موصولة بأي صفحة** (لم يُدمج `<FolderTree>` في `ArchivePage` كما في §14.3)، فلا يوجد محرّر مجلد جانبي ضيّق يحتاج إصلاحاً حالياً. يُعالَج عند تفعيل شجرة المجلدات في الأرشيف.
    - **التحقق:** 741/741 اختبار vitest يمرّ، و`build:spa` أخضر. لم يُجرَّب المتصفح في هذه الدفعة (اعتمدنا على الاختبارات + البناء).

---

## 20. توجيهات المستخدم — دفعة ثانية (10 يونيو 2026)

> **المصدر:** توجيه المستخدم المباشر. صيغت المهام من نصّ وصل مشوّهاً جزئياً — تُراجع الصياغة مع المستخدم عند بدء التنفيذ.

### 20.1 P1 — Refresh Token + التجديد الصامت (Silent Renewal)

- [x] `[P1]` ⏱️M **إضافة `POST /api/auth/refresh` وتجديد JWT تلقائياً قبل الانتهاء** — حالياً انتهاء التوكن يقطع جلسة العمل (أرشفة طويلة تنقطع).
  - **التنفيذ:** refresh token يُخزَّن في HttpOnly cookie (لا localStorage)؛ access token قصير العمر يُجدَّد صامتاً في الخلفية قبل انتهائه؛ إبطال refresh token عند تسجيل الخروج (يرتبط بآلية إبطال JWT الموجودة في §1)؛ rotation عند كل تجديد لكشف إعادة الاستخدام.
  - **الملفات:** `archive-server/src/auth/*`، `archive-server/src/api/server.js`، `archive-app/src/bootstrap/cloudSession.js` (مؤقّت تجديد صامت + إعادة محاولة عند 401).
  - الجهد: 1-2 أسبوع.
  - ✅ **مُنجز ومتحقق (2026-06-11):** وحدة جديدة `archive-server/src/auth/refreshTokenStore.js` (عائلات rotation + كشف إعادة الاستخدام يبطل العائلة كاملة)؛ `POST /api/auth/refresh` يدوّر كوكي `va_refresh` (HttpOnly، `Path=/api/auth`، `SameSite=Strict`، `Secure` على HTTPS) ويصدر access token جديدًا؛ login يزرع الكوكي وlogout يبطل العائلة ويمسحها؛ `REFRESH_EXPIRES_IN_SEC` في `.env.example` (افتراضي 30 يومًا). في العميل: `refreshCloudToken` + `createSilentRenewal` (تجديد قبل الانتهاء بدقيقة، إعادة محاولة عند خطأ شبكة، خروج تلقائي عند 401) موصول في `createCloudSessionProvider`. اختباران HTTP شاملان في `verify-auth.mjs` (مرّا) و7 اختبارات vitest في `cloudSession.refresh.test.js` (مرّت، 73/73).

### 20.2 P1 — التنبيهات الذكية (Smart Alerts عبر Web Push)

- [x] `[P1]` ⏱️M **ربط خدمة الإشعارات بـ Web Push API لإرسال تنبيهات خارج التطبيق** — تُرسل عند: إسناد مهام، اكتشاف مكررات (§16.3)، فشل نسخ احتياطي، تحديث سجل، إغلاق/أرشفة سجل.
  - **التنفيذ:** اشتراك Push في Service Worker + VAPID keys في الخادم؛ تفضيلات اشتراك لكل نوع تنبيه؛ تجميع التنبيهات المتشابهة.
  - **الملفات:** `archive-server/src/notifications/notificationService.js` (أو إنشاؤها)، `archive-app/public/sw.js`، تكامل مع §18.2 (مركز الإشعارات — هذه قناة التسليم الخارجية له).
  - الجهد: 2-3 أسابيع.
  - ✅ **مُنجز ومتحقق (2026-06-11):** خادم: `webPushService.js` جديد (مكتبة `web-push` + VAPID من البيئة، إرسال fire-and-forget، تجميع التنبيهات المتطابقة خلال 30 ث، حذف endpoints الميتة عند 404/410)؛ مسارات `GET /api/push/vapid-public-key` و`POST /api/push/subscribe|unsubscribe` خلف المصادقة؛ Prisma: model `PushSubscription` + حقول `pushOn*` في التفضيلات مع migration `20260611120000_web_push`؛ ربط push بأحداث المشاركة واكتمال الرفع؛ `VAPID_*` في `.env.example`. عميل: معالجا `push`/`notificationclick` في `sw.js` (tag للتجميع، فتح/تركيز النافذة)، وخدمة `pushService.js` (اشتراك/إلغاء/حالة). تحقق: 5 اختبارات جديدة في `verify-notifications.mjs` (11/11 مرّت) و10 اختبارات vitest في `pushService.test.js` (82/82 مرّت).
  - 🔄 **تحسين قنوات الأحداث 2026-06-20:** وُصّل push لأحداث فشل النسخ الاحتياطي: أُضيف callback اختياري `onFailure` إلى `startBackupScheduler` في `backupScheduler.js`؛ عند الفشل يستعلم `index.js` عن المستخدمين ذوي دور admin ويُرسل لكل منهم push بنوع `system` وtag `backup-failure` (fire-and-forget، لا يحجب النظام). تغيير متوافق رجعياً — الاستدعاء القديم بدون opts يعمل كالسابق. التحقق: `verify:server` أخضر + 870 اختباراً.

### 20.3 P1 — نظام Workflow لحالات السجلات (Status Flow + Webhooks)

- [x] `[P1]` ⏱️L **آلة حالات معرّفة للسجلات: مسودة → تحرير → مراجعة → معتمد → منشور → مؤرشف (+ تواريخ استحقاق)** — انتقالات مضبوطة بالأدوار، وصلاحيات معرّفة لكل انتقال.
  - ✅ **مُنجز ومتحقق (2026-06-11):** خادم: `archive-server/src/workflow/stateMachine.js` (6 حالات بتسميات عربية، انتقالات data-driven مقيدة بالأدوار — editor للتأليف وadmin/owner للاعتماد/النشر، `applyTransition` immutable يلحق `workflowHistory` ويتحقق من `dueDate`)؛ مساران `GET /api/workflow/definition` و`POST /api/workflow/transition` (تدقيق + webhook `record.status_changed` + push للمالك عند تغيير حالة سجله من مستخدم آخر — تكامل §20.2). عميل: `itemStatus.js` (مرآة الحالات + `isOverdue`) و`StatusTransitionMenu.jsx` (شارة + قائمة انتقالات حسب الدور)، ثم دُمجت القائمة في صفحة التفاصيل في 2026-06-13. تحقق: `verify-workflow.mjs` جديد ضمن سلسلة `verify` (6/6 مرّت) و9 اختبارات vitest (91/91 مرّت).
  - ✅ **تذكيرات تواريخ الاستحقاق (2026-06-20):** أُنجز `archive-server/src/workflow/dueDateScheduler.js` — جدولة تلقائية بـ `setInterval` (كل ساعة افتراضياً، قابل للضبط عبر `WORKFLOW_DUE_CHECK_HOURS`) تفحص مخازن المحتوى الخمسة (`video_items/media_items/document_items/audio_items/image_items`) وتُرسل push بنوع `system` لصاحب السجل: "سجل متأخر" عند تجاوز `workflowDueDate`، و"موعد استحقاق قريب" عند الاقتراب خلال 24 ساعة. إزالة التكرار عبر `sentToday` Map مؤقتة (مفتاح `${store}:${id}:${alertType}:${day}`) تضمن تنبيهاً واحداً فقط يومياً لكل سجل/نوع. تتجاوز السجلات في الحالتين `published`/`archived`، ومن لا مالك لهم، والتواريخ غير الصالحة. Fire-and-forget لا يحجب الخادم. وُصّل في `index.js` مع `startDueDateScheduler`/`stopDueDateScheduler` (shutdown نظيف). أُضيفت `WORKFLOW_DUE_REMINDERS_ENABLED` و`WORKFLOW_DUE_CHECK_HOURS` في `.env.example`. اختبارات: 12 حالة في `dueDateScheduler.test.js` (89/89 خادم + 870/870 عميل).
  - **التنفيذ:** تعريف الحالات والانتقالات المسموحة في schema قابل للتهيئة؛ صلاحيات لكل انتقال حسب الدور (admin/editor/viewer)؛ إطلاق webhooks عند كل انتقال حالة (يبني على بنية Webhooks الموجودة في `WebhooksSettings.jsx` وأحداث `record.*` في `server.js`)؛ تواريخ استحقاق مع تنبيهات (تكامل §20.2)؛ سجل انتقالات لكل سجل.
  - **الملفات:** `archive-server/src/workflow/stateMachine.js` (جديد)، `archive-server/src/api/server.js`، `archive-app/src/features/archive/itemStatus.js` (يرتبط بـ §17.17 — الحالات المرئية تُبنى فوق هذا الـ workflow)، `archive-app/src/components/workflow/StatusTransitionMenu.jsx`.
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
  - **الملفات:** `archive-server/src/api/publicApi.js` (جديد)، `archive-server/src/auth/apiKeys.js` (جديد)، `archive-app/src/components/settings/ApiKeysSettings.jsx` (جديد)، توثيق `archive-server/docs/public-api.md`.
  - **تنبيه أمان:** مراجعة security-reviewer إلزامية قبل الدمج (سطح هجوم جديد).
  - الجهد: 3-4 أسابيع.
  - ✅ **مُنجز ومتحقق (2026-06-11):** `archive-server/src/auth/apiKeyService.js` (توليد `ak_<prefix8>_<secret32>`، تخزين SHA-256 hash فقط، إظهار المفتاح الخام مرّة واحدة، نطاقات read/write → دور viewer/editor، احترام `expiresAt`/`active`، ختم `lastUsedAt`)؛ Prisma model `ApiKey` + migration `20260611140000_api_keys`؛ مسارات إدارة محمية بـ JWT (`GET/POST/DELETE /api/api-keys`) ونقطة قراءة عامة `GET /api/public/records` بترويسة `X-API-Key` ونطاق read مع حد `limit`؛ تدقيق على الإنشاء/الإبطال. واجهة `ApiKeysSettings.jsx` (إنشاء/سرد/إبطال مع إظهار المفتاح الخام مرّة واحدة + نسخ) موصولة في تبويب Webhooks بصفحة الإعدادات. تحقق: `verify-apikeys.mjs` جديد ضمن سلسلة `verify` (5/5 مرّت، بما فيها مسار HTTP كامل: إنشاء→سرد بلا سر→قراءة عامة→إبطال→رفض بعد الإبطال) و3 اختبارات vitest للواجهة (104/104 مرّت). rate-limit لكل مفتاح مضاف على `/api/public/records` (محدِّد `apiKey` مفتاحه `apiKeyId`، افتراضي 120/دقيقة، 429 عند التجاوز)، وترقيم cursor مستقر (`?cursor=&limit=` مرتّب حسب id مع `nextCursor` في الاستجابة) مع اختبارَي انحدار (8/8 مرّت). ✅ **متابعة توثيق API (2026-06-18):** أُضيفت مواصفة OpenAPI 3.1 في `archive-server/docs/public-api.openapi.json`، ودليل التكامل `archive-server/docs/public-api.md` يوثّق `X-API-Key`، الترقيم، allowlist، وأشكال أخطاء `401/403/429/500`، مع تقديم المواصفة من الخادم عبر `GET /api/public/openapi.json` و`GET /api/v1/public/openapi.json` وتحقق عقد داخل `verify-apikeys.mjs`. المتبقي لاحقًا: موصلات WordPress/Drupal.

### 20.6 P2 — البحث الصوتي (Web Speech API)

- [x] `[P2]` ⏱️M **السماح بالبحث الصوتي: المستخدم ينطق "محاضرات يونيو 2026" أو "افتح هذا الملف" فيُنفَّذ البحث/الأمر** — عبر Web Speech API (SpeechRecognition) مع دعم العربية.
  - **التنفيذ:** زر ميكروفون في شريط البحث + لوحة الأوامر (§17.2)؛ تحويل الكلام لاستعلام بحث (مع التطبيع العربي في `archive-core/src/utils/arabicNormalize.js`)؛ أوامر صوتية بسيطة (افتح/ابحث/أضف)؛ fallback مهذّب حيث لا يتوفر SpeechRecognition؛ احترام إذن الميكروفون وعدم التسجيل الدائم.
  - **الملفات:** `archive-app/src/features/search/voiceSearch.js` (جديد)، `archive-app/src/components/search/VoiceSearchButton.jsx` (جديد)، تكامل `SearchPage.jsx`.
  - ✅ **مُنجز ومتحقق (2026-06-12):** أضيفت وحدة `voiceSearch.js` لاكتشاف `SpeechRecognition`/`webkitSpeechRecognition`، استخراج النص من نتائج المتصفح، وتطبيع أوامر عربية بسيطة (`ابحث`/`افتح`/`أضف`) إلى intents قابلة للتنفيذ. أضيف زر `VoiceSearchButton` داخل شريط بحث `SearchPage`، يعمل بلغة `ar-SA`، لا يسجل إلا عند الضغط، ويعرض fallback عبر toast عند غياب الدعم أو رفض إذن الميكروفون. أوامر البحث تضبط الاستعلام، أمر الفتح يفتح النتيجة الوحيدة أو يضيّق النتائج، وأمر الإضافة ينتقل لصفحة الإضافة. التحقق: اختبار RED/GREEN جديدان (`voiceSearch.test.js`, `VoiceSearchButton.test.jsx`) + حارس `verify-modules` + `pnpm --filter @archive/app run test` (111/111) + `pnpm --filter @archive/app run verify` + `pnpm --filter @archive/app run build:spa`.
  - الجهد: 1-2 أسبوع.

### 20.7 P1 — إصلاح/ترقية خريطة العلاقات (Graph View بـ cytoscape.js)

- [x] `[P1]` ⏱️M **ترقية `GraphViewPage.jsx` إلى cytoscape.js وإصلاح عدم ظهور الروابط بين العناصر** — المستخدم يبلّغ أن الروابط/العلاقات لا تظهر حالياً في الخريطة.
  - **التحقيق أولاً:** ✅ السبب: المطابقة كانت نصية حرفية (lowercase فقط، بلا تطبيع عربي ولا aliases للوسوم الهرمية)، لا حواف للمجموعات إطلاقاً، وقصّ أول 60 عنصراً بترتيب الإدخال قبل حساب الحواف.
  - **التنفيذ:** ✅ تم — `cytoscape.js` (cose ≤250 عقدة / concentric فوقها، استيراد كسول)؛ عقد ملوّنة حسب documentType؛ حواف وسوم مشتركة (مطبّعة عربياً + aliases الوسوم الهرمية) + نفس المجموعة بوزن = عدد التداخل؛ حواف علاقات §18.5 اليدوية موجهة وموسومة؛ تكبير/سحب؛ نقرة → تحديد ونقرة ثانية → التفاصيل؛ فلترة حسب النوع/الوسم؛ سقف 500 عقدة مع «تحميل المزيد». **متبقٍ لاحقًا:** أداء ~5K عقدة (عرض تدريجي حقيقي).
  - **الملفات:** `archive-app/src/pages/GraphViewPage.jsx`، تبعية `cytoscape` جديدة، `archive-app/src/features/graph/buildGraphModel.js` + `buildGraphModel.test.js` (جديدان، 10 اختبارات).
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

---

## ترحيل TypeScript التدريجي (frontend + server) — مكتمل 2026-06-29

> ملخّص خطة `[P1] ⏱️XXL` المُنجَزة بالكامل (31 شريحة، 2026-06-27 → 2026-06-29)، نُقلت هنا من `TASKS.md` لإفساح المجال لخطة جديدة. التفاصيل الكاملة لكل شريحة محفوظة في تاريخ git وملفات الذاكرة (`tasks-state-2026-06-29`).

**النتيجة النهائية:**
- `archive-app/src` و`archive-server/src`: **صفر** تنفيذات JavaScript فعلية — كل المنطق TS/TSX خلف جسور توافق `.js`.
- `archive-core/src`: يحتفظ بجسور التوافق عمداً حتى يحتاج `dist` لنشر خارجي (قرار نهائي).
- العدّ النهائي: **845 ملف TS/TSX** مقابل 663 جسر `.js` (منها 659 جسر توافق + 4 اختبارات تكامل `.mjs` مقصودة).
- بوابة موحّدة: `pnpm run typecheck` (0 أخطاء عبر الحزم الأربع) أُضيفت إلى بداية `release:verify`.

**المسار (31 شريحة):**
- **الأساس (ش0):** `tsconfig.base.json` + tsconfig لكل حزمة + سكربتات typecheck، `moduleResolution: "Bundler"`.
- **frontend (ش1–28):** leaf utilities → pure view models → API clients → feature modules → store slices → components/TSX → app shell → آخر 34 اختباراً. أُغلق `archive-app/src` بالكامل (تنفيذات JS = 0).
- **server (ش29–30):** Task 10 (94 ملف خدمة عبر 8 وكلاء Haiku، 173 خطأ نوع عولج) + Task 11 (47 ملف: adapters/api/routes/index). أُعيد توليد 136 جسر server حتمياً لإصلاح جسور ذاتية المرجع وأخطاء `export default` لا يكشفها typecheck.
- **الإغلاق (ش31):** Tasks 9 و12 — تثبيت قرار الجسور، إصلاح حلّ بريد المستخدم من Prisma وتمرير `transcribe.fetchImpl` وفحص readiness خلف الجسور.

**التحقق النهائي:** `pnpm run release:verify` كامل — typecheck + 143 ملف اختبار app / 1246 اختبار + verify للحزم + `build:spa` + `build:cloud` + `security:baseline` + release readiness.

**القرار الموثّق:** الجسور `.js` تبقى (عائد وقت تشغيل صفري، إزالتها churn عبر 1383 استيراداً بلا فائدة وظيفية)؛ تُلغى فقط جسور `archive-core` عند الحاجة لنشر `dist`.

---

## الموجة الجديدة (تقارير P4) — بنود مُنجَزة (يونيو 2026)

> نُقلت من `TASKS.md` بعد إنجازها والتحقق منها. مرتّبة حسب القسم الأصلي.

### 0. تصفية أولية — بنود التقارير المُرجَّح أنها مُنفّذة (تحقّق ثم علّم)

- [x] `[P1]` ⏱️S **التحقق من تفعيل بنرات/مؤشرات UX الجاهزة** — `SessionRestoreBanner.jsx`, `DraftRecoveryDialog.jsx`, `SaveIndicator.jsx`, `FocusShell.jsx`/`focusMode.js`, `QuickCaptureWidget.jsx`, Skeletons (`SkeletonBlock`/`SkeletonCard`/`va-skeleton`).
  - ✅ تحقق ووُصل (2026-06-21): FocusShell, DraftRecoveryDialog, SaveIndicator, QuickCaptureWidget, Skeletons — كلها موصولة. SessionRestoreBanner وُصلت في DashboardPage مع loadSessionsFromStorage+deleteSession في autosaveSlice.
  - الملفات: `archive-app/src/app/shell/ShellParts.jsx`، `pages/AddVideoPage.jsx`، `pages/InboxPage.jsx`، `pages/ActivityPage.jsx`، `pages/DashboardPage.jsx`.
  - القبول: كل مكوّن إمّا مُفعَّل ومربوط فعلاً (يُعلَّم `[x]`)، أو يُنقَل بنده لقسمه أدناه إن كان ناقصاً.
  - المصدر: sessions_new (F5,F6,F8,F11,F24,F25)، new_tail (F5,F17)، f45ea5a29 (Inbox/Activity skeleton).

- [x] `[P2]` ⏱️S **التحقق من بنود «الأنواع/الاكتمال» ذات الدوال الموجودة** — `analyzeTypeImpact`, `computeCompleteness`, `recentDefaults`, `getFieldsForSelection`, `STATE_META`, `buildMediaReadiness`, `buildProjectDeliveryPackage`, `addTemporalComment`, `buildDiscoverySections`.
  - ✅ مُنجز (2026-06-21 wave-22): كل الدوال معروضة في الواجهة — analyzeTypeImpact+TypeImpactSheet في TypesPage؛ computeCompleteness في ArchiveViews/ArchivePageResults؛ recentDefaults في SideEditPanel+ContextualQuickAddBar؛ getFieldsForSelection في AddVideoPage+DetailPage؛ STATE_META في ArchivePage+AutomationPage؛ buildMediaReadiness+buildProjectDeliveryPackage في ProjectsPage؛ addTemporalComment في ProjectsPage:1375؛ buildDiscoverySections في DiscoverPage.
  - المصدر: new_tail (F1,F4,F6,F10,F15,F17,F18,F21)، sessions_new (F13,F15).

### 1. جاهزية البث المؤسسي (Enterprise / Broadcast) — net-new

- [x] `[P0]` ⏱️XL **نظام إدارة الحقوق الكامل (Rights/License)** — نموذج بيانات + منطق أعمال + واجهة.
  - يشمل: `rightsHolder`, `licenseType`, نافذة `embargo`، تاريخ انتهاء + **تنبيهات انتهاء**، **منع بث تلقائي** للمواد منتهية/المحظورة، **قيود جغرافية**، تقارير حقوق.
  - ✅ شريحة 1/3 — السكيما + REST + اختبارات (2026-06-22 wave-28، agent Sonnet): `RightsRecord` Prisma model + enum `LicenseType` (OWNED/LICENSED/PUBLIC_DOMAIN/FAIR_USE/UNKNOWN) + `embargoStart`/`embargoEnd`/`expiresAt`/`geoRestrictions[]` + 5 endpoints (GET/POST/PUT/DELETE + `/api/rights/expiring?days=N`) + 5 vitest cases. الـ migration بـ `--create-only` (يحتاج `prisma migrate deploy` يدوياً).
  - ✅ شريحة 2/3 — UI (2026-06-24 wave-32، agent A): `RightsPanel.jsx` في `archive-app/src/features/rights/` — شارة لون حسب نوع الرخصة، تحذيرات «منتهية»/«تحت الحجب»/«تنتهي قريباً»، نموذج تحرير بـ BadgeV2، cloud-only guard، design tokens + CSS logical props. تبويب «الحقوق» في DetailPage. 10 اختبارات vitest.
  - ✅ شريحة 3/3 — enforcement (2026-06-24 wave-33، agent A): `rightsEnforcement.js` (pure: checkRightsForExport/isExpiringSoon/buildRightsSummary)، wire في export.js (403 RIGHTS_BLOCKED)، `expiryAlerts.js` (RIGHTS_EXPIRY_ALERT audit)، GET /api/rights/:itemId/enforcement. 13 اختبار.
  - ✅ شريحة Laravel migration — REST + enforcement (2026-06-27): أُضيف `RightsRecord` Eloquent model + `RightsController` + routes تحت `/api/v1/rights` للعرض/upsert/expiring/enforcement، مع `RightsApiTest`. مرّت Laravel tests بنتيجة 8 اختبارات و54 assertion.
  - ✅ إغلاق تحقق (2026-06-29): مرّت `rightsEnforcement.test.mjs`، وREST rights ضمن حزمة `archive-server`، وواجهة `RightsPanel` ضمن حزمة `@archive/app`.
  - الملفات: schema/store جديد في `archive-server/prisma/schema.prisma` + خدمة `archive-server/src/rights/*` + واجهة في `archive-app` (DetailPage + صفحة/تبويب حقوق).
  - القبول: لا يمكن نشر/تصدير مادة منتهية الحقوق دون تجاوز صريح مُسجَّل؛ تقرير «حقوق تنتهي خلال 30 يوماً» يعمل.
  - المصدر: broadcast-report (rights — حرج، «بدونه رفض الاعتماد»)، dev-roadmap (P3-01).

- [x] `[P0]` ⏱️XL **دعم صيغ البث: MXF / XDCAM / ProRes / DNxHR** — ترميز + demux + استخراج metadata مدمجة.
  - ✅ شريحة 1/2 — خطّة الـ ffmpeg (2026-06-22 wave-29، agent Sonnet): `archive-server/src/media/broadcastPlan.js` يحدد الـ codecs (MXF demux، XDCAM، ProRes 4 levels، DNxHR 5 levels) + `probeBroadcastMetadata` يستخرج timecode/duration/reel-name من ffprobe JSON. `archive-server/src/export/broadcast.js` يعرض `renderProRes422` و`renderDnxhrHq` مع injected runner. 24 اختبار، verify chain مُحدّث.
  - ✅ شريحة 2/2 — (2026-06-24 wave-33، agent B): `broadcastIngest.js` (isBroadcastFile + extractBroadcastMetadata injectable)، wire في watchFolder onIngest payload، GET /api/media/:id/broadcast-metadata، POST /api/export/broadcast (ProRes/DNxHR). 25 اختبار، 165 tests green.
  - ✅ إغلاق تحقق (2026-06-29): مرّ `verify-broadcast-codecs.mjs` ومسار broadcast ingest/API ضمن حزمة `archive-server`.
  - الملفات: `archive-server/src/media/broadcastPlan.js` + `archive-server/src/export/broadcast.js`.
  - القبول: رفع ملف MXF/XDCAM يُستخرَج منه metadata ويُولَّد proxy؛ التصدير يدعم ProRes/DNxHR.
  - المصدر: broadcast-report (ingest — حرج)، dev-roadmap (P2-04).

- [x] `[P0]` ⏱️L **خط أنابيب Streaming للملفات الضخمة (50–500GB)** — استبدال `os.tmpdir()` بمعالجة تدفقية.
  - ✅ مُنجز (2026-06-22 wave-28، agent Sonnet): 7 مواقع حُوّلت — `chunkedUpload.completeSession` (PassThrough sequential pipe بدلاً من `Buffer.concat`)، `chunkedUpload.receiveChunk` (pipeline → createWriteStream)، `chunkedUpload.tmpDir()` (STORAGE_DIR بدلاً من os.tmpdir)، `server.js PUT /api/files/:key` (stream مباشرة إلى putStream/putBlob؛ image MIMEs فقط تحتفظ بـ Sharp buffer)، `runMedia.withTempFileFromStore` (getStream preferred + getBlob fallback async generator)، `runMedia.runMediaDerivative` output (putStream من createReadStream)، `export/mp4.js outFile` (STORAGE_DIR/export-work). Smoke test: 10MB stream end-to-end دون `Buffer.concat`. 106/106 server tests pass. ملاحظة: `ocrHandler.js` + `backupCrypto.js` + `controlAgent.js` لم تُحوَّل لأسباب صحيحة (microservice Content-Length، AES-GCM in-memory، bounded process stdout).
  - الملفات: مسارات الرفع/المعالجة في `archive-server/src/api/server.js` + خدمة الوسائط.
  - القبول: معالجة ملف 5GB+ دون تحميله كاملاً في الذاكرة/القرص المؤقت؛ مؤشر تقدم streaming. ✓
  - المصدر: broadcast-report (مخاطرة #4)، dev-roadmap (P3-10).

- [x] `[P1]` ⏱️XL **مخطط PBCore + Dublin Core** — 15 حقل Dublin Core + حقول PBCore + تصدير PBCore XML / DC RDF.
  - ✅ مُنجز (2026-06-22 wave-28، agent Sonnet): `archive-server/src/export/dublinCore.js` (`toDublinCore` يغطي كل الـ 15 عنصر DC)، `pbcore.js` (`toPBCore` بمجموعة PBCore 2.1 الكاملة)، `xmlSerializer.js` (~55 سطر، escapes `&`/`<`/`>`/`"`/`'`، بلا dependencies)، endpoints `GET /api/items/:id/export/pbcore.xml` (`application/xml`) و`/api/items/:id/export/dublincore.rdf` (`application/rdf+xml`) كلاهما خلف `requireAuth`. 19 اختبارات (DC completeness، PBCore structure، XML escaping، HTTP auth، 404 على عنصر مفقود). أُضيف `verify:metadata-export` لسلسلة الـ verify.
  - الملفات: schema + خدمة تصدير في `archive-server/src/export/*` + ربط بحقول الأنواع.
  - القبول: تصدير مادة كـ PBCore XML صالح + DC RDF؛ مفردات منظمة للإعلام العربي. ✓ (المفردات المنظمة العربية تبقى ضمن بند §1 line 102 المنفصل).
  - المصدر: broadcast-report (metadata — حرج)، dev-roadmap (P3-02).

- [x] `[P1]` ⏱️XL **تكامل MOS + NRCS (ENPS/iNEWS)** — جسر لغرفة الأخبار.
  - ✅ شريحة 1/2 (2026-06-23 wave-31، agent Sonnet): `archive-server/src/integrations/mos/` — `messages.js` يبني 6 رسائل MOS 3.x (roReq/roCreate/roStorySend/roElementAction/objList/objCreate) عبر `xmlSerializer.js`؛ `session.js` بـ messageID تلقائي + wrap/unwrap بدون DOMParser؛ `searchBridge.js` يحوّل عناصر الأرشيف إلى MOS shape. REST: `POST /api/mos/search` + `GET /api/mos/envelope-sample?type=roReq`. 23 اختبار، verify chain مُحدّث. لا sockets.
  - ✅ شريحة 2/2 — (2026-06-24 wave-33، agent C): `tcpClient.js` (connect/disconnect/send/getStatus، reconnect، heartbeat 30s، send queue max 100). REST: POST /connect، POST /disconnect، GET /status، POST /send (admin-only). 8 اختبارات node:test بـ echo server حقيقي.
  - الملفات: `archive-server/src/integrations/mos/*` + REST bridge.
  - القبول: محرر في ENPS/iNEWS يبحث الأرشيف ويسحب مادة عبر MOS؛ يمكن تأجيله للمرحلة الثانية مع واجهة ويب + تنزيل يدوي مؤقتاً.
  - المصدر: broadcast-report (integration — حرج لكن قابل للتأجيل)، dev-roadmap (P3-04).

- [x] `[P1]` ⏱️L **سياسة احتفاظ + حذف آمن + سلسلة عهدة** — retention تلقائية + حذف DoD 5220.22-M + تقارير امتثال.
  - ✅ مُنجز (2026-06-22 wave-28، agent Sonnet): `archive-server/src/retention/retentionPolicy.js` (`parseRetentionRule`، `isExpired`، `findExpiringSoon`، `scanRetention` — pure functions) + `secureDelete.js` (`secureOverwrite` بـ 3-pass DoD 5220.22-M: 0x00 → 0xFF → random عبر `fs.open("r+")` ثم unlink، 10GB size guard). Prisma: `RetentionRule` model + `archivedAt` على ArchiveItem + migration بـ `--create-only`. wired في `DELETE /api/files/:key` بحيث disk store يحصل على wipe كامل و cloud stores تعتمد على `files.remove()`. `auditLogger.js` يسجّل `secure-delete` بـ DESTRUCTIVE_OPS مع size + pass count. 30 اختبار. وثّق وكلاء scheduler integration (setInterval style) كـ TODO.
  - ✅ شريحة scheduler (2026-06-29): أُضيف `retentionScheduler.ts` لتشغيل `scanRetention()` يومياً مع `setInterval().unref()` عند تشغيل Postgres، ويطبق archive عبر `archivedAt` والحذف الآمن عبر Disk FileStore أو `files.remove()` لمزودات التخزين السحابية، ثم soft-delete بـ `isDeleted/deletedAt`. أضيفت 6 اختبارات Vitest في `retentionScheduler.test.ts`. مرّت `retentionScheduler.test.ts`، و`node archive-server\scripts\verify-retention.mjs`، و`archive-server` typecheck.
  - متبقّي: UI لإدارة الـ rules (manage retention rules page) + reports امتثال — شرائح لاحقة صغيرة.
  - الملفات: `archive-server/src/retention/*`، ربط بـ ActivityLog الموجود.
  - القبول: سياسة احتفاظ قابلة للتهيئة تعمل؛ حذف آمن يُسجَّل في سلسلة العهدة. ✓
  - المصدر: broadcast-report (compliance)، dev-roadmap (P3-06).

- [x] `[P1]` ⏱️XL **نسخ احتياطي مؤسسي** — replication عبر المناطق + off-site + failover تلقائي + اختبار DR آلي.
  - ✅ شريحة 1/3 (2026-06-23 wave-31، agent Sonnet): `archive-server/src/backup/enterprise/` — `replicate.js` (streaming multipart S3 upload + AES-256-GCM optional encryption، 12B IV + 16B authTag layout)، `manifest.js` (`appendBackupManifestEntry` + `findRestorableEntry`)، `restoreSmoke.js` (download + decrypt + SHA-256 verify + `pg_restore --list` smoke). 3 REST endpoints: `POST /api/backups/replicate/:backupId` (admin) و `GET /api/backups/replicas` و `POST /api/backups/restore-smoke/:replicaId`. config: `config.backup.replication.{enabled, bucket, region, prefix, encryptionKey}` في `env.js`. 14 اختبار جديد، 23 اختبار backup الموجودة لم تتأثر.
  - ✅ شريحة 2/3 — (2026-06-24 wave-32، agent C): `healthProbe.js` (polling fetch، failThreshold، onFailoverNeeded/onRecovered callbacks)، `drDrill.js` (runDrillNow + scheduler، bounded 100-entry history)، `drRoutes.js` (GET health-probe، POST drill-now admin، GET drill-history). 10 اختبارات. verify:server green.
  - ✅ شريحة 3/3 — scheduled DR drills UI + alerts (2026-06-29): أضيفت حالة جدولة للحفر الآلي في `drDrill.js` (`getScheduleStatus`: enabled/running/interval/nextRunAt/lastRunAt/lastResult)، وتشغيل تلقائي لـ health probe وDR scheduler عند تفعيل `BACKUP_REPLICATION_ENABLED`. يعرض `GET /api/backups/drill-history` الآن `schedule` بجانب history. حُدّث `DrAlertsPanel` ليقرأ العقد الفعلي (`probe.lastCheck`, `history[].ranAt/replicaId/error`) ويعرض بطاقة الجدولة والتنبيهات عند فشل health probe، توقف الجدولة، أو فشل آخر حفر. أضيف اختبار UI للجدولة/الفشل واختبار scheduler status. مرّت `node archive-server\src\__tests__\drDrill.test.mjs` (6/6)، و`pnpm --filter archive-server run verify:dr` (5/5)، و`DrAlertsPanel.test.tsx` (10/10)، وtypecheck للواجهة والسيرفر.
  - الملفات: `archive-server/src/backup/enterprise/*` + S3 cross-region.
  - القبول: استعادة من نسخة off-site تنجح في اختبار DR مجدول. ✓ (smoke level)
  - المصدر: broadcast-report (DR)، dev-roadmap (P3-09).

- [x] `[P2]` ⏱️L **Watch Folder + ابتلاع FTP/SMB** — التقاط تلقائي للملفات الواردة + checksum عند الابتلاع.
  - ✅ مُنجز (2026-06-23 wave-31، agent Sonnet): `archive-server/src/ingest/` — `watchFolder.js` بـ polling `node:fs/promises.readdir` (لا chokidar) + Map للـ mtime/size + SHA-256 streaming عبر pipeline (لا full-file buffer) + نقل الملفات إلى `processed/` بعد النجاح. `ftpIngest.js` و`smbIngest.js` يعتمدان على `basic-ftp` و`@marsaud/smb2` (موجودان مسبقاً) مع manifest JSON `archive-server/var/ingest/ftp-manifest.json` للتتبّع. REST: `POST /api/ingest/scan` + `POST /api/ingest/ftp/pull` + `POST /api/ingest/smb/pull`. config: `INGEST_WATCH_DIR` (default `var/ingest/inbox/`، polling default 30 ثانية). 13 اختبار، verify chain مُحدّث.
  - الملفات: `archive-server/src/ingest/*`.
  - القبول: إسقاط ملف في مجلد مراقَب يُنشئ مادة تلقائياً مع proxy + checksum. ✓ (proxy generation reuses الـ media pipeline الموجود)
  - المصدر: broadcast-report (ingest)، dev-roadmap (new-feature #5 Smart Ingest).

- [x] `[P2]` ⏱️M **مفردات إعلامية عربية منظمة + تقويم هجري** — أنواع البرامج/تصنيفات/أدوار + Umm al-Qura (هجري/ميلادي مزدوج).
  - ✅ تقويم هجري مُنجز (2026-06-22 wave-28): `archive-app/src/utils/hijriDate.js` يعرض `formatHijriDate` (Umm al-Qura عبر `Intl.DateTimeFormat` بـ `calendar: "islamic-umalqura"`، أرقام عربية-هندية)، `formatGregorianDate`، و`formatDualDate` (ميلادي · هجري). 6 اختبارات vitest. ربط `LiveClockBadge` في `DashboardPage` ليعرض `٠٣:٣٣ م | الاثنين، ٢٢ يونيو | ٧ محرم هـ` مع `aria-label` مُدمج للقارئ.
  - ✅ المفردات الإعلامية المنظمة (2026-06-30): `archive-app/src/utils/broadcastVocabulary.ts` — 33 نوع برنامج، 14 تصنيف نوعي، 15 دور إنتاجي، مع `getProgramTypeOptions()` / `getGenreOptions()` / `getRoleOptions()` / `getGroupedProgramTypes()`. ربط في `TypesPage.tsx` بقوالبَي إنشاء: «نشرة إخبارية» و«مقابلة تلفزيونية».
  - الملفات: `archive-app/src/utils/hijriDate.js` + `archive-app/src/utils/broadcastVocabulary.ts` + `archive-app/src/pages/TypesPage.tsx`.
  - القبول: تاريخ مزدوج معروض في الـ Dashboard؛ أنواع البرامج/الأدوار متاحة في TypesPage. ✓
  - المصدر: broadcast-report، dev-roadmap (P3-07, P3-08).

### 2. الأساس المعماري (Architecture & Foundation) — net-new

- [x] `[P0]` ⏱️L **ترحيل JWT إلى HttpOnly Cookie + refresh rotation** — استبدال تخزين التوكن في `localStorage`.
  - ✅ مُنجز (2026-06-23 wave-30، agent A): `tokenService.js` (sign/verify). POST `/api/auth/refresh` يدوّر cookie `va_refresh` (HttpOnly+Secure+SameSite=Strict). `cloudSession.js` يخزّن access token في MODULE MEMORY فقط. `createSilentRenewal` يُجدّد 60ث قبل انتهاء الصلاحية. 16 اختبار. 1043 tests green.
  - المصدر: dev-roadmap (P0-01)، ux_plan (security).

- [x] `[P0]` ⏱️L **إصلاح الوضع الفاتح (Light Mode) — جزئي** — `useTheme` + مراجعة المكوّنات بألوان داكنة ثابتة.
  - ✅ أُصلح الجزء الحرج (2026-06-21): `--va-v1-text/secondary/muted` في `:root` أُعيدت لـ semantic tokens. SessionRestoreBanner أُصلحت.
  - ✅ مُكمَّل (2026-06-21 wave-22): SettingsHubPage.jsx — كل `text-white/border-white/10/bg-white/[0.0X]/text-gray-X` → design tokens. TimelinePage.jsx — stat cards `border-white/10 bg-white/5` → tokens. باقي الملفات (gray-7/8/9 في سياق media/players) مقبولة لأنها تعلو خلفيات ملونة.
  - الملفات: `archive-app/src/**` (المكوّنات ذات الألوان الثابتة)، `design-tokens.css`.
  - القبول: التبديل للوضع الفاتح يعطي تباينات صحيحة في كل الصفحات الرئيسية (لا نص داكن على خلفية داكنة).
  - المصدر: dev-roadmap (P0-03، 53+ ملف).

- [x] `[P0]` ⏱️S **إصلاح مكوّن Switch في RTL + أهداف لمس ≥44px** — `left/right` → `start/end` المنطقي؛ توسيع مناطق اللمس.
  - ✅ مُنجز (2026-06-21): الإبهام يستخدم `end-0.5`/`start-0.5`؛ غلاف `min-h-[44px] min-w-[44px]` يوسّع منطقة اللمس.
  - الملفات: `archive-app/src/components/ui/primitives.jsx`، `BottomNav`.
  - القبول: Switch يتجه صحيحاً في RTL؛ كل هدف لمس ≥44px (WCAG 2.5.5).
  - المصدر: dev-roadmap (P0-04, P0-05).

- [x] `[P1]` ⏱️XL **i18n: استخراج النصوص + `en.js` + `fr.js`** — رفع التغطية من ~30% إلى ≥95% ودعم 3 لغات.
  - ✅ مُنجز (2026-06-24 wave-34، agent C): 97 مفتاح ترجمة (7 namespaces: actions/nav/error/status/auth/archive/confirm/backup). `en.js` و`fr.js` كاملان + i18next يُسجّلهما. 10 اختبارات parity + integration. 1155 tests green. ملاحظة: ~30+ نص مُرمَّز في DashboardPage.jsx كُشف — يحتاج جلسة مستقلة.
  - القبول: تبديل لحظي بين 3 لغات دون إعادة تحميل؛ لا سلاسل عربية مُرمّزة في المكوّنات.
  - المصدر: dev-roadmap (P0-06)، ux_plan (Sprint 3).

- [x] `[P1]` ⏱️XL **تفكيك `server.js` إلى وحدات** — تقسيم الملف الضخم إلى authRoutes/mediaRoutes/shareRoutes/backupRoutes/adminRoutes (لا ملف >400 سطر).
  - ✅ مُنجز (2026-06-23 wave-30، agent B): `archive-server/src/routes/` — 5 وحدات + barrel index. server.js تقلّص إلى middleware + mount + startup فقط.
  - المصدر: dev-roadmap (P1-01).

- [x] `[P1]` ⏱️L **تفكيك `archiveSlice` + إصلاح تسرّب الذاكرة** — استخراج شرائح (itemCrud/collection/project/media/history) + تقليم `workflowHistory`/`itemHistory`.
  - ✅ مُنجز (2026-06-22 wave-29، agent Sonnet): `archive-app/src/stores/slices/userSlice.js` (93 سطر، `addUser`/`updateUser`/`deleteUser` + `userInitialState`) و`historySlice.js` (42 سطر، `clearHistory`/`appendHistory` مع `MAX_HISTORY_ENTRIES = 500` cap FIFO). archiveSlice.js من 970 → 918 سطر. `appStore.js` وصلَ slices الجديدة قبل `archiveInitialState`. 12 اختبار جديد (9 unit + 1 stress عند 600 entry). 954/954 frontend tests green في الـ slice، ثم 993/993 بعد دمج Design System v2.
  - الملفات: `archive-app/src/**/archiveSlice*`.
  - القبول: كل شريحة ≤250 سطر؛ الذاكرة ≤150MB مع 50K عنصر.
  - المصدر: dev-roadmap (P0-08, P1-02).

- [x] `[P1]` ⏱️XL **نظام تصميم موحّد v2** — مكتبة مكوّنات أساسية (Button/Input/Card/Dialog/Badge/Switch/Tabs) تستخدم tokens حصراً + توسيع tokens (status/density/duration/skeleton).
  - ✅ شريحة 1/3 — primitives أربعة (2026-06-22 wave-29): ButtonV2/InputV2/CardV2/DialogV2. 33 اختبار.
  - ✅ شريحة 2/3 — (2026-06-23 wave-30، agent C): `BadgeV2.jsx` (5 variants، dot indicator)، `SwitchV2.jsx` (role=switch، 44px tap target، RTL logical props)، `TabsV2.jsx` (compound، keyboard nav ArrowKey/Home/End، ARIA tablist/tab/tabpanel). `design-tokens.css`: كتلة `:root` canonical لـ 14 رمز `--va-*` بقيم light+dark. 38 اختبار جديد. 1043 tests green.
  - ✅ شريحة 3/3 — (2026-06-24 wave-32، agent B): `ToastV2.jsx` (4 variants، 3 positions، CSS-only animations، role=alert، Escape dismiss)، `TooltipV2.jsx` (4 logical positions، delay 300ms، aria-describedby)، `useToast.js` hook (queue max 3، auto-dismiss)، 24 اختبار جديد. 2 call sites هُجِّرت (OcrButton + ApiKeysSettings). 1143 tests green.
  - الملفات: `archive-app/src/components/ui/*`، `archive-app/src/styles/design-tokens.css`.
  - القبول: صفر ألوان مُرمّزة في المكتبة؛ tokens الجديدة موثّقة ومستخدمة.
  - المصدر: dev-roadmap (P1-06)، ux_plan/guide_v6 (Design Tokens).

- [x] `[P1]` ⏱️L **تحسين شامل للنظام اللوني والثيم الأساسي** — مراجعة وضبط palette + tokens النص/الخلفية/الحدود + ألوان الأزرار (primary/secondary/ghost/destructive) + ألوان الحالة (success/warning/danger/info) + المخطّط الليلي/النهاري في ضوء WCAG 2.2 AA.
  - ✅ مُنجز (2026-06-23 wave-31، agent Sonnet): `archive-app/src/styles/design-tokens.css` أُعيد بناؤه كـ single source of truth — كتلة `:root` canonical بـ OKLCH مع `--va-text/-text-2/-text-muted/-text-inverse` (سلّم نصوص بـ contrast ≥7:1 و≥4.5:1 و≥3:1) + `--va-bg/-surface/-surface-2/-elevated` (دلتا إنارة منتظمة) + accent scale `--va-accent-50..950` + status colors (success/warning/danger/info) بـ `-soft/-border/-text` لكل واحد + button palette موحّد. `app-overrides.css` صُلّبت من المكرّرات (13 token متبقّية كانت TODO من DS v2 → نُقلت). `archive-app/scripts/verify-theme-contrast.mjs` (324 سطر، zero-deps OKLCH→sRGB) + `tokenContrast.test.js` (290 سطر). **24/24 pairs PASS WCAG AA** في كلا الوضعين. مع ذلك صلّحت bug عملياً: `--va-btn-primary-bg` كان accent-500 (L=65%) أي 2.82:1 على نص أبيض — حوّلتها إلى accent-700 (L=47%) لتصبح 6.41:1. 1109/1109 frontend tests pass.
  - متبقّي: هجرة `#f8fafc`/`#475569` المتبقّيين في `.jsx` (baseline 4 + 12 instances كحدّ أعلى) كشريحة تالية.
  - الملفات: `archive-app/src/styles/design-tokens.css` + `app-overrides.css` + `archive-app/scripts/verify-theme-contrast.mjs` + `__tests__/tokenContrast.test.js`.
  - القبول: كل النصوص والأزرار تجتاز WCAG 2.2 AA؛ `verify-theme-contrast.mjs` يطبع جدول passing (24/24). ✓
  - المصدر: طلب المستخدم 2026-06-23.
  - النطاق: (أ) **مراجعة contrast حقيقية** لكل token: text-on-surface (≥4.5:1 للنص العادي، ≥3:1 للكبير)، text-on-accent، text-on-status. (ب) **سلّم نصوص واضح**: `--va-text` (high) / `--va-text-2` (mid) / `--va-text-muted` (low) / `--va-text-inverse` للأسطح المُلوَّنة. (ج) **سلّم أسطح متماسك**: `--va-bg` / `--va-surface` / `--va-surface-2` / `--va-elevated` بدلتا إنارة 4%+ بين كل مستوى. (د) **palette أزرار موحّد** بصيغة OKLCH + hover/active/disabled tints بقيم نسبية لا hex by-hand. (هـ) **ألوان حالة semantic** success/warning/danger/info — مع أيقونة مرافقة (a11y: لا تعتمد على اللون وحده). (و) **نقل الـ 13 token** المرحَّلة في `app-overrides.css` إلى `design-tokens.css` (TODO من DS v2). (ز) **توثيق + اختبار contrast**: سكربت `scripts/verify-theme-contrast.mjs` يفشل إذا انخفض الـ contrast دون العتبة.
  - الملفات: `archive-app/src/styles/design-tokens.css` (الكتلة الرئيسية)، `app-overrides.css` (حذف ما انتقل)، `archive-app/src/components/ui/*V2.jsx` (التأكد من الاستهلاك)، `archive-app/scripts/verify-theme-contrast.mjs` (جديد)، `archive-app/src/styles/__tests__/tokenContrast.test.js` (جديد).
  - القبول: كل النصوص والأزرار تجتاز WCAG 2.2 AA؛ `verify-theme-contrast.mjs` يطبع جدول passing؛ لا hex مرمّز خارج tokens canonical.
  - المصدر: طلب المستخدم 2026-06-23.

- [x] `[P2]` ⏱️L **تبسيط متغيّرات البيئة 69→25** — توحيد في تكوين مركزي بقيم افتراضية ذكية.
  - ✅ مُنجز (2026-06-22 wave-29، agent Sonnet): 69 → 25 var operator-facing. `archive-server/src/config/env.js` يجمع كل قراءات `process.env` في `config` object مع validation وdefaults ذكية. 20 production source files حُوّلت من `process.env.X` إلى `import { config } from "./config/env.js"; config.x`. 5 أبرز التغييرات: (1) `CONTROL_AGENT_ACTIONS_ENABLED` → دمج في `CONTROL_AGENT_ACTIONS`؛ (2) `OPENAI_API_KEY` → fallback إلى `AI_API_KEY` عبر `config.openaiApiKey`؛ (3) 37 tuning vars (`RATE_LIMIT_*`، `BACKUP_RETENTION_*`، `SMTP_PORT/SECURE/FROM`، `SHARE_EXPIRY_DAYS`، إلخ) خُفّضت إلى defaults؛ (4) جميع `process.env` reads في 20 ملف → single boot-time evaluation؛ (5) `ARCHIVE_PDF_FONT_PATH`/`FFMPEG_PATH`/`SERVER_CONFIG_PATH`/`COMPOSE_FILE`/`APP_VERSION` أُزيلت من `.env.example` (تفاصيل تطبيق داخلية). 27 اختبار جديد لـ env config. `docs/env-migration.md` يخرّط الأسماء القديمة → الجديدة.
  - الملفات: `archive-server/src/config/*`, `.env.example`.
  - المصدر: dev-roadmap (P0-10).

### 3. محرّر المونتاج متعدد المسارات (Montage) — net-new كبير

- [x] `[P0]` ⏱️XL **خط زمني مرئي متعدد المسارات (Multi-Track Timeline)** — تحويل القائمة النصية إلى Canvas أفقي: 3 فيديو + 2 صوت + 1 عنوان، سحب/إفلات بين المسارات، نقاط تقطيع قابلة للسحب.
  - ✅ مُنجز (2026-06-21 wave-25, commit `c5fb487`): `MultiTrackTimeline.jsx` + `TimelineClip.jsx` + `TrackHeader.jsx` بواجهة @dnd-kit (PointerSensor + TouchSensor + KeyboardSensor)؛ مسارات video/audio/title/adjustment ديناميكية مع snap-to-frame، ripple modes، marker overlay، حوار حذف مسار مع نقل القصاصات. ProjectsPage يستخدم `handleTimelineCommand` لإدارة كل عمليات الخط الزمني عبر multiTrackModel. 22 اختبار unit + E2E يغطي إضافة وتسمية مسار فيديو ثانٍ.
  - الملفات: `archive-app/src/components/montage/MultiTrackTimeline.jsx`، `TimelineClip.jsx`، `TrackHeader.jsx`، `multiTrackModel.js`، `pages/ProjectsPage.jsx`.
  - القبول: ترتيب المقاطع بالسحب يعمل ويُحفظ؛ عرض البلوك = مدته.
  - المصدر: new_tail (F13)، dev-roadmap (P2-01).

- [x] `[P1]` ⏱️L **Clip Thumbnails + طبقة التعليقات الزمنية على الخط الزمني** — خلفية thumbnail لكل block + إشارات ▲ للتعليقات (`addTemporalComment` موجودة).
  - ✅ مُنجز (2026-06-21 wave-25, commit `6c1c912`): `TimelineClip` يقبل `thumbnailUrl` و`comments[]`؛ الصورة تُرسم كخلفية مغطاة مع تدرّج داكن، والتعليقات تظهر كدبابيس MessageCircle ملوّنة (أصفر مفتوح/أخضر محلول) فوق القصاصة عند موضعها الزمني. الضغط على الدبوس يُصدر `clip.comment-focus` → ProjectsPage يختار القصاصة ويقفز بـ playhead إلى `atSec`. ProjectsPage يبني `thumbnailsByItemId` من `items[].thumbnail` و`commentsByClipId` من `project.comments`.
  - الملفات: `archive-app/src/components/montage/TimelineClip.jsx`، `MultiTrackTimeline.jsx`، `MontageWorkspace.css`، `pages/ProjectsPage.jsx`.
  - القبول: thumbnail يظهر لكل مقطع؛ الضغط على إشارة يعرض التعليق.
  - المصدر: new_tail (F14, F15).

- [x] `[P1]` ⏱️L **معاينة Look/Transition** — swatches ملونة للـ looks + أزرار مرئية للـ transitions (proxy workflow يبقى مهمة خادم منفصلة).
  - ✅ مُنجز (2026-06-22 wave-27): `LOOK_SWATCHES` (5 تدرجات) + `TRANSITION_ICONS` أُضيفا في `ProjectsPage.jsx`. looks تعرض شريطاً ملوناً H-8؛ transitions انتقلت من `<select>` إلى شبكة أزرار مرئية. 933 اختبار ناجح.
  - الملفات: `archive-app/src/pages/ProjectsPage.jsx`.
  - المصدر: new_tail (F16)، dev-roadmap (P2-03).

- [x] `[P2]` ⏱️M **Media Readiness + Export Package Wizard** — عرض `buildMediaReadiness()` قبل التصدير + معالج تصدير من خطوتين (`buildProjectDeliveryPackage()` موجودة).
  - ✅ مُنجز (2026-06-24 wave-35، agent B): `MediaReadinessPanel.jsx` (readiness % + color bar + blocking issues + "تصدير على أي حال"). `ExportPackageWizard.jsx` (DialogV2، خطوتان: محتوى/صيغة، 4 formats). 12 اختبار. 1218 tests green.
  - الملفات: `archive-app/src/pages/ProjectsPage.jsx`.
  - المصدر: new_tail (F17, F18).

### 4. الأداء وإمكانية الوصول (Performance & a11y) — جزئياً net-new

- [x] `[P1]` ⏱️L **Virtual Scrolling في ArchivePage** — قوائم +1000 عنصر عبر TanStack Virtual / react-window.
  - ✅ مُنجز (2026-06-23 wave-30، agent D): `useVirtualList.js` — estimateSize/overscan/scrollKey/containerScroll، sessionStorage scroll-position save+restore. `ArchivePageResults.jsx`: list view container-scroll (72px rows، overscan 5، RTL-safe). 8 اختبار جديد. 1043 tests green.
  - المصدر: ux_plan (Sprint 4)، guide_v6 (ArchivePage).

- [x] `[P1]` ⏱️L **Lazy Loading للمكتبات الثقيلة** — Cytoscape, Recharts, pdfjs, xlsx, sql.js عبر dynamic import.
  - ✅ مُنجز (wave-22): تحقّق كامل — كل الصفحات تستخدم React.lazy()؛ Cytoscape/pdfjs/sql.js لها dynamic import مباشر؛ xlsx أُصلح (wave-22) من static import إلى dynamic import حقيقي في vendor/xlsx.js + DataCenterPage + ReportsPage. لا حاجة لمزيد من التغييرات.
  - الملفات: `archive-app/src/pages/{GraphViewPage,AnalyticsPage}.jsx`، نقاط الاستيراد.
  - القبول: لا تُحمَّل المكتبة إلا عند فتح صفحتها؛ قياس بـ rollup-plugin-visualizer.
  - المصدر: ux_plan (perf)، f45ea5a29 (GraphView lazy)، dev-roadmap (P5-01).

- [x] `[P1]` ⏱️L **تدقيق a11y شامل (WCAG 2.2 AA)** — تشغيل `vitest-axe`/`@axe-core/playwright` على كل صفحة + إصلاح focus/landmarks/labels + مراجعة التباين (4.5:1) في الوضعين.
  - ✅ مُنجز (2026-06-24 wave-34، agent A): `pages.a11y.test.jsx` — 37 assertions جديدة (ButtonV2/InputV2/BadgeV2/CardV2/SwitchV2/TabsV2/DialogV2/ToastV2/TooltipV2 + 3 صفحات). إصلاح: SwitchV2 — `aria-labelledby` مفقود أُضيف. 58 إجمالي axe assertions. 1192 tests green.
  - الملفات: `archive-app/src/**`، توسيع `components.a11y.test.jsx`.
  - القبول: Lighthouse Accessibility ≥95؛ صفر مخالفات axe حرجة.
  - المصدر: ux_plan (Sprint 4, a11y)، guide_v6 (KPIs).

- [x] `[P1]` ⏱️L **مراجعة RTL Logical Properties شاملة** — استبدال `margin/padding-left/right` بـ `*-inline-start/end`؛ `dir="ltr"` للـ URLs/المسارات/التواريخ؛ أيقونات الاتجاه تتبع RTL.
  - ✅ مُنجز (2026-06-24 wave-34، agent B): 36 تحويل في 14 ملف (primitives، ActivityTimeline، ShellParts، ArchiveToolbar، ExportButton، ArchiveViews، إلخ). استثناءات: وسائط/lightbox/FABs. 1192 tests green.
  - الملفات: `archive-app/src/**`.
  - القبول: ESLint rule مخصصة تمنع الخصائص الفيزيائية؛ صفر مخالفات.
  - المصدر: ux_plan (Sprint 3).

### 5. إعادة هيكلة الإعدادات والتنقّل — جزئياً net-new

- [x] `[P1]` ⏱️L **تبويب «Cloud Control» موحّد في الإعدادات** — تجميع DatabaseSettings + FileStoreSettings + Health Dashboard في تبويب واحد بمؤشرات حالة حية.
  - ✅ مُنجز (2026-06-21): `CloudControlTab.jsx` جديد يضم HealthDashboard (server/DB/storage status pills) + DatabaseSettings + FileStoreSettings. تبويب "cloud" مضاف في `settingsTabs.js`. LocalModeCard يظهر في الوضع المحلي.
  - الحالة: لا مكوّن `CloudControl` (تم التحقق) — جديد. يُبنى فوق `DatabaseSettings`/`FileStoreSettings` الموجودين.
  - الملفات: `archive-app/src/features/settings/CloudControlTab.jsx` (جديد)، `pages/SettingsPage.jsx`.
  - القبول: في وضع Cloud يعرض حالة DB/Storage/JWT/Redis/CORS حيّة؛ في وضع local يعرض `LocalModeCard`.
  - المصدر: guide_v6 (§3 Cloud Settings).

### 6. تحسينات الصفحات والميزات (Per-Page UX) — تحقّق ثم نفّذ net-new

- [x] `[P1]` ⏱️M **AI Auto-fill عند URL/رفع + Step Preview Header + Save & Add Another** — اقتراح العنوان/الوسوم/النوع/التاريخ تلقائياً (`useAiAssist`/`AiAssistBar` موجودان) + عرض عدد حقول النوع قبل الدخول + زر حفظ-وإضافة.
  - ✅ مُنجز (2026-06-21): "حفظ وإضافة آخر" كان موجوداً. Step Preview Header: `stepsWithDetail` memoized يُحدّث تفصيل خطوة الحقول بالعدد الفعلي (مثل «4 حقل (2 مطلوب)»). AiAssistBar موجودة ومفعّلة.
  - الملفات: `archive-app/src/pages/AddVideoPage.jsx`.
  - المصدر: new_tail (F1, F3, F4).

- [x] `[P2]` ⏱️M **Inline Review Edit** — تعديل مباشر لكل حقل في خطوة المراجعة دون العودة للخطوات.
  - ✅ مُنجز (2026-06-21 wave-22): كل بطاقة في خطوة المراجعة في AddVideoPage تحتوي زر «تعديل» يقفز مباشرة للخطوة المناسبة (الأساسيات=0، التصنيف=1، الحقول=2) عبر setStepIndex.
  - المصدر: new_tail (F2).

- [x] `[P1]` ⏱️M **Type Impact Preview + Type Template Gallery** — عرض `analyzeTypeImpact()` قبل الحفظ + قوالب أنواع جاهزة (تقرير/مقابلة/لقطة خام/مادة أرشيفية).
  - ✅ مُنجز (2026-06-21 wave-23): أُضيفت قوالب «تقرير» و«لقطة خام» و«مادة أرشيفية» إلى TYPE_CREATION_TEMPLATES (8 قوالب الآن). TypeEditor — خطوة المراجعة تعرض لوحة «تأثير التعديل» عند تعديل نوع موجود: عدد المواد المتأثرة + الحقول المضافة/المحذوفة + 3 عينات.
  - الملفات: `archive-app/src/pages/TypesPage.jsx`.
  - المصدر: new_tail (F6, F7).

- [x] `[P1]` ⏱️M **Workflow Pipeline Bar + Transition Reason + Due Dates** — شريط أعداد الحالات (فلتر فوري) + نموذج تأكيد الانتقال مع سبب وتاريخ استحقاق.
  - ✅ مُنجز (2026-06-21): `WorkflowPipelineBar` مضاف في ArchivePage — يعرض أعداد الحالات مع فلترة فورية بالنقر.
  - ✅ مُكمَّل (2026-06-21 wave-23): `StatusTransitionMenu` — تدفق تأكيد من خطوتين: اختيار الحالة → نموذج مصغر بحقل «سبب التغيير» (اختياري، 500 حرف) وحقل «تاريخ الاستحقاق» (اختياري) → زر تأكيد. الحقلان يُرسَلان في POST /api/workflow/transition (note + dueDate) التي يدعمها الخادم فعلاً.
  - الملفات: `archive-app/src/pages/{ArchivePage,DetailPage}.jsx`، `itemStatus.js`.
  - المصدر: new_tail (F10, F11, F12).

- [x] `[P2]` ⏱️M **Completeness Column** — عمود اكتمال اختياري في جدول الأرشيف.
  - ✅ مُنجز (2026-06-21 wave-22): عمود «الاكتمال» أُضيف في tableColumns.js (default=false) مع renderer في ArchiveViews.jsx — شريط تقدم ملون + نسبة مئوية. يُفعَّل من قائمة الأعمدة.
  - Batch Fix + Inline Cell Editing + Saved Views — لا تزال مطلوبة.

- [x] `[P2]` ⏱️M **Batch Fix + Inline Cell Editing + Saved Views persistence** — إصلاح بالجملة + تحرير داخل الجدول + حفظ عرض الأعمدة/الفرز.
  - ✅ مُنجز (2026-06-24 wave-35، agent A): `BatchFixToolbar.jsx` (3 dropdowns: حالة/نوع/فرع، updateVideoItem بالجملة، showToast). `useSavedViews.js` (localStorage، cap 20، save/delete). 13 اختبار. 1206 tests green.
  - الملفات: `archive-app/src/features/archive/*`, `tableColumns.js`, `InlineCellEditor.jsx`.
  - المصدر: new_tail (F21)، guide_v6 (ArchivePage).

- [x] `[P1]` ⏱️M **Instant Search (debounce 150ms) + Query Suggestions + Filter Panel** — نتائج فورية أثناء الكتابة + اقتراحات + لوحة فلاتر قابلة للطي.
  - ✅ مُنجز (2026-06-21 wave-23): `debouncedQuery` 150ms؛ `SearchInputWithSuggestions` يعرض 7 اقتراحات؛ زر «فلاتر» مع شارة عدد الفلاتر النشطة يُفتح/يُغلق لوحة الفلاتر بحركة انزلاق — تضم النوع/الفرع/التاريخ/المفضلة/حقول ناقصة/الكثافة.
  - الملفات: `archive-app/src/pages/SearchPage.jsx`.
  - المصدر: guide_v6 (SearchPage)، ux_plan (S2).

- [x] `[P2]` ⏱️S **Dashboard: Today's Digest** — بطاقة «اكتشاف اليوم» تعرض ٣ مواد منسيّة من `buildDiscoverySections()` (forgotten section, daily seed). أُضيفت لوحة جديدة `todaysDigest` في `DashboardPage.jsx`.
  - ✅ مُنجز (2026-06-21 wave-24): import + useMemo + CommandPanel + DASHBOARD_PANEL_TITLES. تمرير `pnpm verify:app` + 925 اختبار vitest أخضر.
  - المصدر: sessions_new (F15)، f45ea5a29 (DiscoverPage).

- [x] `[P2]` ⏱️M **AnalyticsPage: Time Range Picker + Export CSV** — فلتر زمني موحّد يؤثر على كل الرسوم + تصدير.
  - ✅ مُنجز (2026-06-21): فلتر (30 يوم/90 يوم/سنة/الكل) يُصفّي videoItems قبل buildArchiveAnalytics. زر تصدير CSV يُنزّل العناصر المُصفّاة. Bento Grid لا يزال مطلوباً.
  - الملفات: `archive-app/src/pages/AnalyticsPage.jsx`.
  - المصدر: guide_v6 (#8)، f45ea5a29 (Analytics).

### 22. تبسيط جذري لتجربة الإطلاق + Setup.bat (طلب المستخدم 2026-06-21)

- [x] `[P0]` ⏱️M **شاشة هبوط بخيارين فقط (Boot Choice)** — تعرض «بدء سريع» و«إعداد متقدم» قبل أي معالج. «بدء سريع» يطبّق الإعدادات الافتراضية بنقرة واحدة: حساب admin افتراضي + قاعدة بيانات محلية + تخزين محلي + ثيم النظام، ثم يدخل للوحة التحكم مباشرة. «إعداد متقدم» يفتح `V1OnboardingWizard` الحالي بكل خطواته.
  - ✅ مُنجز (2026-06-21 wave-25, commit `738c469`): `BootChoiceScreen.jsx` (130 سطر) يعرض بطاقتين فقط مع رمز Rocket/Cog. «بدء سريع» يستدعي `skipPasswordSetup` + يسجّل دخول admin + يحدّث `settings.ui.bootChoice="quick"` + `onboardingCompleted=true`. RuntimeShellApp يحرس بـ `bootChoice || v1OnboardingCompleted` فلا يعيد عرض الشاشة. تم تأكيد البصري حياً: شاشة الخيارين تظهر على state نظيف، الضغط على بدء سريع يدخل #/dashboard مع الشريط الجانبي. 933 اختبار ناجح (+2 جديدة).
  - الملفات: `archive-app/src/features/onboarding/BootChoiceScreen.jsx`، `BootChoiceScreen.test.jsx`، `index.js`، `archive-app/src/app/RuntimeShellApp.js`.
  - القبول: عند فتح التطبيق لأول مرة تظهر شاشة الخيارين فقط؛ زر «بدء سريع» يكمل التهيئة دون أي خطوة إضافية ويصل للداشبورد؛ زر «إعداد متقدم» يظهر الويزارد الحالي كما هو.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️M **معالج «جولة الميزات» واحد قابل للتجاهل ولإعادة التشغيل** — دمج `UsageOnboarding` + الجولات الموزّعة + خطوات `ONBOARDING_STEPS` الثانوية في معالج واحد يعرض الميزات الأساسية في 4 شرائح.
  - ✅ مُنجز (2026-06-22 wave-26): `V1ProductTour` في `ShellParts.jsx` أُعيد بناؤه بـ `createFeatureTourSlides()` — 4 شرائح (الواجهة + الأرشيف + الاختصارات + الذكاء الاصطناعي). الشريحة 1 تعرض `CORE_UI_TOUR_ITEMS`؛ الشريحة 3 تعرض `ONBOARDING_SHORTCUTS` بـ kbd pills. مؤشر نقاط ملاحية قابل للنقر؛ زر «تخطّى نهائياً» صريح. 933 اختبار ناجح.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️S **زر «شغّل جولة الميزات» في صفحة المساعدة** — إضافة بطاقة في `HelpPage` تُطلق `FeatureTour` في أي وقت عبر `window.dispatchEvent("videoarchive:onboarding-open", { mode: "replay" })`.
  - ✅ مُنجز (2026-06-21 wave-25): زر «إعادة الجولة» الموجود في `HelpPage` كان يُصفّر علامات `v1TourCompleted` فقط دون فتح أي معالج؛ الآن يطلق أيضاً حدث `videoarchive:onboarding-open` بـ `mode: "replay"` (يستقبله `RuntimeShellApp:268-270` ويفتح `V1OnboardingWizard` في وضع التشغيل المتأخر).
  - الملفات: `archive-app/src/pages/HelpPage.jsx:495-500`.
  - القبول: المستخدم يستطيع إعادة عرض الجولة من المساعدة بنقرة واحدة.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P2]` ⏱️M **نقل الخطوات الثانوية إلى صفحة المساعدة كمواضيع** — مواضيع «التخزين»، «الواجهة»، «الحماية»، «المظهر»، «البيانات» كأقسام قابلة للبحث.
  - ✅ مُنجز (2026-06-22 wave-27): 5 أقسام جديدة في `createHelpSections()`: `storage-setup`، `security-guide`، `interface-guide`، `appearance-guide`، `data-guide` — كل قسم له عنوان + أيقونة + `searchText` + `InfoGrid` تفصيلي. تظهر في القائمة الجانبية وقابلة للبحث. 933 اختبار ناجح.
  - الملفات: `archive-app/src/pages/HelpPage.jsx`.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️M **تحسين `setup.bat`/`control-center.mjs` — أوامر مختصرة + مساعدة موسّعة + تشخيص أولي**
  - ✅ مُنجز (2026-06-22 wave-26): `quick` (deploy+start+health)، `doctor` (Node/pnpm/Docker/port check مع تقرير ملوّن)، `help` موسّعة بكل الأوامر + أمثلة. القائمة التفاعلية أُضيف لها قسم «Quick Actions» مع [q] و[d].
  - ✅ إضافات (2026-06-22 wave-27): (أ) `preflightSummary()` يعمل تلقائياً عند فتح القائمة التفاعلية ويعرض حالة Node/pnpm/Docker/.env بسطر واحد، ويُبلّغ عن المشاكل بأسطر `- ...` مع الإحالة لـ `doctor` للتفاصيل الكاملة. (ب) `help` صار يطبع قسم «Quick-start examples»، شبكة الأوامر، قسم «Troubleshooting» بثلاث وصفات (stack not running / no .env / port in use)، ثم قائمة القائمة التفاعلية كاملة. صلّحت اختبار `control-center.test.mjs` الذي كان فاشلاً مسبقاً (يفترض أن `help` يتضمّن أقسام المنيو).
  - ✅ إصلاح تشغيل setup الحالي (2026-06-28): صُلّح فحص `pnpm` على Windows حتى لا يفشل `doctor` كذباً، وصارت أوامر `status/start/health/migrate-status/diagnostics` تعيد exit code حقيقياً إلى `setup.bat`. صار `health` يفحص endpoint المستخدم الصحيح في وضع Postgres المحلي `http://127.0.0.1:8080/api/health` بدلاً من منفذ الخادم الداخلي غير المنشور `8787`، وصارت أوامر Prisma المحلية تستخدم `127.0.0.1:15432` بدلاً من hostname الداخلي `postgres:5432`. أُصلحت قراءة `.env` حتى لا تظهر التعليقات inline كقيم.
  - الملفات: `scripts/control-center.mjs`.
  - المصدر: طلب المستخدم 2026-06-21، 2026-06-22.

- [x] `[P1]` ⏱️S **التحقق من تحميل تلقائي لإعدادات SQL/PocketBase في «الإعداد المتقدم»** — التحقق أن المعالج المتقدم يكشف `.env` ويستخدم القيم الموجودة بنقرة واحدة.
  - ✅ مُنجز مسبقاً (موجة سابقة): `V1OnboardingWizard.jsx:299-310` يستدعي `/api/setup/preset-config` عند الفتح ويخزّن `presetConfig`. عند توفّر إعداد كامل يُعرض `PresetConfigScreen` (الأسطر 1211–1240) يظهر backend/DATABASE_URL/ADMIN_EMAIL/JWT_SECRET/dbReachable مع زر «استخدام الإعدادات المكتشفة» يكمل الإعداد بنقرة واحدة. يدعم postgres وpocketbase معاً (`createPresetFormState`).
  - الملفات: `archive-app/src/features/onboarding/V1OnboardingWizard.jsx`، `PresetConfigScreen.jsx`، `archive-server/src/index.js` (نقطة `/api/setup/preset-config`).
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️M **وضع «بسيط/متقدم» داخل المعالج المتقدم** — تبسيط معالج الإعداد المتقدم بحيث يبدأ في «بسيط» (3 خطوات: backend + admin + start) ويوفّر زر «المزيد من الخيارات» يكشف الخطوات المتقدمة (file-store، appearance، interface، shortcuts، data، server update policy). يحفظ التفضيل في `settings.ui.advancedSetupMode`.
  - ✅ مُنجز (2026-06-21 wave-25): `flow.js` يحمل الآن `tier: "basic" | "advanced"` على كل خطوة (basic = `storage`, `admin`, `first-task`). `V1OnboardingWizard` يقرأ `settings.ui.advancedSetupMode` (افتراضي `basic`)، يفلتر الخطوات بـ tier، ويفرض `securityMode="secure"` في الوضع البسيط ليبقى `admin` ضمن الفلتر. أُضيف زر «المزيد من الخيارات»/«إخفاء الخيارات المتقدمة» في footer الـ wizard (`aria-pressed`)؛ التبديل لا يعيد بدء المعالج بل يوسّع/يطوي قائمة الخطوات فوراً ويُحفظ في `settings.ui.advancedSetupMode`.
  - الملفات: `archive-app/src/features/onboarding/V1OnboardingWizard.jsx` (state + filter + toggle + persist)، `archive-app/src/features/onboarding/flow.js` (وسم `tier` على `ONBOARDING_STEPS`).
  - القبول: في الوضع «بسيط» يظهر 3 خطوات فقط (storage → admin → first-task)؛ النقر على «المزيد» يكشف الباقي دون إعادة بدء المعالج.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P2]` ⏱️S **بطاقة الساعة والتاريخ في الشاشة الرئيسية** — إضافة بطاقة حية تعرض الوقت (HH:MM) والتاريخ بالأرقام العربية (السنة الميلادية) داخل hero لوحة التحكم، تُحدّث على حدود الدقيقة فقط.
  - ✅ مُنجز (2026-06-21 wave-25): `DashboardPage.jsx` يضم الآن `LiveClockBadge` (helper موضعي) يعرض `Clock3` + الوقت + اليوم/الشهر بصيغة `ar-EG-u-nu-arab`. مُجدول على حدود الدقيقة عبر `setTimeout` متجدد فلا تتسبب الساعة بإيقاظ React كل ثانية. مدمج بجانب زر «إضافة فيديو» في الـ hero مع `aria-label` مدمج للوقت والتاريخ.
  - الملفات: `archive-app/src/pages/DashboardPage.jsx` (`LiveClockBadge` + إدماج في hero).
  - القبول: عند فتح لوحة التحكم يظهر الوقت والتاريخ الحاليان بشكل واضح؛ الوقت يتقدّم على حدود الدقيقة دون عناء render مستمر.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️M **تحسين تصميم صفحات تسجيل الدخول والخروج** — a11y + أهداف لمس.
  - ✅ مُنجز (2026-06-22 wave-26): `LoginScreen` و`LockScreen` و`ForceChangePasswordDialog` في `ShellParts.jsx`: أزرار الإرسال → `min-h-[44px]`؛ رسائل الخطأ → `role="alert" aria-live="assertive"`؛ زر «البدء السريع» → `min-h-[44px]`. Design tokens موجودة مسبقاً. 933 اختبار ناجح.
  - الملفات: `archive-app/src/app/shell/ShellParts.jsx`.
  - المصدر: طلب المستخدم 2026-06-21.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P2]` ⏱️S **تنبيه «غير متصل بالإنترنت» قابل للإغلاق + اعتبار وضع local/local-SQL أونلاين** — حالياً `OfflineBanner.jsx` يعرض شريطاً ثابتاً معتمداً فقط على `navigator.onLine` ولا يمكن إخفاؤه؛ هذا يربك في الوضع المحلي (`backendChoice === "local"` أو `localEngine === "sqlite"`) حيث التطبيق يعمل بكامل وظائفه دون إنترنت أصلاً.
  - ✅ مُنجز (2026-06-22 wave-26): `connectivityProbe.js` أضاف `isLocalBackend()` يرجع `true` عندما يكون `getBackendChoice() === "local"`؛ `probeConnectivity` يرجع `true` فوراً في هذا الوضع، و`useConnectivity` يتخطّى الـ interval ويُعيد `{ isOnline: true, isLocalBackend: true }`. `OfflineBanner.jsx` (الفعلي تحت `components/offline/`) يقرأ الآن `isLocalBackend` + `settings.ui.offlineBannerDismissed`، ويُضمّن زر إغلاق `X` + زر «لا تظهر مجدداً» في الشريط العلوي. المنطق الجديد: إذا كان الوضع محلي والطابور فارغ → لا شريط؛ إذا كان أوفلاين والطابور فارغ والمستخدم أغلقه → لا شريط؛ خلاف ذلك يظهر مع أزرار الإغلاق.
  - الملفات: `archive-app/src/features/offline/connectivityProbe.js` (export `isLocalBackend` + short-circuit في `probeConnectivity` و`useConnectivity`)، `archive-app/src/components/offline/OfflineBanner.jsx` (state إغلاق للجلسة + قراءة/كتابة `settings.ui.offlineBannerDismissed` + زرّا الإغلاق).
  - القبول: في الوضع المحلي لا يظهر شريط «غير متصل» أبداً حتى عند فصل الواي-فاي؛ في الخوادم البعيدة يظهر مع زر إغلاق يحترم إعداد المستخدم؛ تغيير الـ backend في وقت التشغيل يُحدّث التقييم فوراً.
  - المصدر: طلب المستخدم 2026-06-22.

- [x] `[P0]` ⏱️S **إصلاح: «تذكر الجلسة على هذا الجهاز» لا يحفظ بيانات الدخول** — خانة «تذكر الجلسة» في `LoginScreen` كانت لا تُبقي المستخدم مسجَّلاً بعد إعادة التحميل في حالتين فعليّتين: (أ) مسار الخادم السحابي (postgres/pocketbase/firebase) كان يحذف `SESSION_KEY` بشكل غير مشروط بعد signIn، ولا يُكتب أي مرجع، و`initAuth` ليس لديه أي فرع لاستعادة جلسة سحابية → المستخدم السحابي يُسجَّل خروجه بعد كل reload رغم تفعيل الخانة. (ب) المسار المحلي كان يكتب `SESSION_KEY` بعد `await updateUser(...)` ضد IndexedDB، فإذا فشلت كتابة قاعدة البيانات (quota، transaction abort) فقدنا الـ session مع أن المصادقة نجحت.
  - ✅ مُنجز (2026-06-22 wave-27): (أ) `authSlice.js` في فرع السحابي يكتب الآن علامة `cloud:<userId>:<expiresAt>` في `SESSION_KEY` عندما `rememberMe=true`، ويحذفها عندما `false`. `initAuth` صار يفهم العلامة `cloud` ويستدعي `getSessionProvider().getCurrentUser()` + `getToken()` لإعادة بناء `currentUser` على reload. (ب) في الفرع المحلي قدّمت كتابة `SESSION_KEY` قبل `await updateUser(...)` وغلّفت تحديث المستخدم في `try/catch` فلا تكسر فشلات قاعدة البيانات «تذكر الجلسة» بعد الآن.
  - الملفات: `archive-app/src/stores/slices/authSlice.js` (initAuth: فرع cloud؛ login: cloud branch يحترم rememberMe + local branch يقدّم كتابة الجلسة)، `archive-app/src/stores/slices/authSlice.remember.test.js` (7 اختبارات regression جديدة).
  - القبول: 7 اختبارات vitest تغطّي: SESSION_KEY يُكتَب في الوضع المحلي مع rememberMe=true، يُحذف مع false، يبقى محفوظاً حتى عند فشل updateUser، الفرع السحابي يكتب علامة "cloud" مع rememberMe=true ويحذف مع false، initAuth يستعيد المستخدم السحابي من SessionProvider، ويُنظّف العلامة عند انقطاع الجلسة السحابية. اختبارات المشروع الكاملة: 945 ناجحة (كان 938).
  - المصدر: طلب المستخدم 2026-06-22.


### 5. ترحيل معماري إلى Laravel API + Next.js — سجل الشرائح المنجزة

> نُقلت من بند §5 في `TASKS.md` بعد إنجازها؛ بقي في TASKS فقط 5e.2-cutover (إشرافي) + تحقّق حيّ مؤجَّل.

  - شريحة 0 — قرار معماري: Laravel مسؤول عن Auth/Policies/Queues/Files/Media jobs/REST API، وNext.js مسؤول عن الواجهة، SSR/ISR للصفحات العامة، وclient app للصفحات التشغيلية الثقيلة. حفظ القرار في `docs/laravel-nextjs-migration-plan.md`.
  - شريحة 1 — عقد API قبل النقل: تثبيت OpenAPI/JSON contract للكيانات الحالية (`items`, `types`, `folders`, `rights`, `files`, `auth`) حتى يمكن تشغيل Next.js فوق الخادم الحالي ثم Laravel لاحقاً.
  - شريحة 2 — Next.js shell: إنشاء حزمة `archive-next` لاحقاً بـ TypeScript، App Router، RTL، design tokens الحالية، وتوجيه تدريجي يبدأ بصفحات عامة/مساعدة/تقارير قبل صفحات العمل الثقيلة.
  - ✅ شريحة 1/4 — عقود API (2026-06-27): أُضيف `docs/api/archive-contract.openapi.json` بعقد OpenAPI 3.1 يغطي health/auth/records/search/files/folders/rights/share، مع `docs/api/README.md` وبوابة `pnpm run verify:api-contracts`.
  - ✅ شريحة 2/4 — Next.js shell أولي (2026-06-27): أُضيفت حزمة workspace `archive-next` باسم `@archive/next` مع Next.js 16، TypeScript، App Router، صفحة RTL عربية تقرأ عقد API، وسكربتات `dev:next`/`build:next`/`typecheck:next`. مرّت `pnpm run typecheck`, `pnpm run build:next`, `pnpm run verify:api-contracts`, و`pnpm run build:spa`.
  - ✅ شريحة 2b — Next.js API client أولي (2026-06-27): أُضيف `archive-next/lib/archive-api.ts` بعميل typed خفيف لـ health/me/search/rights/share مبني على عقد API، واستُخدم في الصفحة الرئيسية. مرّت `pnpm run typecheck` و`pnpm run build:next`.
  - شريحة 3 — Laravel API: إنشاء `archive-laravel` لاحقاً مع Sanctum أو session cookies، migrations مطابقة للـ Prisma schema، queues للمعالجة الثقيلة، وطبقة file storage متوافقة مع التخزين المحلي/S3.
  - ✅ شريحة 3/4 — Laravel scaffold أولي (2026-06-27): أُنشئ `archive-laravel` عبر Composer داخل Docker بـ Laravel 13، وأُضيفت routes أولية `/api/v1/health` و`/api/v1/public/openapi.json` تقرأ العقد المشترك، مع اختبار Feature. مرّ `docker run --rm -v "D:\archiveaq\Arch_App:/app" -w /app/archive-laravel composer:latest php artisan test` بنتيجة 4 اختبارات و21 assertion.
  - ✅ شريحة 3b — Laravel schema أساس (2026-06-27): أُضيف migration لـ `storage_rows` و`rights_records` مطابق كبداية لعقد records/rights، مع اختبار `ArchiveSchemaTest`. مرّت Laravel tests بنتيجة 5 اختبارات و37 assertion.
  - ✅ شريحة 3c — Laravel rights API (2026-06-27): أُضيفت endpoints `GET/POST /api/v1/rights`, `GET /api/v1/rights/expiring`, و`GET /api/v1/rights/{itemId}/enforcement` فوق `rights_records`، مع upsert يحافظ على معرف السجل واختبارات Feature. مرّت `php artisan test` داخل Docker بنتيجة 8 اختبارات و54 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3d — Laravel API key guard (2026-06-27): أُضيف middleware `archive.api_key` يحمي route group الحقوق عبر `X-Archive-Api-Key` أو Bearer token، مع `ARCHIVE_API_KEY` في `.env.example` واختبارات رفض الطلبات غير الموثقة/غير المضبوطة. مرّت Laravel tests بنتيجة 10 اختبارات و58 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3e — Laravel records compatibility API (2026-06-27): أُضيف `GET /api/v1/records` مع cursor pagination و`POST /api/v1/records/bulk` فوق جدول `storage_rows`، مع حفظ الحقول المرنة كما يطلب عقد `ArchiveRecord` واختبارات Feature للـ bulk/list/auth/validation. مرّت Laravel tests بنتيجة 13 اختباراً و75 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3f — Laravel search API (2026-06-27): أُضيف `GET /api/v1/search` كبحث keyword مبدئي فوق `storage_rows` مع filter للمتجر، cursor pagination، وfacets توضّح `keyword`/`keyword-fallback` لحين semantic search. استُخرج `StorageRowPayload` لتوحيد تنسيق records/search. مرّت Laravel tests بنتيجة 16 اختباراً و91 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3g — Laravel files/browser API (2026-06-27): أُضيف `GET /api/v1/files` و`GET /api/v1/files/browser` فوق `ARCHIVE_FILE_ROOT` مع listing آمن، query filter، منع path traversal، واختبارات Feature. مرّت Laravel tests بنتيجة 20 اختباراً و104 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3h — Laravel public share API (2026-06-27): أُضيف جدول `share_links` و`POST /api/v1/share` المحمي و`GET /api/v1/share/{token}` العام، مع scope itemIds، permission، expiresAt، password hash اختياري، وإرجاع records من `storage_rows`. مرّت Laravel tests بنتيجة 23 اختباراً و121 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3i — Laravel audit log أساس (2026-06-27): أُضيف جدول `audit_logs` وmiddleware `archive.audit` لتسجيل الطلبات المعدِّلة داخل route group المحمي، مع action/status/metadata/ip/user-agent واختبارات Feature. مرّت Laravel tests بنتيجة 25 اختباراً و125 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3i.2 — Laravel audit taxonomy (2026-06-27): وُسّع `audit_logs` بحقول `event`, `resource_type`, `resource_id`, `actor_id`, و`outcome` مع classifier لمسارات records/rights/share/auth logout، وبقي `action` للتوافق. مرّت Laravel tests بنتيجة 29 اختباراً و180 assertion.
  - ✅ شريحة 3j — Laravel HttpOnly session auth (2026-06-27): أُضيف جدول `api_sessions` و`AuthController` لمسارات `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/refresh`, و`POST /api/v1/auth/logout` مع access Bearer token وrefresh cookie باسم `va_refresh`، ودوران refresh token، وإلغاء الجلسة عند logout. استُبدل الحارس المؤقت بـ `archive.auth` الذي يقبل Bearer/HttpOnly cookie ويبقي `X-Archive-Api-Key` كfallback داخلي للهجرة فقط. مرّت Laravel tests بنتيجة 29 اختباراً و150 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3k — إزالة API-key fallback (2026-06-27): حُذف `ARCHIVE_API_KEY` وmiddleware القديم، وصار `archive.auth` يعتمد فقط على Bearer access token أو `va_refresh` cookie. حُوّلت اختبارات Laravel المحمية إلى trait مشترك ينشئ جلسة Auth حقيقية بدلاً من `X-Archive-Api-Key`. مرّت Laravel tests بنتيجة 28 اختباراً و176 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3l — Laravel queue-backed media workflow أساس (2026-06-27): أُضيف عقد OpenAPI لمسارات media، وجدول `media_jobs`، و`POST /api/v1/media/jobs` لإنشاء workflow محمي، و`GET /api/v1/media/jobs/{id}` لقراءة الحالة، وJob باسم `ProcessMediaWorkflow` يؤسس lifecycle من queued إلى processing/completed كحد queue أولي قبل المعالجات الفعلية. مرّ `pnpm run verify:api-contracts` وLaravel tests بنتيجة 32 اختباراً و194 assertion.
  - ✅ شريحة 4a — Next.js Playwright smoke (2026-06-27): أُضيف `pnpm run e2e:next` لاستخدام Playwright الموجود في `archive-app` ضد `E2E_BASE_URL`، مع اختبار `next-migration-shell.spec.ts` يتحقق من RTL shell، الشعار، وعرض حالة عقد API على desktop/mobile. مرّ `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8944 pnpm run e2e:next` بنتيجة 2 passed.
  - ✅ شريحة 4b — Next.js auth client parity (2026-06-27): وُسّع `archive-next/lib/archive-api.ts` بعميل typed لمسارات `login/me/refresh/logout`، مع `credentials: "include"`، ودعم Bearer access token اختياري لبقية الطلبات المحمية، وتحديث صفحة shell/smoke test لعرض جاهزية Auth. مرّ `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8961 pnpm run e2e:next` بنتيجة 2 passed.
  - ✅ شريحة 4c — Next.js login route (2026-06-27): أُضيف `/login` كأول شاشة Auth فعلية في `archive-next` تستخدم `createArchiveApiClient().login()`، تعرض حالة success/error، وتحافظ على access token في state محلي بينما يعتمد refresh على cookie HttpOnly. وُسّع smoke test لزيارة `/login`. مرّ `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8970 pnpm run e2e:next` بنتيجة 4 passed.
  - ✅ شريحة 4d — Next.js public share route (2026-06-27): أُضيف `/share/[token]` كأول مسار عام منخفض المخاطر في `archive-next`، يستخدم `createArchiveApiClient().share()` ويعرض حالة loading/error/records دون تحويل المرور الإنتاجي بعد. وُسّع smoke test لزيارة `/share/demo-token` على desktop/mobile. مرّ `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8978 pnpm run e2e:next` بنتيجة 6 passed.
  - ✅ شريحة 4e — Next.js/Laravel route integration smoke (2026-06-27): أُضيف rewrite في `archive-next/next.config.mjs` يمرر `/api/v1/*` إلى `ARCHIVE_API_BASE_URL`، وSeeder ثابت `NextIntegrationSeeder`، وسكربت `pnpm run e2e:next:integration` الذي يتحقق أن `/share/[token]` في Next يعرض record قادماً من Laravel حي. مرّت `pnpm run typecheck:next`, `pnpm run verify:api-contracts`, `pnpm run build:next`, و`pnpm run e2e:next:integration` بنتيجة 2 passed، كما مرّت Laravel tests بنتيجة 28 اختباراً و176 assertion.
  - ✅ شريحة 4f — إكمال سطح Next.js كواجهة TypeScript فوق Laravel backend (2026-06-29): أُضيفت مسارات `/help`, `/reports`, `/settings`, و`/media/jobs` داخل `archive-next` كمسارات App Router مكتوبة بـ TS/TSX. يعرض `/media/jobs` حالة jobs عبر عميل `mediaJob()` typed ضد `/api/v1/media/jobs/:id`، بينما يبقى إنشاء jobs ومعالجتها والـ queues داخل Laravel. صفحة Next الرئيسية تعرض الآن تنقلاً صريحاً لمسارات Next المنقولة. مرّت `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8993 pnpm run e2e:next` بنتيجة 14 passed.
  - شريحة 4 — تشغيل متوازٍ: إبقاء Vite/React الحالي إلى أن تمر Playwright smoke على Next.js، ثم نقل صفحة بصفحة مع بوابة `typecheck`, `build`, وE2E.
  - **خطة التنفيذ القادمة (شرائح عمودية، Laravel يقود عند نقص endpoint، Next يتبع، ثم بوابة قطع):**
    - [x] شريحة 5a — صفحة Next لقائمة الأرشيف + البحث فوق `search` الموجود في Laravel: مسار `/archive` بـ App Router، حقل بحث، شبكة سجلات typed عبر `createArchiveApiClient().search()`، حالات loading/error/empty، RTL. بوابة: `typecheck:next` + `build:next` + smoke في `e2e:next`.
    - [x] شريحة 5b — صفحة Next للتفاصيل `/archive/[id]` تعرض سجلاً واحداً + حقوقه عبر `rights()`؛ أُضيف `record(id)` للعميل. ‼️ **فجوة parity:** `GET /records/{id}` غير موجود في Laravel (موجود `/records` list + `/records/bulk` فقط) — يُضاف ضمن 5d/5e قبل القطع، والصفحة تتعامل مع `ok:false` بسلاسة حالياً.
    - [x] شريحة 5c — صفحة Next `/files` (تصفّح + إنشاء مشاركة) فوق `files`/`share`؛ أُضيف `files()`/`createShare()` و`ArchiveFile` للعميل. ‼️ **فجوات حقول** للتسوية عند القطع: Laravel يرسل `lastModified` (الواجهة تتوقع `modifiedAt`) و`shareUrl` (الواجهة تتوقع `url`)، و`POST /share` يتوقع `scope:{itemIds}`.
    - [x] شريحة 5d-prep — أُضيف `GET /records/{id}` في Laravel (`store` اختياري، يبحث عبر المتاجر عند غيابه) + إدخاله في العقد + 3 اختبارات Feature. بوابة خضراء: 36 اختبار Laravel + `verify:api-contracts`. (يتبقّى تسوية أسماء حقول files/share — تُحسم في 5e عند القطع.)
    - [x] شريحة 5d — Laravel يقود: نقل `media` pipeline + `ingest` بالكامل من Node (قرار المستخدم: استبدال كامل لعامل الوسائط). مفكَّكة:
      - [x] 5d.1 — تكافؤ التنسيق في Laravel: `GET /media/jobs` (قائمة + فلاتر)، تحقّق العمليات (thumbnail/transcode/transcription)، واجهة `MediaProcessor` + `FakeMediaProcessor`، ربط `ProcessMediaWorkflow` ليخزّن artifacts. العقد + اختبارات. بوابة: `php artisan test` + `verify:api-contracts`.
      - [x] 5d.2 — معالج ffmpeg فعلي + Dockerfile/worker image (بنية تحتية، يُتحقّق بـ smoke لا unit).
      - [x] 5d.3 — نقل ingest (broadcastIngest/watch folder/checksum) إلى Laravel queues.
      - [x] 5d.4 — صفحات Next تستهلك قائمة/إنشاء media jobs.
    - [~] شريحة 5e — بوابة القطع. مفكَّكة:
      - [x] 5e.1 — تسوية أسماء حقول parity: `lastModified`→`modifiedAt` و`shareUrl`→`url` كأسماء قانونية عبر العقد + Laravel + عميل Next؛ تأكيد `POST /share` يرسل/يقبل `scope:{itemIds}`. بوابة خضراء: 61 اختبار Laravel + `verify:api-contracts` + `typecheck:next`.
      - [x] 5e.2-harness — وُسِّع `e2e:next:integration` ليغطي `/archive`, `/archive/[id]`, `/media/jobs` (DB-backed) + shell `/files`، مع fixture media_job في `NextIntegrationSeeder`. الـ spec يُحلَّل (10 اختبارات) لكنه **لم يُشغَّل** (يحتاج Laravel+Next حيَّين).
        - ▶️ **شُغِّل حيًّا أول مرة (2026-06-30):** Laravel (Docker/SQLite مبذورة، منفذ 8950) + Next dev (8951، `ARCHIVE_API_BASE_URL=…/api/v1`) + Playwright. النتيجة **4/10 نجح، 6/10 فشل**. ✅ نجح: `/share/[token]` (عرض سجل حقيقي عبر السلسلة الكاملة) + هيكل `/files` (×desktop/mobile). ❌ فشل: `/archive`, `/archive/[id]`, `/media/jobs` بـ **401 Unauthorized**.
        - ‼️ **حاجز قطع مكتشَف (auth parity):** صفحات Next التشغيلية تستدعي endpoints محمية بلا اعتماد — `archive/page.tsx` (`search()`)، `archive/[id]/page.tsx` (`record()`)، `media/jobs/MediaJobsList.tsx` (`mediaJobs()`). الـ access token يُحفظ في state محلي بصفحة `/login` فقط ولا يُحمل عبر التنقّل؛ لا طبقة استمرار جلسة في Next. الـ harness أيضًا لا يبذر مستخدمًا ولا يسجّل دخولًا.
        - ✅ **حُلّ (2026-06-30، نهج httpOnly cookie):** تبيّن أن مصادقة الكوكي مبنيّة سلفًا — `AuthenticateArchiveApiRequest` يقبل httpOnly `va_refresh` cookie كاعتماد جلسة، والـ login يضبطه، والعميل يرسل `credentials:include`؛ فالمتصفح يحمله تلقائيًا عبر التنقّل. لا حاجة لأي تغيير في Laravel. الفجوة كانت test-side فقط: (أ) `NextIntegrationSeeder` يبذر الآن مستخدمًا (`ARCHIVE_E2E_EMAIL`/`_PASSWORD`)؛ (ب) الـ spec يسجّل دخولًا في `beforeEach` عبر `page.request`. **بوابة خضراء: `e2e:next:integration` 10/10 نجح حيًّا** (chromium + mobile-chrome، عام + مُصادَق). يبقى فقط **5e.2-cutover** (قلب علم الإنتاج + حذف مجموعات Node) كخطوة إشرافية.
      - [x] 5e.2-cutover — **اعتماد Laravel/Next كمسار التطوير الافتراضي (2026-06-30):** انتقلت أوامر الجذر `pnpm dev` و`pnpm build` و`pnpm verify` إلى Laravel + Next.js، ونُقلت Vite/Node إلى أوامر `legacy:*` صريحة. أُضيفت `verify:cutover` لمنع رجوع الافتراضات إلى SPA/Node، و`verify:laravel-next:live` لتشغيل Laravel+Next مؤقتاً ثم تنفيذ Playwright integration. **قرار «إيقاف البناء net-new على Node» صار مفروضاً بالأوامر والوثائق:** أي ميزة جديدة في records/search/files/share/media/ingest تُبنى على Laravel/Next حصراً، بينما تبقى `archive-app` و`archive-server` reference/fallback إلى أن تُطفأ الفجوات التشغيلية المتبقية.
      - [x] تنفيذات حقيقية مبنية (خلف الواجهات، الربط الافتراضي يبقى Fake): `RealMediaProcessor` (ffmpeg)، `WhisperTranscriber` (faster-whisper-large-v3/ar/vtt)، `FtpIngestTransport` (ext-ftp)، `SmbIngestTransport` (smbclient عبر ProcessRunner). كلها unit-tested بـ fakes (71 اختبار Laravel). **يتبقّى فقط تحقّق حيّ:** بناء `Dockerfile.worker` بـ ffmpeg/whisper + smoke بملف وسائط حقيقي وخادمَي FTP/SMB — يُؤجَّل لجلسة اختبار على بنية حيّة.

### 3. مشغّل فيديو متقدم — الجزء المنجز

  - ✅ Frame stepping + Mark In/Out + «أضف لمشروع» (2026-06-30): `VideoPlayer.tsx` — خطوة إطار بـ 1/fps (افتراضي 25fps PAL) عبر `,`/`.` + أزرار ChevronLeft/Right؛ Mark In/Out عبر `i`/`o` مع شرائط مرئية على الـ scrubber + عرض label؛ زر «أضف لمشروع» (FolderPlus) يُشغّل `onAddToProject({markIn,markOut})`؛ في `DetailPage.tsx` لوحة اختيار مشروع inline تُنشئ `createRoughCutValue` وتستدعي `updateProject`. 6 اختبارات جديدة، 1251 test pass.

### 4. تحسين الصور (srcset + lazy) — مُنجَز (2026-06-30، وكيل Sonnet)

- [x] `[P2]` ⏱️M **تحسين الصور (srcset + lazy)** — أُضيف مكوّن `ArchiveImage.tsx` (lazy افتراضي، width/height صريحة لمنع CLS، fetchPriority للـ hero، srcSet/sizes جاهزة، decoding=async، fallback عند الخطأ، RTL/tokens) + 8 اختبارات TDD، وتُبنّي في شبكة الأرشيف (`ArchiveViews.VideoThumb`). الخادم يُنتج مقاس thumbnail واحد (640px) فق** فبقي srcSet معلّقًا بتعليق ponytail. 1253→1261 اختبارًا أخضر. ملاحظة: hero في DetailPage مشغّل فيديو لا img.

### 6. TimelinePage — تصدير SVG (مُنجَز 2026-06-30، وكيل Sonnet)

- [x] `[P2]` ⏱️L **TimelinePage أفقي + Zoom levels + Export SVG** — الأفقي و4 مستويات granularity (day/week/month/year) كانت موجودة سلفًا؛ أُضيف `timelineSvgExport.ts` (دالة نقية `buildTimelineSvg` تُنتج SVG مستقل: محور زمني، صفوف lanes، دوائر بحجم العدد، روابط، XML escaping) + 11 اختبار TDD + زر «تصدير SVG» يعيد استخدام `downloadArchiveBlob` (بلا dependency). 1261→1272 أخضر. **PDF مؤجَّل** (لا يوجد pdf helper محلي في archive-app؛ يُضاف عند توفّر مكتبة client-side — ponytail).

### 6. Conditional Fields Visual Builder + حقل Relation (مُنجَز 2026-06-30، وكيل Sonnet)

- [x] `[P2]` ⏱️L **Conditional Fields Visual Builder + حقل Relation** — أُضيف نوع `{ id: "relation" }` إلى `FIELD_TYPE_OPTIONS` (محدّد عناصر أرشيف في `AddVideoPage.FieldInput`)، ومكوّن `ShowWhenBuilder` في `TypesPage` يدور حول شكل `showWhen` الموجود (`{fieldKey, equals}`، عامل المساواة فقط). +16 اختبار TDD. 1272→1288 أخضر. مؤجَّل: relation في DetailPage.

### 6. GraphViewPage Cytoscape — مُنجَز مسبقًا (تحقّق 2026-06-30، وكيل Sonnet)

- [x] `[P2]` ⏱️XL **GraphViewPage: تفعيل Cytoscape الكامل** — بند قديم في القائمة لكنه **مُنفَّذ بالكامل فعلاً** (تحقّق الوكيل، لا كود جديد): `GraphViewPage.tsx` + `features/graph/buildGraphModel.ts` (+14 اختبار) — force-directed (cose/concentric)، ألوان حسب النوع، حجم حسب الـ degree (mapData)، zoom/pan + أزرار، فلاتر type/tag/layout، hover/click highlight، lazy import لـ cytoscape (سطر 424). الروابط من: وسوم مشتركة + collections + علاقات يدوية (`itemRelations`). 1288 اختبارًا أخضر دون تغيير.

### 6. Dashboard Widget Gallery + Getting-Started Checklist (مُنجَز 2026-06-30، وكيل Sonnet)

- [x] `[P2]` ⏱️M **Dashboard: Widget Gallery + DnD + Getting-Started Checklist** — الـ DnD (`DashboardGrid`+`dashboardLayoutModel`) كان موجودًا؛ أُضيف: `widgetGalleryModel.ts` (listWidgets/toggle/add/remove يلفّ `setPanelHidden`) + `WidgetGallery.tsx` (لوحة إظهار/إخفاء في وضع التحرير)، و`checklistModel.ts` (`buildGettingStartedChecklist` نقي يحسب 6 خطوات من حالة حقيقية: نوع/مادة/رفع/مجموعة/نسخة احتياطية/حماية + dismiss عبر `dismissedBanners`) + `GettingStartedChecklist.tsx` (بطاقة بشريط تقدّم). +31 اختبار TDD (19 checklist + 12 gallery). 1288→1319 أخضر. مؤجَّل: تمرير uploads slice مخصّص (fallback يفحص filePath/metadata).

### 4. PWA Print Styles — مُنجَز (2026-06-30، وكيل Sonnet)

- [x] `[P2]` ⏱️L **PWA: Service Worker + Print Styles** — البنية الأساسية كانت موجودة (`manifest.json` RTL، `sw.js` v3: cache-first shell + SWR للأصول + network-first/TTL للـ API + background sync + push، وتسجيل في `AppSync.ts`). الناقص الوحيد **أنماط الطباعة** أُضيف: كتلة `@media print` (~100 سطر) في `app-overrides.css` خارج `@layer` — تُخفي الـ chrome (sidebar/tabs/toolbars/أزرار/dialogs)، `@page` A4، أبيض/أسود، عرض كامل، `break-inside: avoid` للبطاقات، فواصل صفحات لـ `[data-report-section]`، جداول بحدود وتكرار thead، روابط تُظهر href. 1319 أخضر (CSS فقط). مؤجَّل: background sync (مبني سلفًا)، تحديث جولة الإعداد (لا مكوّن tour موجود).

### 3. مشغّل فيديو — Waveform (مُنجَز 2026-06-30، وكيل Sonnet)

- جزء من بند §3 «مشغّل فيديو متقدم» (يبقى Transcript Sync فقط): أُضيف `useAudioWaveform.ts` (hook يجلب الوسائط، يفكّ الصوت عبر `AudioContext.decodeAudioData`، يستخرج 120 قمة عبر `downsamplePeaks` الموجود، cache per-src، AbortController + تدرّج صامت عند CORS/فشل) و`WaveformStrip` في `VideoPlayer.tsx` (أشرطة SVG، الجزء المُشغَّل بـ `--va-action`، تتدرّج لعرض الـ scrubber، aria-hidden، placeholderPeaks ديكوري عند تعذّر الفكّ). أعاد استخدام `features/montage/waveform.ts` (13 اختبارًا قائمًا) دون تكرار. 1319 أخضر.

### 3. مشغّل فيديو — Transcript Sync مُغلق (تحقّق 2026-06-30)

- [x] `[P2]` ⏱️L **مشغّل فيديو متقدم في DetailPage** — أُغلق المتبقّي الأخير بعد التحقق من التنفيذ الموجود: `TranscriptSyncWorkbench` داخل `DetailPage.tsx` يقرأ `getTranscriptSegments`, يتابع `playbackTime`, يبرز السطر النشط، يتيح البحث داخل التفريغ، ويقفز للفيديو عبر `seekToBookmark`. `VideoPlayer.tsx` يعرض `SubtitleRenderer` فوق الفيديو، و`subtitleParser.ts`/`transcriptToSrt.ts` يدعمان SRT/VTT واستنتاج cues من segments. التحقق: `pnpm --filter @archive/app run test -- src/features/media/subtitleParser.test.ts src/features/media/transcriptToSrt.test.ts src/components/media/VideoPlayer.test.tsx` مرّ ضمن 147 ملف اختبار / 1319 اختبار. لا كود جديد؛ تحديث حالة المهمة فقط.

### Hardening — ثغرات تدقيق cutover + SQL Server (2026-06-30، وكيل Sonnet)

- 🔴 `archive-server/src/index.ts`: `buildExtraHealth` صار يأخذ `databaseEngine` ويحرس استعلام `pg_extension` (vector) على postgres فقط؛ غير postgres يُرجع `{ok:false, skipped:true, reason:"not-postgres"}` بلا خطأ مضلّل في `/api/health`. +اختبار `buildExtraHealth.test.ts` (3 حالات).
- 🟡 `scripts/dev-laravel-next.mjs`: أُضيف `waitForJson` health-wait على Laravel قبل إقلاع Next (مطابقة لـ verify-next-laravel-live)؛ توضيح اتساق seeder (`NextIntegrationSeeder`).
- 🟡 `CLAUDE.md`: توضيح `pnpm server`=Laravel / `server:legacy`=Node. `storage.ts`: تصحيح تعليق JSONB/NVARCHAR المضلّل.
- ⚪ `prismaJsonCompat.test.ts`: اختبار `hasSome` متعدد القيم + round-trip. `package.json`: بادئات `build:spa:legacy`/`build:cloud:legacy`.
- بوابات: verify:cutover ✅ · verify:db-provider ✅ · archive-server tests ✅ (299) · typecheck ✅.

### 1. تفريغ عربي إنتاجي — Whisper GPU config في Laravel (شريحة، 2026-06-30)

- [~] `[P1]` ⏱️XL **تفريغ عربي إنتاجي (GPU + faster-whisper-large-v3)** — أُضيفت شريحة إعداد GPU في المسار القانوني الجديد `archive-laravel`: `WHISPER_DEVICE` و`WHISPER_COMPUTE_TYPE` في `config/media.php` و`.env.example`، وتم تمريرهما من `AppServiceProvider` إلى `WhisperTranscriber`. أمر faster-whisper صار يضيف `--device cuda` و`--compute_type float16` افتراضياً مع بقاء `large-v3`/`ar`/`vtt`. أضيفت قدرة `FakeProcessRunner::lastCommand()` لاختبار الأمر، ومرّ `php artisan test --filter=WhisperTranscriberTest` داخل Docker: 6 اختبارات / 13 assertion. المتبقي لإغلاق P1: smoke حي على GPU + قياس دقة مقابلة عربية + diarization + تصدير TTML.

### 2. K8s + Docker Compose — تحقق offline للبنية (شريحة، 2026-06-30)

- [~] `[P2]` ⏱️L **إكمال K8s + توحيد Docker Compose** — صُحّحت selectors في `archive-server/k8s/network-policy.yaml` لتطابق labels الفعلية (`server`/`frontend`/`postgres`) بدلاً من أسماء `archive-*` غير الموجودة، وأُضيف `scripts/verify-infra-config.mjs` مع أمر `pnpm run verify:infra`. البوابة تتحقق من وجود ملفات Compose، وتشغّل `docker compose config` لكل البدائل الأساسية، وتفحص `kubectl kustomize`/dry-run عند توفر context. التحقق: `node --check scripts/verify-infra-config.mjs` و`pnpm run verify:infra` نجحا؛ تخطّي dry-run الخاص بـ `kubectl` كان متوقعاً لعدم وجود context محلي. المتبقي لإغلاق البند: توحيد Compose بـ profiles وإضافة Redis/Whisper إلى K8s ثم بوابة CI حيّة.

### 5. Settings + Security posture في Next.js (شريحة، 2026-06-30)

- [~] `[P2]` ⏱️M **توحيد SettingsPage/SettingsHubPage + لوحة أمان موسّعة** — استُبدلت صفحة `/settings` في `archive-next` بواجهة read-only تجمع System/Security/Storage/API/Appearance، وأُضيفت لوحة "وضع الأمان" تعرض كلمة المرور، مهلة الجلسة، ومحاولات الفشل مع عناصر مخططة للمصادقة الثنائية وWebhook allowlist. التحقق: `pnpm run build:next` و`pnpm run typecheck:next`، مع فحص بصري Playwright على desktop/mobile. المتبقي: نقل/توحيد صفحات settings القديمة في `archive-app` وربط عناصر CSP/CORS/JWT TTL/rate-limit بصلاحيات وendpoints Laravel فعلية.

### 2. E2E — Next UI smoke موسّع (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️L **توسيع اختبارات E2E + ترقية الحزم الأمنية** — حُدّث `archive-app/tests/next-migration-shell.spec.ts` بعد اعتماد polish في واجهة Next، وأضيف smoke لمسار `/archive` يتحقق من العنوان وحقل البحث وتفاعل `بحث` دون اشتراط Laravel حي. تم إثبات RED أولاً بتوقعات العناوين القديمة، ثم مرّت البوابة: `E2E_BASE_URL=http://127.0.0.1:9064 pnpm run e2e:next` بنتيجة 16/16 على chromium وmobile-chrome. المتبقي لإغلاق البند: توسيع Playwright للمسارات الأثقل وربط فحص CVEs/audit ضمن بوابة CI.

### 2. K8s — Redis + Whisper worker (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️L **إكمال K8s + توحيد Docker Compose** — أُضيفت موارد `redis-deployment.yaml`/`redis-service.yaml`، و`whisper-worker-deployment.yaml` كعامل Laravel queue لمعالجة ffmpeg/faster-whisper فوق PVC ملفات الأرشيف، مع `REDIS_URL`, `MEDIA_PROCESSOR=real`, إعدادات `WHISPER_*`, وطلب GPU `nvidia.com/gpu: 1`. وُسّعت NetworkPolicy للسماح المحدد بين server/worker/redis/postgres، ووُسّع `verify:infra` للتحقق من الموارد الجديدة. التحقق: `node --check scripts/verify-infra-config.mjs` و`pnpm run verify:infra`؛ dry-run الحي بقي متوقفاً على Kubernetes context.

### 2. Repo hygiene gate (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️M **ترتيب وتنظيف مجلدات المشروع + بوابة Playwright** — أُضيف `scripts/verify-repo-hygiene.mjs` و`pnpm run verify:repo-hygiene`، ورُبط ضمن `verify:laravel-next` لمنع بقاء مخرجات Playwright (`test-results`/`playwright-report`/`blob-report`) وملفات logs/screenshots المؤقتة في الجذر. البوابة كشفت `archive-app/playwright-report` المتبقي من جولة RED ونُظف، ثم مرّت. المتبقي: جرد أوسع للوثائق/النسخ/الملفات القديمة ونقل أو حذف الآمن منها مع Playwright شامل.

### 3. Watermark overlay في Laravel media (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️M **علامة مائية + تصدير SRT/VTT/TTML للفيديو** — أُضيف دعم watermark اختياري إلى `RealMediaProcessor::processTranscode`: عند وجود `options.watermark` أو تفعيل `MEDIA_WATERMARK_*` يُضاف مدخل صورة ثانٍ و`filter_complex` يطبق overlay بمواضع مضبوطة (`top-left/top-right/bottom-left/bottom-right/center`) مع opacity/margin آمنين، مع بقاء السلوك الافتراضي بلا watermark. أضيفت مفاتيح `.env.example` و`config/media.php` ورُبطت في `AppServiceProvider`. التحقق: RED ثم GREEN لـ `node scripts/laravel-docker.mjs test --filter=RealMediaProcessorTest`، ثم `node scripts/laravel-docker.mjs test --filter=Media` بنتيجة 22 اختبار / 85 assertion. المتبقي: smoke حي بـ ffmpeg على ملف فيديو وasset علامة مائية فعلي.

### 3. Watermark media job preset في Next.js (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️M **علامة مائية + تصدير SRT/VTT/TTML للفيديو** — أضيفت حقول `sourcePath` وwatermark preset إلى نموذج `/media/jobs` عند اختيار `transcode`: مسار صورة العلامة، الموضع، الشفافية، والهامش تُرسل كـ `options.watermark` إلى Laravel، مع دعم `atSec` للـ thumbnail وعرض خيارات job المخزّنة في القائمة. المتبقي لإغلاق البند نهائياً: smoke حي بـ ffmpeg على ملف فيديو حقيقي وasset علامة مائية فعلي.

### 3. Legal media player — Files integration (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️L **مشغّل وسائط قانوني في Next + بثّ HTTP Range** — رُبط المشغّل القانوني بمتصفح الملفات: `MediaPlayer` يقبل `disk` اختياري، صفحة `/media/play` تقرأ `path/disk` من query params، و`/files` تعرض زر "تشغيل" للملفات الصوتية/المرئية بناءً على MIME/extension وتفتحها مباشرة عبر Laravel streaming. المتبقي: byte-range حقيقي للـ remote disks وsmoke حي لسيناريوهات storage متعددة.

### 22. ODBC readiness في Laravel (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️XL **دعم ODBC (عام لقواعد بيانات Windows القديمة)** — نُقلت بداية الجسر إلى المسار القانوني Laravel + Next.js بدلاً من بناء مسار Node موازٍ: أُضيفت `OdbcConnectionProbe` و`NativeOdbcConnectionFactory` فوق PHP ODBC extension، و`config/odbc.php` + مفاتيح `ODBC_*` في `.env.example`، ونقطة مصادقة `GET /api/v1/system/odbc` تعيد readiness status مع إخفاء `PWD`/`Password` وتعرض أسماء الجداول عند نجاح الاتصال. أُضيف `docs/odbc-laravel-bridge.md` لتوثيق DSN والحدود الحالية. التحقق: RED ثم GREEN لـ `node scripts/laravel-docker.mjs test --filter=Odbc`، ثم `node scripts/laravel-docker.mjs test --filter='Api|Odbc'` بنتيجة 57 اختبار / 305 assertion. المتبقي: Repository read/write محدود وربطه في إعدادات Next.js/معالج الإعداد.

### 22. ODBC setup UI في Next.js (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️XL **دعم ODBC (عام لقواعد بيانات Windows القديمة)** — أُضيفت بطاقة ODBC إلى `/settings` في `archive-next` فوق مسار Laravel القانوني: تعرض حالة الجسر، DSN المقنّع، توفر driver، عدد الجداول، واختيار جدول أساسي لمعاينة read-only محدودة. وُسّع عميل `archive-next/lib/archive-api.ts` بتعريفات typed لـ `odbcStatus()` و`odbcTable()`، ووُثقت مسارات `/system/odbc` و`/system/odbc/tables/{table}` في OpenAPI وربطت بـ `verify:api-contracts`. المتبقي لإغلاق ODBC: CRUD/transactions وsmoke حي على Windows ODBC فعلي.

### 6. Next UI polish pass (شريحة، 2026-07-01)

- [~] `[P3]` ⏱️L **بقية الصفحات (تحسينات مفردة)** — نُفّذت تمريرة UI متوسطة عبر وكيل منخفض التكلفة ثم روجعت محلياً: `/archive` و`/files` حصلا على badges سياقية وحالات loading/error/empty أوضح وبطاقات أكثر إحكاماً؛ `/login` يعرض حالة auth داخل banner موحد؛ `/settings` تقللت inline styles وتوحّد panel rhythm؛ وأضيفت classes مشتركة في `archive-next/app/globals.css` (`hero-actions`, `panel-title-row`, `state-banner`, `helper-row`). التحقق: `pnpm run typecheck:next`, `pnpm run build:next`, وفحص Playwright desktop/mobile ببيانات mock على `/archive`, `/files`, `/login`, `/settings` بدون horizontal overflow أو console/page errors.

### 2. Compose Laravel/Next القانوني (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️L **إكمال K8s + توحيد Docker Compose** — أُضيف ملف Compose قانوني جديد `archive-server/docker-compose.laravel-next.yml` يشغّل Postgres + Redis + Laravel API + Laravel queue worker + Next standalone بدل الاعتماد على Stack Node/SPA القديم. أُضيف `archive-next/Dockerfile` لبناء `output: standalone` من workspace الجذر، وقُوّي `archive-laravel/Dockerfile.worker` بدعم PHP Redis extension حتى يعمل `QUEUE_CONNECTION=redis`. أضيف `docker:config:laravel-next` وربطت البوابة ضمن `scripts/verify-infra-config.mjs`. التحقق: `pnpm run docker:config:laravel-next` و`pnpm run verify:infra`؛ dry-run الحي لـ Kubernetes ما زال متوقفاً على context.

### 7. Visual Review — روابط مراجعة خارجية (شريحة، 2026-07-01)

- [x] `[P2]` ⏱️XL **مراجعة بصرية واعتماد (Visual Review)** — أُغلقت شريحة الرابط الخارجي: جدول/model `review_links`، و`ReviewLinksController` مع `POST /api/v1/media/{mediaUid}/review-links` تحت auth لإنشاء token عشوائي طويل وصلاحية `view/comment` وانتهاء اختياري، و`GET /api/v1/review-links/{token}` عام يعيد media UID وmetadata وتعليقات المراجعة المرتبة ويفرض expiry. أضيفت صفحة Next عامة `/review/[token]` وعميل typed في `archive-next/lib/archive-api.ts`. التحقق: `node scripts/laravel-docker.mjs test --filter=ReviewLinksApiTest` مرّ 5/5 (30 assertion)، ثم `node scripts/laravel-docker.mjs test --filter=Review` مرّ 17/17 (62 assertion)، ومرّا `pnpm run typecheck:next` و`pnpm run build:next`.

### 7. Live Collaboration — Presence heartbeat (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️XL **تعاون حي (Live Collaboration)** — أضيف أساس حضور قانوني في Laravel/Next: جدول/model `collaboration_presence`، و`CollaborationController` مع endpoints محمية `GET/POST /api/v1/collaboration/rooms/{roomKey}/presence` لتسجيل heartbeat وعرض المشاركين النشطين ضمن نافذة 45 ثانية بدون audit spam. أضيف عميل typed وصفحة Next `/collaboration` تعرض الغرفة، المورد، الحالة، وقائمة المشاركين. وُثّق المسار في OpenAPI وربط بـ `verify:api-contracts`. التحقق: RED ثم GREEN لـ `CollaborationPresenceApiTest` (4/4، 25 assertion)، ومرّت `pnpm run verify:api-contracts`, `pnpm run typecheck:next`, و`pnpm run build:next`. يبقى WebSocket/Reverb الحقيقي والتحرير المتزامن/locks لإغلاق البند كاملاً.

### 7. Live Collaboration — Editing locks (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️XL **تعاون حي (Live Collaboration)** — أضيفت طبقة أقفال تحرير فوق presence: جدول/model `collaboration_locks`، وواجهات محمية `GET/POST /api/v1/collaboration/rooms/{roomKey}/locks` و`POST /locks/release`. يدعم القفل TTL، refresh لنفس المستخدم، تحرير المالك، و409 `lock_conflict` عند محاولة مستخدم آخر حجز المورد نفسه. صفحة Next `/collaboration` تعرض الأقفال وتتيح حجز/تحرير المورد الحالي، والعميل typed والعقد OpenAPI حُدّثا. التحقق: RED ثم GREEN لـ `CollaborationLocksApiTest`، وفلتر `Collaboration` مرّ 8/8 (55 assertion)، ومرّت `pnpm run verify:api-contracts`, `pnpm run typecheck:next`, و`pnpm run build:next`. المتبقي: WebSocket/Reverb وإشعارات فورية بدل polling.

### 7. Live Collaboration — UI polish (شريحة، 2026-07-01)

- [~] `[P2]` ⏱️XL **تعاون حي (Live Collaboration)** — نُفّذت تمريرة UI منخفضة التكلفة على `/collaboration` ثم روجعت محلياً لتبقى متوافقة مع CSS الحالي لا Tailwind: حالات loading للأزرار والheartbeat، banners أوضح للخطأ/الاتصال، بطاقات أكثر إحكاماً للحضور والأقفال، وحماية من بقاء حالة التحميل عند فشل fetch. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`, و`pnpm run typecheck`.
# 2026-07-11 — رحلة إضافة المواد والمعالجة

- أضيف نموذج `intake-journey` خالص لاستعادة المسودات، كشف تكرار الملفات، تلخيص الفشل الجزئي، جاهزية المراجعة، واشتقاق الإجراء التالي.
- أصبح معالج الرفع هو المسار الأساسي بعرض كامل مع أدوات مساندة قابلة للطي، حفظ محلي آمن لبيانات المسودة، حالة لكل ملف، وتحذير التكرار وإعادة محاولة الملفات المتعثرة.
- رُبطت حالات الفرز في الوارد بخطوات الأرشفة التالية، وأضيف توضيح preflight للاستيراد، واختيار قابل للبحث لوسائط التفريغ السابقة، وتحذير علاقات المسارات في تحديد الملفات.

# 2026-07-11 — مساحة عمل الأرشيف والبحث وسجل المادة (Task 5)

- أضيفت وحدة `workspace-preferences` محلية بإصدار v2: ترحيل payload v1، تطبيع صارم للقيم، وعزل حسب المسار. تستعيد `/archive` و`/search` العرض والكثافة والمعاينة والفلاتر حين لا توجد query parameters صريحة، بلا تغيير API أو backend.
- يحفظ الغلاف القانوني، وسطح `/catalog` العام، موضع القراءة لمسارات workspace المطابقة فقط مع فشل صامت آمن عند تعطيل localStorage؛ لا تُستعاد أو تُحفظ إزاحة صفحات تفاصيل السجل، ولا تُكتب الإزاحة أثناء تبديل pathname.
- يستخدم البحث عداد نتائج مشتقاً يوضح المرئي بعد التصفية والترقيم؛ تبقى chips للفلاتر وpreview rail والإجراء التالي التفصيلي القائمة كمراجعة سياقية محدودة.
- TDD: RED لغياب الوحدة ثم GREEN لاختبارات الترحيل والقيم غير الصحيحة وعزل المسارات وعدد النتائج؛ RED/GREEN إضافي لمنع تفاصيل السجل من نطاق الموضع، ولإلزام البحث المحفوظ بتنفيذ query بدلاً من البقاء Idle، ولتأخير كتابة تفضيلات البحث حتى اكتمال محاولة الاستعادة عندما يغيب URL. مرّت Vitest المركزة وNext typecheck.

# 2026-07-11 — مساحات التنظيم والجودة (Task 6)

- أضيفت وحدة `change-impact` خالصة لاشتقاق عدد السجلات المتأثرة وصياغة التحذير للأفعال المدمّرة أو القابلة للتراجع أو بلا أثر، مع اختبار RED لغياب الوحدة ثم GREEN (4 حالات: counts، دمج، تراجع، لا أثر).
- أضيفت معاينات أثر واضحة قبل مسارات التنظيم المدعومة: توضح المجموعات أنها لا تحذف سجلاتها ولا تعرض عدداً قبل اكتمال التحميل، والمفردات عدد السجلات المستخدمة، والوسوم أن تغيير الأب هيكلي بلا تعديل سجلات أو تراجع تلقائي، مع تحذير دمج التشابهات. تعرض صفحات الأنواع تحذير توافق المخطط قبل الحفظ/الحذف، وتبقى المكررات معاينة فقط حتى تتوفر نقطة دمج خادم قابلة للمراجعة.
- وثّقت Kanban أن قائمة النقل البديلة تدعم لوحة المفاتيح/قارئات الشاشة لكل البطاقات بدلاً من الاعتماد على السحب، وأضيف زر تراجع عن آخر نقل ناجح؛ وعرضت المشاريع تأكيداً صريحاً لحذف المشروع أو القصاصة محلياً بوصفه غير قابل للتراجع ولا يغيّر المادة الأصلية، مع بقاء أزرار ترتيب القصاصات بديلاً مباشراً للسحب.

# 2026-07-11 — المشاركة والمراقبة والإدارة (Task 8)

- أضيفت وحدة `admin-action-summary` خالصة ومختبرة بأسلوب TDD: تنقيح قيم credentials الشائعة، حالات انتهاء روابط المشاركة، معاينة تصدير صادقة، حداثة النسخة الاحتياطية، وتجميع الأخطاء مع خطوة استرداد عملية.
- طبّقت الشريحة واجهات أكثر أمناً في المشاركات وعلّاقات المراجعة العامة والتقارير والنسخ الاحتياطي وسجل الأخطاء والنشاط والتحليلات وكتالوج الإضافات والإشعارات: عارض عام محدود، حالة انتهاء واضحة، تأكيدات محلية لا تدّعي إبطال الرابط، معاينة قبل التصدير، وحالات خطأ منقحة مع إجراء تالٍ. لا توجد نقاط API أو ادعاءات تشغيلية جديدة.

# 2026-07-11 — التحقق الشامل وإغلاق الخطة (Task 9)

- شُخّص فشل `pnpm --filter @archive/next run test` أولاً: نجحت 122 حالة Vitest لكن اكتشاف Vitest الافتراضي ضمّ ملفّي Playwright تحت `archive-next/e2e/`، ففشلا لأن hooks Playwright نُفذت خارج runner الخاص بها.
- أضيف `archive-next/vitest.config.ts` بإقصاء محدود لـ `e2e/**` فوق `configDefaults.exclude`؛ بذلك تبقى استثناءات Vitest الافتراضية، ولا تتأثر أوامر Playwright المنفصلة. RED: فشل التشغيل الكامل بملفي E2E؛ GREEN: 19 ملفاً و122 اختباراً ناجحاً.
- بوابات محلية ناجحة: `pnpm --filter @archive/next run typecheck`، `pnpm --filter @archive/next run build` (51 route)، `node scripts/verify-api-contracts.mjs`، و`node scripts/verify-repo-hygiene.mjs`.
- مراجعة static للاستجابة وحالات المسارات: `pnpm --filter @archive/next exec vitest run lib/responsive-layout.test.ts lib/page-state-contract.test.ts` نجح بـ 6/6. لم تُلتقط screenshots في هذه الجولة لأن مراجعة المتصفح الحية تتطلب تشغيل خدمات Next/Laravel وبيانات/جلسة اختبار؛ لا يعد ذلك فشلاً محلياً أو مهمة تطوير مفتوحة.
# 2026-07-12 — تدقيق وخطة جاهزية الإصدار الأول

- أُنجز تدقيق قراءة شامل ومتوازٍ للمنتج وUI/UX والخلفية والأمن والبيانات والتثبيت والتشغيل وCI وسلسلة التوريد.
- سُجل قرار `NO-GO` الحالي مع مانعات P0 مثبتة، من بينها الصلاحيات ومسارات الوسائط وDR وحساب المدير الافتراضي وتعطل Control Center.
- أضيف تقرير الجاهزية `docs/superpowers/specs/2026-07-12-v1-release-readiness-report.md`.
- أضيفت خطة تنفيذ موجية قابلة للتوزيع على الوكلاء في `docs/superpowers/specs/2026-07-12-v1-agent-execution-plan.md`.
- لم تنفذ هذه الجولة تغييرات في سلوك المنتج؛ تنفيذ الخطة يبدأ بعد اعتماد النطاق وترتيب الأولويات.
- اعتُمد تصميم V1 متعدد الأنظمة: On‑Premises على Windows وLinux، Docker Compose افتراضياً، وNative خيار ضمن مصفوفة توافق مختبرة.
- أضيفت ملفات تثبيت موصى به/كامل/مخصص وحزمتا Online وOffline في `docs/superpowers/specs/2026-07-12-v1-cross-platform-on-prem-design.md`.
- أُجريت مراجعة ثانية للخطة: أضيفت فجوة التوثيق/الإعدادات القديمة، وبوابة توحيد مسار النشر، ومهام Native مستقلة لـWindows وLinux مع بوابة parity قبل RC.

# 2026-07-12 — توافق Laravel Docker مع ext-ftp (V1-003b/V1-202)

- أصبحت صورة `archive-laravel/Dockerfile.worker` تثبت امتداد PHP `ftp` المطلوب في `composer.lock` من `league/flysystem-ftp`.
- أصبح `scripts/laravel-docker.mjs` يبني ويستخدم صورة Laravel الفعلية بدلاً من `composer:latest`، ويتحقق من تحميل `ext-ftp` قبل تثبيت Composer وتشغيل الاختبارات.
- أضيف `scripts/verify-laravel-runtime.mjs` كفحص آلي يبني الصورة ويتحقق من `ext-ftp` ومن ربط الـharness بالصورة القانونية؛ أُثبت RED أولاً ثم شُغّل GREEN.
# 2026-07-12 — V1-004a توحيد مداخل التثبيت والتشغيل

- أصبح `pnpm setup` يستدعي `Control Center deploy` مباشرةً، مثل `pnpm deploy`، لمسار Laravel + Next القانوني في `infra/docker-compose.yml`.
- أُزيل معالج الإعداد القديم وترجمات PocketBase التابعة له واختبارها، وأزيلت مراجع أوامر النشر وCompose القديمة من أدلة التثبيت والنشر وControl Center.
- أُضيف اختبار Node يمنع عودة مداخل عامة أو وثائق تشير إلى `deploy-legacy` أو ملفات Compose القديمة.
- عُزلت ملفات override القديمة، وأصبح launcher ودليل Hostinger تحت `infra/deploy/`
  يوجهان إلى Control Center و`infra/docker-compose.yml` فقط.

# 2026-07-13 — V1-113 timeouts/backoff/idempotency/cancel حقيقي لوظائف الوسائط

- `ProcessMediaWorkflow` (الوظيفة الوحيدة في النظام) أصبحت تحمل `$timeout`/`$tries`/`backoff()` قابلة للضبط عبر `config/media.php`، بدل الاعتماد على افتراضيات Laravel الضمنية.
- idempotency حقيقي: `ShouldBeUnique` (يُسقِط dispatch مكرراً لنفس معرّف الوظيفة) + middleware `WithoutOverlapping` (يمنع تشغيل نفس الوظيفة من عاملين متزامنين).
- cancel حقيقي: `handle()` و`RealMediaProcessor::guardNotCanceled()` يعيدان قراءة الحالة من القاعدة قبل بدء المعالجة وعند كل مقطع في transcription متعددة المقاطع، فيوقفان العمل عبر `JobCanceledException` الجديد بدل الاكتفاء بعلم DB لا يقرأه أحد.
- تنقية الأخطاء: رسائل الاستثناءات تُنقّى من أي مسار مطلق (Unix/Windows) قبل تخزينها في `media_jobs.error` المُعاد عبر الـAPI؛ التفاصيل الخام تُسجَّل في السجلات فقط. `failed()` الجديدة تكتب status=failed مرة واحدة بعد استنفاد كل المحاولات، لا عند كل محاولة.
- 12 اختباراً جديداً (`MediaJobsReliabilityTest`)، الحزمة الكاملة 500 تمر/0 فشل.

# 2026-07-13 — V1-123 retention/pruning للجلسات/audit/jobs/backups + RPO/RTO

- أربعة أوامر artisan جديدة/مُفعَّلة على جدولة يومية (`Schedule::command(...)->daily()` في `routes/console.php`): `sessions:prune` (يحذف `api_sessions` المنتهية الصلاحية — الآلية الفعلية للجلسات، لا جدول `sessions` غير المستخدَم أصلاً)، `audit:prune` (`AUDIT_LOG_RETENTION_DAYS`، افتراضي 365 يوماً)، `media:prune-jobs` (`MEDIA_JOB_RETENTION_DAYS`، افتراضي 90 يوماً، يستثني `queued`/`processing` بالكامل عبر فلترة الحالة)، و`backup:cleanup` (كان موجوداً من V1-121 لكنه لم يكن مجدولاً).
- قياس RPO/RTO حقيقي عبر `DrReadinessService::rpoRtoReport()` وأمر `dr:report` جديد: RPO = عمر آخر نسخة احتياطية ناجحة بالساعات (من `filemtime` مباشرة)؛ RTO = مدة آخر `backup:dr-drill` فعلي (يقيس `microtime()` حول الاستعادة الفعلية) أو `null` صراحة مع رسالة "غير مُقاس بعد" قبل أول تشغيل، بدل رقم مُخمَّن.
- 9 اختبارات جديدة (`RetentionPruningTest`)، الحزمة الكاملة 506 تمر/0 فشل.

# 2026-07-13 — V1-003 reproducibility baseline

- أضيف عقد toolchain قابل للفحص آلياً في `infra/platform/toolchain.v1.json`: Node.js 22.12.0 ضمن خط 22، pnpm 11.9.0، PHP 8.4.23، وComposer 2.9.5.
- ثُبتت نسخ Node في CI وصورة Next ونسختا PHP/Composer في صورة Laravel، وربطت المتطلبات بعقد توافق المنصات؛ لم يعد Dockerfile ينزّل Composer عائماً.
- أصبح `pnpm install --frozen-lockfile` مسار التثبيت الجذري الموثق، وأضيف `verify:reproducibility` إلى `pnpm verify` لمنع drift أو pins مفقودة.
- نجح frozen install في checkout معزول (262 حزمة، pnpm 11.9.0)، ثم نجح `pnpm verify`: 122 اختبار Next، build لـ51 route، و526 اختبار Laravel (2468 assertion؛ تحذير معروف و2 skipped).
