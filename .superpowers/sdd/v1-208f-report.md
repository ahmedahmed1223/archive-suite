# V1-208F — Setup wizard الشاملة

## التعديل

- أضيف `wizard --config=<file>` كواجهة غير تفاعلية تقرأ الإعداد فقط عبر
  `setup plan`، فتطابق مخرجات الخطة ولا تنشئ `.env` أو manifest أو تستدعي Docker.
- أضيف `planInput` و`importInput` إلى resolver الإعداد المعلن؛ تستخدمهما
  الواجهة التفاعلية قبل أي كتابة، بدلاً من قوائم اختيار خاصة بالمعالج.
- توسعت أسئلة المعالج لتعرض mode/platform/source/access/profiles/capabilities/
  storage، مع وصف عربي موجز للخدمات الاختيارية والتنبيه إلى أن PostgreSQL وRedis
  أساسيتان. يبقى `core` مفروضاً و`media` و`edge` اختياريين صريحين.
- التنفيذ بعد الخطة يمرر الإعداد المعياري إلى مسار إصدار Docker `install`؛ لا
  يستعمل مسار Compose التطويري. Native مخطط فقط ويرفض التنفيذ قبل أي كتابة أو Docker.
- **تصحيح المراجعة:** طبقة `setup-wizard.mjs` تجمع إجابات runtime القابلة للاختبار
  عبر prompts عربية موجزة، ثم تبني candidate واحداً للـresolver. أصبحت سياسة
  الوصول جزءاً من resolver: `public` يتطلب `edge` و`edge` محصور بـ`public`؛
  المخالفات تعيد codes ثابتة قبل أي كتابة أو Docker.

## TDD والتحقق

1. أضيفت اختبارات parity لـ`wizard --config` ثم شُغلت كـRED: فشلت لأن wizard
   كان يتجاهل config ويعود إلى deploy.
2. أضيف اختبار resolver المباشر ثم شُغل كـRED: فشل لأن `planInput` لم يكن موجوداً.
3. أضيف اختبار controlled prompt/TTY-flow لطبقة الإجابات، واختبارا رفض
   `public` بلا `edge` و`edge` مع intranet، ثم نجحت:

   `node --test scripts/control-center.test.mjs` — 37/37

4. نجح `node --check scripts/control-center.mjs` و`node --check
   scripts/control-center/setup-config.mjs`.

`pnpm verify:infra` لم يُعد تشغيله: البوابة محجوبة محلياً بإصدار Node 24 خارج
النطاق المدعوم وبصلاحيات Docker/`--env-file`، كما هو موثق في المهام السابقة.

## ملاحظة دمج

حُدّث سطر V1-208F فقط ووُسم مكتمل باستخدام staging جزئي؛ لم تُضم حزمة backlog
غير المتعلقة بالمهمة الموجودة مسبقاً في `TASKS.md`.
