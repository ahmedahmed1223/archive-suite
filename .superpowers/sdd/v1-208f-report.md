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

## TDD والتحقق

1. أضيفت اختبارات parity لـ`wizard --config` ثم شُغلت كـRED: فشلت لأن wizard
   كان يتجاهل config ويعود إلى deploy.
2. أضيف اختبار resolver المباشر ثم شُغل كـRED: فشل لأن `planInput` لم يكن موجوداً.
3. بعد التنفيذ نجحت:

   `node --test scripts/control-center.test.mjs` — 34/34

4. نجح `node --check scripts/control-center.mjs` و`node --check
   scripts/control-center/setup-config.mjs`.

`pnpm verify:infra` لم يُعد تشغيله: البوابة محجوبة محلياً بإصدار Node 24 خارج
النطاق المدعوم وبصلاحيات Docker/`--env-file`، كما هو موثق في المهام السابقة.

## ملاحظة دمج

لم يُعدل `TASKS.md` لأنه كان معدلاً مسبقاً في شجرة العمل من مهمة متزامنة؛ يلزم
تحديث سطر V1-208F ووسم المهمة مكتملة عند الدمج من دون ضم تعديلات الغير.
