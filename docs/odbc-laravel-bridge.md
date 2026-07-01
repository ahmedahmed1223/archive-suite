# Laravel ODBC bridge

هذه الشريحة تضيف فحص جاهزية آمن لقواعد Windows القديمة عبر ODBC داخل المسار القانوني الجديد Laravel + Next.js.

## المتطلبات

- PHP ODBC extension محملة في بيئة Laravel runtime.
- ODBC driver مناسب للقاعدة القديمة.
- DSN معرف مسبقاً في ODBC Data Source Administrator على Windows، أو DSN connection string صالح للبيئة.

## إعداد البيئة

```env
ODBC_ENABLED=true
ODBC_DSN=LegacyArchive
ODBC_USERNAME=legacy_user
ODBC_PASSWORD=change-me
ODBC_TABLE_LIMIT=25
```

يمكن تمرير secrets داخل DSN مثل `PWD=` أو `Password=`، لكن API readiness يخفيها دائماً في الاستجابة.

## نقطة الفحص

`GET /api/v1/system/odbc`

النقطة خلف مصادقة Archive API، وتعيد ملخصاً فقط:

- `disabled`: الجسر غير مفعل.
- `missing-dsn`: الجسر مفعل لكن `ODBC_DSN` فارغ.
- `driver-unavailable`: PHP ODBC أو drivers غير متاحة في runtime.
- `connected`: الاتصال نجح، مع أول أسماء الجداول حسب `ODBC_TABLE_LIMIT`.
- `failed`: محاولة الاتصال فشلت، مع رسالة خطأ منقحة بلا كلمات مرور.

## الحدود الحالية

هذه ليست طبقة repository كاملة بعد. لا توجد migrations ولا mapping لعمليات read/write على `items/users/settings/audit` في هذه الشريحة. المرحلة التالية يجب أن تضيف adapter محدوداً فوق نفس واجهة ODBC بعد تحديد mapping جداول القاعدة القديمة.
