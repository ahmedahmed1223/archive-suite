# تثبيت Archive Suite دون اتصال

[English](README.md) · [فهرس التوثيق](../../docs/README.ar.md)

توفر Archive Suite حزمًا قابلة للنقل لمساري Docker والتشغيل المباشر دون
حاويات (Native). يصف هذا المجلد صيغة حزمة Docker دون اتصال. تُبنى حزم التشغيل
المباشر بأوامر المنصة الموضحة في [دليل Native](../../docs/native-installation.ar.md).

## حزمة Docker

1. نزّل جميع أجزاء الحزمة وملفي `SHA256SUMS` و`OFFLINE-BUNDLE-SHA256` من
   الإصدار نفسه. لا تبدأ إذا كان جزء مثل `.part-00` أو `.part-01` مفقودًا.
2. تحقق من الأصول التي نزّلتها باستخدام `sha256sum --check SHA256SUMS` على
   Linux أو قارن ناتج `Get-FileHash` على Windows مع السطر المطابق في الملف.
3. اجمع الأجزاء بالترتيب قبل فك الضغط. على Linux أو macOS:

   ```bash
   cat archive-suite-offline-v1.5.1.tar.gz.part-* > archive-suite-offline-v1.5.1.tar.gz
   sha256sum --check OFFLINE-BUNDLE-SHA256
   ```

   على Windows في موجه الأوامر (CMD):

   ```cmd
   copy /b "archive-suite-offline-v1.5.1.tar.gz.part-00"+"archive-suite-offline-v1.5.1.tar.gz.part-01" "archive-suite-offline-v1.5.1.tar.gz"
   ```

   ثم احسب `Get-FileHash .\archive-suite-offline-v1.5.1.tar.gz -Algorithm SHA256`
   وقارنه بقيمة `OFFLINE-BUNDLE-SHA256`. أضف أي أجزاء لاحقة بالترتيب نفسه.
4. فك الحزمة بعد نجاح التحقق، مثل: `tar -xzf archive-suite-offline-v1.5.1.tar.gz`.
5. انقل المجلد المستخرج كاملًا إلى الجهاز المعزول، ثم شغّل `sh install.sh` على
   Linux أو `.\install.ps1` في Windows PowerShell.
6. راجع ملف `.env` المحمي، وشغّل `compose.v1.yml` المرفق، ثم تحقق من صحة الخدمات.

يتحقق المثبت من جميع الملفات والصور قبل تشغيل `docker load`، ولا يحتاج إلى
اتصال بسجل صور.

## التحديث والاستعادة

أنشئ نسخة احتياطية وتحقق منها قبل التحديث. أوقف الخدمات الحالية دون حذف وحدات
التخزين، ثم حمّل الحزمة الجديدة وشغّلها. يطبق Laravel تغييرات البنية عبر
`archive:migrate-safe`.

إذا فشل التحديث، فاستعد نسخة قاعدة البيانات والتخزين الموافقة للإصدار السابق
قبل تشغيله. لا تشغّل تطبيقًا أقدم على بنية قاعدة بيانات أحدث وغير متوافقة.

## إلغاء التثبيت

```bash
docker compose --env-file .env -f compose.v1.yml down
```

أضف `--volumes` فقط إذا كنت تقصد حذف البيانات الدائمة وتحققت من النسخة
الاحتياطية. راجع [دليل التثبيت](../../INSTALL.ar.md) و[دليل النشر](../../DEPLOYMENT.ar.md)
لإجراءات التشغيل.
