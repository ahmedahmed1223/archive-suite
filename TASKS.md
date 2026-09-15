# لوحة عمل مسار 1.4

> هذه لوحة التنفيذ النشطة فقط. الخطة التفصيلية، وواجهات المهام، وأوامر
> التحقق موجودة في
> [`docs/superpowers/plans/2026-08-20-v1.4.0-daily-ux-refresh.md`](docs/superpowers/plans/2026-08-20-v1.4.0-daily-ux-refresh.md).
> تاريخ مهام 1.3 محفوظ في [`CHANGELOG.md`](CHANGELOG.md).

## قواعد الالتقاط

- لا تلتقط مهمة قبل إكمال اعتمادياتها.
- `[ ]` جاهزة، `[~]` قيد التنفيذ، `[x]` مكتملة، `[!]` محجوبة، `[d]` مؤجلة.
- أضف المالك ووقت البدء ونتيجة التحقق تحت المهمة عند التقاطها.
- لا تُغلق أي مهمة قبل نجاح اختبارات الوحدة والاختبارات المرئية أو الحية
  المذكورة في الخطة.
- لا يُنشر `v1.4.0` ولا يُنشأ GitHub Release إلا بعد قرار Go صريح.

## الحالة

| المسار | جاهز | قيد التنفيذ | مكتمل | محجوب |
| --- | ---: | ---: | ---: | ---: |
| التنقل والغلاف | 0 | 0 | 2 | 0 |
| الرحلات اليومية | 0 | 0 | 4 | 0 |
| التفاعل واللغات | 0 | 0 | 5 | 0 |
| القبول والإصدار | 0 | 0 | 1 | 0 |

> يُعاد حساب الجدول عند كل دمج؛ لا تعتمد بوابات المشروع على هذه الأرقام.
> آخر تحديث: 2026-09-12 — مسار 1.4 مغلق بالكامل (P9/P10 أُغلقتا: إجراء ثانوي
> لبطاقة فراغ الرئيسية + زر إغلاق الدرج بمنطقة الإبهام مع اختبار حي أخضر،
> كوميت afc2d773؛ إصلاح تغطية مسار media-derivatives/content في RouteScopeTest،
> كوميت f16c7805). البوابات الحية أصبحت قابلة للتشغيل (Docker يعمل).
> الإصدار المنشور الحالي v1.5.3؛ غير المنشور: عمل المشتقات/الأوصاف الزمنية +
> إصلاحا 1.4. فحص الجاهزية (بدون نشر): security:audit يفشل (ثغرات sharp/
> js-yaml/next) — سابق لتغييرات 1.4 ولا يخص المنتج.
> تحديث 2026-09-15: فشل tar في verify:reproducibility لم يكن بيئيًا بل خطأ في
> السكربت نفسه (مسار أرشيف مطلق يقرأه GNU tar كمضيف بعيد، وهدف استخراج
> بشرطات خلفية) — أُصلح في كوميت 6e9331bc والبوابة الآن 79/79.
> وفي اليوم نفسه عاد master إلى الأخضر بعد 18 فشلًا في Laravel: فرض الحقوق كان
> يُمرَّر معرّف مشروع المونتاج بدل معرّفات المواد (كوميت a1d1bac9)، ومساران
> جديدان بلا تصنيف في RouteScopeTest (كوميت d6ab3f9c).

## موجة 1 — التنقل والغلاف

- [x] **V14-UX-001 — تنقل يومي ثابت حسب الدور.** أربع وجهات يومية للمحرر
  والمشاهد والمسؤول، مع احترام الصلاحيات والإخفاءات. **الاعتماديات:** لا شيء.
  **المرجع:** خطة 1.4، Task 1.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: archive-next (تنقل الغلاف والوجهات اليومية)
  التحقق: كوميت ff90d701 على master
  ```

- [x] **V14-UX-002 — غلاف أبسط ودرج تنقل واضح.** فصل إجراءات الغلاف ودرج
  المسارات، مع تسلسل إجراءات قابل للوصول على الهاتف وسطح المكتب.
  **الاعتماديات:** V14-UX-001. **المرجع:** خطة 1.4، Task 2.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: archive-next (غلاف مشترك + درج التنقل)
  التحقق: كوميت 64470208 على master
  ```

## موجة 2 — الرحلات اليومية الأساسية

- [x] **V14-UX-003 — صندوق العمل نقطة البداية.** ترتيب المهام العاجلة وتعيين
  `/work-inbox` نقطة بداية لأمين الأرشيف. **الاعتماديات:** V14-UX-002.
  **المرجع:** خطة 1.4، Task 3.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: archive-next (/work-inbox)
  التحقق: كوميت c3f2b400 + إصلاح فرز عام c66e7720 على master
  ```

- [x] **V14-UX-004 — حالات موحدة للأرشيف والبحث.** تحميل وفراغ وخطأ وإعادة
  محاولة من خلال `AsyncStateSurface`. **الاعتماديات:** V14-UX-002.
  **المرجع:** خطة 1.4، Task 4.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: archive-next (AsyncStateSurface)
  التحقق: كوميت a52f4c64 على master
  ```

- [x] **V14-UX-005 — فلاتر متدرجة وواضحة.** إظهار الفلاتر الأساسية وإخفاء
  الخيارات المتقدمة خلف كشف دلالي. **الاعتماديات:** V14-UX-004.
  **المرجع:** خطة 1.4، Task 5.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: archive-next (فلاتر البحث/الأرشيف)
  التحقق: كوميت 742d743f على master
  ```

- [x] **V14-UX-006 — رفع مبسط ومساحات ثانوية متسقة.** جعل رفع الملف المسار
  الأولي وتطبيق حالات الغلاف على الاستوديو والإعدادات. **الاعتماديات:**
  V14-UX-004 وV14-UX-005. **المرجع:** خطة 1.4، Task 6.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: archive-next (رفع + استوديو + إعدادات)
  التحقق: كوميت 9ff5e00f على master
  ```

## موجة 3 — جودة جميع الصفحات

- [x] **V14-UX-007 — تغطية تفاعلية لكل المسارات.** تصنيف كل صفحات App Router
  في `ROUTE_COVERAGE` واختبارها بدور وحالة صالحين. **الاعتماديات:**
  V14-UX-001 إلى V14-UX-006. **المرجع:** خطة 1.4، Task 7.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: archive-next/lib/page-experience.ts (+اختبارات)، e2e/fixtures/route-inventory.ts
  التحقق: 65/65 مسارًا مصنّفًا؛ vitest 4/4 وPlaywright inventory 12/12 أخضر
  القرارات: كوميت f7121e01؛ أُضيفت /approval-requests (editor) و/safety-preview
    و/help/releases/[version] والمسارات اليومية والتعاونية الناقصة
  ```

- [x] **V14-UX-008 — تحسين التفاعل حسب مجموعة الصفحة.** أنماط موحدة للصفحات
  اليومية والمكتبة والوسائط والتعاون والإدارة والعامة. **الاعتماديات:**
  V14-UX-007. **المرجع:** خطة 1.4، Task 8.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: project-tasks/approval-requests/project-groups/notifications pages،
    03-components.css (.page-action-row بحد لمس 44px)، lib/page-interaction.test.ts
  التحقق: tsc نظيف + 4 اختبارات عقد التفاعل خضراء
  القرارات: كوميت 073f8f04؛ رأس الإشعارات وحّد على PageToolbar، وأضيف
    إعادة محاولة بعد فشل التحميل في صفحات التعاون الثلاث
  ```

- [x] **V14-UX-009 — جودة العربية والإنجليزية والتصميم المرن.** صياغة أصلية
  للغتين، RTL/LTR صحيح، وتخطيط مرن عند 375/768/1280 وتكبير 200%.
  **الاعتماديات:** V14-UX-008. **المرجع:** خطة 1.4، Task 9.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: lib/i18n/copy-quality.test.ts (بوابة على القواميس المنشورة)،
    lib/layout-flex-contract.test.ts (منع left/right الفيزيائية في CSS المشترك)
  التحقق: 10 اختبارات جودة نص + اختباران للمرونة أخضران؛ القواميس ar/en نظيفة
  القرارات: كوميت 2e3f55a1؛ عرض zoom-200-640 موجود مسبقًا في visual-routes.ts
  ```

## موجة 4 — القبول والإصدار

- [x] **V14-REL-001 — قبول 1.4 وإصداره.** توحيد رقم الإصدار، أدلة القبول،
  الاختبارات الحية، ملاحظات عربية وإنجليزية، وGitHub Release بعد قرار Go.
  **الاعتماديات:** V14-UX-001 إلى V14-UX-009. **المرجع:** خطة 1.4، Task 10.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة (التحضير) — النشر بانتظار قرار Go
  الملفات: package.json + archive-next/package.json = 1.4.0،
    docs/release-notes/v1.4.0{,.ar}.md، docs/evidence/v1.4.0-ux-acceptance.md،
    READMEs، WHATS_NEW_RELEASE = 1.4.0 + حوارات ما الجديد بالغتين
  التحقق: release-notes 5/5 وWhatsNewDialog 3/3 أخضران؛ tsc نظيف
  القرارات: كوميت 146728e7؛ لا وسم ولا GitHub Release قبل البوابات الحية وقرار Go
  المتبقي: تشغيل pnpm verify:laravel-next:live وبوابات *.authed ثم قرار Go
  ```

