# قياسات الأداء V1-307

## القطع الموجودة

| القطعة | الملف | الحالة |
| --- | --- | --- |
| العقد والميزانيات | `docs/performance/baseline.v1.json` | مكتمل |
| مولّد بيانات القياس | `php artisan archive:generate-benchmark-dataset` | مكتمل |
| حاصد الواجهة والـAPI | `archive-next/e2e/performance-baseline.authed.spec.ts` | **أضيف — V1-307B/C** |
| تجميع التشغيل | `scripts/performance-collect.mjs` | مكتمل |
| بوابة الـregression | `scripts/performance-regression.mjs` | مكتمل |

## التشغيل الكامل

```bash
MSYS_NO_PATHCONV=1 node scripts/laravel-docker.mjs artisan archive:generate-benchmark-dataset --seed=42 --records=100000 --files=10000 --files-total-size=1073741824 --json
E2E_BASE_URL=http://localhost:3000 pnpm --filter @archive/next exec playwright test e2e/performance-baseline.authed.spec.ts --project=authenticated
node scripts/performance-collect.mjs docker docs/performance/runs/frontend-events.json docs/performance/runs/api-events.json docs/performance/runs/run.docker.json
node scripts/performance-regression.mjs docs/performance/runs/run.docker.json
```

يولّد الحاصد 20 عيّنة لكل مقياس (5 مسارات × 4 مرات، بدورة على العروض
375/768/1280) و20 عيّنة لكل عملية API.

## ما يبقى مفتوحًا في V1-307B/C/D

**التشغيل على ملف الموارد المعلن.** العقد يعرّف
`rc-baseline-linux-x64` (Ubuntu 24.04، 4 vCPU، 8 GiB). تشغيل 2026-08-02 جرى
على مضيف Windows بـ28 خيطًا و31.7 GiB، فأرقامه **غير منسوبة** ولا تصلح baseline
معتمدًا مهما بدت مريحة:

| المقياس | المقاس | الميزانية |
| --- | ---: | ---: |
| lcpP75Ms | 204 | 2500 |
| clsP75 | 0 | 0.1 |
| inpP75Ms | 48 | 200 |
| searchP95Ms | 21.7 | 1500 |
| recordOpenP95Ms | 21.8 | 1000 |
| uploadSessionStartP95Ms | 29.5 | 2000 |

**تحذير في التصميم:** `performance-collect.mjs` يختم `resourceProfileId` من
العقد مباشرة، فأي تشغيل يدّعي الملف المعلن تلقائيًا. لا يتحقق أحد من مطابقة
البيئة الفعلية. قبل اعتماد أي baseline يجب إما تمرير ملف الموارد المقاس فعليًا
أو إضافة فحص يقارن `nproc`/الذاكرة/نظام التشغيل بالعقد.

**الخطوات المتبقية للإغلاق:**

1. تشغيل المكدس والمتصفح داخل بيئة مقيّدة بـ4 vCPU و8 GiB على Ubuntu 24.04.
2. حفظ حزمة الأدلة التي يشترطها `docs/acceptance/datasets/v1-307a.manifest.json`:
   `dataset-manifest.json`، `resource-profile.json`، `source-commit.txt`،
   `image-digests.json`، `attachment-checksums.json`.
3. اعتماد الناتج baseline وربط بوابة 307D به.

مخرجات التشغيل (`docs/performance/runs/`) غير متتبَّعة في git عمدًا — الأدلة
المعتمدة تُحفظ ضمن حزمة قبول موقّعة، لا كملف يُعاد كتابته في كل تشغيل.
