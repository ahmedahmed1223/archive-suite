# V1-208D — تقرير التنفيذ

## النتيجة

- أضيف manifest V1 قانوني وقابل للاستئناف تحت `infra/setup/installation-manifest.v1.schema.json`، وتنفيذ مستقل في `scripts/control-center/installation-manifest.mjs`.
- يسجل فقط: الإصدار، المصدر، الوضع، المنصة، runtime profiles، capabilities، digests/checksums المتاحة، الخدمات المملوكة، مسارات البيانات، آخر خطوة ناجحة، الإصدار السابق، وحالة العملية. لا يقبل مفاتيح أو قيم secrets/tokens/passwords/credentials أو URL/مسار يحمل credentials.
- تستخدم الكتابة ملفًا مؤقتًا ثم rename ذريًا؛ إذا فشل الاستبدال يبقى manifest السابق JSON صالحًا ولا يترك ملفًا مؤقتًا معروفًا.
- أضيف `install --config=<file>` و`repair --config=<file>` لوضع Docker فقط. يربطان Docker adapter بالـmanifest خلال العملية التنفيذية، ويعيدان استخدام الملف نفسه عند repair. لا ينشئ `plan` أو`import-config` manifest ولا يشغّلان Docker.
- لا تضيف الشريحة update أو rollback أو uninstall؛ تبقى العمليات غير المدعومة كما هي.

## TDD

1. **RED:** أضيفت اختبارات لوحدة manifest ولعملية `repair` في Docker adapter. فشل التشغيل `7/10` كما هو متوقع: الوحدة غير موجودة و`repair` غير معرّف.
2. **GREEN:** أضيف schema والوحدة وربط adapter؛ نجح التشغيل المركّز `10/10`.
3. **RED/Green للتكامل:** أضيف اختبار CLI يثبت أن `plan` و`import-config` لا ينشئان manifest، وأن `install` ثم `repair` يعيدان استخدام manifest آمن واحد. فشل أولًا لأن `install` لم يكن أمرًا معروفًا، ثم نجح بعد الربط.

## التحقق

- `node --test scripts/control-center.test.mjs scripts/control-center/installation-manifest.test.mjs scripts/control-center/runtime-adapter.test.mjs` — 40/40 ناجح.
- `node --test scripts/platform-contract.test.mjs` — 4/4 ناجح.
- `node --check scripts/control-center.mjs`
- `node --check scripts/control-center/installation-manifest.mjs`
- `node --check scripts/control-center/runtime-adapter.mjs`
- `git diff --check`

## الحدود

- لا يوجد تنفيذ Native أو release artifact adapter في هذه الشريحة؛ يرفض `install` و`repair` الوضع Native صراحةً.
- manifest يسجل digests أو checksums المتاحة في Compose الحالي فقط؛ حل صور الإصدارات online/offline الكامل مؤجل إلى V1-208E.
