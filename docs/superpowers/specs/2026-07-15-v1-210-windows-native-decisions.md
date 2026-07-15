# V1-210 Windows Native — قرارات موثقة (بوابة الدفعة 4)

بوابة الدفعة تشترط قراراً موثقاً — لا مفترضاً — لكل من: service wrapper، واجهة HTTP، حساب الخدمة، نظام التشغيل، خدمة البيانات، والتوقيع. هذه هي القرارات المعتمدة لتنفيذ V1-210A/B/C. حالة المنصة تبقى `planned` حتى دليل clean-host الخارجي (V1-210D).

| القرار | الاختيار | البدائل المرفوضة ولماذا |
| --- | --- | --- |
| Service wrapper | **WinSW 2.12.0** مثبّت الإصدار، منسوخ داخل الحزمة، checksum له مسجل في SBOM (`windows-services.mjs`) | NSSM (لا إصدارات موقعة حديثة)، `sc.exe` مباشرة (لا إعادة تشغيل تلقائي ولا rolling logs) |
| HTTP front | خدمة **archive-http (Caddy مثبّت الإصدار)**: إنهاء TLS وproxy إلى Next (3000) وLaravel FastCGI (php-cgi على 127.0.0.1:9000) | IIS (غير مضمون التثبيت على Windows 10/11 client SKUs، ويعقّد uninstall المملوك بالـmanifest) |
| حساب الخدمة | **حساب افتراضي لكل خدمة `NT SERVICE\<id>`** — بلا كلمة سر، بلا logon تفاعلي، ACLs تُمنح على install root فقط | LocalSystem (صلاحيات مفرطة)، حساب مُدار واحد (نقطة فشل مشتركة وإدارة كلمة سر) |
| نظام التشغيل | **Windows 10 و11 x64** وفق عقد المنصات (V1-210D يغطي كليهما) | — |
| خدمة البيانات | **PostgreSQL محلي مُدار تحت install root أو endpoint خارجي** (يُرفض غير السليم قبل التثبيت عبر probes)؛ queue/cache على **database baseline**؛ Redis-compatible **اختياري بعد probe ناجح** (`windows-data-services.mjs`) | فرض Redis (يخالف baseline المقرر في V1-210C) |
| التوقيع | **Authenticode عبر signtool بشهادة الإصدار** في release workflow؛ مانيفست الحزمة يرفض أي `.exe` بلا إدخال توقيع (`WINDOWS_PACKAGE_UNSIGNED`)، وكل ملف له SHA-256 | التوقيع بعد التوزيع أو حِزم غير موقعة (يخالف V1-210A نصاً) |

## حدود هذا التنفيذ

- `update`/`rollback` للـnative تبقى `unsupported` برمجياً في الـadapter حتى تُحقن عملياتها (تذكرة لاحقة مرتبطة بـV1-212).
- تركيب mode=native في `scripts/control-center.mjs` (CLI) مؤجل عمداً: البوابة V1-212C تمنع ادعاء الدعم قبل مصفوفة clean-host، والوحدات الثلاث مغطاة باختبارات عقد محلية.
- الـPostgreSQL المحلي المُدار يتطلب تضمين ثنائيات postgres في الحزمة؛ `LOCAL_POSTGRES_UNAVAILABLE` يُعيد التوجيه إلى endpoint خارجي في البنى التي لا تضمّنها.

## الملفات

- `scripts/control-center/windows-services.mjs` — الطوبولوجيا (6 خدمات) + مانيفست الحزمة + SBOM + فرض التوقيع (V1-210A)
- `scripts/control-center/windows-runtime-adapter.mjs` — دورة Setup الكاملة بخطوات manifest قابلة للاستئناف + مزيل خدمات مملوكة بالـmanifest فقط (V1-210B)
- `scripts/control-center/windows-data-services.mjs` — خطة البيانات وبوابة ما قبل التثبيت (V1-210C)
- `scripts/control-center/uninstall.mjs` — معامل `supportedModes` ليمر uninstall الأصلي بنفس بوابات التأكيد/النسخ الاحتياطي