- [x] **V14-UX-010 — تلميع CTA والتفاعل لكل صفحة (مراجعة UI/UX شاملة).**
  فحص آلي لكل واجهة (عناوين، أزرار primary/secondary، حالات فراغ، toolbar)
  ثم تنفيذ عشرة تحسينات موزعة على كل مجموعات الصفحات. **الاعتماديات:**
  V14-UX-008. **المرجع:** امتداد لخطة 1.4 بعد مراجعة اللقطات.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: app/{work-inbox,page,daily,activity,search,status,notifications,
    media/studio,projects}/page.tsx، components/OnboardingPrompt.tsx،
    قواميس ar/en (home, daily, workInbox, mediaStudio, searchResults, status)
  التحسينات:
    1. work-inbox: «إضافة مادة» primary + رابط اليومي في الـ toolbar
    2. الرئيسية: توحيد ui-button→button + «إضافة مادة جديدة» + CTA صندوق العمل
    3. media-studio: «تصفح الأرشيف» primary في الفراغ + رابط مهام الوسائط
    4. projects: زر إنشاء مشروع ترقّى إلى primary
    5. OnboardingPrompt: «فتح الجولة» secondary كي لا ينافس CTA الصفحة
    6. activity: «تحديث» primary وحيد + الفلاتر خلف DisclosureToolbar
    7. daily: الترحيب يحمل CTA اليوم + زر استعراض في فراغ المفضلة
    8. search: روابط وجهات سريعة في الفراغ + hint يفسر تعطيل «حفظ البحث»
    9. status: «فحص الآن» primary + «عرض سجل الأخطاء» عند انقطاع الاتصال
   10. notifications: «وضع الكل كمقروء» primary
  التحقق: tsc نظيف + 28/28 اختباراً أخضر — كوميت 7935f358
  ```

- [x] **V14-UX-011 — إصلاحات قابلية الاستخدام من جولة مراجعة UX كاملة.**
  جولة تشغيلية بمحاكاة مستخدم حقيقي على كل الصفحات مع قياسات آلية (أهداف
  النقر، التغذية الراجعة، التباين) كشفت ثماني مشاكل، عولجت جميعها.
  **الاعتماديات:** V14-UX-010. **المرجع:** امتداد لخطة 1.4.

  ```text
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات: lib/auth-session.tsx، app/{search,project-tasks,projects,inbox,
    status,activity,uploads/FilelessRecordForm}/page*.tsx،
    app/styles/{03-components,04-tables}.css
  الإصلاحات:
    P1 (حرج): تجديد صامت للجلسة قبل انتهاء التوكن بدقيقة — المستخدم النشط
      لم يُطرح لتسجيل الدخول بعد بضعة تنقلات
    P2 (حرج): summary العارية في <details> حصلت على هدف نقر 44px عبر
      disclosure-toolbar__summary (كانت ~21px في نموذج «بلا ملف»)
    P3: فراغ البحث يقترح عمليات بحث محفوظة/مثالاً مهيكلاً بنقرة واحدة
      بدل روابط تنقل لصفحات لا علاقة لها بالبحث
    P4: نموذج إنشاء المهام (7 حقول) خلف DisclosureToolbar؛ اللوحة تبقى
      أعلى الطية، ورابط كانبان رُقّي إلى primary
    P5: فراغ المشاريع يحمل CTA primary ينقل التركيز لحقل الإنشاء مباشرة
    P6: أسماء أحداث API الخام (post.api.v1.*) لم تعد تتسرب لعناوين
      النشاط؛ أفعال HTTP تُترجم لعربية مع تنظيف ذيل المسار
    P7: نموذج الإضافة السريعة في الوارد مميز بصرياً بإطار accent
      (.quick-add-form) عن رقائق الفلاتر أسفله
    P8: عند انقطاع الاتصال في حالة النظام يظهر banner خطأ في جسم الصفحة
      مع زر «عرض سجل الأخطاء» وليس في الـ toolbar فقط
  التحقق: قياسات آلية — أهداف نقر <24px: صفر بعد الإصلاح (كانت 1)؛
    تغذية راجعة بعد التفاعل 9/9 صفحات؛ tsc نظيف + 25/25 اختباراً
  القرارات: كوميت 9f1348f2؛ لقطة الجولة محفوظة في v14-ux-review/
  المتبقي (أُغلق 2026-09-12): P9 — بطاقة فراغ الرئيسية حصلت على إجراء ثانوي
    «فتح الأرشيف» بجانب الأساسي؛ P10 — زر «إغلاق التنقل» ثابت أسفل الدرج
    (منطقة الإبهام) مع اختبار حي nav-drawer-thumb-mobile أخضر — انظر كوميت الإغلاق أدناه.
  ```

## V14-UX-REVIEW — فحص UX للصفحات اليومية والعامة + i18n/CSS

- [x] فحص شامل: 9 مسارات × لغتين × مقاسين (مسبارات Playwright آلية) + تحليل ثابت لقواميس i18n و CSS
- [x] إصلاح السبب الجذري لتساقط جلسة va_session: نافذة سماح لإعادة استخدام refresh token (30ث)
  الحالة: مكتملة
  الملفات: archive-laravel/{app/Http/Controllers/Api/V1/AuthController.php,
    app/Http/Middleware/AuthenticateArchiveApiRequest.php, app/Models/ApiSession.php,
    config/archive.php, database/migrations/2026_08_23_000001_*.php,
    tests/Feature/AuthApiTest.php}
  الإصلاحات:
    B1 (حرج): تدوير التوكنات أصبح in-place مع حفظ الهاش السابق؛ التاب المتوازي
      الذي يخسر السباق يحصل على جلسة جديدة بدل 401/طرد للتسجيل
    B2: الميدل وير يقبل access token السابق داخل نفس نافذة السماح —
      الطلبات الطائرة لا تموت عند التدوير
  التحقق: AuthApiTest 13/13؛ اختبار سباق موازٍ حي يعيد 200/200
- [x] إصلاحات الواجهة اليومية والعامة
  الحالة: مكتملة
  الملفات: archive-next/{app/styles/{01-base,06-widgets,08-foundation}.css,
    app/notifications/page.tsx, "app/help/releases/[version]/page.tsx",
    app/activity/page.tsx, lib/i18n/dictionaries/{ar,en}/pages/activity.ts,
    lib/i18n/dictionaries/ar/pages/daily.ts}
  الإصلاحات:
    F1: أهداف نقر ≥24px (WCAG 2.5.8): روابط breadcrumb و«عرض الكل» وروابط
      دليل المساعدة ومبدّل لغة ملاحظات الإصدار — صفر مخالفات بعد الإصلاح
    F2: زر CTA لحالة فراغ الإشعارات عاد للعمل (button--primary → button-primary)
    F3: ملاحظات الإصدار تعرض لغة القارئ فقط مع رابط ?lang= للغة الأخرى
    F4: أحداث النشاط ذات الشكل HTTP تستخدم أفعالاً وأسماء من القاموس بدل
      مسارات API الخام في نص المستخدم
    F5: توحيد الصياغة «لا توجد إشعارات جديدة»
  التحقق: tsc نظيف؛ vitest (activity, notifications, dictionaries, حارس
    اللiterals العربية) أخضر؛ مسيرة Playwright بعدية بلا مخالفات
  القرارات: كوميت 4c0ce061 على master؛ اللقطات والمسابر في v14-agents/daily-public/
  المتبقي: مراجعة سلوك الجلسة على بيئة إنتاج بحِمل متعدد التابات الحقيقي

## V14-UX-REVIEW-2 — معالجة كل المتبقّي من الفحص

- [x] ألوان hex خارج الـ tokens (transcriber.module.css) -> color tokens
- [x] مسح i18n كامل لكل القواميس + تصحيح إملائي عربي على نطاق واسع
  الحالة: مكتملة
  الملفات: archive-next/lib/i18n/dictionaries/ar/** (30 ملفًا)،
    archive-next/app/transcriber/transcriber.module.css
  الإصلاحات:
    «جار / جاري» -> «جارٍ» في كل تسميات التحميل؛ «يحرر» كتسمية حالة ->
      «تحرير»؛ «مفعل» -> «مفعّل». لا مفاتيح ناقصة ولا نصوص غير مترجمة.
  التحقق: dictionaries.test + copy-quality + حارس الـ literals أخضر
- [x] تحصين تدفق الجلسة (تشخيص حي بالتتبع)
  الحالة: مكتملة
  الملفات: archive-next/lib/auth-session.tsx (+ اختباراته)
  الإصلاحات:
    S1: إعادة محاولة bootstrap على 401 العابر (سباق كتابة كوكي ما بعد الدخول)
    S2: تجاهل حدث unauthorized أثناء حالة loading
    S3: refreshSession يعيد المحاولة قبل الحكم بالموت
    S4: كاش bootstrap بـ10 ثوانٍ يمنع ازدواجية التدوير مع StrictMode
  التحقق: auth-session tests 12/12؛ تنقّل SPA حي 8/8 صفحات بمكالمة refresh
    واحدة. تساقطات مسار goto الكامل في الاختبار = استنزاف throttle الـIP
    (120/د) من سكربت الفحص نفسه — لا يصل إليه مستخدم حقيقي.
  القرارات: كوميت fd2e303e؛ /status وصف نقاط النهاية للإدارة بقيت كما هي
    (توثيق مقصود وليس تسريبًا)
  المتبقي: لا شيء من هذا الفحص

## V14-AUDIT — تدقيق شامل لواجهة archive-next (54 مسارًا، 3 وكلاء متوازيين)

> فحص كود ثابت بلا تشغيل متصفح فعلي (2026-08-23). 25 صفحة فُحصت بلا
> ملاحظات: system/control، backup، automation، rights، delegations،
> reports، status، help، errors، trash، login، data-center، types،
> first-run، duplicates، copilot، collections، reading-lists، kanban،
> shares/with-me، vocabulary، activity، work-inbox، inbox، daily.

### حرج (4) — يمس أمان البيانات أو يعطّل ميزة كليًا

- [x] **V14-AUDIT-001 — حذف/تغيير دور مستخدم بلا تأكيد.**
  archive-next/app/settings/users/page.tsx:99-121,154,282 —
  `handleDelete`/`handleRoleChange` ينفَّذان مباشرة من onClick/onChange،
  الصفحة الوحيدة في مجموعة الإعدادات بلا useConfirmDialog.
  **الإصلاح:** لفّ الدالتين بنفس نمط useConfirmDialog المستخدم في
  trash/types/automation/delegations.

- [x] **V14-AUDIT-002 — لوحة ODBC تحذف/تعدّل صفوفًا بلا تأكيد.**
  archive-next/app/settings/OdbcBridgePanel.tsx:76-126,262-269 — زر
  button-danger ينفّذ الحذف فور الضغط، بلا حوار.
  **الإصلاح:** نفس نمط useConfirmDialog.

- [x] **V14-AUDIT-003 — روابط الرفع الخارجية غير قابلة للاستخدام.**
  archive-next/app/uploads/UploadLinksPanel.tsx — تُنشئ الرابط لكن لا
  تعرض token أو رابط المشاركة ولا زر نسخ، رغم أن الـAPI يعيد token
  (lib/generated/archive-api.ts:7188).
  **الإصلاح:** اعرض رابط المشاركة المُركّب وزر نسخ عند الإنشاء.

- [x] **V14-AUDIT-004 — أزرار صفحة المراجعة العامة بلا تنسيق.**
  archive-next/app/review/[token]/ReviewLinkViewer.tsx:104,107 —
  className="button-primary" فقط بدل "button button-primary"؛ الصنف
  المعزول لون فقط ويعتمد على .button للتنسيق الأساسي.
  **الإصلاح:** أضف صنف button الأساسي لكلا الزرّين.

### عالي (5) — خلل واضح أو ثغرة إتاحة حقيقية

- [x] **V14-AUDIT-005 — borderLeft فعلي يكسر RTL في الوسوم.**
  archive-next/app/tags/page.tsx:230 — استخدم borderInlineStart بدل
  borderLeft؛ مؤشر لون الوسم يظهر على الجانب الخطأ بالعربية.

- [x] **V14-AUDIT-006 — لا حالة تحميل في مهام/مجموعات المشاريع.**
  archive-next/app/project-tasks/page.tsx:119،
  archive-next/app/project-groups/page.tsx:78 — القوائم تبدأ فارغة
  فيظهر "لا يوجد" قبل وصول البيانات، بعكس kanban/collections المجاورتين.
  **الإصلاح:** أضف اتحاد LoadState صريح بمرحلة "loading" + Skeleton.

- [x] **V14-AUDIT-007 — حالة خطأ المزامنة بلا role="alert" أو إعادة محاولة.**
  archive-next/app/sync/page.tsx:147-149 — تستخدم EmptyState بدل نمط
  state-banner state-banner-error المستخدم في duplicates/collections.

- [x] **V14-AUDIT-008 — main متداخل غير صالح في صفحة المشاركة العامة.**
  archive-next/app/share/[token]/page.tsx:18 +
  archive-next/app/share/[token]/ShareViewer.tsx:60 — main داخل aside
  داخل main آخر؛ يكسر تنقل المعالم لقارئات الشاشة.
  **الإصلاح:** غيّر العنصر الداخلي إلى div أو section.

- [x] **V14-AUDIT-009 — نص "synthetic: true" غير مترجَم.**
  archive-next/app/safety-preview/page.tsx:107,137 — لا مفتاح مطابق في
  ar/pages/safetyPreview.ts رغم أن الصفحة معرَّبة بالكامل.

### متوسط (13) — ديْن تجربة استخدام حقيقي

- [x] **V14-AUDIT-010 — ميتاداتا مُعروضة كـJSON.stringify خام.**
  archive-next/app/archive/page.tsx:880-882،
  archive-next/app/metadata-templates/page.tsx:144 — استبدل بشبكة
  kv-grid منظمة.

- [x] **V14-AUDIT-011 — إعادة تسمية بالنقر المزدوج بلا مؤشر بصري.**
  archive-next/app/archive/ArchiveRecordCard.tsx:106-109 — لا أيقونة
  قلم ولا tooltip يدل على التفاعل.

- [x] **V14-AUDIT-012 — 8 أزرار متساوية الوزن بلا تراتبية.**
  archive-next/app/archive/[id]/page.tsx:607-687 — أخفِ الإجراءات
  الثانوية خلف DisclosureToolbar كباقي الصفحات.

- [x] **V14-AUDIT-013 — وميض حالة فراغ قبل وصول البيانات.**
  archive-next/app/favorites/page.tsx:23-28،
  archive-next/app/metadata-templates/page.tsx:43-49 — لا حالة تحميل؛
  أضف Skeleton كسائر الصفحات المجاورة.

- [x] **V14-AUDIT-014 — تحميل غير محدود في الخط الزمني.**
  archive-next/app/timeline/page.tsx:117-146 — حلقة while(hasMore) بلا
  سقف، بعكس map.tsx التي تحدّد MAX_PAGES=25 مع تنبيه صريح.

- [x] **V14-AUDIT-015 — عناصر نائبة إنجليزية ثابتة في الفهرس.**
  archive-next/app/catalog/page.tsx:131,140 — "video"/"public" بدل
  المرور عبر كائن الترجمة.

- [x] **V14-AUDIT-016 — تفاوت مصطلح "بلا عنوان" مقابل "بدون عنوان".**
  archive-next/lib/i18n/dictionaries/ar/pages/discover.ts:21 — وحّد مع
  archiveList/archiveDetail/catalog/searchResults.

- [x] **V14-AUDIT-017 — قائمة اختيار الدور بلا aria-label.**
  archive-next/app/search/saved/page.tsx:147 — لا اسم إتاحي لقارئ
  الشاشة.

- [x] **V14-AUDIT-018 — لوحة role="dialog" غير حقيقية.**
  archive-next/app/files/page.tsx:582 — بلا aria-modal ولا حجز تركيز؛
  بقية الصفحة تبقى تفاعلية خلفها.

- [x] **V14-AUDIT-019 — تنسيق تاريخ يفرض ar-SA + لون شريط تقدم ثابت بالكود.**
  archive-next/app/media/jobs/MediaJobsList.tsx:705,681-683،
  archive-next/app/transcriber/page.tsx:348-349 — قارن مع
  StudioCommentsPanel.tsx:114 (يختار اللغة بشكل صحيح).

- [x] **V14-AUDIT-020 — تفاوت غنى حالة الفراغ داخل صفحة المفرغ الصوتي.**
  archive-next/app/transcriber/page.tsx:415 مقابل 429 — إحداهما
  EmptyState كامل والأخرى نص خام.

- [x] **V14-AUDIT-021 — بث/تعاون: نفس الميزة بتجربتين ومصطلحين مختلفين.**
  archive-next/app/broadcast/page.tsx:297-356،
  archive-next/app/collaboration/page.tsx:415-481 — وحّد غنى حالة
  الفراغ والمصطلح ("قفل التحكم" مقابل "أقفال التحرير/حجز المورد").

- [x] **V14-AUDIT-022 — حالتا تحميل ناقصتان في الإضافات وطلبات الموافقة.**
  archive-next/app/plugins/page.tsx:278-279 (EmptyState بلا
  role/aria-live، قارن analytics.tsx)،
  archive-next/app/approval-requests/page.tsx:38-46 (لا حالة تحميل
  إطلاقًا).

### منخفض (12) — صقل لا يعطّل شيئًا

- [x] **V14-AUDIT-023 — تباين بصري بين لوحات نفس صفحة الرفع.**
  archive-next/app/uploads/scheduled/ScheduledUploadsClient.tsx:147-153
  — نص خام بدل Skeleton.

- [x] **V14-AUDIT-024 — أرقام سحرية متفرقة.**
  archive-next/app/ingest/page.tsx:339 (inline style)،
  archive-next/app/graph/graph.css:26,165-171،
  archive-next/app/map/map.css — استبدل بـvar(--space-*).

- [x] **V14-AUDIT-025 — مؤشرات خط زمني أصغر من هدف اللمس 24×24px.**
  archive-next/app/media/studio/studio.module.css:66-74 (WCAG 2.5.8).

- [x] **V14-AUDIT-026 — لون hex خام لخلفية إطار الفيديو.**
  archive-next/app/media/media.css:53,159 — #020617 بدل رمز تصميم.

- [x] **V14-AUDIT-027 — تفاوت نحوي في تسميات حالة التعاون.**
  archive-next/lib/i18n/dictionaries/ar/pages/collaboration.ts:2-8 —
  viewing/reviewing فعل مضارع، editing اسم ("تحرير"). راجع مع كوميت
  fd2e303e الذي غيّرها عمدًا من "يحرر"؛ يحتاج قرار منتج لا إصلاح أعمى.

- [x] **V14-AUDIT-028 — حالة فراغ خام في عارض المشاركة.**
  archive-next/app/share/[token]/ShareViewer.tsx:74 — استخدم EmptyState
  كما في shares/with-me المجاورة.

- [x] **V14-AUDIT-029 — حذف إشعار بلا تأكيد أو تراجع.**
  archive-next/app/notifications/page.tsx:64-71.

- [x] **V14-AUDIT-030 — تسمية "إزالة" لحذف نهائي.**
  archive-next/app/settings/users/page.tsx:154 — وائم مع "حذف" في
  types.ts بعد إضافة حوار التأكيد (V14-AUDIT-001).

- [x] **V14-AUDIT-031 — تنقّل بإعادة تحميل كاملة في الخريطة.**
  archive-next/app/map/page.tsx:104 — window.location.href بدل Link من
  Next، بعكس القائمة المجاورة لنفس السجلات.

- [x] **V14-AUDIT-032 — تفاوت صياغة CTA في اليوم.**
  archive-next/app/daily/page.tsx — "إضافة مادة جديدة" (فعل) مقابل
  "صندوق العمل" (اسم) في نفس صف الأزرار الرئيسية.

- [x] **V14-AUDIT-033 — قيم افتراضية/أحجام سحرية لمُدخل اللون.**
  archive-next/app/tags/page.tsx:253,256.

- [x] **V14-AUDIT-034 — شريط تقدم بلون ثابت مكرر بلا رمز تصميم.**
  archive-next/app/media/jobs/MediaJobsList.tsx:681-683،
  archive-next/app/transcriber/page.tsx:348-349 — نفس
  rgba(0,0,0,0.1) مكرر حرفيًا في ملفين؛ استخرج مكوّنًا مشتركًا برمز
  تصميم واحد بدل التكرار.

## V14-UX-REVIEW-3 — رحلة الإدخال اليومية + صفحة الأرشيف

- [x] شاشة «إضافة مادة» — أكثر شاشة استخدامًا يوميًا
  الحالة: مكتملة
  الملفات: archive-next/app/uploads/{page,FilelessRecordForm}.tsx (+اختبار)،
    app/archive/ArchiveRecordCard.tsx، app/styles/07-ui-kit.css، قواميس ar/en
  الإصلاحات:
    I1: مسارات الإدخال الأربعة صارت بطاقات ظاهرة بدل إخفائها خلاف كشف
    I2: نموذج «بدون ملفات» يبقى في مكانه بعد الإنشاء مع بانر نجاح ورابط
      للسجل وزر «إضافة سجل آخر» — كان ينقلك بعيدًا كل مرة
    I3: شريط «آخر ما أضفته» يعرض أحدث 6 سجلات مع شارة اكتمال التوصيف
  التحقق: uploads suites 13/13؛ tsc نظيف
  القرارات: كوميت a03ba5de (أمُدّ لإزالة سكربت عابر: 1822e55b)
- [x] صفحة الأرشيف: شارة اكتمال التوصيف على بطاقة كل سجل
  الحالة: مكتملة
  الملفات: archive-next/app/archive/ArchiveRecordCard.tsx، قواميس ar/en
  التحقق: tsc نظيف؛ اختبارات الأرشيف خضراء
  المتبقي: لا شيء — أُغلقت في كوميت e9ea1e49

### الإغلاق

- [x] جميع بنود التدقيق الـ34 منجزة
  الحالة: مكتملة
  الدفعات: 19f054e3 (حرجة+عالية+متوسطة) · 451ff8c9 (منخفضة) · e9ea1e49 (012/014/018/020/021/027)
  القرارات:
    - AUDIT-012: «المفضلة» وحدها تبقى في الـ toolbar؛ البقية خلف «إجراءات أخرى»
    - AUDIT-014: سقف 25 صفحة كخريطة
    - AUDIT-018: نافذة حقيقية بتراكب وEscape
    - AUDIT-021/027: توحيد المصطلح على «قفل التحرير» والصياغة على اسم الفاعل
      (يشاهد/يراجع/يحرّر) — قرار المنتج المطلوب نُفّذ بهذا الاتجاه
  التحقق: tsc نظيف؛ 124/124 اختبارًا للمسارات المتأثرة أخضر

## V14-AUDIT-2 — دفعة تدقيق ثانية (إدارة، مكتبة، يومي/عام، تعاون، 4 وكلاء متوازيين)

> فحص كود ثابت (2026-08-24) لأربع مجموعات لم يشملها V14-AUDIT الأول:
> إدارة/نظام (12 مسارًا)، مكتبة (15 مسارًا)، يومي/عام (11 مسارًا)، تعاون
> (11 مسارًا: project-groups/kanban/delegations/rights/collaboration/broadcast
> وغيرها). كل النقاط أُصلحت وأُدمجت في master؛ تقارير الفحص الكاملة محفوظة
> في v14-agents/{admin,collab,daily-public,library}/*-ux-report.md.

- [x] **V14-AUDIT2-001 — خلل وظيفي: /timeline عالق في «جارٍ التحميل» للأبد.**
  archive-next/app/timeline/page.tsx — loadRecords لا يضبط الحالة إلى
  "success" بعد نهاية حلقة الصفحات؛ الصفحة لا تعرض أي سجل مطلقًا.
  **الإصلاح:** إضافة setState({status:"success",...}) بعد الحلقة. كوميت fdeec7ee.

- [x] **V14-AUDIT2-002 — استرجاع كلمة المرور غير قابل للوصول (حلقة إعادة توجيه).**
  archive-next/lib/public-paths.ts — /help/password-recovery لم يكن
  ضمن publicPathPrefixes، فيُعاد الزائر غير المسجَّل إلى /login التي
  فشل فيها أصلاً؛ الصفحة نفسها ناقصة "use client" رغم استخدام useLocale().
  **الإصلاح:** إضافة المسار للقائمة العامة + التوجيه المفقود. كوميت eacff482.

- [x] **V14-AUDIT2-003 — JSON.stringify خام في أخطر صفحة (system/control).**
  archive-next/app/system/control/page.tsx — نتيجة الإجراء تُعرض كـ
  `<pre>{JSON.stringify(...)}</pre>` خام. أُصلح أيضًا نفس النمط المتبقي
  في معاينة بيانات الأرشيف (nested objects). **الإصلاح:** lib/kv-format.ts
  (helper جديد قابل لإعادة الاستخدام) + kv-grid. كوميت eacff482.

- [x] **V14-AUDIT2-004 — ODBC "تحديث" بلا تأكيد رغم خطورته كالحذف.**
  archive-next/app/settings/OdbcBridgePanel.tsx — عملية update تكتب
  JSON حرًا مباشرة على صف موجود بلا حوار تأكيد (فقط delete كان محميًا).
  كوميت eacff482.

- [x] **V14-AUDIT2-005 — حالات خام/إخفاء صامت في automation وbackup وreports.**
  automation/page.tsx (run.status خام + نموذج القاعدة يختفي بلا تفسير)،
  backup/page.tsx (زر "تشغيل الآن" يختفي بلا تفسير)، reports/page.tsx
  (عمود الحدث خام رغم وجود ترجمة جاهزة للفلتر). كوميت eacff482.

- [x] **V14-AUDIT2-006 — حذف بلا تأكيد: reading-lists وgraph وsearch.**
  reading-lists/page.tsx (حذف قائمة كاملة)، graph/page.tsx (حذف علاقة
  يدوية)، search/page.tsx وsearch/saved/page.tsx (حذف بحث محفوظ؛
  الأخير كان يبلع فشل الحذف صامتًا بلا أي رسالة). كوميت fdeec7ee.

- [x] **V14-AUDIT2-007 — role="img" على svg خريطة العلاقات يخفي التفاعل عن AT.**
  archive-next/app/graph/page.tsx:130 — العقد الداخلية role="button"/
  tabIndex صحيحة لكن role="img" على الحاوية يُسقط الشجرة الداخلية من
  تقنية المساعدة. **الإصلاح:** role="group". كوميت fdeec7ee.

- [x] **V14-AUDIT2-008 — إخفاء صامت وحذف بلا تأكيد في /inbox.**
  archive-next/app/inbox/page.tsx — زر «توجيه للقسم» يختفي بلا رسالة
  لمن لا يملك records.edit؛ حذف عنصر بلا تأكيد. كوميت 2d35fdc8.

- [x] **V14-AUDIT2-009 — ثلاثة أزرار «تفريغ» في /daily بلا تأكيد.**
  archive-next/app/daily/page.tsx — تفريغ السلة/الطابور/السجل الأخير
  ينفَّذ فورًا. كوميت 2d35fdc8.

- [x] **V14-AUDIT2-010 — روابط رفع خارجية وقوالب إدخال: إلغاء/حذف بلا تأكيد.**
  archive-next/app/uploads/{UploadLinksPanel,IntakeTemplatesPanel}.tsx.
  كوميت 2d35fdc8.

- [x] **V14-AUDIT2-011 — إخفاء صامت لأزرار الصلاحيات في project-groups وrights.**
  archive-next/app/project-groups/page.tsx (~سطر 76) يخفي نموذج الإنشاء
  بالكامل لمن لا يملك collections.manage بلا أي رسالة؛ app/rights/page.tsx
  (~سطر 215) يخفي زر «تسجيل حقوق» بنفس الطريقة (`canManageRights ? <button/> : null`).
  **الإصلاح:** استبدال null بـ `<p className="helper-text">` برسالة noPermission
  مترجمة، كما في delegations/kanban. كوميت ef38be8d.

- [x] **V14-AUDIT2-012 — قرارات اعتماد جماعي غير قابلة للتراجع بضغطة واحدة.**
  archive-next/app/approval-requests/page.tsx — دوال decide/execute كانت
  تنفّذ approve/reject/execute فورًا بلا تأكيد رغم كونها إجراءً جماعيًا
  (bulk-macro) على عناصر متعددة. **الإصلاح:** useConfirmDialog بنمط
  destructive قبل كل قرار/تنفيذ. كوميت ef38be8d.

- [x] **V14-AUDIT2-013 — فقدان صامت لتعديلات المستخدم عند تعارض حفظ التعاون الحي.**
  archive-next/app/collaboration/page.tsx (saveDocument، ~سطر 313) وapp/broadcast/page.tsx
  (saveRundown) كانا يستبدلان محتوى الـtextarea بمحتوى الطرف الآخر عند
  تعارض النسخة دون أي تحذير، ما يُفقد كتابة المستخدم غير المحفوظة صامتًا.
  **الإصلاح:** حوار تأكيد «تحميل نسختهم» مقابل «الاحتفاظ بتعديلاتي» قبل
  الاستبدال. كوميت ef38be8d.

- [x] **V14-AUDIT2-014 — حالات خام غير مترجمة وتحذير مفقود عند إسقاط أهداف غير صالحة.**
  archive-next/app/broadcast/page.tsx (~سطر 304) يعرض participant.status
  الخام بالإنجليزية (viewing/reviewing/editing) داخل badge؛ app/projects/page.tsx
  (~سطر 476) يعرض exportJob.status الخام كذلك؛ وapprovalRequests/page.tsx
  (parseTargets، ~سطر 12) كان يتجاهل أجزاء "store:id" غير الصالحة صامتًا
  بلا أي تحذير للمستخدم. **الإصلاح:** خرائط تسمية مترجمة لكلتا الصفحتين
  (إعادة استخدام statusLabels الحالية في broadcast) + رسالة تحذير عند
  إسقاط أهداف غير صالحة في approval-requests. كوميت ef38be8d.

  **نقاط تحقَّق منها الفحص وتبيَّن أنها إيجابيات كاذبة (لم تُعدَّل):**
  vocabulary/page.tsx removeTerm لديه بالفعل مكدّس تراجع (V1-732D)؛
  نموذج «استيراد من رابط» في uploads يوسم نفسه بوضوح كمعاينة فقط مع
  توجيه صريح لمسار الإكمال الفعلي، ويقع أصلاً تحت كاشف "خيارات إدخال
  أخرى" الثانوي وليس ضمن المسارات الرئيسية الأربعة.

  التحقق: tsc نظيف بعد كل دفعة (4 دفعات: eacff482، fdeec7ee، 2d35fdc8، ef38be8d)

## قالب التسليم

```text
المالك:
الحالة:
الملفات:
التحقق:
القرارات:
المتبقي:
```

## 1.5-NLE — المرحلة الثانية: التوسع التشغيلي ومحرر NLE

> مصدر الخطة:
> [`docs/superpowers/plans/2026-08-26-v1.5.0-operational-nle-expansion.md`](docs/superpowers/plans/2026-08-26-v1.5.0-operational-nle-expansion.md).
> بنيت على عقد 1.5 الأساسي (commits 6765ce4a..ce1e13ed). المراجع الرجعية للنظام:
> `CLAUDE.md` و`AGENTS.md` (canonical = archive-next + archive-laravel + docs/api).

- [x] **1.5-NLE-1 — عقد Montage المُراجَع + مخطط DB + OpenAPI + توليد العميل.**
  المالك: ox-alpha (هذا الوكيل)
  الحالة: مكتملة
  الملفات:
    docs/api/archive-contract.openapi.json (schemas: MontageSource, MontageClip,
      MontageProjectRevision, MontageExportRequest/Response, MontageRevision*…)
    archive-laravel/database/migrations/2026_08_26_000001_create_montage_revision_tables.php
    archive-laravel/app/Models/{MontageProject,MontageProjectRevision,MontageExport}.php
    archive-laravel/database/factories/MontageProjectFactory.php
    archive-next/lib/generated/archive-api.ts (regenerated)
    archive-next/lib/archive-api.contract.test.ts
  التحقق: verify-api-contracts أخضر؛ generate-api-types verify أخضر؛
    tsc نظيف؛ عقد TS 5/5 أخضر
  القرارات: كوميت ab4463d1؛ revisions/exports تكتسب uuid تلقائيًا عند الإنشاء
  المتبقي: لا شيء

- [x] **1.5-NLE-2 — مراجعات المشروع المتحقق منها + تعارضات + صلاحيات (domain).**
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات:
    archive-laravel/app/Domain/Montage/{MontageTimelineValidator,MontageProjectService,
      MontageRevisionConflict,MontageValidationException}.php
    archive-laravel/app/Http/Controllers/Api/V1/MontageRevisionsController.php
    archive-laravel/routes/api.php
    archive-laravel/tests/Feature/Api/MontageRevisionsApiTest.php
  التحقق: Montage suite (docker runtime) 30/30 أخضر؛ 409 حتمي على expectedRevision
    قديم بلا كتابة
  القرارات: كوميت ab4463d1 + 038a7fd8
  المتبقي: لا شيء

- [x] **1.5-NLE-3 — البروكسي الآمن + معالجة التصدير (allowlist).**
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات:
    archive-laravel/app/Domain/Montage/{MontageRenderManifest,MontageRenderManifestBuilder,
      MontageExportService}.php
    archive-laravel/app/Http/Controllers/Api/V1/MontageExportsController.php
    archive-laravel/tests/Unit/Domain/MontageRenderManifestBuilderTest.php
  التحقق: 3/3 وحدة manifest (رفض مسار/كود العميل 422)؛ Exports API idempotent
    لكل project+revision+preset نشط؛ 409 على stale revision
  القرارات: كوميت 038a7fd8؛ كل معامل FFmpeg من allowlist خادم، المصدر يُحل من
    record id + source_version_token لا من مسار العميل
  المتبقي: لا شيء

- [x] **1.5-NLE-4 — محرك تحرير العميل النقي + واجهة API مولّدة.**
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات:
    archive-next/lib/{montage-editor,montage-autosave}.ts (+اختبارات)
  التحقق: 11/11 أخضر؛ undo/redo stacks؛ autosave coordinator يجهض الطلبات
    المتجاوزة ويعيد conflict حتميًا بلا فقد تعديلات محلية
  القرارات: كوميت ab4463d1
  المتبقي: لا شيء

- [x] **1.5-NLE-5 — نواة استوديو NLE متاحة (TimelineCanvas + MediaBin).**
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات:
    archive-next/components/montage/{TimelineCanvas,MediaBin,MontageEditorPanel}.tsx
    archive-next/components/montage/{TimelineCanvas,StudioPanels}.test.tsx
    lib/i18n/dictionaries/{ar,en}/pages/mediaStudio.ts (قسم montageEditor)
  التحقق: 14/14 أخضر؛ حارس الـliterals العربية (V2-305) أخضر؛ كل النصوص من
    القاموس لا من المكوّن
  القرارات: كوميت 522ccd7b + e3506914؛ اللوحة تُضاف بجوار لوحة الاستوديو
    القائمة (TimelinePanel) ولا تستبدلها
  المتبقي: لا شيء

- [x] **1.5-NLE-6 — NLE المتقدم: تصدير + تعاون + معاينة + ربط حي.**
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات:
    archive-next/components/montage/ExportDrawer.tsx (+StudioPanels.test.tsx)
    archive-next/app/media/montage/[id]/page.tsx (route حيّ يربط المحرر)
    archive-next/components/montage/MontageEditorPanel.tsx (مرتبط بالعميل)
    archive-next/lib/archive-api.ts (montageProject/montageActiveRevision +
      montageSaveRevision/montageRequestExport عبر العميل)
    archive-laravel/app/Http/Controllers/Api/V1/MontageRevisionsController.php
      (show = GET المراجعة النشطة) + route جديد
  التحقق: 9/9 ExportDrawer + 14/14 MontageEditorPanel (هيكل/RTL) + 43/43
    Laravel Montage (docker)؛ zر التصدير محجوب حتى اجتياز QC؛ presets من
    allowlist فقط؛ الحصول على المشروع/المراجعة النشطة + الحفظ/التصدير عبر
    عقد العميل المعتمد
  القرارات: كوميت b26caa36؛ المحرر الذي كان «ميتًا» (مبني بلا تركيب) صار
    مُركّبًا بمسار فعلي — إغلاق فخ «الميزة الميتة» الذي علّمتني إياه مراجعة
    v1.5
  المتبقي: لا شيء

- [x] **1.5-NLE-6b — سطح presence وتقدّم التصدير الآمن (Step 4).**
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات:
    archive-next/lib/montage-presence.ts (+اختبار 4/4 أخضر)
    ربط presence عبر CollaborationController النظامي (collaborationPresence
      roomKey montage:{projectId}) — لا endpoint وهمي
    archive-next/components/montage/MontageEditorPanel.tsx (استقصاء آمن +
      role=status live region)
  التحقق: montage-presence 4/4 أخضر؛ حارس V2-305 أخضر؛ الاستقصاء يتجاهل
    أخطاء الشبكة العابرة وآمن ضد unmount
  القرارات: كوميت b26caa36؛ طبقة Reverb/WS الحية تُستبدل لاحقًا بلا تغيير
    نقاط الاستدعاء (العقد النقي موجود في montage-presence.ts)
  المتبقي: لا شيء

- [x] **1.5-NLE-7 — تمديد العمل اليومي للمعالجة/التصدير.**
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات:
    archive-next/lib/{media-work-inbox,montage-search}.ts (+اختبارات)
  التحقق: 10/10 أخضر؛ فشل التصدير يبقى قابلًا للعمل (retry واحد مُتاح حسب
    صلاحية الخادم)؛ buildStudioHref مشتق من id آمن + timestamp منتهٍ
  القرارات: كوميت 4bff8c6a
  المتبقي: لا شيء

- [x] **1.5-NLE-8 — سير الاستقبال المجزأ (wizard state machine).**
  المالك: ox-alpha
  الحالة: مكتملة
  الملفات:
    archive-next/lib/project-intake.ts (+اختبار)
  التحقق: 6/6 أخضر؛ تكرار = قرار صريح لا دمج تلقائي؛ الإرسال يتطلب حقوقًا
    مؤكدة + مشروع وجهة
  القرارات: كوميت e188a35a
  المتبقي: لا شيء

- [x] **1.5-NLE-9 — بحث المشاريع/المقاطع/المشتقات (kind/project filters).**
  المالك: ox-alpha
  الحالة: مكتملة (مدمج في 1.5-NLE-7 عبر montage-search.ts)
  الملفات: archive-next/lib/montage-search.ts (+اختبار)
  التحقق: 5/5 أخضر؛ MontageSearchKind union؛ وصف معاينة clip لقارئ الشاشة
  القرارات: كوميت 4bff8c6a
  المتبقي: لا شيء

- [x] **1.5-NLE-10 — القبول وبوابات الإصدار.**
  المالك: ox-alpha
  الحالة: مكتملة — Step 3 مُغلق ببديل قابل للتشغيل
  الملفات:
    docs/releases/1.5-ui-ux-acceptance.md
    archive-next/components/montage/montage.snapshot.test.tsx (4 لقطات DOM)
    archive-next/components/montage/__snapshots__/montage.snapshot.test.tsx.snap
    archive-next/components/montage/MontageEditorPanel.test.tsx (14 هيكل/RTL)
  التحقق: كل البوابات دون اتصال خضراء — 1137 اختبار Next / 215 ملف؛
    tsc نظيف؛ next build exit 0؛ عقود API + العميل المولَّد متحقَّقان؛
    Montage Laravel 43/43 (docker)
  القرارات: كوميت 30ba0758 (بوابات) + 8aaba20a (خط أساس هيكلي) +
    e4c1c6c7 (لقطات DOM). لا وسم/نشر قبل قرار Go
  المتبقي: Step 3 — لقطات الانحدار البصري production-mode (PNG) تحتاج
    الحاوية الكاملة؛ البديل المُعتمد الآن: لقطات DOM (toMatchSnapshot)
    لمكوّنات المونتاج الأربعة توثّق الخط الأساسي للهيكل + التسميات +
    اتجاه RTL بلا بيئة حية — تُراجَع عبر `pnpm test` وتُحدَّث عند
    تغيير مقصود

### دمج مراجعة وكيل آخر (codex/v1.5-operational-nle -> ba560618)

- [x] **1.5-NLE-AUTH — طبقة التفويض الصلبة التي أضافها الوكيل الآخر.**
  المالك: agent (codex/v1.5-operational-nle) — دُمجت بـ fast-forward
  الحالة: مكتملة + مُصلَح فخ دمج
  الملفات:
    archive-laravel/app/Policies/{MontageProjectPolicy,MontageExportPolicy}.php
    archive-laravel/app/Providers/AuthServiceProvider.php
    archive-laravel/app/Http/Controllers/Controller.php (archiveUser + require*)
    archive-laravel/app/Http/Controllers/Api/V1/{MontageRevisions,MontageExports,
      MontageProjects}Controller.php (ربط Gate + ApiError)
    archive-laravel/tests/Feature/Api/MontageAuthorizationApiTest.php (310 سطر)
    docs/api/archive-contract.openapi.json (توسعة +682 سطر schema/errors)
  التحقق: MontageAuthorization 12/12 أخضر؛ RoleMatrixApiTest سليم
  الفخ المُصلَح (هذا الوكيل، d6802e45): MontageProjectPolicy.delete كان
    admin-only فقط، متعارضًا مع RoleMatrix (editor ينشئ/يعدّل/يحذف) ما سبب
    تلوّث اختبارات 1/42 عند التشغيل المجمّع. صار delete يسمح للمحرر المالك
    (تماشيًا مع العقد القائم). أُعيدت تسمية الاختبار المتعارض إلى
    test_owner_editor_can_delete_owned_project_but_viewer_cannot.
  القرارات: كوميت ba560618 (الوكيل) + d6802e45 (إصلاح الدمج)
  المتبقي: لا شيء — suite 42/42 أخضر

## مسار الإصدار 1.5.1

> **ملاحظة:** نطاق هذا القسم (تجهيز الإصدار، المُثبّت والمدير، وحزمة
> Native Standalone) شُحن فعليًا تحت الوسم `v1.5.2` بعد أن اتسع العمل ليضم
> إصلاحات CVE وترقيع مفاتيح Passport المسرَّبة، فتغيّر رقم الإصدار المستهدف
> أثناء التنفيذ. المهام الثلاث أُغلقت أدناه بأدلة من الإصدار المنشور فعليًا.

- [x] **1.5.1-REL-001 — تجهيز ونشر إصدار 1.5.1 (شُحن كـ v1.5.2).** تحديث رقم
  الإصدار في المسارات المعتمدة، وإعداد ملاحظات الإصدار العربية والإنجليزية،
  وتجهيز أصول Docker وNative والحزمة دون اتصال، مع توثيق تنزيل وتجميع الحزمة
  المقسّمة وفك ضغطها والتحقق من بصماتها على Windows وLinux.

  ```text
  المالك: تلقائي (run2)
  الحالة: مكتملة
  الأدلة: package.json = 1.5.2؛ docs/release-notes/v1.5.2{,.ar}.md موجودان؛
    GitHub Release v1.5.2 منشور (gh release view v1.5.2) بكل الأصول: مُثبّت
    Windows/Linux، أرشيفات Native لكل منصة، حزمة offline مقسّمة على جزأين مع
    OFFLINE-BUNDLE-SHA256 وتعليمات تجميع لـ Linux/macOS (cat) وWindows
    (copy /b)؛ final-manifest.json يوثّق builtAt ورقم الإصدار.
  القرارات: كوميت 59d76fbc (CVE + تسريب مفاتيح Passport) وd85fa4cc (شحن
    المُثبّت والمدير) و34b19964 (تسجيل الأدلة وملاحظات الإصدار).
  المتبقي: توثيق macOS غير متوفر — لا يوجد أصل Native أو تعليمات مخصّصة
    لـ macOS في هذا الإصدار؛ يُترك لمهمة لاحقة إذا صار مطلوبًا.
  ```

- [x] **1.5.1-INSTALLER-001 — توفير مُثبّت ومدير نظام قابل للتنزيل من صفحة
  الإصدار (شُحن كـ v1.5.2).** بناء برنامج مُثبّت رسمي يكتشف نظام التشغيل
  والمعمارية، ويتحقق من سلامة الأصل قبل تشغيله، ويثبّت Archive Suite من أصل
  الإصدار المناسب (بما في ذلك الحزمة المقسّمة عند الحاجة)، ثم يوفّر إدارة
  دورة الحياة اليومية.

  ```text
  المالك: تلقائي (run2)
  الحالة: مكتملة
  الأدلة: scripts/control-center/ يضم أكثر من 60 وحدة (install-preflight،
    setup-wizard، operations، update-release، rollback-release، uninstall،
    windows-services، linux-services، native-launchers، …)؛ ملاحظات
    v1.5.2 تسرد صراحة أوامر دورة الحياة: status وstart وstop وrestart
    وlogs وhealth وrepair وbackup عبر runtime adapters قائمة؛ docs/
    installer-manager.ar.md يوثّق أن repair يستأنف الإعداد دون حذف بيانات
    التطبيق، وأن الانتقال بين Native وDocker يتم عبر النسخ الاحتياطية؛
    أصول المُثبّت (Archive-Suite-Installer-Windows.zip وarchive-suite-
    installer-linux.tar.gz) وبصماتها SHA256SUMS مرفوعة على GitHub Release
    v1.5.2.
  المتبقي: لا شيء ملاحظ ضمن نطاق هذا التدقيق.
  ```

- [x] **1.5.1-NATIVE-001 — استكمال نسخة Native Standalone بأدوات التثبيت
  والإدارة (شُحن كـ v1.5.2).** توفير حزمة مستقلة كاملة للمستخدم لا تعتمد
  على Docker، مع أدوات تثبيت وإعداد وفحص مسبق وإدارة الخدمات ودورة الحياة
  الكاملة.

  ```text
  المالك: تلقائي (run2)
  الحالة: مكتملة
  الأدلة: أصول archive-suite-v1.5.2-{linux,windows}-native.tar.gz منشورة على
    GitHub Release v1.5.2 ببصمات SHA256 موثّقة في RELEASE.json؛ رحلة تحقّق
    Windows الكاملة (v1-206-rehearsal-evidence.json ضمن final-manifest.json)
    سجّلت نجاح install وbundled-data-and-six-services-active وhttp-health
    وuninstall، مع تنظيف كامل (dockerResourcesAbsent وservicesAbsent
    وapplicationRootAbsent) بعد الاختبار؛ docs/native-installation{,.ar}.md
    موجودان.
  ملاحظة اعتمادية: قسم "1.5.1-NATIVE-001" في docs/superpowers/plans/
    2026-08-30-v1.5.1-native-dependencies.md (توريد PostgreSQL/pgvector/
    Redis الأصلية) نُفّذ فعليًا: كل الاثني عشر متغيّر مستودع (WINDOWS_*
    وLINUX_* لكل من postgres/pgvector/redis) موجودة عبر gh variable list،
    وإصدار native-dependencies-v1.5.1 منشور. سير عمل
    .github/workflows/native-dependencies.yml غير موجود كملف دائم على
    master — يبدو أنه شُغّل يدويًا وقت النشر لا كملف Workflow محفوظ؛ إن
    احتيج تكرار نشر تبعيات أصلية مستقبلاً فيجب إعادة إنشاء هذا الملف من
    الخطة أعلاه قبل التشغيل.
  المتبقي: إعادة إنشاء .github/workflows/native-dependencies.yml إذا
    احتيج تحديث تبعيات PostgreSQL/pgvector/Redis مستقبلاً.
  ```

## خطة الإصدار 2 — سجل المتابعة النشط

> لا تتحول المهمة إلى «مكتملة» بوجود تصميم أو كود فقط؛ يلزم دليل قبول قابل
> للتحقق. الحالة: `[x]` مكتملة، `[-]` قيد التنفيذ، `[!]` معلّقة، `[ ]` لم تبدأ.

### لوحة المتابعة المختصرة

> هذه هي المهام التي يجب متابعتها في كل جلسة عمل للإصدار 2. لا يبدأ صف لاحق
> يعتمد على صف سابق قبل تسجيل دليله في هذه الصفحة. المالك هو الوكيل المنفذ
> حاليًا، ويصبح «متاحًا» عند تسليم الدليل أو إزالة العائق.

| الترتيب | المهمة | الحالة | الاعتماد | دليل الإغلاق المطلوب |
| --- | --- | --- | --- | --- |
| 1 | V2-MEDIA-002 تمثيلات الوسائط | `[-]` | V2-MEDIA-001 | عقد + Laravel + Next + اختبار يثبت إخفاء المشتقات القديمة بعد استبدال المصدر |
| 2 | V2-MEDIA-003 الفحص وQC | `[ ]` | V2-MEDIA-002 | `ffprobe` حقيقي وحالات نجاح/فشل/إعادة محاولة وتدقيق تجاوز QC |
| 3 | V2-MEDIA-004 الوصف والبحث الزمني | `[ ]` | V2-MEDIA-002، V2-MEDIA-003 | بحث حي يفتح المقطع أو التفريغ عند الزمن الصحيح |
| 4 | V2-OPS-001 صندوق العمل | `[ ]` | 1–3 | رحلة تشغيل كاملة بلا رابط مخفي أو بحث يدوي |
| 5 | V2-OPS-002 الإدخال والدفعات | `[ ]` | V2-MEDIA-003 | checksum واستئناف وربط ملف–دفعة–سجل مثبتة حيًا |
| 6 | V2-OPS-003 حالة الخدمات | `[ ]` | 2، 5 | حالات طوابير صادقة وإجراء تدارك صحيح لكل فشل |
| 7 | V2-UX-001 إلى V2-UX-003 | `[ ]` | شاشات 1–6 | لقطات حية وسجل نتائج `.design/` لجميع العائلات |
| 8 | V2-GOV-001 وV2-GOV-002 | `[ ]` | تمثيلات الوسائط | حقوق وحفظ ونزاهة بلا كشف بيانات حساسة |
| 9 | V2-UI-004 الاستوديو | `[-]` | 1–4 | فحص حي لكل العمليات الفعلية في 1280 و768 و375 |
| 10 | V2-REL-001 إلى V2-REL-003 | `[ ]` | كل ما سبق | قبول طرفي، بوابات جودة، ثم موافقة نشر صريحة |

#### نقطة المتابعة الحالية — V2-MEDIA-002

- [x] **V2-MEDIA-002a — عقد تمثيل الوسيط.** تعريف `MediaRepresentation`
  وهوية الإصدار وأنواع `source|preservation|mezzanine|proxy|thumbnail|waveform|text|output`
  وحالاتها، مع منع كشف مفاتيح التخزين ومساراته للمتصفح. الدليل: endpoint
  `GET /records/{id}/media-representations` وعقد OpenAPI والعميل المولّد،
  واختبارات العقد 2026-09-14.
- [x] **V2-MEDIA-002b — سجل النسخ في Laravel.** تدقيق 2026-09-15: هذا موجود
  فعلًا لأنواع `thumbnail|waveform|proxy` عبر هجرة
  `2026_08_18_000003_create_media_derivatives_table.php` ونموذج
  `MediaDerivative`: علاقة بالسجل (`record_store`+`record_uid`، بنفس عرف
  `review_sessions`/`media_clips`) وبالمرفق (`attachment_id` nullable)، مع
  `version_token` بصمة المصدر التي أنتجت منها النسخة (نفس
  `ReviewSessionService::resolveVersionToken`). لا حاجة لجدول/نموذج مستقل
  بنفس الشكل — يبقى المتبقي الحقيقي هو تخزين فعلي لأنواع الحفظ/mezzanine/النص
  التي لا يوجد لها خط توليد بعد (انظر ملاحظة V2-MEDIA-002 أدناه).
- [x] **V2-MEDIA-002c — تزامن الاستبدال.** تدقيق 2026-09-15: مُنفَّذ ومختبر
  فعلًا عبر `MediaDerivativeService::isCurrentVersion()` (يعيد حساب البصمة
  الحية ويقارنها بالمخزنة) و`MediaRepresentationsController::index()` (يصفّي
  حسب `versionToken` الحالي فقط). النسخة القديمة البصمة لا تظهر في جرد السجل
  أو الاستوديو (`test_media_representations_list_the_current_source_and_never_include_a_stale_derivative`)
  ولا تُشغَّل كوسيط حالي (`GET /media-derivatives/{id}/content` يرد `409` عبر
  `test_a_stale_derivative_is_not_streamable_as_current_media`). كلتا
  الواجهتين (السجل والاستوديو) تعرضان فقط ما يعيده هذا العقد المصفّى، فلا
  توجد نسخة قديمة قابلة للعرض في أي مسار.
- [x] **V2-MEDIA-002d — واجهة السجل والاستوديو.** عرض صريح لما هو موجود فقط:
  لا تظهر نسخة حفظ أو mezzanine بوصفها جاهزة ما لم تسجلها الخدمة فعلًا. الدليل:
  `MediaRepresentationsPanel` في السجل والاستوديو واختبار واجهة وحدي بالعربية.
- [-] **V2-MEDIA-002e — اختبار القبول.** اختبار API يثبت المصدر والمشتقات
  الحالية، ثم استبدال المصدر، ثم اختفاء النتائج القديمة (18 اختبار Laravel
  ناجحًا في `MediaDerivativesApiTest`). يتبقى فحص حي للواجهة عند 1280 و375.
  تقدم 2026-09-15: أضيف اختبار قبول جديد يثبت أن مصدرًا محذوفًا من التخزين
  (بعد أن سجله السجل) يظهر بحالة `missing` صراحة بدل الادعاء الكاذب بأنه
  `ready` — العيب كان أن `MediaRepresentationsController` يفترض جاهزية
  المصدر من مجرد وجود `filePath`/`fileName` في بيانات السجل دون التحقق من
  وجود الملف فعليًا على قرص `ingest.disk`. أضيف فحص `Storage::exists()` وقيمة
  `missing` إلى عقد OpenAPI (`MediaDerivativeStatus`) والعميل المولّد ونصوص
  الواجهة العربية/الإنجليزية معًا حتى لا ينحرف العقد عن التنفيذ. اكتُشف أيضًا
  أثناء التحقق الكامل عيب منفصل غير مرتبط: `RouteScopeTest` لم يكن يصنّف
  `GET /records/{id}/media-representations` منذ إضافته في جلسة سابقة
  (56f2439a)، فأُضيف إلى `FIXTURE` و`ROLE_FIXTURE` بنفس معيار
  `media-derivatives` القرائي (مصادقة فقط، أي دور). 19/19 اختبار
  `MediaDerivativesApiTest` والمجموعة الكاملة للواجهتين ناجحة (1242 اختبار
  Next.js + كامل PHPUnit) بعد الإصلاح. يتبقى فحص حي للواجهة عند 1280 و375
  و`V2-MEDIA-002b`/`V2-MEDIA-002c` لإغلاق `V2-MEDIA-002` بالكامل.

### P0 — مساحة العمل والفيديو

- [x] **V2-UI-001 — واجهة عربية موحدة واتجاه RTL افتراضي.** الدليل: `f6a172fa`.
- [x] **V2-MEDIA-001 — تشغيل مادة فيديو مرفوعة من الواجهة.** الدليل: بث Laravel المحمي يدعم `Range` واختبار محلي بمادة MP4؛ `065175ae`.
- [x] **V2-UI-002 — شجرة التسلسل الأرشيفي المؤسسي.** الدليل: شجرة قابلة للطي واختبارها؛ `8f70ba45`.
- [x] **V2-UI-003 — جاهزية مادة الفيديو وإجراءها التالي في الاستوديو.** الدليل: المصدر والفحص والتفريغ/الوصف في الاستوديو واختبارها؛ `c536fea1`.

- [-] **V2-UI-004 — مساحة عمل أصل الفيديو الاحترافية.**
  النطاق: المشغّل وtimecode والنسخ والمشتقات والتفريغ والمقاطع والتعليقات
  والمهام وحالات الفحص، من دون ادعاء قدرة غير موجودة.
  القبول: فحص حي بالعربية على 1280 و768 و375، ومادة فيديو فعلية تمر من السجل
  إلى الاستوديو، وكل حالة ظاهرة مرتبطة ببيانات العقد الفعلية.
  التقدم 2026-09-14: شغّلت `e2e/media-studio.authed.spec.ts` و
  `e2e/media-studio-timeline.authed.spec.ts` فعليًا لأول مرة عبر
  `pnpm verify:laravel-next:live` (كانتا موسومتين "NOT RUN LIVE" من تأليفهما).
  التشغيل الحي كشف وأصلح عيبين حقيقيين قبل أن يصلا لأي قبول:
  (1) عيب أمان/صحة حقيقي في الخلفية — `AuthController::refresh()` كان يدوّر
  رمز الوصول دون إعادة إصدار كوكي `va_media`، فتفقد أي جلسة تجاوزت أول تدوير
  للرمز تشغيل الوسائط في كل مكان حتى تسجّل الدخول من جديد (تحقّق عبره
  `AuthApiTest`)؛ (2) اختبارات كانت تستخدم تسميات إنجليزية مخمَّنة لا تطابق
  واجهة عربية بالكامل، وطلب API خارج نطاق الواجهة بلا مصادقة صالحة. بعد
  الإصلاح: 9/9 اختبارات ناجحة حيًّا (مشغّل، timecode، تفريغ، تعليقات/علامات
  زمنية حيّة وbroadcast مباشر، مهام، جاهزية) + لقطة `desktop-1280` بلا فيضان
  أفقي عبر `visual-regression-authenticated.authed.spec.ts`.
  فحص مرن 2026-09-14: نجح المشغّل والتفريغ والتعليقات ومواصفات الملف على
  768 و375. أضيف وصول متدرج إلى شجرة المشتقات والخط الزمني وStudioRecordTasks
  تحت 900px، واختُبر حيًا على 375؛ تبقى مفتوحة تلقائيًا على سطح المكتب.
    فحص 2026-09-14: سُطِّحت داخل الإفصاح المتدرج في الاستوديو نتيجة الفحص
    الفني وQC الحقيقية، بما فيها بصمة النسخة وحالة التجاوز الموثق، وكذلك
    المقاطع الوصفية المحفوظة من `recordSegments` مع انتقال المشغّل إلى بدايتها.
    تحقّق حي على 375 من بقاء هذه المساحة مطوية أولًا ثم ظهورها كاملة عند طلبها.
    يبقى `/records/{id}/clips` مخصصًا لمقاطع التحرير غير الإتلافية في
    `/media/compare` إلى أن تُصمَّم رحلة تحرير مقطع كاملة داخل الاستوديو؛ لا
    ينبغي نسخها كقائمة شكلية بلا عملياتها.

- [-] **V2-MEDIA-002 — نموذج نسخ وتمثيلات الوسائط الصريح.**
  القبول: يعرض السجل والاستوديو أصل الحفظ وmezzanine وproxy والصورة المصغرة
  والنصوص والمخرجات بهوية إصدار واضحة، ولا يستخدم ناتجًا قديمًا بعد تغير المصدر.
  تدقيق 2026-09-14: الموجود حاليًا هو `media_derivatives` للأنواع
  `thumbnail|waveform|proxy` مع `versionToken` و`isCurrentVersion` صحيحين،
  وملخص سجل يعرض حالاتها فقط. لا يوجد بعد عقد أو تخزين لـ`MediaAsset` أو
  `MediaRepresentation`، ولا هوية صريحة للأصل أو نسخة الحفظ أو mezzanine أو
  النصوص؛ لذلك لا يكفي العرض الحالي لقبول هذه المهمة.
  تقدم 2026-09-14: أضيف جرد `MediaRepresentation` عام ومتعاقد عليه يعرض
  المصدر والمشتقات الحالية فقط ببصمة الإصدار نفسها، ويخفي تلقائيًا المشتق
  القديم بعد استبدال المصدر. ظهر في السجل والاستوديو من دون مفاتيح أو مسارات
  تخزين. لا تزال المهمة مفتوحة إلى أن تُضاف طبقة التخزين الفعلية لنسخ الحفظ
  وmezzanine والنص والمخرجات، ثم يكتمل فحص الواجهة الحي.
  تدقيق 2026-09-15: أُغلق V2-MEDIA-002b وV2-MEDIA-002c (انظر أعلاه) بعد تأكيد
  أن سجل النسخ وتزامن الاستبدال منفذان ومختبران فعلًا لأنواع
  `thumbnail|waveform|proxy`+`source`. المتبقي الوحيد لإغلاق هذه المهمة
  بالكامل هو تخزين فعلي (نموذج/هجرة/خط توليد) لأنواع الحفظ وmezzanine والنص
  والمخرجات — لا يوجد أي منها بعد، ولا يوجد بعد تصميم لخط توليدها (ترميز
  mezzanine، نسخة حفظ، تفريغ نصي محفوظ كممثل مستقل، تصدير)؛ بناء تخزين لهذه
  الأنواع بلا خط توليد حقيقي يفيدها سيكون سقالة بلا فائدة. هذا يحتاج تخطيطًا
  منفصلًا (خصوصًا مع V2-MEDIA-003 الذي يعتمد فحص QC عليها) قبل التنفيذ.
  ملاحظة تشغيلية 2026-09-15: تعذّر تنفيذ الفحص الحي المتبقي (1280 و375) في
  هذه الجلسة المجدولة لأن تشغيل خوادم التطوير محجوب صراحة في الجلسات غير
  المراقَبة ("Dev servers can't be started from unattended sessions"). يتبقى
  تنفيذه في جلسة تفاعلية.

- [ ] **V2-MEDIA-003 — فحص تقني وQC صادقان للمادة.**
  القبول: ملف فيديو حقيقي ينتج تقرير `ffprobe`، ويظهر الفشل والنجاح وإعادة
  المحاولة والإجراء التالي، ولا يُعتمد فشل QC إلا بصلاحية وسبب وأثر تدقيق.

- [x] **V2-MEDIA-004 — توصيف زمني وبحث داخل الفيديو.**
  **إغلاق 2026-09-15.** تدقيق الإغلاق كشف أن الميزة لم تكن تصل المستخدم فعلًا:
  `withMoments` كانت مستدعاة في مسار البحث الدلالي فقط، والبحث بالكلمة
  المفتاحية — وهو الافتراضي وما يرتد إليه الدلالي عند تعطّله — لا يُرجع أي
  لحظة. أُصلح الاستدعاء على شريحة الصفحة نفسها بجانب `withMediaSummaries`.
  الدليل الآن طرفي لا خدميًا فقط: اختبار عبر `GET /search` يؤكد وصول لحظة
  تفريغ عند الثانية 5 ولحظة وصف عند الثانية 100 لـ3000 إطار بمعدل 30000/1001
  (لا 120 التي يعطيها افتراض 25fps)، مع تثبيت أن التفريغ يُزرع مباشرة في
  `storage_rows` لأن `POST /records/bulk` يُسقط الحقل صامتًا. وفي الواجهة
  استُخرج `buildMomentHref` إلى `lib/search.ts` باختباريه: لحظة بلا زمن
  مبرَّر لا تحصل على رابط بدل رابط يفتح عند الصفر ويبدو موثوقًا.

  القبول: يجد المستخدم سجلًا من بياناته ومقطعًا من وصفه وكلمة من التفريغ،
  ويفتح النتيجة عند زمنها الصحيح.
  **محاولة أولى فاشلة ومُتراجَع عنها 2026-09-15** (`3ca72f10` ثم `00bbd82b`).
  ثلاثة دروس تُوفّر على المحاولة القادمة وقتًا:
  1. **عائق بنيوي حقيقي:** لا يمكن تحويل إطارات المقاطع إلى زمن صحيح اليوم.
     `timed_description_segments` يخزّن `start_frame`/`end_frame` **بلا عمود
     لمعدل الإطارات**، و`SYSTEM_COVERAGE.md` يسجّل أن نموذج التوقيت بالإطارات
     (`non_drop`/`drop_frame`) غير مبنيّ. المحاولة الأولى قسمت على 25 مفترَضة،
     فكانت تُنتج زمنًا خاطئًا صامتًا (مادة 30fps تنحرف ~20٪) — وهذا يناقض
     معيار القبول نفسه. الحل إما حمل معدل حقيقي من `media_inspections`
     (يتطلب تخزينه أولًا)، أو عدم إصدار توقيت مشتق للمقاطع والاكتفاء بلحظات
     التفريغ التي تحمل توقيتًا حقيقيًا من VTT/SRT.
  2. **مزلقة تهيئة الاختبار:** `transcript` ليس حقلًا مقبولًا في الإدراج
     الجماعي `POST /records/bulk`. اختبار يهيّئ التفريغ عبره يُسقطه صامتًا
     فيعود البحث بصفر نتائج، ويبدو العطل في المطابقة وهو في التهيئة.
  3. **اختبار صلاحيات زائف:** «لا يرى المستخدم لحظات مما لا يملك» ينجح تلقائيًا
     حين تكون النتائج صفرًا. يجب أن يؤكد أيضًا أن المصرَّح له **يحصل** على
     لحظة، وإلا فهو اختبار لا يستطيع أن يفشل.
  ملاحظة إدارية: التراجع كان لأن الشيفرة غير المُثبتة كانت تُفشل
  `tests/Feature/SearchApiTest.php` على master، فتكسر بوابة التحقق لكل
  الجلسات المتوازية. البوابة خضراء بعد التراجع (18 اختبارًا).

  **محاولة ثانية ناجحة 2026-09-15** (`a7c46daf` ثم `edad3add`).
  **العائق الأول كان وهمًا:** ظننت أن معدل الإطارات غير موجود في النظام، فبدا
  التحويل الصحيح مستحيلًا. الفحص أثبت العكس — `MediaProbeService` يلتقطه من
  `avg_frame_rate` ويخزّنه ككسر نسبي `{numerator, denominator}` في
  `media_inspections.report.streams[].frameRate`. فلا حاجة لتغيير المخطط ولا
  لتعبئة رجعية، والتحويل دقيق: 29.97 تبقى `30000/1001` بلا انحراف.
  المبدأ الحاكم: لكل لحظة مصدر زمن صادق. مقاطع التفريغ تحمل توقيتها في
  VTT/SRT فلا تُحوَّل، والمقاطع الوصفية تُحوَّل فقط عند معرفة المعدل — وإلا
  ظهرت **بلا توقيت** بدل توقيت مخترع.
  الاختبارات تُثبت التمييز لا وجود الحقول: نفس الـ3000 إطار تعطي 100 ثانية عند
  `30000/1001` و120 عند `25/1`، وسجل بلا فحص يعطي `null`. وهذا وحده يُسقط أي
  ثابت مفترض.
  الربط في `SearchController` وُضع **بعد** شريحة الصفحة وبجانب
  `withMediaSummaries` تمامًا، مع تعليق يشرح السبب في الكود لا في وثيقة تسليم
  منفصلة. أُضيف حقل `moments` لكل سجل (لا `segmentMatches` على مستوى
  الاستجابة، فهو موصوف بأنه فارغ لاستعلامات التفريغ ولا يُعبّر عن لحظة تفريغ،
  واللحظة يجب أن تسافر مع سجلها لتكون قابلة للفتح). العقد وLaravel والروابط
  المولّدة في الالتزام نفسه.
  الأدلة: 24 اختبار Laravel، و1257 اختبار واجهة، وفحص العقد والأنواع نظيف.

### P0 — الاستقبال والتشغيل اليومي

- [ ] **V2-OPS-001 — صندوق عمل موحد لمراحل المادة.**
  النطاق: وارد جديد وفحص وتوصيف وربط وحقوق وQC فاشل وجاهز للاعتماد ومهام
  معالجة فاشلة. القبول: رحلة بلا رابط مخفي أو بحث يدوي.

- [ ] **V2-OPS-002 — إدخال ودفعات واقعية للوسائط.**
  القبول: checksum وفحص حاوية/ترميز وتقدم واستئناف جزئي وربط كل ملف بدفعة
  وسجل؛ لا يعاد نقل الملف المقبول.

- [ ] **V2-OPS-003 — حالات خدمات وطوابير تشغيلية صادقة.**
  القبول: يوضح التحويل والصورة المصغرة والتفريغ وQC سبب الفشل وخيار المعالجة
  الصحيح، ولا يعرض المخطط أو المتوقف كمكتمل.

### P1 — جودة التجربة والحوكمة

- [ ] **V2-UX-001 — غلاف هاتف لمساحة عمل تشغيلية.**
  القبول: عند 375 يظهر عنوان الصفحة وإجراءها أو المادة الأساسية ضمن أول شاشة،
  مع أهداف لمس 44px وبقاء التنقل والجولة متاحين.

- [ ] **V2-UX-002 — مراجعة العائلات التسع بصريًا ووظيفيًا.**
  القبول: لكل عائلة لقطة حية على سطح المكتب والهاتف وحالات تحميل/فارغ/خطأ/لا
  صلاحية عند انطباقها، وتُسجل النتيجة في `.design/`.

- [ ] **V2-UX-003 — فصل التسلسل والمجموعة والمشروع.**
  القبول: التسلسل المؤسسي والمجموعة المنسقة والذكية ومشروع الإنتاج متميزة
  لغويًا وبصريًا وفي التنقل.

- [ ] **V2-GOV-001 — مساحة الحقوق والاستخدام.**
  القبول: تظهر نوافذ الحقوق والقيود والأقاليم والمنصات وقرار الإتاحة الحقيقي
  قبل المشاركة أو التصدير مع سجل تدقيق.

  **تقدم 2026-09-15.** ثلاث فجوات أُغلقت:
  1. **لا واجهة لمنح الحقوق أصلًا.** جدول `rights_windows` وخدمة القرار وفرضها
     على أربعة حدود كانت موجودة، لكن **لا endpoint لإنشاء نافذة** — فقاعدة
     الرفض الافتراضي كانت تُعطّل كل مشاركة وتصدير بلا طريق لفتحها إلا الكتابة
     المباشرة في قاعدة البيانات. أُضيف `‎/rights/{itemId}/windows` (قراءة
     وإنشاء) و`‎/rights-windows/{id}` (تعديل وحذف) بصلاحية محرّر، مع العقد
     والروابط المولّدة والاختبارات.
  2. **المعاينة كانت تكذب.** `GET /rights/{itemId}/enforcement` كان يجيب
     `allowed: true` لمادة بلا حقوق بينما ترفضها كل الحدود. صار يجيب قرارًا
     لكل استخدام من `RightsDecisionService` نفسها — لا يوجد جواب واحد بلا
     استخدام.
  3. **انتهاء الحقوق والحظر على السجل لم يكونا يُفرضان** بعد إدخال النوافذ،
     رغم بقاء حقليهما في نموذج الحقوق. صارا يسبقان النوافذ: نافذة لا تتجاوز
     الترخيص الذي تتفرع منه.
  كذلك تعرض الواجهة الآن سبب الرفض والبند الحاسم عند المشاركة والتصدير
  والمشتقات (كوميت d1d71781)، وتدير صفحة الحقوق النوافذ وتعرض القرار الحقيقي.
  **المتبقي للإغلاق:** أثر تدقيق مخصّص لقرارات الحقوق (الحالي عام عبر
  `AuditArchiveApiRequest` ولا يشمل رفض تنزيل مشتق لأنه طلب GET)، وإدخال جماعي
  للحقوق، وفحص حي.

- [ ] **V2-GOV-002 — الحفظ طويل الأمد والنزاهة.**
  القبول: تعرض الواجهة طبقة الحفظ والاستعادة والنزاهة وبصمة الإصدار من دون كشف
  مسارات حساسة للمتصفح.

### تصميم Stitch

- [-] **V2-DESIGN-002 — تحوّل الهوية البصرية إلى النظام المؤسسي الفاتح.**
  **قرار المالك 2026-09-15، بعد عرض البدائل الثلاثة صراحةً.** الاتجاه: إعادة
  تصميم شاملة لكامل التطبيق على `Operational Excellence` الفاتح، لا تحسينًا
  داخل الهوية الحالية.
  السبب المكتشَف: تعارض جوهري كان سيُفسد كل شاشة تُولَّد. التطبيق الفعلي
  («مسار») **داكن قريب من الأسود بلون كهرماني ذهبي** — تأكّد من لقطات
  `archive-next/visual-evidence/authed--*--desktop-1280.png` الحقيقية — بينما
  نظاما التصميم في Stitch (`Operational Excellence` و`Sovereign Slate QC`
  المولّد تلقائيًا) كلاهما `colorMode: LIGHT` بخلفية `#F7F9FB`/`#F8FAFC`. توليد
  شاشات فاتحة «لتحسين» تطبيق داكن هو استبدال هوية لا تحسين، فأُوقف التوليد
  حتى صدر القرار.
  نقاط الضعف الفعلية المرصودة في الواجهة الحالية (من اللقطات، لا من تخمين)،
  تُعالَج ضمن هذا التحوّل:
  1. هدر رأسي ≈280px قبل أول بيانة (شريط أدوات + لافتة أول تشغيل + بطاقة عنوان).
  2. لافتة «هل هذا أول تشغيل؟» تتكرر في كل صفحة بدل الرئيسية أو إخفاء دائم.
  3. ١٨ تركيبة عرض معروضة دفعةً واحدة (٣ كثافات × ٦ صيغ) — إفراط في الخيارات.
  4. الكهرماني مستهلَك في الأزرار والتنقّل والشارات والعدّادات معًا، فلا تمييز.
  5. بطاقات السجلات تُظهر ٤ سجلات/شاشة؛ صف بكثافة 40px يُظهر ١٥–٢٠.
  6. الشارات (مسودة/document/التوصيف مكتمل) رمادية متشابهة بلا دلالة لونية.
  القبول: نظام تصميم فاتح معتمد، وشاشة مُصيَّرة لكل قالب من قوالب
  `.stitch/SYSTEM_COVERAGE.md` الأحد عشر، ثم تقرير فجوات يقارن المُصمَّم
  بالمنفَّذ فعليًا ويحدد خطوات السدّ. لا يُنفَّذ أي تحويل في الكود قبل ذلك.

  **منجَز 2026-09-15 — أحد عشر شاشة مُصيَّرة + تقرير الفجوات.** الطريقة
  المعتمدة بعد فشل التوليد الآلي (نجاح واحد من ثماني محاولات): **Stitch
  يقترح وأنا أبني**. نداء الاقتراح خفيف وموثوق ويعود بتفكير تصميمي جيد، أما
  توليد الشاشة فثقيل ويُقطع؛ فصار Stitch مصدر مقترحات تُراجَع مقابل الكود
  ثم تُبنى يدويًا HTML. هذا أزال أيضًا مشكلة اختلاق الميزات: أنا أتحكم بكل
  عنصر معروض.
  الشاشات (نظام تصميم واحد مشترك `.design/v2-redesign/masar.css`، والمصادر
  في `.design/v2-redesign/` وهو مجلد متجاهل من git):
  الأرشيف · مركز الاستقبال · استوديو الوسائط · مركز عمليات الوسائط ·
  سجل المادة · البحث والاستكشاف · مساحة العمل اليومية · المشاريع وسير العمل ·
  الحقوق والحوكمة · إدارة النظام · بوابة الوصول الخارجية.
  الروابط المنشورة: الأرشيف `PPfVwbQHpZYtCAXs1azYgZ` · الاستقبال
  `Uo9yqW4APhHykmPMBitXSW` · الاستوديو `1uo2eazEFhrre2yPnYVqUA` · العمليات
  `E1QtLRd6XCpRVQvgtPPYGD` · سجل المادة `EYbChFS2N4apA2wvQgJsvC` · البحث
  `NGMMnLF775rc4aJheMypQy` · اليومية `Bzt56FCQzzhjdxBCijNTex` · المشاريع
  `2v1Ju4SRC3Tq1ozoTgwSF5` · الحقوق `D8ZQhkPSvb5nnPcyYnGxuH` · النظام
  `4dEEod1gn1yQSM2XW1Pori` · البوابة `4huYh2KhWyu4BTv2o5UhCT`
  (بادئة `https://claude.ai/artifact/`).
  **تقرير الفجوات: `docs/v2-design-gap-report.ar.md`** — يقارن المصمَّم
  بالمنفَّذ شاشةً شاشة، ويرتّب السدّ حسب نسبة الأثر إلى الكلفة: تبويبات سجل
  المادة، ثم كثافة الأرشيف ودلالة الشارات، ثم صندوق العمل الموحّد، ثم انتقال
  الهوية، ثم لوحة حالة الخدمات، ثم البحث الزمني، ثم الحقوق والإتاحة، ثم
  البوابة الخارجية.
  **تنفيذ بنود التقرير 2026-09-15 — خمسة من ستة:**
  | البند | الالتزام | ملاحظة |
  | --- | --- | --- |
  | تبويبات سجل المادة | `8b065787` | ١٨ لوحة ← ٥ تبويبات، بإعادة استخدام `ui/Tabs` |
  | كثافة الأرشيف ودلالة الشارات | `ecdc2b1f` | جدول 40px افتراضيًا، و`lib/badge-tone.ts` مصدرًا واحدًا للدلالة |
  | لوحة حالة الخدمات | `f4d81233` + `52d48e0d` | اختباراتها كانت مكسورة ولم تُشغَّل؛ أُصلحت وأُضيف اختبار لحدّ المصادقة |
  | صندوق العمل الموحّد | `96ff742c` + `8aff3b81` | خلفية + واجهة |
  | انتقال الهوية الفاتحة | `b226886f` + `43a5d9f4` | ١٩١ رمزًا؛ الافتراضي لم ينقلب إلا بتبديل `currentPreset` |
  | البحث الزمني | ❌ `00bbd82b` | متراجَع عنه — راجع V2-MEDIA-004 |
  درس تشغيلي يستحق البقاء: الاختبارات وحدها لم تكشف أن انتقال الهوية لم يقع.
  مرّت ١٢٥٧ اختبارًا خضراء بينما التطبيق ما زال داكنًا، لأن `ThemeProvider`
  يكتب `data-theme` عند التركيب من `getPreferredThemeMode()` التي تعيد `dark`
  لكل نمط عدا `neutral-light`. لم يظهر ذلك إلا بفتح الصفحة والنظر إليها.
  المتبقي في هذه المهمة: تنفيذ بنود التقرير في الكود. لا يُنقل أي بند إلى
  «منفَّذ» قبل دليل قبول قابل للتحقق.

