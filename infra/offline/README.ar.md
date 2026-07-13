# تثبيت Archive Suite دون اتصال (Docker فقط)

هذه الحزمة لمسار Docker القانوني على Windows وLinux. لا توفر مثبتًا native/أصليًا ولا تدّعي دعم Windows/Linux الأصلي؛ ذلك باقٍ ضمن V1-208 وما بعدها.

1. نزّل ملف الحزمة و`SHA256SUMS` من الإصدار نفسه، وافحص `SHA256SUMS` **قبل فك الحزمة** (`sha256sum --check SHA256SUMS` على Linux أو `Get-FileHash` ومقارنة السطر على Windows).
2. فك الحزمة وانقل المجلد كاملًا إلى المضيف المعزول.
3. Linux: شغّل `sh install.sh`. Windows PowerShell: شغّل `.\install.ps1`. كلاهما يفرض checksum الداخلي والتحقق الدلالي المغلق قبل `docker load`.
4. راجع `.env` المحمي، ثم شغّل أمر `docker compose ... up -d` الظاهر.
5. تحقق بـ`docker compose --env-file .env -f compose.v1.yml ps` ثم افتح اسم النطاق المضبوط.

الترقية: أنشئ backup عبر [Control Center](../../INSTALL.md) وتحقق من إمكانية قراءته، ثم أوقف الإصدار الحالي دون حذف volumes، وحمّل الحزمة الجديدة وشغّلها. يبدأ Laravel بأمر `archive:migrate-safe` الذي يأخذ نسخة قبل migration؛ لا تعتبر الترقية ناجحة قبل health/HTTPS smoke.

الرجوع ليس تشغيل binary أقدم فوق schema أحدث. عند فشل الترقية أوقف الإصدار الجديد، واستعد backup قاعدة البيانات والتخزين المأخوذ قبل الترقية والمتوافق schema مع الإصدار السابق، ثم شغّل Compose الخاص بالإصدار السابق وتحقق من الصحة. إن لم تتوفر نسخة schema متوافقة فلا تنفذ downgrade؛ اتبع مسار الاستعادة في وثائق Control Center.

إلغاء التثبيت: `docker compose --env-file .env -f compose.v1.yml down`. أضف `--volumes` فقط بعد نسخة احتياطية وعند الرغبة الصريحة في حذف البيانات نهائيًا.

راجع [INSTALL.md](../../INSTALL.md) و[DEPLOYMENT.md](../../DEPLOYMENT.md) للتشغيل والنسخ الاحتياطي. لا تحتاج خطوات التحميل والتثبيت أعلاه إلى registry أو شبكة.
