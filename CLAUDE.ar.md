# دليل المساهمة في مسار

[English](CLAUDE.md) · [فهرس التوثيق](docs/README.ar.md)

يتكون المنتج من واجهة `archive-next` المبنية بـNext.js وخدمة
`archive-laravel` المبنية بـLaravel. عقد API في
`docs/api/archive-contract.openapi.json` هو مصدر الحقيقة المشترك.

استخدم `pnpm` من جذر المستودع. شغّل `pnpm dev` للتطوير و`pnpm verify` قبل
الدمج. أي تعديل عام في API يتطلب تحديث العقد وتنفيذ Laravel وعميل Next.js
وفحوص التوافق في التغيير نفسه.

راجع [عقد API](docs/api/README.ar.md) و[خدمة Laravel](archive-laravel/README.ar.md)
للتفاصيل الخاصة بكل طبقة.