- [!] **V2-DESIGN-001 — توليد `Video Asset Workspace` المتخصصة في Stitch.**
  العائق الأصلي: `gcloud 581.0.0` مثبت، لكن بيئة SDK لا تملك صلاحية إنشاء سجل
  داخل مجلد حساب المستخدم؛ لا تتوفر أدوات Stitch MCP في الجلسة الحالية.
  تشخيص وإصلاح 2026-09-15 (بيئة الجهاز، خارج هذا المستودع): أعيد إنتاج
  السبب فعليًا بدل التخمين — أدوات Node.js على Windows لا تستطيع تنفيذ
  `gcloud` مباشرة بلا shell (`spawnSync('gcloud', {shell:false})` يعطي
  `ENOENT`، وحتى `gcloud.cmd` صراحة يعطي `EINVAL`)، وملف `gcloud` بلا امتداد
  (سكربت bash) يتواجد بجانب `gcloud.cmd` في نفس مجلد SDK مما يسبب غموض
  الالتقاط لأي أداة تفحص المجلد يدويًا بدل استخدام PATHEXT. الإصلاح: مجلد
  شِيم نظيف `D:\dev-tools\gcloud-shim\gcloud.cmd` (يحوي `gcloud.cmd` فقط، لا
  نسخة بلا امتداد) وُضع أول PATH عبر ملفي بروفايل PowerShell 5.1 و7، مع تعيين
  `GOOGLE_CLOUD_PROJECT=12079300562270009833` (الخادم يقرأ هذا المتغير لا
  `STITCH_PROJECT_ID`). تحقّق حي: جلسة PowerShell جديدة كاملة (كلا
  الإصدارين) تُشغّل `gcloud --version` بالاسم المجرد بنجاح وتقرأ المتغير
  الصحيح.
  **العائق مرفوع 2026-09-15 — الطريق كان أبسط من كل ما سبق.** مسار gcloud/ADC
  لم يكن ضروريًا أصلًا: خادم Stitch MCP عام على `https://stitch.googleapis.com/mcp`
  ويقبل مصادقة بمفتاح API عبر ترويسة `X-Goog-Api-Key` (المفتاح من
  stitch.withgoogle.com ← Stitch Settings ← API Keys)، وهو مجاني. أُضيف إلى
  Claude Code عبر `claude mcp add --transport http stitch ... --header ... -s user`
  فصارت 18 أداة Stitch متاحة مباشرة في الجلسة. المصدر الرسمي:
  `github.com/gemini-cli-extensions/stitch`. (لمن يريد مسار ADC لاحقًا، الخطوتان
  الناقصتان كانتا `gcloud beta services mcp enable stitch.googleapis.com` ومنح
  الدور `roles/serviceusage.serviceUsageConsumer`.)
  تحقّق حي من الاتصال 2026-09-15: `list_projects` أعاد 5 مشاريع فعلية،
  و`get/list` على `projects/12079300562270009833` أكّد العنوان «Archive Suite
  v1.6 — Unified Operations»، و`list_design_systems` أعاد `Operational
  Excellence` = `assets/769859ba548141418e0b4955e3a21f00` مطابقًا للموثّق،
  و`list_screens` أعاد **23 شاشة** — ما يثبت أن `.stitch/metadata.json` (15
  شاشة) فهرس محلي قديم لا مصدر عدّ.
  ما يزال مفتوحًا: لا توجد ضمن الـ23 أي شاشة لاستوديو الوسائط/فحص الفيديو، ما
  يؤكد أن محاولة `generate_screen_from_text` السابقة فشلت صامتة ولم تُنشئ شيئًا.

  **مشروع v2 الجديد 2026-09-15:** أُنشئ `projects/6211391049574486099` بعنوان
  «Archive Suite v2 — Video Asset Workspace» لفصل جولة التصميم الجديدة عن
  شاشات v1.6 الـ23. قرار المالك: تبقى شاشات v1.6 حتى اكتمال الجديد ثم تُحذف.
  ملاحظة أداة: لا يوجد في Stitch MCP حذف شاشة مفردة — المتاح `delete_project`
  فقط، فحذف الـ23 يعني حذف المشروع القديم بكامله (أو حذفها يدويًا من الواجهة).

  **سبب فشل التوليد — مُشخَّص أخيرًا:** ليس عطلًا في Stitch ولا في المطالبة، بل
  مهلة انتظار قصيرة من طرفنا. إعداد الخادم في `~/.claude.json` كان بلا
  `timeout`، بينما إضافة جوجل الرسمية تضبطه على `300000` لأن التوليد — بنصّ
  الأداة — «يستغرق عدة دقائق». ضُبط الآن: `timeout: 300000` على الخادم
  و`MCP_TOOL_TIMEOUT=600000` في `~/.claude/settings.json` (نسخ احتياطية
  `.bak-2026-09-15`). القيم تُقرأ عند الإقلاع، فتحتاج إعادة تشغيل Claude Code.
  دليل صحة التشخيص: نداء الاقتراح الخفيف نجح وأعاد مقترحًا كاملًا، بينما نداء
  التوليد الثقيل يُقطع — وهو ما يفسّر أيضًا «لم يُرجع معرّفًا ولا خطأً» في
  الجلسة السابقة: القطع كان من طرفنا لا من Stitch.

  **مراجعة مقترح Stitch (توجيه بشري، ميزات وهمية شُطِبت):** اقترح Stitch توزيعًا
  ثلاثي الأعمدة جيدًا، لكنه أدرج قدرات غير موجودة في الكود: كودك وفضاء ألوان
  وقنوات صوت في بطاقة المواصفات (الحقيقي: مدة/أبعاد/نسبة/معدل بت **تقديري**
  مقيس في المتصفح فقط)، وSMPTE بالإطارات وDrop-frame (غير مبنيّ — راجع
  `.stitch/SYSTEM_COVERAGE.md`)، ونسخة Mezzanine (مهمة V2-MEDIA-002 لم تبدأ)،
  وتخزين شريطي LTO (لا وجود له)، وحالة علامة «قيد المعالجة» (الحالات الفعلية:
  مفتوحة/محلولة). أُرسل التصحيح مع أمر التوليد. يُعتمد التوزيع الثلاثي.

  التالي بعد إعادة التشغيل: توليد شاشة `Video Asset Workspace` على المشروع
  الجديد بنظام `Operational Excellence`، مراجعتها مقابل عقود Laravel وNext.js،
  ثم المضي في بقية القوالب الـ11 في `.stitch/SYSTEM_COVERAGE.md` بحسب ترتيب
  التنفيذ الموثّق فيه. لا تُسجَّل أي شاشة منجزة قبل وجودها فعليًا في المشروع.
  ملاحظة تشغيلية 2026-09-15 (جلسة مجدولة تالية): خادم Stitch MCP غير متصل في
  هذه الجلسة (`CONNECTION_CLOSED`) رغم أنه وُثِّق متصلًا وتم التحقق منه حيًا في
  الجلسة السابقة لنفس اليوم. هذا يعني أن استمرار الإعداد ليس دائمًا عبر إعادة
  تشغيل واحدة فقط لـ Claude Code — قد يحتاج كل جلسة تفاعلية جديدة إعادة اتصال
  يدوية (`claude mcp` أو `/mcp`). لم يُولَّد أي شيء في هذه الجلسة؛ التوليد يبقى
  يحتاج جلسة تفاعلية بها اتصال Stitch حي فعلًا قبل المتابعة.

