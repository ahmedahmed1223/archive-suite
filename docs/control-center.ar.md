# مركز التحكم في مسار

[English](control-center.md) · [فهرس التوثيق](README.ar.md)

مركز التحكم هو واجهة تشغيل الحزمة المعتمدة: Laravel وNext.js عبر
`infra/docker-compose.yml`. استخدمه بدل أوامر Docker المباشرة عند التثبيت أو
الفحص أو النسخ الاحتياطي أو التحديث.

## أول تشغيل

```bash
node scripts/control-center.mjs doctor
node scripts/control-center.mjs wizard
```

يفحص `doctor` البيئة دون تغييرها. يشرح `wizard` خيارات المصدر أو الإصدار أو
الحزمة دون اتصال، ثم يجهز المسار الذي تختاره. لتنفيذ سريع يمكن استخدام `quick`.

## التشغيل الآمن

- `status` و`health` و`logs` لمراجعة الحالة قبل إعادة التشغيل.
- `backup` ثم `verify-backup` قبل التحديث أو الاستعادة.
- `support-bundle` لإنشاء حزمة تشخيص منقحة؛ لا تشارك `.env` أو قاعدة البيانات.
- `rollback --yes` يعرض أثر استعادة البيانات قبل تنفيذها، ولا يستخدم إلا بعد
  نسخة احتياطية مناسبة للإصدار السابق.

راجع [دليل النشر](../DEPLOYMENT.md) للتعرض العام و[دليل الدعم](ops/rc-launch-and-support.md)
للتعامل مع البلاغات.
