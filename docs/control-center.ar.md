# مركز التحكم في Archive Suite

[English](control-center.md) · [فهرس التوثيق](README.ar.md)

يوحّد Control Center تثبيت حزمة Laravel وNext.js وتشغيلها وإعدادها وصيانتها.
يجهز أمر `deploy` الأسرار في `.env` ويشغّل ملف
`infra/docker-compose.yml` عند استخدام Docker.

## التشغيل

| المنصة | الأمر |
| --- | --- |
| Windows | افتح `Setup-Archive.bat`، أو استخدم `Setup-Archive.bat <command>` |
| Linux وmacOS | شغّل `bash setup.sh`، أو استخدم `bash setup.sh <command>` |
| جميع المنصات | `pnpm control` أو `node scripts/control-center.mjs [command]` |

من دون وسيط، تظهر القائمة التفاعلية. ومع وسيط، ينفذ الأمر المطلوب مباشرة، وهو
الأسلوب المناسب للأتمتة والمهام المجدولة. الخيار `1` هو البدء السريع، ويخرج
الخياران `0` و`q` من القائمة.

## القدرات

| المجموعة | الأوامر |
| --- | --- |
| البدء | `wizard` و`quick` و`first-run` و`doctor` |
| النشر | `deploy` |
| الخادم | `status` و`start` و`stop` و`restart` و`logs` و`health` |
| الإعداد | `config` و`set-url` |
| الأمان | `generate-password` و`change-admin-password` و`rotate-secrets` |
| قاعدة البيانات | `migrate-status` و`migrate` |
| النسخ الاحتياطي | `backup` و`backups` و`restore` |
| الصيانة | `diagnostics` و`update` |

أمثلة:

```bash
node scripts/control-center.mjs status
node scripts/control-center.mjs health
node scripts/control-center.mjs backup
node scripts/control-center.mjs update
node scripts/control-center.mjs change-admin-password --generate
```

## ملفات Docker التشغيلية

تشغّل حزمة Compose الخدمات الأساسية افتراضيًا. يمكن إضافة ملف `media` لمعالجة
الوسائط والتعرف البصري على النصوص، وملف `edge` لإنهاء TLS عبر Caddy. يضبط
المعالج القيمة `ARCHIVE_COMPOSE_PROFILES`، ويمكن تجاوزها لأمر واحد:

```bash
ARCHIVE_COMPOSE_PROFILES=media node scripts/control-center.mjs start
```

تعبر `ocr` و`ai` عن قدرات في المنتج، وليستا اسمي ملفين في Docker Compose.

## السلامة

- ينشئ Control Center نسخة من `.env` قبل تعديله.
- يحجب القيم التي تنتهي أسماؤها بـ`SECRET` أو`PASSWORD` أو`TOKEN` أو`KEY` أو`DSN` أو`URL`.
- تستبدل الاستعادة قاعدة البيانات الحالية، ولذلك تتطلب تأكيدًا صريحًا.
- يؤدي تدوير أسرار Reverb إلى قطع الاتصالات الفورية، ويتطلب إعادة بناء صورة Next.js.
- لا يدوّر النظام `LARAVEL_APP_KEY` تلقائيًا لأنه يحمي البيانات المشفرة.
- يحدّث تغيير كلمة مرور المشرف ملف `.env` والمستخدم القائم عندما تكون Laravel عاملة.

## المتطلبات

- Node.js 22 أو أحدث.
- Docker مع Compose v2 لمسار Docker.
- ملف الإعداد `infra/.env` وصلاحية الكتابة في مجلد النسخ الاحتياطية.

تُحفظ نسخ Docker في `infra/backups/archive-<timestamp>.sql`. تتم إدارة حسابات
المستخدمين وأدوارهم من صفحة **المستخدمون** داخل التطبيق، بينما يغطي Control
Center بيانات اعتماد المشرف والصيانة التشغيلية.

## أوامر Native Standalone

عند التشغيل من حزمة Native الإصدار 1.5.1، استخدم `manage.bat` في Windows أو
`manage.sh` في Linux. يستدعي الملفان وقت تشغيل Node.js المرفق ومسار Control
Center نفسه لتنفيذ دورة الإدارة:

```text
doctor | status | start | stop | restart | logs | health
backup | restore | update | uninstall
```

ملف التثبيت هو `install.bat` أو `install.sh`. يتحقق من `SHA256SUMS`، ويسجل
خدمات المنصة التي يملكها التثبيت فقط، ويحافظ على البيانات عند إلغاء التثبيت
ما لم يقدّم المشغل تأكيد حذف صريحًا. يسجل `RELEASE.json` إصدار الحزمة ووقت
بنائها بتوقيت UTC، ويحتوي `CHANGELOG.md` على سجل التغييرات المرفق.

تدير خطة Native الافتراضية خدمتي البيانات المضمّنتين `archive-postgres` و
`archive-redis` إلى جانب خدمات التطبيق الست. يتحقق المثبت من بيان payload قبل
التثبيت، وتشملهما أوامر دورة الحياة نفسها. يظل اختيار خدمات البيانات الخارجية
متاحًا للمشغل الذي يدير PostgreSQL أو خدمة متوافقة مع Redis مسبقًا.

راجع [دليل النشر](../DEPLOYMENT.ar.md) و[دليل الدعم](ops/support.ar.md).