### بوابة الإطلاق

- [ ] **V2-REL-001 — قبول حي من الإدخال إلى الاعتماد.**
  الدليل: فيديو حقيقي → أصل → probe/QC → توصيف → تسلسل → حقوق →
  segments/transcript → بحث زمني → مراجعة → proxy → اعتماد أو حجر.

- [ ] **V2-REL-002 — بوابات الجودة.**
  الدليل: `pnpm verify` و`pnpm verify:laravel-next:live` على مسار Docker
  المدعوم، مع مراجعة وصول ولوحة أخطاء نظيفة للرحلات الحرجة.
  التقدم 2026-09-14: نجح `pnpm verify` كاملًا على المسار المحلي المدعوم، بما
  في ذلك 1240 اختبار Next.js وبناء الإنتاج وفحص النظافة واختبارات Laravel في
  Docker. كان التشغيل المقيد يفشل فقط قبل Laravel بسبب منع بيئة الأدوات قراءة
  إعدادات Docker المحلية؛ أُعيدت البوابة خارج القيد ونجحت. لا يغني ذلك عن
  قبول `pnpm verify:laravel-next:live` أو مراجعة الوصول للرحلات الحرجة.
  تحديث 2026-09-14: نجح `pnpm verify:laravel-next:live` أيضًا (53 اختبار
  Playwright مصادقًا). عُدّل مشغّل القبول ودليل قارئ الشاشة كي تستخدم مخرجات
  Playwright مساحة `.tmp` المهملة بدل ترك `playwright-report` أو
  `test-results` في المستودع؛ ثم اجتاز فحص النظافة مباشرة بعد القبول الحي.

- [ ] **V2-REL-003 — قرار الإطلاق.**
  الدليل: سجل تغييرات ودليل تشغيل وخطة استعادة وموافقة المستخدم الصريحة قبل
  أي نشر أو إطلاق خارجي.

### قواعد الإصدار 2

1. تتغير العقود والسيرفر والواجهة والاختبارات معًا عند تغيير سلوك عام أو API.
2. ميزات AI مؤجلة ولا تظهر كقدرات إنتاجية في هذا الإصدار.
3. لا تُغلق مهمة تصميم قبل فحص حي، ولا تُغلق مهمة إطلاق قبل بوابات الجودة
   وموافقة صريحة على النشر.
