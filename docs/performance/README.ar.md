# قياس الأداء

[English](README.md) · [فهرس التوثيق](../README.ar.md)

تعتمد Archive Suite عقدًا قابلًا لإعادة القياس لمساري Docker والتشغيل المباشر
دون حاويات (Native). ملف [`baseline.v1.json`](baseline.v1.json) هو المرجع
المعتمد لخصائص جهاز القياس، وحجم البيانات، والمسارات، والعمليات، وحدود الأداء.

## ما الذي نقيسه؟

| المجال | القياسات |
| --- | --- |
| المتصفح | ‏LCP وCLS وINP وحجم نقل JavaScript عند P75 على عروض الشاشة المحددة |
| API | زمن البحث وفتح السجل وبدء جلسة الرفع وفتح الاستوديو عند P95 |
| سير العمل | زمن بدء المعاينة وزمن انتظار الطابور عند P95 |
| البيئة والبيانات | نظام التشغيل والمعالج والذاكرة وقيود الحاوية وبيان مجموعة البيانات المنشأة |

يرفض الحاصد أي نتيجة لا تطابق بيئة التشغيل المرصودة أو دليل مجموعة البيانات
المحدد في العقد. يمنع ذلك اعتماد أرقام مأخوذة من جهاز أقوى أو من مجموعة أصغر
على أنها قياسات إصدار. لا ينشئ الحاصد قياسات ولا يستبدلها؛ فهو يحفظ الملاحظات
المقدمة له فقط.

## تشغيل القياس

شغّل القياس على Ubuntu 24.04 x64 مع 4 vCPU و8 GiB فقط. أنشئ مجموعة البيانات
الحتمية، واحفظ مخرجات JSON بوصفها دليلاً خارج Git، ثم اجمع 20 عينة أو أكثر لكل
مقياس ضمن `measurement.requiredMetrics`، بما فيه الاستوديو والمعاينة وحجم
JavaScript والطابور، وشغّل بوابة التراجع:

```bash
MSYS_NO_PATHCONV=1 node scripts/laravel-docker.mjs artisan archive:generate-benchmark-dataset --seed=42 --records=100000 --files=10000 --files-total-size=1073741824 --json > docs/performance/runs/dataset-manifest.json
E2E_BASE_URL=http://localhost:3000 pnpm --filter @archive/next exec playwright test e2e/performance-baseline.authed.spec.ts --project=authenticated
node scripts/performance-collect.mjs docker docs/performance/runs/dataset-manifest.json docs/performance/runs/frontend-events.json docs/performance/runs/api-events.json docs/performance/runs/run.docker.json
node scripts/performance-regression.mjs docs/performance/runs/run.docker.json
```

استخدم `native` بدل `docker` عند القياس على التشغيل المباشر. يرفض الحاصد كتابة
ملف نتيجة عند اختلاف البيئة أو مجموعة البيانات أو عند وجود بيانات أحداث غير
صالحة. يجب أن يحتوي كل تشغيل على 20 عينة على الأقل لكل قياس مطلوب، وتعيد بوابة
التراجع التحقق من ذلك قبل اعتماد الدليل.

## النتائج والأدلة

لا تُحفظ الملفات الناتجة في `docs/performance/runs/` داخل Git. اجمع ملف النتيجة
ووصف الموارد ومعرّف الالتزام البرمجي وبصمات الصور أو الحزم وبيان مجموعة البيانات
في مخزن أدلة الإصدار. ينجح التشغيل فقط إذا بقيت جميع القياسات ضمن الحدود
المحددة في `baseline.v1.json`. لا تنشئ ملف نتيجة من قيم مخترعة، ولا تصف قياسات
التطوير المحلية بأنها خط أساس للإصدار.
