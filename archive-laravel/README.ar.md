# خدمة Laravel في مسار

[English](README.md) · [فهرس التوثيق](../docs/README.ar.md)

تملك هذه الحزمة سلوك API والتخزين والصلاحيات والمهام والخدمات الفورية وسجل
التدقيق. الواجهة المعتمدة هي `archive-next` والعقد العام هو
`../docs/api/archive-contract.openapi.json`.

من جذر المستودع استخدم `pnpm dev:laravel` للتطوير و`pnpm verify:laravel`
للتحقق. عند تغيير API عام، حدّث العقد وLaravel وعميل Next.js في التغيير نفسه،
واجعل التفويض في الخادم دائمًا.
