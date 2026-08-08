# مسار

[English](README.md) · [فهرس التوثيق](docs/README.ar.md)

**مسار** نظام لإدارة المواد الأرشيفية والوسائط. يجمع السجل والبيانات الوصفية
والملفات والبحث والمراجعة في مساحة عمل واحدة، مع صلاحيات وسجل تدقيق يساعدان
الفِرق على إدارة المادة من الاستلام حتى استخدامها.

## حالة الإصدار

الإصدار [`v1.0.0`](docs/release-notes/v1.0.0.ar.md) متاح للاستخدام العام.
تشرح ملاحظات الإصدار ما تغيّر في هذه النسخة، وتعليمات التشغيل، وسياسة الدعم.

- [دليل الميزات والاستخدام](docs/features-guide.md)
- [دليل التثبيت](INSTALL.md)
- [دليل النشر](DEPLOYMENT.md)
- [التشغيل والدعم](docs/ops/rc-launch-and-support.md)

## البنية المعتمدة

المسار المعتمد للمنتج هو **Next.js + Laravel**:

- `archive-next/` واجهة المستخدم المعتمدة.
- `archive-laravel/` واجهة API والتخزين والصلاحيات وسجل التدقيق.
- `docs/api/archive-contract.openapi.json` عقد OpenAPI المشترك.

الحزم القديمة موجودة للرجوع إلى التاريخ فقط ولا تستقبل مزايا جديدة.

## ابدأ محليًا

### المتطلبات

- `Node.js 26.5.0`
- `pnpm 11.9.0`
- Docker Desktop مع Docker Compose

يعمل `PHP 8.5.8` وComposer داخل Docker، لذلك لا تحتاج إلى تثبيتهما على جهاز
التطوير. القيم المعتمدة موجودة في `infra/platform/toolchain.v1.json`.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

يشغّل `pnpm dev` خدمة Laravel داخل Docker وواجهة Next.js محليًا. لتشغيل أحدهما
فقط استخدم `pnpm dev:next` أو `pnpm dev:laravel`.

## التحقق قبل الدمج

```powershell
pnpm verify
pnpm verify:laravel-next:live
```

يجمع `pnpm verify` فحوص العقد والأنواع والاختبارات والبناء ونظافة المستودع.
أما الأمر الثاني فيتحقق من رحلة فعلية بين Laravel وNext.js.

## النشر والدعم

استخدم Control Center لنشر مسار Docker المعتمد:

```powershell
pnpm setup
pnpm deploy
```

راجع [فهرس التوثيق](docs/README.ar.md) لاختيار دليل المشرف أو المطوّر أو
المستخدم، ولا تضع أسرارًا أو سجلات تحتوي على بيانات أرشيف حقيقية في بلاغ الدعم.
