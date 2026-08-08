# دليل المساهمة في Archive Suite

[English](CLAUDE.md) · [فهرس التوثيق](docs/README.ar.md)

يتكون المسار المعتمد للمنتج من واجهة `archive-next` المبنية بـNext.js وخدمة
`archive-laravel` المبنية بـLaravel. عقد
`docs/api/archive-contract.openapi.json` هو المرجع المشترك بينهما. لا تُنسخ
تعريفات API إلى حزمة TypeScript مستقلة.

## التقنيات الأساسية

- الواجهة: Next.js 16 وReact 19 وTypeScript، مع App Router وواجهة من اليمين إلى اليسار.
- الخادم: Laravel 13، ويتولى المصادقة والسجلات والبحث والملفات والمشاركة والحقوق والوسائط.
- الاختبارات: Vitest وPlaywright وTesting Library وaxe-core وPHPUnit.
- إدارة الحزم: `pnpm` من جذر المستودع، وComposer داخل `archive-laravel/`.

## أوامر التطوير

```bash
pnpm dev
pnpm dev:next
pnpm dev:laravel
pnpm server
```

يشغّل `pnpm dev` واجهة Next.js وخدمة Laravel معًا. لا يلزم تثبيت PHP أو
Composer محليًا لأن أدوات الجذر تشغّل Laravel عبر Docker.

## البناء والتحقق

```bash
pnpm build
pnpm verify
pnpm verify:laravel-next:live
pnpm verify:api-contracts
pnpm typecheck
pnpm --filter @archive/next run test
pnpm security:baseline
```

يشمل `pnpm verify` العقد وفحص الأنواع والبناء والاختبارات ونظافة المستودع
واختبارات Laravel. استخدم فحص التكامل الحي عندما يتغير السلوك بين الخادم
والواجهة.

## قواعد التغيير

- عند تغيير API عام، حدّث عقد OpenAPI وتنفيذ Laravel وعميل Next.js وفحوص العقد في التغيير نفسه.
- ضع عمل المنتج الجديد في `archive-next/` و`archive-laravel/`.
- أبقِ المصادقة والصلاحيات والتحقق من المدخلات في Laravel.
- استخدم `pnpm release:verify` قبل تجهيز إصدار.

راجع [عقد API](docs/api/README.ar.md) و[مرجع Laravel](archive-laravel/BACKEND.ar.md)
للتفاصيل الخاصة بكل طبقة.
