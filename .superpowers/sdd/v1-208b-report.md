# تقرير V1-208B — تفكيك Control Center إلى وحدات

التاريخ: 2026-07-14
الفرع المستهدف: `master` مباشرة، بلا branch أو worktree.

## النطاق المنجز

- بقيت `scripts/control-center.mjs` نقطة الدخول العامة والقائمة التفاعلية والأوامر الحالية.
- أضيفت `scripts/control-center/cli.mjs` لتحليل الأعلام واستخراج الأمر.
- أضيفت `scripts/control-center/configuration.mjs` لقراءة وكتابة `.env` مع النسخة الاحتياطية، إخفاء الأسرار، وتوليد الأسرار/كلمات المرور.
- أضيفت `scripts/control-center/docker-compose.mjs` لاكتشاف Docker Compose، وتحويل الـprofiles القانونية من عقد المنصات، وتنفيذ Compose.
- أضيفت `scripts/control-center/operations.mjs` لعمليات الخادم، الصحة، الهجرات، النسخ الاحتياطية والاستعادة، diagnostics، والتحديث وإعادة البناء.
- أضيفت `scripts/control-center/runtime-adapter.mjs` بعقد lifecycle المشترك: `install`, `start`, `stop`, `restart`, `status`, `health`, `logs`, `exec`, `update`, `rollback`, `uninstall`.
- Docker adapter ينفذ العمليات الحالية المدعومة عبر Compose. `update` و`rollback` و`uninstall` غير المنفذة فيه تعيد نتيجة قابلة للبرمجة: `{ ok: false, supported: false, operation, reason: "unsupported" }`، ولا تشغل أي أمر.
- لم يضف هذا العمل Native runtime أو تبعيات أو تغييرًا في API أو الحزم legacy. بقي قرار V1-208A محفوظًا: core افتراضي؛ media وedge اختياريان؛ capabilities ليست Compose profiles.

## TDD

1. أضيف `scripts/control-center/runtime-adapter.test.mjs` أولاً. شُغّل RED وكان الفشل المتوقع `ERR_MODULE_NOT_FOUND` لـ`runtime-adapter.mjs`.
2. أضيف الحد الأدنى من Docker adapter. ظهر فشل GREEN أولي متوقع بسبب تمرير object options فارغ إلى `compose`; صُحح دون توسيع الواجهة، ثم نجحت الاختبارات الثلاثة.
3. أضيف اختبار CLI تركيبيًا أولاً يطلب وحدات entry point. شُغّل RED وكان الفشل المتوقع `missing focused Control Center module: cli.mjs` مع بقاء 19 اختبار CLI سابقًا ناجحة.
4. استخرجت الوحدات وربطت نقطة الدخول. شُغّلت اختبارات CLI الفعلية والـadapter بعد الربط ونجحت 23/23.

## التحقق

| الأمر | النتيجة |
| --- | --- |
| `node --test scripts/control-center.test.mjs scripts/control-center/runtime-adapter.test.mjs` | نجح: 23/23، 0 فشل |
| `node --test scripts/platform-contract.test.mjs` | نجح: 4/4، 0 فشل |
| `node --check scripts/control-center.mjs` ووحدات `scripts/control-center/*.mjs` | نجح |
| `git diff --check` | نجح |
| `pnpm verify:infra` | محجوب بالبيئة، انظر أدناه |

## قيد البيئة

`pnpm verify:infra` خرج برمز 1 قبل تحقق Compose الفعلي. الناتج يثبت أن Node الحالي هو `v24.15.0` خارج العقد `>=22.13.0 <23`، وأن Docker لا يستطيع قراءة `C:\Users\LAPTOP PC WORLD\.docker\config.json` (`Access is denied`) ثم يرفض `compose --env-file` (`unknown flag: --env-file`). هذا ليس نجاحًا ولا تغيرًا من المهمة؛ لم تُخفَ النتيجة.

## الملفات الموثقة

- معدل: `scripts/control-center.mjs`
- معدل: `scripts/control-center.test.mjs`
- مضاف: `scripts/control-center/cli.mjs`
- مضاف: `scripts/control-center/configuration.mjs`
- مضاف: `scripts/control-center/docker-compose.mjs`
- مضاف: `scripts/control-center/operations.mjs`
- مضاف: `scripts/control-center/runtime-adapter.mjs`
- مضاف: `scripts/control-center/runtime-adapter.test.mjs`
- معدل: `TASKS.md`
- معدل: `ChangeLog.md`

لم يُلمس `archive-next/next-env.d.ts`; التعديل الموجود فيه سابق ومملوك للمستخدم ولن يُدرج في commit هذه المهمة.
