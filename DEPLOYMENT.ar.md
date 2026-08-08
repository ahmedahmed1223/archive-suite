# نشر Archive Suite عبر Docker

[English](DEPLOYMENT.md) · [فهرس التوثيق](docs/README.ar.md)

انشر خدمتي Laravel وNext.js من خلال Control Center وملف
`infra/docker-compose.yml`.

## قبل النشر

- ثبّت Docker مع Compose v2.
- ثبّت Node.js بالإصدار `26.5.0` وpnpm بالإصدار `11.9.0` عند تشغيل Control Center من المصدر.
- عند النشر العام، جهز سجل DNS للخادم وبريدًا إلكترونيًا لشهادة TLS.

## التشغيل الأول

ابدأ بفحص لا يغير النظام، ثم شغّل معالج الإعداد:

```bash
node scripts/control-center.mjs doctor
node scripts/control-center.mjs wizard
```

يتيح `wizard` الاختيار بين البناء من المصدر أو إصدار منشور أو حزمة دون اتصال.
ينفّذ `quick` النشر وفحص الصحة في خطوة واحدة، بينما ينشئ `deploy` الأسرار
الناقصة في `infra/.env` ويشغّل حزمة Compose.

```bash
node scripts/control-center.mjs quick
# أو
node scripts/control-center.mjs deploy
node scripts/control-center.mjs health
```

## التشغيل الآمن

استخدم Control Center لعرض الحالة والسجلات وإنشاء النسخ الاحتياطية والتحديث
والاستعادة. تحقق من النسخة الاحتياطية قبل استعادتها؛ يرفض `restore` أي ملف لا
تطابق بصمته. يتطلب النشر العام قيم `.env` الصحيحة، ومنها نطاق فعلي وقيمة
`ARCHIVE_PUBLIC_DEPLOY=1`.

راجع [مرجع Control Center](docs/control-center.ar.md) و[دليل الدعم](docs/ops/support.ar.md).
