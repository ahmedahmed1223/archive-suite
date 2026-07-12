# CI/CD Regression Ledger

> **القاعدة:** أي فشل في CI/CD أو حادثة تشغيل لا يُغلق بإصلاح العرض فقط.
> كل حادثة تُغلق بثلاث خطوات إلزامية:
>
> 1. **إصلاح السبب الجذري** — لا يُقبل إصلاح يخفي العرض ويترك السبب.
> 2. **حارس دائم** — اختبار أو سكربت `verify:*` يفشل إذا عاد الخطأ، ويُربط في CI
>    (`.github/workflows/ci.yml`) أو في بوابة الإصدار (`pnpm release:verify`).
> 3. **سطر في هذا السجل** — التاريخ، العرض، السبب الجذري، الحارس.
>
> لا يُعتبر البند مغلقًا إذا نقصت أي خطوة. هذا هو سبب وجود عائلة سكربتات
> `scripts/verify-*.mjs`: كل واحد منها حارس ضد فئة أخطاء وقعت فعلًا.

## خط الإصدار

- الدفعات العادية (PR / master): تمر عبر `ci.yml` — العقد، typecheck، بناء Next،
  اختبارات Laravel، خط الأمان.
- **النسخ الرسمية**: دفع tag بنمط `v*` يُشغّل `release.yml` — بوابة
  `pnpm release:verify` كاملة **قبل** نشر أي صورة أو Release. النسخ المستقرة
  (بدون لاحقة مثل `-rc.1`) فقط تحرّك وسم `latest`.
- النشر اليدوي الاستثنائي: `docker.yml` عبر `workflow_dispatch` فقط، ويوسم
  `manual-<sha>` — لا يلمس `latest`.

## السجل

| التاريخ | العرض | السبب الجذري | الحارس |
|---------|-------|--------------|--------|
| 2026-07-10 | فشل CI: pnpm غير موجود | الاعتماد على corepack بدل تثبيت pnpm صراحة | `pnpm/action-setup` في `ci.yml` |
| 2026-07-10 | فشل بناء Next على نسخة Node مغايرة | نسخة Node غير مثبتة في الـ workflow | تثبيت `node-version: "22"` + `scripts/node-version.mjs` |
| 2026-07-10 | سلوك مختلف بين CI والمحلي | ملف `.env.local` متتبَّع في git يغيّر السلوك | `verify:repo-hygiene` يرفض ملفات env متتبَّعة |
| 2026-07-10 | فشل توثيق: تأكيد على ملف محذوف | assertion ميت بعد حذف الإرث | تحديث `control-center.test.mjs` ليقرأ الواقع لا القائمة القديمة |
| 2026-07-12 | حاويات الإنتاج المحلي في crash-loop بعد V1-101 | compose يعلن `APP_ENV=production` دون تمرير `ARCHIVE_SECURE_COOKIES`/`ADMIN_*` لكل خدمات Laravel | `verify:infra` + إصلاح `docker-compose.laravel-next.yml` (ae2a954) |
| 2026-07-12 | نشر صور عند دفع tag دون تشغيل الاختبارات | `docker.yml` كان ينشر على tags بلا بوابة تحقق | `release.yml`: publish `needs: verify` — لا نشر بلا بوابة |

## كيف تضيف حارسًا جديدًا

1. أنشئ `scripts/verify-<name>.mjs` يفشل (exit != 0) عند عودة الخطأ.
2. اربطه في `package.json` (`verify:<name>`) وفي `ci.yml` أو سلسلة `release:verify`.
3. أضف سطرًا في الجدول أعلاه.
