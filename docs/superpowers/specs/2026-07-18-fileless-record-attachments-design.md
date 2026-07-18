# السجلات الوصفية ومرفقاتها

## المجال والبيانات

يبقى `storage_rows` مصدر حقيقة السجل. يضاف جدول `record_attachments` بهوية UUID وحقلي `record_store` و`record_uid`، وحقول `disk`, `path`, `original_name`, `mime_type`, `size_bytes`, `checksum_sha256`, `is_primary`, `processing_status`, `created_by` والتواريخ. يفهرس `(record_store, record_uid)`, checksum والحالة، ويمنع تكرار `(disk,path)`. لا يستخدم FK إلى `storage_rows` لأن هويتها مركبة وليست نموذج Eloquent ثابتًا.

## API

- `POST /records` ينشئ سجلًا وصفيًا واحدًا للـeditor/admin، مع title مطلوب وstore افتراضي `archive-items` وUUID يولده الخادم.
- `GET /records/{id}/attachments?store=` يعيد المرفقات لأي مستخدم مصادق.
- `POST /records/{id}/attachments` يقبل `files[]` حتى 20 ملفًا ويعيد استخدام سياسة الحجم والامتدادات وفحص المحتوى والحجر الصحي. كل ملف مستقل؛ الاستجابة توضح المقبول والمرفوض.
- `DELETE /records/{id}/attachments/{attachmentId}?store=` للـeditor/admin، يحذف صف المرفق والملف، ولا يحذف السجل.
- رد السجل يتضمن `attachmentCount`، ويبقى صالحًا عند الصفر.

## السلامة والأداء

تتحقق ملكية السجل قبل الرفع، وتستخدم أسماء UUID ومسارات محتواة. يسجل checksum والحجم وMIME. عند فشل إدخال DB بعد النقل يحذف الملف تعويضيًا. الاستعلام عن العدد يتم بتجميع مفهرس ولا يحمل الصفوف كاملة.

## Next.js

تضيف صفحة الرفع خيار «سجل وصفي بلا ملفات» ينشئ السجل ثم ينتقل لتفاصيله. تضيف صفحة التفاصيل لوحة مرفقات متعددة الملفات مع الرفع والحالة والحذف والتنزيل/التشغيل. توضح الحالة الفارغة أنها سجل صالح بلا ملفات.

## القبول

اختبارات Laravel للإنشاء والصلاحيات والعزل والرفع المتعدد والحذف، تحديث OpenAPI والعميل، اختبارات Next للحالات النقية، ثم بوابة `pnpm verify`.
