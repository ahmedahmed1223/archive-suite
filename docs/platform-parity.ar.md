# دعم المنصات

[English](platform-parity.md) · [فهرس التوثيق](README.ar.md)

يدعم مسار Docker والتشغيل الأصلي على Windows وLinux. يوثّق
`infra/platform/compatibility.v1.json` متطلبات وقت التشغيل والخدمات ومسارات
البيانات والمنافذ لكل منصة.

| المنصة | التشغيل | نقطة البداية | المتطلبات |
| --- | --- | --- | --- |
| Windows 10/11 | Docker | `Setup-Archive.bat` | Docker Desktop مع Compose v2 |
| Linux | Docker | `setup.sh` | Docker Engine مع Compose v2 |
| Windows 10/11 | Native | `pnpm bundle:windows-native` | PostgreSQL متاح للجهاز (Redis اختياري) |
| Linux | Native | `pnpm bundle:linux-native` | `systemd` وPostgreSQL (Redis اختياري) |

شغّل `node scripts/control-center.mjs doctor` قبل التثبيت. اختر Docker عندما
تدير المؤسسة الحاويات، واختر Native عندما تدير خدمات الجهاز مباشرة. يستخدم
المساران API والصلاحيات وسجل التدقيق وإجراءات النسخ الاحتياطي نفسها.

راجع [دليل التثبيت الأصلي](native-installation.ar.md) و[دليل Docker](../DEPLOYMENT.md).
