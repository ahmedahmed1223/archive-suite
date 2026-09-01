# أداة تثبيت Archive Suite وإدارته

[English](installer-manager.md)

نزّل `Archive-Suite-Installer-Windows.zip` على Windows أو `archive-suite-installer-linux.tar.gz` على Linux x64 من أصول الإصدار. تتضمن الحزمة Node.js ولا تحتاج تثبيته على الجهاز. تحقق من SHA256SUMS المنشور مع الأصول، ثم فك ضغط الحزمة في مجلد مستقل.

## بدء التشغيل

على Windows افتح `Archive-Suite-Installer.bat` أو شغّل `Archive-Suite-Installer.ps1` من PowerShell. على Linux:

```sh
./archive-suite-installer doctor --root /opt/archive-suite
./archive-suite-installer install --root /opt/archive-suite
```

يمكن اختيار مسار في مجلد المستخدم لتثبيت Docker دون صلاحية root إذا كان حسابك يملك الوصول إلى Docker. تثبيت Native يحتاج صلاحية مسؤول على Windows أو root مع systemd على Linux. الأداة لا تغيّر صلاحيات النظام أو تثبّت Docker تلقائيًا؛ يعرض الفحص ما يجب توفيره أولًا.

المعالج يفحص معمارية x64 والذاكرة ومساحة القرص والصلاحيات وتوفر Docker. يفحص منافذ طريقة التشغيل المختارة قبل التثبيت. الحد المطلوب للملف الأساسي 8 GiB من الذاكرة و100 GiB من المساحة الحرة، وفق عقد دعم المنتج.

## اختيار الحزمة

- `docker`: تشغيل الصور المثبتة ببصماتها في واصف الإصدار. إذا كان Docker جاهزًا تقترحه الأداة أولًا.
- `native`: تنزيل حزمة النظام المناسبة والتحقق منها، ثم إعداد الخدمات المحلية. يمكن استخدام حزمة محلية عبر `--source`.
- `offline`: تشغيل Docker دون تنزيل الصور. ضع جميع الأجزاء مع `SHA256SUMS` و`OFFLINE-BUNDLE-SHA256` في مجلد واحد وحدده باستخدام `--source`. تجمع الأداة الأجزاء وتتحقق من كل جزء ومن الملف الكامل قبل الاستخراج.

في الوضع غير المتصل يجب تنزيل أداة التثبيت نفسها مسبقًا أيضًا؛ وجود أرشيف التطبيق وحده لا يغني عنها. استخدم أصول الإصدار نفسه، وتحقق من مصدر ملفات البصمات عبر صفحة الإصدار الرسمية.

يطلب المعالج بريد المدير وكلمة مرور لا تقل عن 12 حرفًا، ويخفي كلمة المرور أثناء إدخالها. يخزن الأسرار في ملف إعدادات محمي. لا تدخل كلمة المرور في سطر الأوامر. للتشغيل غير التفاعلي مررها عبر `ARCHIVE_INSTALLER_PASSWORD` واحذف المتغير بعد التشغيل.

```sh
./archive-suite-installer install --mode docker --root /opt/archive-suite --email owner@example.org --port 3000 --yes
```

يفتح Docker منفذ التطبيق والمنفذ التالي للاتصال اللحظي؛ مثال: 3000 و3001. يستخدم Native المنفذ 8443 لواجهة الدخول، مع منافذه الداخلية الثابتة. الإعداد الأولي محلي؛ إعداد نطاق عام وTLS يحتاج إعداد نشر منفصل. يحفظ Docker ملفات التطبيق في `storage` داخل مسار التثبيت، وتبقى بيانات PostgreSQL في وحدة Docker خاصة بالمشروع.

## الإدارة والإصلاح

شغّل الأداة نفسها مع مسار التثبيت المحفوظ:

```sh
./archive-suite-installer status --root /opt/archive-suite
./archive-suite-installer health --root /opt/archive-suite
./archive-suite-installer start --root /opt/archive-suite
./archive-suite-installer stop --root /opt/archive-suite
./archive-suite-installer restart --root /opt/archive-suite
./archive-suite-installer logs --root /opt/archive-suite
./archive-suite-installer backup --root /opt/archive-suite
./archive-suite-installer repair --root /opt/archive-suite
```

يحفظ `installation.json` نوع التثبيت وإصداره ومرحلته دون أسرار. يعيد `repair` تنفيذ خطوات الإعداد القابلة للاستئناف؛ لا يحذف بيانات التطبيق ولا يعيد ضبط نظام التشغيل. إذا فشل تنزيل أو استخراج الحزمة قبل مرحلة الإعداد، احتفظ بالمجلد للتشخيص وأعد التثبيت في مجلد جديد. يدير هذا الإصدار تثبيتًا واحدًا لكل مسار؛ التبديل بين Native وDocker يحتاج تثبيتًا منفصلًا ونقل البيانات بواسطة النسخ الاحتياطية.

للتفاصيل راجع [دليل المشروع](../README.md) و[دليل الإدارة](control-center.ar.md).
