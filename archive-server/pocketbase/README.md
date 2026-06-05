# PocketBase — خادم البيانات لنسخة الإنتاج

خادم Go ثنائي واحد (بيانات + مصادقة + REST + لحظي + تخزين)، مثبّت بإصدار محدّد.

## التشغيل

```bash
cd pocketbase
# ثبّت PB_VERSION على إصدار حقيقي منشور: https://github.com/pocketbase/pocketbase/releases
docker compose up -d --build
```

- الواجهة الإدارية: `http://127.0.0.1:8090/_/` (أنشئ حساب المشرف أوّل مرّة).
- البيانات تُحفظ في حجم Docker الدائم `pb_data`.

## استيراد المخطّط

المجموعات وقواعد الوصول مُعرَّفة في `pb_schema.json` بصيغة PocketBase 0.22
(نموذج عام لكل مخزن: `uid` فريد + `data` JSON + `syncVersion` +
`lastModifiedBy`). استوردها عبر الواجهة الإدارية:

1. افتح Settings → Import collections.
2. الصق محتوى `pb_schema.json`.
3. فعّل خيار **Merge with the existing collections** حتى تبقى مجموعة `users`
   المدمجة وحسابات المصادقة الحالية.
4. راجع التغييرات ثم اضغط Import.

> لا يوجد أمر `pocketbase import collections` في PocketBase 0.22.21؛ الاستيراد
> يتم من الواجهة أو عبر migration مخصص.
> المجموعة `users` هي مجموعة المصادقة المدمجة في PocketBase — أضِف إليها حقل `role`
> (admin/editor/viewer) لتفعيل قواعد الوصول.

## قواعد الوصول (نموذج أحادي-المؤسسة)

- القراءة (list/view): أي مستخدم موثَّق — `@request.auth.id != ""`.
- الإنشاء/التعديل: `admin` أو `editor`.
- الحذف: `admin` فقط (و`audit_logs` غير قابلة للحذف — سجلّ ملحق فقط).

## النسخ الاحتياطي

انسخ حجم `pb_data` احتياطيًّا دوريًّا:

```bash
docker run --rm -v archive-pocketbase_pb_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/pb_data-backup.tar.gz -C /data .
```
