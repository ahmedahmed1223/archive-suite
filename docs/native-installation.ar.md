# تثبيت Native Standalone

[English](native-installation.md) · [فهرس التوثيق](README.ar.md)

يوفر الإصدار 1.5.1 حزم Native Standalone كاملة لنظامي Windows x64 وLinux x64.
تتضمن الحزمة التطبيق المعتمد المبني على Laravel وNext.js، وأوقات التشغيل
المثبتة، وملفات تشغيل المنصة، وControl Center، وبيانات الإصدار، والبصمات،
وحزمة خدمات البيانات المتحقق منها اللازمة للإصدار.

## التنزيل والتحقق

من [صفحة إصدار v1.5.1 على GitHub](https://github.com/ahmedahmed1223/archive-suite/releases/tag/v1.5.1)، نزّل أصل منصة واحدة فقط، ودليل قبولها، وملف `SHA256SUMS` العام.

في Windows:

```powershell
Get-FileHash .\archive-suite-v1.5.1-windows-native.tar.gz -Algorithm SHA256
```

في Linux:

```bash
sha256sum --check SHA256SUMS
```

لا تفك أي أصل أو تشغله إذا اختلفت بصمته عن `SHA256SUMS` أو غاب دليل قبول
منصته.

## المتطلبات

يتطلب Windows نظامًا بمعمارية x64 ونافذة طرفية بصلاحيات المسؤول. ويتطلب Linux
نظامًا بمعمارية x64 ووجود `systemd` وصلاحية root لتسجيل الخدمات، إضافة إلى
أداة `tar`. يحتاج النظامان إلى مساحة كافية لفك التطبيق وحزمة خدمات البيانات
المضمنة.

## التثبيت والتحقق

فك الأرشيف في مجلد جديد، ثم شغّل ملف التشغيل الموجود في جذر الحزمة:

```bat
install.bat
```

```bash
chmod +x install.sh manage.sh
./install.sh
```

يتحقق المثبت من سجل الحزمة، ويطلب اختيارات إعداد Native، وينشئ الإعدادات
والأسرار المحمية، ويسجل خدمات المنصة، وينفذ الترحيلات الآمنة، ثم يجري فحص
الصحة.

عند اختيار الخدمات المُدارة افتراضيًا، يهيئ المثبت PostgreSQL المضمّن، ويثبت
إضافة `pgvector` المتحقق منها، وينشئ حساب التطبيق في Archive، ويسجل خدمة Redis
المضمنة. تُسجل خدمات البيانات هذه في بيان التثبيت، لذلك تشملها أوامر التشغيل
والإيقاف وإعادة التشغيل والحالة وإلغاء التثبيت. اختر نقاط اتصال خارجية فقط إذا
كانت هذه الخدمات تعمل خارج حزمة Native.

## إدارة التثبيت

يمثل `manage.bat` و`manage.sh` نقطتي الإدارة الثابتتين. وهما يستدعيان تطبيق
Control Center نفسه ولا يحتويان مدير خدمات منفصلًا:

```bat
manage.bat doctor
manage.bat status
manage.bat health
manage.bat logs
manage.bat backup
manage.bat update
manage.bat restore
manage.bat uninstall
```

```bash
./manage.sh doctor
./manage.sh status
./manage.sh health
./manage.sh logs
./manage.sh backup
./manage.sh update
./manage.sh restore
./manage.sh uninstall
```

تتطلب `restore` وحذف البيانات أثناء `uninstall` تأكيدًا صريحًا. يحافظ إلغاء
التثبيت على مسارات البيانات والنسخ الاحتياطية افتراضيًا.

## رقم الإصدار وسجل التغييرات

اقرأ `RELEASE.json` في جذر الحزمة لمعرفة الإصدار والمنصة ووقت البناء بتوقيت
UTC. واقرأ `CHANGELOG.md` لمعرفة سجل التغييرات المرفق بالحزمة. احتفظ بالملفين
`RELEASE.json` و`SHA256SUMS` مع التثبيت عند طلب الدعم.

## الترقية والاستعادة

أنشئ نسخة احتياطية وتحقق منها قبل تنفيذ `update`. احتفظ بالحزمة السابقة حتى
تجتاز النسخة الجديدة فحص `health` وتجارب فعلية للبحث والرفع ومعالجة الوسائط.
إذا فشل التحديث، استخدم النسخة الاحتياطية المتحقق منها والحزمة السابقة، ولا
تحاول التراجع عن مخطط قاعدة البيانات يدويًا.

في حزمة Docker غير المتصلة والمقسمة، اجمع أولًا جميع الملفات التي تحمل الاسم
`archive-suite-offline-v1.5.1.tar.gz.part-*`، وتحقق من
`OFFLINE-BUNDLE-SHA256`، ثم نفّذ `tar -xzf`. راجع
[`infra/offline/README.ar.md`](../infra/offline/README.ar.md).
