# مرجع الواجهة الخلفية في Laravel

[English](BACKEND.md) · [فهرس التوثيق](../docs/README.ar.md)

تملك Laravel سلوك API والتخزين والمصادقة والصلاحيات وسجل التدقيق والمهام
الخلفية في Archive Suite. عقد
[`docs/api/archive-contract.openapi.json`](../docs/api/archive-contract.openapi.json)
هو المرجع المعتمد للمسارات والطلبات والاستجابات العامة.

## قواعد التطوير

1. حدّث عقد OpenAPI قبل تغيير أي سلوك عام في API.
2. نفّذ السلوك في `archive-laravel/` والعميل في `archive-next/` ضمن التغيير نفسه.
3. أبقِ المصادقة والتفويض والتحقق من المدخلات وتسجيل التدقيق عند حدود Laravel.
4. شغّل Laravel بأدوات Docker الموجودة في المستودع؛ لا يلزم تثبيت PHP أو Composer محليًا.

## تغيير بنية قاعدة البيانات بأمان

يستخدم التطبيق الأمر `php artisan archive:migrate-safe` عند تطبيق تغييرات
البنية. يفحص الأمر الترحيلات المعلقة، وينشئ نسخة احتياطية إذا كانت القاعدة
تحتوي على جداول، ثم يفعّل وضع الصيانة ويطبق الترحيلات بقفل يمنع التشغيل
المتزامن. عند الفشل يبقى التطبيق في وضع الصيانة ويعرض اسم النسخة اللازمة
للاستعادة.

استعد النسخة المسماة، وأعد التطبيق إلى الخدمة، وصحح الترحيل، ثم شغّل الأمر
الآمن مرة أخرى:

```bash
php artisan tinker --execute="app(\App\Services\Backup\BackupService::class)->restore('<backup-name>')"
php artisan up
php artisan archive:migrate-safe
```

## التحقق

من جذر المستودع:

```bash
pnpm verify:laravel
pnpm verify:laravel-next:live
```

يشغّل الأمر الأول اختبارات Laravel، ويتحقق الثاني من التكامل الحي بين Laravel
وNext.js عبر مسار التطبيق المدعوم.
