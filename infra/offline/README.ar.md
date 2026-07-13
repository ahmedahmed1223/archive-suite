# تثبيت Archive Suite دون اتصال (Docker فقط)

هذه الحزمة لمسار Docker القانوني على Windows وLinux. لا توفر مثبتًا native/أصليًا ولا تدّعي دعم Windows/Linux الأصلي؛ ذلك باقٍ ضمن V1-208 وما بعدها.

1. فك الحزمة وانقل المجلد كاملًا إلى المضيف المعزول.
2. Linux: شغّل `sh install.sh`. Windows PowerShell: شغّل `.\install.ps1`.
3. راجع `.env` وأضف بيانات المسؤول الأول، ثم شغّل أمر `docker compose ... up -d` الظاهر.
4. تحقق بـ`docker compose --env-file .env -f compose.v1.yml ps` ثم افتح اسم النطاق المضبوط.

الترقية/الرجوع: خذ نسخة احتياطية عبر [Control Center](../../INSTALL.md)، فك إصدار الحزمة المطلوب في مجلد جديد، حمّله، ثم استخدم ملف Compose الخاص بذلك الإصدار. لا تحذف volumes عند الرجوع.

إلغاء التثبيت: `docker compose --env-file .env -f compose.v1.yml down`. أضف `--volumes` فقط بعد نسخة احتياطية وعند الرغبة الصريحة في حذف البيانات نهائيًا.

راجع [INSTALL.md](../../INSTALL.md) و[DEPLOYMENT.md](../../DEPLOYMENT.md) للتشغيل والنسخ الاحتياطي. لا تحتاج خطوات التحميل والتثبيت أعلاه إلى registry أو شبكة.
