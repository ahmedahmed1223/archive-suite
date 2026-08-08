# قياس الأداء

[English](README.md) · [فهرس التوثيق](../README.ar.md)

تعتمد Archive Suite عقدًا قابلًا لإعادة القياس لمساري Docker والتشغيل المباشر
دون حاويات (Native). ملف [`baseline.v1.json`](baseline.v1.json) هو المرجع
المعتمد لخصائص جهاز القياس، وحجم البيانات، والمسارات، والعمليات، وحدود الأداء.

## ما الذي نقيسه؟

| المجال | القياسات |
| --- | --- |
| المتصفح | LCP عند P75، وCLS عند P75، وINP عند P75 على عروض الشاشة المحددة |
| API | زمن البحث وفتح السجل وبدء جلسة الرفع عند P95 |
| البيئة | نظام التشغيل والمعالج والذاكرة وقيود الحاوية عند استخدامها |

يرفض الحاصد أي نتيجة لا تطابق بيئة التشغيل المرصودة فيها الملف المعتمد. يمنع
ذلك اعتماد أرقام مأخوذة من جهاز أقوى على أنها قياسات إصدار.

## تشغيل القياس

أنشئ مجموعة البيانات الحتمية، ثم اجمع عينات المتصفح وAPI وشغّل بوابة التراجع:

```bash
MSYS_NO_PATHCONV=1 node scripts/laravel-docker.mjs artisan archive:generate-benchmark-dataset --seed=42 --records=100000 --files=10000 --files-total-size=1073741824 --json
E2E_BASE_URL=http://localhost:3000 pnpm --filter @archive/next exec playwright test e2e/performance-baseline.authed.spec.ts --project=authenticated
node scripts/performance-collect.mjs docker docs/performance/runs/frontend-events.json docs/performance/runs/api-events.json docs/performance/runs/run.docker.json
node scripts/performance-regression.mjs docs/performance/runs/run.docker.json
```

استخدم `native` بدل `docker` عند القياس على التشغيل المباشر. يجب أن يحتوي كل
تشغيل على 20 عينة على الأقل لكل قياس مطلوب.

## النتائج والأدلة

لا تُحفظ الملفات الناتجة في `docs/performance/runs/` داخل Git. اجمع ملف النتيجة
ووصف الموارد ومعرّف الالتزام البرمجي وبصمات الصور أو الحزم وبيان مجموعة البيانات
في مخزن أدلة الإصدار. ينجح التشغيل فقط إذا بقيت جميع القياسات ضمن الحدود
المحددة في `baseline.v1.json`.
