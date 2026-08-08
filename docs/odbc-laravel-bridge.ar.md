# جسر ODBC في Laravel

[English](odbc-laravel-bridge.md) · [فهرس التوثيق](README.ar.md)

يوفر جسر ODBC فحص جاهزية للقراءة فقط لمصدر بيانات Windows مُعد مسبقًا. يعرض
حالة الاتصال وقائمة محدودة من أسماء الجداول، ولا يعيد بيانات الاعتماد أو
محتوى الجداول.

## المتطلبات

- إضافة ODBC الخاصة بـPHP ضمن بيئة Laravel.
- برنامج تشغيل يدعم قاعدة البيانات المطلوبة.
- اسم مصدر بيانات DSN مُعد، أو سلسلة اتصال DSN صحيحة.

## الإعداد

```env
ODBC_ENABLED=true
ODBC_DSN=ArchiveSource
ODBC_USERNAME=archive_reader
ODBC_PASSWORD=replace-in-secret-store
ODBC_TABLE_LIMIT=25
```

احفظ بيانات الاعتماد في مخزن أسرار. يحجب API أي كلمة مرور مضمنة في سلسلة DSN
قبل إعادة رسالة خطأ.

## نقطة فحص الجاهزية

يتطلب `GET /api/v1/system/odbc` المصادقة في Archive Suite، ويعيد إحدى الحالات:

- `disabled`: الجسر متوقف.
- `missing-dsn`: قيمة `ODBC_DSN` فارغة.
- `driver-unavailable`: إضافة PHP أو برنامج التشغيل غير متاح.
- `connected`: نجح الاتصال، وتظهر أسماء الجداول حتى الحد المضبوط.
- `failed`: فشل الاتصال، مع رسالة خطأ منقحة.

يقتصر نطاق هذه النقطة على الجاهزية واستكشاف بنية المصدر؛ ولا تقرأ سجلات
الأرشيف أو تكتبها.
