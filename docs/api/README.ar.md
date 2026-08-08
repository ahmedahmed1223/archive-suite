# عقد API في مسار

[English](README.md) · [فهرس التوثيق](../README.ar.md)

الملف `archive-contract.openapi.json` هو عقد OpenAPI المشترك للواجهة وخدمة
Laravel. يصف المصادقة والسجلات والبحث والملفات والحقوق والمشاركة والإدارة.

عند تغيير واجهة عامة، حدّث العقد أولًا ثم Laravel وNext.js، وشغّل:

```bash
pnpm verify:api-contracts
pnpm verify:api-generated
```

لا تنشئ مسارات بديلة خارج العقد أو عميلًا يتجاوز قواعد الصلاحيات في الخادم.
