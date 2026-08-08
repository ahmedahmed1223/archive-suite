# خدمة Laravel في Archive Suite

[English](README.md) · [فهرس التوثيق](../docs/README.ar.md)

تملك هذه الحزمة سلوك API والتخزين والتفويض وطوابير المهام والخدمات الفورية
وسجل التدقيق. الواجهة المعتمدة هي `archive-next`، والعقد العام المشترك هو
`../docs/api/archive-contract.openapi.json`.

## التطوير والتحقق

شغّل الأوامر الآتية من جذر المستودع. يوفر Docker بيئة PHP وComposer:

```bash
pnpm dev:laravel
pnpm verify:laravel
pnpm verify:laravel-next:live
```

عند تغيير API عام، حدّث عقد OpenAPI وLaravel وعميل Next.js في التغيير نفسه.
أبقِ التفويض في الخادم، واختبر الدور أو حد الملكية المتأثر.

راجع [توثيق API](../docs/api/README.ar.md) و[مرجع الواجهة الخلفية](BACKEND.ar.md).
