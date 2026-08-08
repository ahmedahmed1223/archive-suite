# قياسات الأداء V1-307

[English](README.en.md) · [فهرس التوثيق](../README.ar.md)

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

## الإغلاق — 2026-08-02

تشغيل كامل على ملف الموارد المعلن فعليًا، عبر حاوية `mcr.microsoft.com/playwright:v1.61.1-noble`
مقيّدة بـ`--cpus=4 --memory=8g`. البوابة نفسها تحقّقت من ملف البيئة المرصود عبر cgroup:
`{"platform":"linux","cpus":4,"memoryGiB":8,"constrained":true}` — مطابق تمامًا لـ`rc-baseline-linux-x64`.

**مشكلتان حقيقيتان ظهرتا وحُلّتا أثناء هذا التشغيل، لا وُجّهتا حولهما:**

1. **Origin مرفوض (403):** صفحة المتصفح داخل الحاوية أرسلت
   `Origin: http://host.docker.internal:3000`، وفاحص CORS في
   `AuthController::rejectDisallowedOrigin` يسمح فقط بـ`127.0.0.1`/`localhost`.
   الحل: وكيل TCP محلي *داخل الحاوية الاستهلاكية* على `127.0.0.1:3000` يمرّر
   إلى `host.docker.internal:3000` — فيصبح Origin الفعلي مسموحًا به افتراضيًا
   دون أي تعديل على إعدادات أمان الخادم.
2. **ملف بيانات ناقص:** نُسي `docs/acceptance/datasets/v1-307a.manifest.json`
   عند نسخ المستودع داخل الحاوية، فرفضت `validatePerformanceContract` التشغيل.

**درس مُسجَّل:** تشغيل سابق فشل صامتًا بسبب `cmd | tail -8` يُخفي حالة خروج
الأمر الفعلي عن `set -e` — البوابة قبلت وقتها بيانات Playwright *قديمة* من
تشغيل ويندوز سابق، موسومة زورًا كـ`linux/4/8/constrained`. اكتُشف يدويًا
بمقارنة القيم بملف قديم على القرص، لا بالبوابة نفسها. أُصلح بإضافة `pipefail`
وحذف الأدلة الملوّثة فورًا.

حزمة الأدلة الكاملة في [`docs/evidence/v1-307/`](../evidence/v1-307/):
`run.docker.json`، `resource-profile.json`، `source-commit.txt`،
`image-digests.json`، `attachment-checksums.json`، `dataset-manifest.json`.

القياسات النهائية (كلها ضمن الميزانية بهامش واسع):

| المقياس | P75/P95 المقاس | الميزانية |
| --- | ---: | ---: |
| lcpP75Ms | 472 | 2500 |
| clsP75 | ~0.037 | 0.1 |
| inpP75Ms | 72 | 200 |
| searchP95Ms | 75 | 1500 |
| recordOpenP95Ms | 78.8 | 1000 |
| uploadSessionStartP95Ms | 82.5 | 2000 |

## ما كان مفتوحًا في V1-307B/C/D

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

**ثغرة أُصلحت:** كان `performance-collect.mjs` يختم `resourceProfileId` من
العقد مباشرة، فأي تشغيل يدّعي الملف المعلن تلقائيًا دون تحقق. صار المجمّع
يسجّل البيئة المقاسة فعليًا (`environmentProfile`)، وتقارنها البوابة بالعقد
وترفض التشغيل عند الاختلاف أو عند غياب التسجيل. تشغيل 2026-08-02 مرفوض بهذه
البوابة صراحةً بثلاثة أسباب: `win32` بدل Ubuntu، و28 معالجًا بدل 4، و31.7 GiB
بدل 8.

**ملف الموارد صار قابلًا للتحقق.** `os.cpus()` يقرأ `/proc` أي يبلّغ المضيف
حتى داخل حاوية مقيّدة، فلا حاوية كانت تستطيع تحقيق العقد. صار المجمّع يقرأ
حدود cgroup الفعلية (v2 ثم v1 — Docker Desktop على WSL2 ما زال v1)، وتحقّق
عمليًا:

```bash
docker run --rm --cpus=4 --memory=8g -v "$PWD:/work" -w /work node:24-slim \
  node -e "import('./scripts/performance-collect.mjs').then(m=>console.log(JSON.stringify(m.observeEnvironmentProfile())))"
# {"platform":"linux","cpus":4,"memoryGiB":8,"constrained":true}
```

هذه القيم تطابق `rc-baseline-linux-x64` تمامًا، فالتشغيل داخل حاوية بهذه
الحدود ينسب دليله بحق.

**الخطوات المتبقية للإغلاق:**

1. تشغيل الحاصد نفسه داخل تلك الحاوية: صورة
   `mcr.microsoft.com/playwright:v1.61.1-noble` (Ubuntu 24.04) بالحدود ذاتها،
   مع `pnpm install` داخلها — لا يمكن إعادة استخدام `node_modules` المبنية على
   Windows. ثم تشغيل `performance-collect` من داخل الحاوية نفسها ليُسجَّل
   ملف البيئة الصحيح.
2. حفظ حزمة الأدلة التي يشترطها `docs/acceptance/datasets/v1-307a.manifest.json`:
   `dataset-manifest.json`، `resource-profile.json`، `source-commit.txt`،
   `image-digests.json`، `attachment-checksums.json`.
3. اعتماد الناتج baseline وربط بوابة 307D به.

مخرجات التشغيل (`docs/performance/runs/`) غير متتبَّعة في git عمدًا — الأدلة
المعتمدة تُحفظ ضمن حزمة قبول موقّعة، لا كملف يُعاد كتابته في كل تشغيل.
