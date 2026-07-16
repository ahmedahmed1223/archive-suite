# مهام Masar الحالية

> هذا هو ملف المهام النشطة الوحيد بعد دمج خطط Laravel/Next وUI وlegacy parity.

> **للوكلاء المنفذين:** كل ميزة تبدأ بـTDD وتبقى في ملفاتها المملوكة؛ تُنفذ المميزات المتقاربة في **دفعة** ثم تُراجع وتُفحص الدفعة مرة واحدة قبل الدمج. يظل لكل ميزة commit مستقل بعد قبول الدفعة. لا يعمل وكيلان على الملف نفسه، ولا يُدمج جزء غير مكتمل أو تحقق خارجي على أنه منجز محليًا.

## الحالة

- أُغلقت جميع مانعات P0 الأصلية، لكن الإصدار يبقى **NO-GO** للاستخدام العام حتى إكمال التشغيل المزدوج وSetup الشامل وجاهزية المستخدم والتجربة الميدانية وبوابات GA أدناه.
- توجد مهام تطوير محلية مفتوحة في المسار القانوني `archive-next/` و`archive-laravel/` (وأيضًا `scripts/` و`infra/` للتثبيت والتشغيل)؛ البنود التي تحتاج Windows/Linux نظيفين أو اعتمادات حية موسومة صراحة كتحقق خارجي.
- التصميم الحاكم: [`docs/superpowers/specs/2026-07-14-daily-use-dual-runtime-design.md`](docs/superpowers/specs/2026-07-14-daily-use-dual-runtime-design.md).
- ترتيب التنفيذ الحاكم هو جدول الأولويات التشغيلي أدناه؛ أُلغي الترتيب الخطي القديم لأنه كان يفتح Native وRC قبل قراراتهما واعتماداتهما، ويشغّل الاختبارات العامة قبل اكتمال المميزات والبنية الأساسية.
- الموجة 7 (P8، بنود `V1-7xx`) مميزات مُرقّاة من Backlog بقرار المستخدم 2026-07-14 وهي مانعة للإصدار بموجب بوابة V1-406؛ تفاصيلها في قسمها أدناه.
- البنود المكتملة نُفذت ووُثقت في `ChangeLog.md` ولا تُعاد إلا بمتابعة جديدة ذات معرّف مستقل.

## الأولويات التشغيلية وتبعيات الدفعات

> هذا القسم هو **مصدر الحقيقة لترتيب التنفيذ**. تبقى الأقسام ذات معرفات V1 أدناه سجل النطاق والتفاصيل، ولا يُعاد ترقيم أي بند.

| الترتيب | الدفعة | البنود | شرط البدء | بوابة الدمج |
| --- | --- | --- | --- | --- |
| 0 | تنظيف الحالة | أي تعديل غير ملتزم أو مهمة قاطعتها جلسة سابقة | جرد المالك والنطاق؛ لا تختلط التغييرات | فحص diff واختبار موجّه قبل ضمها للدفعة الصحيحة |
| 1 | أساس المنتج والعقود | V1-301A، V1-701، V1-702، V1-704، V1-706، V1-708، V1-713، V1-714، V1-715، V1-759، V1-761 | لا قرار external ولا تغيير متداخل لعقد OpenAPI في الوقت نفسه | TDD واختبارات موجهة لكل بند، ثم typecheck + API-contracts + build مرة للدفعة |
| 2 | تجارب السجل والرفع والتعاون | بقية P8A/P8B/P8C ثم P8E/P8G | اكتمال العقد أو API الذي تستهلكه الميزة؛ مالك واحد لكل صفحة أو client contract | مراجعة الدفعة، ثم build ولقطات/اختبارات موجهة للواجهات المتأثرة |
| 3 | السلامة والموثوقية | P8D وV1-760 وV1-756..758 | لا تبدأ UI undo قبل V1-732؛ لا يبدأ تحذير مغادرة قبل وجود نماذج قابلة للحفظ | اختبارات Laravel/Node الموجهة، ثم backup/health/queue checks للدفعة |
| 4 | إعداد وNative محلي | V1-210A..C وV1-211A..C وV1-212B..C | قرار موثق للـwrapper/HTTP/service account/OS/data service/signing؛ لا يُفترض أي منها | contract + unit tests محلية؛ حالة المنصة تبقى planned حتى clean-host evidence |
| 5 | القياس والوصولية والاختبارات العامة | V1-303B..E وV1-307A..D وV1-306B | اكتمال دفعات المنتج والبنية التي ستغطيها؛ لا توسّع inventory أثناء تغير المسارات | `pnpm verify` وlive Playwright وaxe/screenshots/perf baseline مرة لكل دفعة مستقرة |
| 6 | RC وGA | V1-501..605 | اكتمال 1–5 وartifacts موقعة؛ V1-501 Docker rehearsal المحلي يمكن أن يتقدم مبكرًا دون ادعاء إغلاق | أدلة clean-host/field حقيقية، توقيعات Product/Security/Ops/Support، ولا بديل محلي لها |

### قواعد منع التعارض

- ملفات العقد المشتركة (`docs/api/archive-contract.openapi.json` و`archive-next/lib/archive-api.ts`) لها مالك واحد في كل دفعة؛ لا تبدأ ميزتان تغيرانهما في وقت واحد.
- ملفات Setup المشتركة (`scripts/control-center.mjs`، `setup-config.mjs`، manifest schemas، `compatibility.v1.json`) لها دفعة Native واحدة بعد تثبيت قرارات المنصة، لا مسارات Windows وLinux متوازية عليها.
- V1-301A يسبق V1-301B وV1-301C؛ V1-303B يسبق V1-303C..E؛ V1-307A يسبق V1-307B..D؛ V1-501 المحلي وV1-505 المحلي لا يغلقان القبول الخارجي.
- لا تُشغّل اختبارات التغطية العامة أو `pnpm verify` بعد كل ميزة. تُشغّل الاختبارات الموجهة أثناء التطوير، ثم بوابة الدفعة بعد استقرار مميزاتها وعقودها.

## خطة UX/UI الشاملة — الشرائح المتبقية (مُرحَّلة من خطة 2026-07-11 قبل حذف ملفها)

> المنهج لكل شريحة: اختبار فاشل أولاً → تنفيذ → typecheck/build/tests → لقطات 375/768/1280 → توثيق في ChangeLog وcommit مستقل. المهام 1–4 (الأساس المتجاوب، التنقل والحالات، رحلة أول تشغيل، رحلة الإضافة والمعالجة) منجزة.

- [x] **Task 5: Archive, Search and Record Workspace** — مساحة عمل الأرشيف والبحث وسجل المادة.
- [x] **Task 6: Organization and Quality Workspaces** — المجموعات، الوسوم، المفضلة، المكررات، الجودة.
- [x] **Task 7: Media Review, Collaboration, Automation and Rights** — مراجعة الوسائط، التعاون، الأتمتة، الحقوق.
- [x] **Task 8: Sharing, Observability and Administration** — المشاركة، المراقبة، الإدارة.
- [x] **Task 9: Whole-App Verification and Closure** — تحقق شامل للتطبيق وإغلاق الخطة.
- البنود التي تحتاج اعتمادات، أجهزة، سياقات نشر، أو عينات حية نُقلت إلى سجل “تحققات خارجية مؤجلة” داخل `ChangeLog.md` ولا تُعد مهام تطوير محلية نشطة.

## صلابة الانهيار والتعافي — بنود معمارية مؤجلة (من مراجعة المرحلة 5، 2026-07-12)

> إصلاحات جراحية أُنجزت (تسريب أخطاء 401/الإعدادات، تحقق checksum عند الاستعادة). البنود أدناه تحتاج قراراً تصميمياً لا تعديلاً صغيراً.

- [x] **عقد رموز أخطاء ثابتة (error codes)** — منجز 2026-07-13 في ba927be: `ApiError` بثمانية رموز مستقرة + renderer مركزي + تعقيم 500 في الإنتاج؛ حقل `error` النصي باقٍ كما هو (إضافة صرفة).
- [x] **إزالة اقتران sentinel-string الهش** — منجز 2026-07-13 في ba927be: صفحات data-center/status/system-control تفرّع على `code` (المطابقة النصية القديمة fallback انتقالي موسوم للإزالة).

## خطة الإصدار الأول (V1) — مدمجة من `docs/superpowers/specs/2026-07-12-v1-agent-execution-plan.md`

> القرار الحالي **NO-GO** رغم إغلاق P0؛ الموانع الحالية هي W2/W3 والقبول الحي وRC/GA. تقرير 2026-07-12 مرجع تاريخي لخط الأساس، أما حالة التنفيذ الحالية ومصدر الأولوية فهما هذا الملف وتصميم 2026-07-14 أعلاه.

### الموجة 0 — خط الأساس
- [x] **V1-000 مراجعة cutover** — حذف الإرث (1700 ملف) وcommit نظيف. (منجز 2026-07-12)
- [x] **V1-001 قفل النطاق** — منجز 2026-07-13 في d071fa2: تصنيف 135 مسارًا (108 v1 / 20 admin / 7 experimental خلف ARCHIVE_FEATURE_* معطلة في الإنتاج / 0 hidden) + `RouteScopeTest` يمنع شحن مسار غير مصنّف + جدول `docs/scope/v1-route-scope.md`. متابعة مفتوحة: إضافة requireAdmin لمسارات ODBC (chip).
- [x] **V1-002 versioning/legal** — منجز 2026-07-13: LICENSE جذري MIT (قرار المستخدم)، `package.json` إلى `1.0.0-rc.1` + حقل license، سياسة SemVer ونافذة الدعم في `docs/versioning.md`؛ الإطلاق الرسمي بدفع tag مطابق عبر بوابة `release.yml`.
- [x] **V1-003 reproducibility** — منجز 2026-07-13: عقد toolchain آلي (Node 22.13.0، pnpm 11.9.0، PHP 8.4.23، Composer 2.9.5)، تثبيت frozen معزول، وفحص drift داخل `pnpm verify`. رُفع Node من 22.12 إلى 22.13 ضمن V1-204 لأن pnpm 11.9 يتطلب 22.13 كحد أدنى.
- [x] **V1-004 canonical deployment truth** — توحيد Setup/Control Center/compose وإزالة PocketBase/deploy-legacy/docker-compose.postgres. (منجز 2026-07-12 بالدمج؛ setup.bat يعمل.)
- [x] **V1-005 platform contract** — `infra/platform/compatibility.v1.json` + schema + `platform-contract.mjs` يستهلكها doctor. (منجز 2026-07-12 بالدمج.)

### الموجة 1 — أمن وبيانات (P0/P1)
- [x] **V1-101** رفض المدير الافتراضي/الضعيف و`ARCHIVE_SECURE_COOKIES=false` في الإنتاج (حارس Seeder + حارس boot، 12 اختباراً، 439 تمر). (منجز 2026-07-12) **(P0 #1)**
- [x] **V1-102** مصفوفة RBAC + Policies لكل endpoint مع `RoleMatrixApiTest`. (منجز 2026-07-13: أدوار admin/editor/viewer الموجودة أصلاً في عمود `users.role` مُفعَّلة عبر Gate abilities حقيقية (`manage-system`/`manage-content` في `AuthServiceProvider`) و`Controller::requireAdmin()`/`requireEditor()`. الثغرات المُغلَقة: `/records/bulk`+`/records/bulk-delete`+`POST /share`+كتابة/حذف montage-projects كانت مفتوحة لأي مستخدم مصادَق (حتى viewer)؛ نقاط admin/system-control/backup كانت محمية أصلاً بـ`requireAdmin` قبل هذا التغيير. media jobs تبقى معزولة بالملكية (V1-111) بتصميم مقصود. `RoleMatrixApiTest` جديد (14 اختباراً)، الحزمة الكاملة 475 تمر/0 فشل. خارج النطاق موثقاً: tag-nodes/vocabulary/collections/relations/types/automation-rules/ingest/upload-links لا تزال مفتوحة لأي دور مصادَق — يحتاج تمريرة تالية.) **(P0 #4)**
- [x] **V1-103** قصر refresh cookie على `/auth/refresh` + Origin/CSRF/throttle + تحديث OpenAPI. (منجز 2026-07-13: `path` الكوكي `va_refresh` أصبح `/api/v1/auth/refresh` بدل `/` — لا يُرسَل مع أي طلب آخر (`AuthController::REFRESH_COOKIE_PATH`، مطبَّق في الإصدار والحذف عبر `withoutCookie`). فحص Origin صريح مضاف على `refresh()` مقابل نفس قائمة `config('archive.security.cors_origins')` المستخدمة للـCORS أصلاً (403 عند عدم التطابق، يسمح بغياب الترويسة لأن SameSite=Strict يغطي الحالة العابرة للمواقع). throttle:30,1 كان موجودًا أصلاً من 732b7c1 (V1-104). العقد `archive-contract.openapi.json` حدَّث استجابات `/auth/refresh` بإضافة 403/429. 4 اختبارات جديدة في `AuthApiTest` (نطاق المسار، رفض Origin غريب، قبول origin الواجهة الافتراضي، throttle)، الحزمة الكاملة 479 تمر. لم يُستخدم CSRF token مزدوج الإرسال — Origin check + SameSite=Strict كافيان لمسار API عديم الحالة.) **(P0 #5)**
- [x] **V1-104** share secrets في body/header لا query + rate limiting فعلي. (منجز 2026-07-12: throttle في 732b7c1، X-Share-Password في 9af5b6c)
- [x] **V1-111** containment/ownership لـmedia jobs ومنع path traversal/arbitrary reads. (منجز 2026-07-12 في 18f7336؛ MediaPathGuard + created_by، 16 اختبار احتواء جديدًا، الحزمة 461 تمر.) **(P0 #2)**
- [x] **V1-112** upload validation: MIME+magic، UUID، quotas، quarantine/AV. (منجز 2026-07-13: نقطة الرفع الوحيدة `/api/v1/uploads` (`UploadsController`) الآن تمر عبر `UploadFileValidator` (finfo magic-byte sniffing) بعد فحص الامتداد/الحجم الموجود أصلاً في `StoreUploadRequest` — يرفض محتوى لا يطابق الامتداد المُعلَن (مثل سكربت PHP بامتداد .jpg) بغض النظر عن Content-Type. أسماء التخزين أصبحت UUID دومًا (لا اسم الملف من العميل)، ما يمنع traversal/overwrite. طبقة حجر صحي (quarantine): الرفع يهبط أولاً في مجلد غير مُقدَّم `{ingest}/quarantine`، ولا يُنقل لمسار الخدمة إلا بعد اجتياز الفحص؛ الفشل يحذف الملف فورًا بدل ترك ملف غير صالح على القرص. 13 اختبارًا جديدًا (7 وحدة + 6 features)، الحزمة الكاملة 489 تمر/0 فشل. خارج النطاق موثقًا: (1) نظام حصص تخزين لكل مستخدم/منظمة — لا يوجد مفهوم حصص في نموذج User الحالي؛ الحد الوحيد المطبَّق هو حد حجم الملف الفردي (600MB، `max:614400` في `StoreUploadRequest`) الموجود أصلاً. (2) فحص AV/ClamAV حقيقي — يتطلب بنية تحتية وتبعية خارجية جديدتين؛ طبقة الحجر الصحي أعلاه هي الضابط التعويضي الوحيد لهذه الجولة.)
- [x] **V1-113** timeouts/backoff/idempotency/cancel للوظائف + تنقية الأخطاء والمسارات. (منجز 2026-07-13: الوظيفة الوحيدة في النظام `ProcessMediaWorkflow` أصبحت تحمل `$timeout` (900s افتراضياً)، `$tries` (3)، و`backoff()` (30/120/300s) قابلة للضبط عبر `config/media.php` (`job_timeout_seconds`/`job_tries`/`job_backoff_seconds`) بدل قيم Laravel الافتراضية الضمنية. **idempotency حقيقي**: الوظيفة تنفذ `ShouldBeUnique` (`uniqueId()`=معرّف media_job، `uniqueFor`=3600s) فتُسقِط أي dispatch مكرر لنفس المعرّف بدل تشغيله مرتين، بالإضافة إلى middleware `WithoutOverlapping` يمنع تشغيل نفس الوظيفة من عاملين متزامنين لو أعاد queue الداتابيز إتاحتها بعد `retry_after` بينما لا تزال قيد التنفيذ. **cancel حقيقي وليس علم DB فقط**: `handle()` يتحقق من حالة الوظيفة قبل بدء المعالجة ويتوقف فوراً لو كانت `canceled`؛ `RealMediaProcessor` أضاف `guardNotCanceled()` يُعيد قراءتها من القاعدة في بداية `process()` (يغطي العمليات أحادية الخطوة: thumbnail/transcode/ocr/montage_export) وأيضاً عند بداية كل مقطع (segment) في حلقة transcription متعددة المقاطع — أول عملية طويلة فعلياً قابلة للإيقاف منتصف الطريق، عبر استثناء جديد `App\Exceptions\JobCanceledException` لا يُعامَل كفشل (لا retry، لا status=failed). **تنقية الأخطاء**: رسائل الاستثناءات (التي قد تحمل مسارات ffmpeg/whisper المطلقة الحقيقية على القرص من stderr) تُنقّى عبر `sanitizeError()` (استبدال أي مسار Unix/Windows بـ`[path]`) قبل تُخزَّن في `media_jobs.error` المُعاد عبر الـAPI؛ التفاصيل الخام تُسجَّل عبر `Log::error` على الخادم فقط. أضيف `failed()` (يُستدعى مرة واحدة بعد استنفاد كل المحاولات) بدل كتابة status=failed عند كل محاولة، فمحاولة تفشل ثم تنجح بإعادة المحاولة لا تُظهر حالة فاشلة عابرة. 12 اختباراً جديداً في `MediaJobsReliabilityTest`، الحزمة الكاملة 500 تمر/0 فشل (كانت 489 عند V1-112). خارج النطاق موثقاً: (1) قتل عملية ffmpeg/whisper الفرعية الجارية فعلياً عند الإلغاء — العمليات أحادية الخطوة (thumbnail/transcode/ocr/montage) ليس لها نقطة تفتيش طبيعية منتصف تشغيل أمر ffmpeg واحد؛ الإلغاء الحقيقي المُطبَّق يوقف الوظيفة *قبل* بدء الأمر أو *بين* مقاطع transcription، وليس أثناء استدعاء subprocess واحد قيد التشغيل. (2) قفل idempotency عبر عمليات/عُقد متعددة بذاكرة تخزين موزعة حقيقية — `ShouldBeUnique`/`WithoutOverlapping` يعتمدان على `CACHE_STORE` (افتراضياً database، يدعم أقفالاً ذرية)، وهذا كافٍ لعامل واحد أو عدة عمال يشتركون في نفس الـcache store، لا حاجة لتصميم قفل موزّع مخصص. (3) مفتاح idempotency على مستوى طلب HTTP (`POST /media/jobs` مكرر من العميل يُنشئ صف media_job جديداً بمعرف UUID جديد في كل مرة) — يتطلب عقد idempotency-key من العميل وتغييراً في الـAPI؛ خارج نطاق هذه المهمة.)
- [x] **V1-121** backup كامل: كل جداول التطبيق (schema-driven) + ملفات file_root + manifest/checksums لكل ملف. (منجز 2026-07-12 في d8537e2؛ 21 اختبارًا. خارج النطاق موثقًا: pg_dump-level وملفات السحابة.) **(P0 #7)**
- [x] **V1-122** استعادة غير مدمرة (معاملة DB ترجع الحيّة سليمة عند أي فشل) + تحقق checksum قبل الاستعادة (رفض النسخ التالفة 422، توافق خلفي للنسخ بلا sidecar بعلَم `verified:false`). (منجز 2026-07-12؛ 4 اختبارات جديدة، 15 تمر.) **(P0 #3)**
- [x] **V1-123** retention/pruning للجلسات/audit/jobs/backups + RPO/RTO. (منجز 2026-07-13: أربع أوامر artisan جديدة، كل واحد بنافذة احتفاظ قابلة للضبط عبر env مع افتراضي آمن. **`sessions:prune`**: يحذف صفوف `api_sessions` (آلية الجلسات الفعلية المستخدمة فعلاً — `AuthController`/`AuthenticateArchiveApiRequest` عبر bearer token + كوكي `va_refresh`، وليس جدول `sessions` الافتراضي لـLaravel الذي لا يُكتب فيه شيء أصلاً لغياب أي استخدام لـ'web' session middleware) بمجرد انتهاء `refresh_expires_at` (لم تعد قابلة للتجديد أصلاً). **`audit:prune`**: يحذف صفوف `audit_logs` الأقدم من `AUDIT_LOG_RETENTION_DAYS` (افتراضي 365 يوماً، `config('archive.audit_log_retention_days')`) — سجل الامتثال يبقى طويل الأمد بشكل افتراضي وليس قصيراً كسجلات تشغيلية. **`media:prune-jobs`**: يحذف صفوف `media_jobs` الطرفية فقط (`completed`/`failed`/`canceled`) التي مضى على `completed_at` أكثر من `MEDIA_JOB_RETENTION_DAYS` (افتراضي 90 يوماً، `config('media.job_retention_days')`)؛ الفلترة بالحالة وحدها كافية لضمان عدم لمس أي وظيفة `queued`/`processing` بغض النظر عن قِدَمها. **`backup:cleanup`** كان موجوداً أصلاً من V1-121 (حد أقصى للعدد + العمر) لكنه لم يكن مجدولاً — أُضيف الآن على الجدولة اليومية مع البقية عبر `Schedule::command(...)->daily()` في `routes/console.php` (Laravel 13 يكتشفها تلقائياً بلا حاجة لـKernel)؛ منطقه الحالي يحمي دوماً آخر `max_count` نسخة بغض النظر عن عمرها (لا يُفرغ الأرشيف بالكامل حتى لو كانت كل النسخ قديمة). **قياس RPO/RTO حقيقي وليس ادعاءً**: `DrReadinessService::rpoRtoReport()` (مكشوف عبر أمر `dr:report` جديد ومدمج في `probe()` الحالية التي تغذي `/api/v1/system/status`) يُرجع **RPO** = عمر آخر نسخة احتياطية ناجحة بالساعات (محسوب مباشرة من `filemtime` النسخة، لا تقدير) — غياب أي نسخة يُرجع `null` (تعرّض غير محدود) لا صفراً. **RTO** = مدة آخر تشغيل فعلي لـ`backup:dr-drill` (V1-122)؛ `runDrDrill()` أصبح يقيس `microtime(true)` قبل/بعد الاستعادة الفعلية ويخزّن `durationSeconds` ضمن `dr-drill-status.json` الموجود أصلاً، فتُعرَض قيمة مُقاسة حقاً لا تخمين؛ قبل أول تشغيل للـdrill تُعرض `rtoSeconds: null` و`rtoSource: "not yet measured — run backup:dr-drill"` صراحة بدل رقم ملفّق. 9 اختبارات جديدة في `RetentionPruningTest` (تغطي: حذف الجلسة المنتهية فقط، حذف سجل التدقيق القديم فقط، حذف الوظائف الطرفية القديمة فقط مع بقاء `queued`/`processing` مهما قدُم تاريخها، عدم حذف النسخة الاحتياطية الوحيدة حتى لو كانت قديمة جداً، الاحتفاظ بأحدث نسخة عند تجاوز `max_count`، وتقرير RPO/RTO قبل/بعد تسجيل drill)، الحزمة الكاملة 506 تمر/0 فشل (كانت 500 عند V1-113). خارج النطاق موثقاً: (1) قياس RTO من استعادة حقيقية على بيئة إنتاج فعلية بحجم بيانات واقعي — الرقم المُقاس يأتي من `backup:dr-drill` الذي يستعيد إلى حالة مؤقتة على نفس القاعدة (نفس آلية V1-122)، وهو مؤشر اتجاه صحيح لكنه ليس محاكاة كاملة لاستعادة كارثة فعلية (استرجاع سيرفر جديد بالكامل، إلخ). (2) أرشفة صفوف `audit_logs`/`media_jobs` المحذوفة إلى تخزين بارد قبل الحذف النهائي — الحذف هنا نهائي مباشرة، لا يوجد مسار أرشفة وسيط.)

#### متابعات أمن وبيانات أُعيد فتحها بعد مراجعة الجاهزية

- [x] **V1-102F إغلاق بقية مصفوفة RBAC** — منجز 2026-07-14: أُضيف `Controller::requireEditor()` كأول سطر في كل دالة كتابة (POST/PATCH/DELETE) عبر ثمانية متحكمات: `TagNodesController` (store/update/destroy/reorder/merge/move)، `VocabularyController` (store/destroy)، `CollectionsController` (store/destroy)، `RelationsController` (store/update/destroy)، `TypesController` (store/destroy)، `AutomationRulesController` (store/update/destroy/run)، `IngestController` (scan/ftpPull/smbPull)، `UploadLinksController` (store/revoke). نقاط القراءة (index/show/graph) بقيت مفتوحة لأي دور مصادَق عمدًا، وكذلك `POST /types/{id}/check-field-acl` لأنها فحص صلاحية للحقل (read) لا كتابة — يحتاجها viewer وeditor لمعرفة ما يمكنهم تعديله، وTypesControllerTest القائم يمارسها بدور viewer دون توقع 403. ثلاث دوال (`RelationsController::destroy`, `TypesController::destroy`, `UploadLinksController::revoke`) لم تكن تستقبل `Request` أصلاً فأُضيف كمعامل أول (Laravel يحقنه بغض النظر عن الترتيب، معامل المسار `{id}` يبقى مربوطًا بالاسم). `RoleMatrixApiTest` أضاف 24 اختبارًا جديدًا (viewer مرفوض لكل route كتابة + دورة حياة editor كاملة لكل مجموعة)، بإجمالي 99 اختبارًا ناجحًا/472 تأكيدًا في هذا النطاق. إصلاح جانبي: `tests/Feature/Api/V1/TagNodesControllerTest.php` كان ينشئ مستخدم اختبار بدور viewer الافتراضي (`User::factory()->create()` بلا role) عبر `actingAs()` — أُصلح إلى `['role' => 'editor']` وإلا كانت ستفشل بـ403 بعد هذا التغيير. خارج النطاق موثقًا: V1-102H (ربط هذه التغطية ببوابة CI تلقائية عبر RouteScopeTest) وV1-102G (ODBC) منفصلان أدناه.
- [x] **V1-102G قصر ODBC على admin** — منجز 2026-07-14: أُضيف `requireAdmin()` كأول سطر في كل الدوال الخمس بـ`SystemController` (`odbc`/`odbcReadTable`/`odbcCreateRow`/`odbcUpdateRow`/`odbcDeleteRow`)؛ `odbc()` لم تكن تستقبل `Request` أصلاً فأُضيف. `OdbcReadApiTest` استبدل `authHeaders()` المشترك (دور editor افتراضيًا حسب `AuthenticatesArchiveRequests`) بـ`adminHeaders()`/`editorHeaders()`/`viewerHeaders()` محليين، وأضاف 6 اختبارات رفض (viewer/editor على probe/read/write) — كل اختبارات القراءة/الكتابة الأصلية تعمل الآن بدور admin. `RouteScopeTest::test_odbc_route_is_reachable_when_its_feature_flag_is_on` كان يستخدم نفس authHeaders() المشترك (editor) وسيفشل بـ403 بعد هذا التغيير؛ أُصلح بإضافة adminHeaders() محلي. التحقق: 23 اختبارًا/86 تأكيدًا، صفر فشل.
- [x] **V1-102H بوابة route/role مشتركة** — منجز 2026-07-14: أُضيف `RouteScopeTest::ROLE_FIXTURE` (127 مسارًا مصادَقًا عليه ← admin/editor/any) بنفس آلية `Route::getRoutes()` المستخدمة أصلاً لـ`FIXTURE` (النطاق)، مع `PUBLIC_ROUTES` (9 مسارات لا تمر بـ`archive.auth`) مستبعدة صراحة بدل الاعتماد على استبطان middleware. اختباران جديدان: `test_every_authenticated_route_has_expected_role_coverage` يفشل عند أي route مصادَق غير مصنّف، و`test_role_fixture_has_no_stale_entries` يمنع بقاء إدخالات لمسارات محذوفة. القيمة `any` (وليست الغياب) هي التوثيق الصريح لـ"مفتوح لأي دور مصادَق بقرار"، وهي القيمة الغالبة (86 من 127) لأن معظم نقاط القراءة والعمل على سجلات المستخدم نفسه مقصودة كذلك. تأكيد تجريبي أن ROLE و FIXTURE محوران مستقلان: `system/odbc` (نطاق EXPERIMENTAL) صار role=admin بعد V1-102G بينما `records/{id}/broadcast-metadata` (نطاق EXPERIMENTAL أيضًا) بقي role=any. خارج النطاق موثقًا: لا يتحقق الاختبار من أن كل route يطابق سلوكه الفعلي (403/200) القيمة المُعلنة في ROLE_FIXTURE عبر استدعاء HTTP حقيقي لكل الـ127 — ذلك التحقق السلوكي يقع على `RoleMatrixApiTest`/`OdbcReadApiTest` لمجموعات الفرعية المحمية فعليًا؛ هذا الاختبار يضمن فقط أن كل route له توقع موثّق فيمنع الإضافة الصامتة. التحقق: 8 اختبارات/19 تأكيدًا، صفر فشل.
- [x] **V1-112F حماية سعة الرفع** — منجز 2026-07-14: أُضيف `UploadsController::assertCapacityAvailable()` يُستدعى قبل أي كتابة إلى quarantine (يستخدم `$file->getSize()` من الملف المرفوع مباشرة، فلا يُكتب شيء على القرص أصلاً عند الرفض). فحصان مستقلان: (1) **مساحة قرص كحد أدنى آمن**: `ingest.min_free_bytes` (افتراضي 100MB، `INGEST_MIN_FREE_BYTES`) — رفض 507 `insufficient_disk_space` إن كانت المساحة الحرة بعد الرفع أقل من الهامش. (2) **حصة تخزين مؤسسية اختيارية**: `ingest.storage_quota_bytes` (افتراضي null = بلا حد، `INGEST_STORAGE_QUOTA_BYTES`) — رفض 413 `storage_quota_exceeded` إن تجاوز الاستخدام (`total - free` على قرص الـingest) + حجم الرفع الحصة المُعلنة. **ponytail موثق**: الحصة تُقاس كاستخدام قرص volume الـingest بالكامل (`disk_total_space`/`disk_free_space`)، لا بعدّاد لكل سجل — لأن هذا النشر أحادي المؤسسة لكل تثبيت (مسار بيانات مخصص واحد لكل مضيف حسب عقد المنصة)؛ تثبيت متعدد المؤسسات (multi-tenant) يحتاج عدّاد استخدام حقيقي بدلاً من هذا. الفحصان يُطبَّقان فقط عندما يكون disk driver الـingest هو `local` (يُتخطَّيان بأمان لأي disk بعيد كـS3/Azure/GCS، حيث لا معنى لـ`disk_free_space`). اختبارات جديدة في `UploadsApiTest`: فرض حالتي الرفض عبر قيم config متطرفة حقيقية (لا mocking لدالة PHP العامة `disk_free_space`) — `min_free_bytes = PHP_INT_MAX` يضمن رفض 507 على أي قرص حقيقي، و`storage_quota_bytes = 1` يضمن رفض 413 (لأن استخدام أي قرص حقيقي يتجاوز بايتًا واحدًا)؛ كلا الاختبارين يؤكدان عدم بقاء ملف في quarantine وعدم إدراج سجل في `storage_rows`. اختبار إيجابي يؤكد أن الإعدادات الافتراضية (بلا حصة، هامش 100MB) لا تكسر الرفع الطبيعي. التحقق المركّز: 13 اختبارًا/68 تأكيدًا. التحقق الشامل بعد كل تغييرات هذه الجلسة (V1-102F/G/H + V1-112F): `pnpm verify:laravel` بالكامل 578 اختبارًا ناجحًا/2678 تأكيدًا، تحذير قديم واحد واختبارا DB integration متخطيان (معروفان مسبقًا)، صفر فشل.

### الموجة 2 — التشغيل والتغليف
- [x] **V1-201 Control Center** — إصلاح رمز legacy المفقود + إزالة الأوامر القديمة + اختبارات. (منجز 2026-07-12؛ 18 اختباراً.) **(كان P0 #6)**
- [x] **V1-202 production runtime** — منجز 2026-07-13: استُبدل PHP dev server بواجهة nginx على `laravel:8000` وPHP-FPM داخلي غير منشور على `laravel-fpm:9000`، مع health عميق للقاعدة وRedis والتخزين، وفحوص liveness/readiness للعامل وReverb. بقي حل localhost الحالي (Caddy `DOMAIN=localhost` وACME fallback) محفوظاً. تحقق: Compose config للملفين، image build، smoke nginx→FPM (health 200 وكل checks=true و9000 بلا host binding)، و`pnpm verify` (122 Next + 526 Laravel، 0 فشل). **(P0 runtime)**
- [x] **V1-203 migration safety** — منجز 2026-07-13 في 7ae55f4: أمر `archive:migrate-safe` (preflight → prebackup عبر BackupService → maintenance عند الحاجة فقط → `--isolated` migrate-once → up عند النجاح/بقاء down + تعليمات rollback عند الفشل)، مربوط في compose الملفين وControl Center. 4 اختبارات جديدة، الحزمة 510 تمر. **(P0 #8)**
- [x] **V1-204 immutable images** — منجز 2026-07-13: صور Node/PHP/Composer الأساسية مثبتة بـ`tag@sha256`، نشر الإصدار لا ينشئ `latest`، و`release-images.txt` يسجل `version@digest`. أضيف فحص static وبناء/smoke للصورتين وTrivy بسياسة فشل للثغرات `CRITICAL` القابلة للإصلاح. **(P0 #9)**
- [x] **V1-205 supply chain (SBOM/checksums/signing)** — منجز 2026-07-13: يحتفظ الإصدار بـSBOM/provenance attestations المرفقة بالصور، ويصدّر SPDX JSON قابلًا للتنزيل لكل digest قانوني، ويولّد inventories تراخيص إنتاجية لـpnpm وComposer ويفرض allowlist صريحة (رفض forbidden/unknown بلا استثناءات حالية)، ويوقّع digest الصورتين بـCosign keyless/OIDC ثم يتحقق من هوية workflow وissuer قبل إنشاء الإصدار. كل artifact قابل للتنزيل مغطى بـ`SHA256SUMS` مفحوص، والصلاحيات مقيدة لكل job. لا يوجد ادعاء توقيع محلي؛ التوقيع يحدث فقط عند tag داخل GitHub Actions.
- [x] **V1-206 offline bundle** — منجز 2026-07-13: حزمة Docker air-gapped مُرقّمة وقابلة للتحقق تضم صورتي Next/Laravel وكل صور runtime المثبتة لملف core (pgvector/Redis/Caddy)، مع Compose محلي بلا build/pull، مولد أسرار، مثبتَي Windows/Linux Docker، checksums/manifest، وربط GitHub Release بعد تحقق التوقيعات. نجحت بروفة load وتشغيل/صحة/HTTPS بمشروع وvolumes معزولة ثم تنظيفه بالكامل. لا يوجد ادعاء native، وبقي V1-208+ مفتوحًا.
- [x] **V1-207 observability** — منجز 2026-07-13 في e643fb4: نُفّذ الـrehearsal القانوني الحقيقي (صور Next+Laravel خلف Caddy TLS) وأثبت المعرّف نفسه (صريح ومولَّد) في response وسجلات Caddy/Next/Laravel — الدليل في `docs/ops/v1-207-correlation-evidence.md`. التشغيل الحقيقي كشف وأصلح علتين: ملكية storage volume لـfpm (chown عند الإقلاع) وDOMAIN المحلي.
- [x] **V1-209 Docker profiles** — منجز 2026-07-13 في 7020528: `core/media/edge`، والافتراضي كامل عبر Control Center، و`ARCHIVE_COMPOSE_PROFILES` للتخصيص.
- [x] **V1-212A مصفوفة التوافق الوصفية** — منجز 2026-07-13 في bb8a689: `docs/platform-parity.md` مرآة للعقد. لا يُعد هذا تحقق تكافؤ حيًا؛ المتابعة في V1-212B أدناه.

#### P1 — Setup core وV1-208

- [x] **V1-208A توحيد عقد الخيارات** — مكتملة 2026-07-14: فصل runtime profiles (`core/media/edge`) عن capabilities (`ocr/ai/observability`) في العقد وschema المغلقين، وضبط Setup ليبدأ بـ`core` فقط ويختار `media` (معالجة/OCR اختيارية وعبء موارد) و`edge` (وصول عام/TLS) صراحة، مع بوابة drift بين العقد وCompose واختبار سلوكي لمسار Control Center الفعلي قبل Docker. الدليل: `node --test scripts/platform-contract.test.mjs` (4/4) و`node --test scripts/control-center.test.mjs` (19/19)؛ `pnpm verify:infra` حُاول لكن حُجب ببيئة Docker/Node المحلية كما يوثقه تقرير V1-208A.
- [x] **V1-208B تفكيك Control Center إلى وحدات** — مكتملة 2026-07-14 (تصحيح مراجعة لاحق): بقي `scripts/control-center.mjs` نقطة الدخول المتوافقة، وصار يركب وحدات `scripts/control-center/cli.mjs` (تحليل CLI وطبقة العرض الفعلية: الألوان/log/format/banner/menu/prompt)، و`configuration.mjs` (قراءة/كتابة `.env` والنسخ الاحتياطي وإخفاء الأسرار)، و`docker-compose.mjs` (Compose والتحقق من contract/profile)، و`operations.mjs` (الخادم والهجرة والنسخ الاحتياطية والتشخيص/التحديث)، و`runtime-adapter.mjs`. العقد الموحد للـadapter يعلن `install/start/stop/restart/status/health/logs/exec/update/rollback/uninstall`؛ Docker ينفذ دورة الخادم الحالية، ويعيد لـ`update`/`rollback`/`uninstall` غير المنفذة نتيجة structured صريحة بلا تنفيذ وهمي. حُفظ default `core` وخيارا `media/edge` الصريحان وعدم اعتبار capabilities profiles. دليل TDD: RED لغياب adapter ثم GREEN، وRED لتكوين entry point ثم GREEN. وسّعت مراجعة لاحقة الاختبار السلوكي ليغطي كل lifecycle ونجاح/فشل Compose/health، ثم استخرجت display/prompt بعد RED تركيبي. التحقق: Control Center + adapter ‏24/24، contract ‏4/4، و`git diff --check`; بوابة `pnpm verify:infra` محجوبة محلياً بسبب Node/Docker كما يوثق التقرير `v1-208b-report.md`.
- [x] **V1-208C schema وخطة تثبيت declarative** — مكتملة 2026-07-14: أُضيف schema مغلق versioned في `infra/platform/setup-config.v1.schema.json` وطبقة declarative تقرأ عقد V1-208A بدل قوائم profiles/capabilities مستقلة. أوامر `setup plan --config=<file>` و`setup import-config --config=<file>` صِرفة بلا `.env` أو Docker أو مسارات بيانات، و`setup export-config` يصدر الاختيارات القانونية من `.env` دون secrets أو credentials أو URL/مسار تخزين يحمل credentials. تدعم الأوامر الثلاثة `--json` بعقد الحقول الثابت `ok/code/message/details/nextActions` وexit غير صفري للفشل، حتى عند تعذر قراءة `.env`. دليل TDD: RED (3 اختبارات لأوامر غائبة ثم 3 موانع أمن/قراءة جديدة) ثم GREEN؛ `node --test scripts/control-center.test.mjs` ‏29/29 و`node --test scripts/platform-contract.test.mjs` ‏4/4.
- [x] **V1-208D installation manifest قابل للاستئناف** — مكتملة 2026-07-14 (تصحيح مراجعة): manifest V1 مغلق وآمن يسجل خيارات التثبيت وartifacts/services/data paths وحالة العملية دون أسرار، مع كتابة ذرية واستئناف/repair idempotent عبر أوامر `install` و`repair` القانونية. يرفض مفاتيح `key`/`apiKey`/`privateKey` والـcredentials والـwhitespace-only، ويحترم آخر خطوة ناجحة قبل أي كتابة حالة جديدة.
- [x] **V1-208E Docker release adapter** — مكتملة 2026-07-14: عقد إصدار مغلق وصور online immutable، وCompose مستخدم منفصل بلا `build:` لـ install/repair، والتحقق الصارم من offline bundle/checksums قبل Compose. يبقى Compose المصدر الحالي لمسار التطوير الصريح فقط.
- [x] **V1-208F واجهة wizard شاملة** — مكتملة 2026-07-14 في `deaf88f`: صار `wizard --config` مطابقاً لـ`plan` وبلا كتابة أو Docker، وتستخدم إجابات wizard التفاعلية resolver نفسه قبل أي كتابة. عُرضت خيارات Docker/Native والمنصة والمصدر والوصول والتخزين وprofiles/capabilities بالعربية، وبقيت PostgreSQL وRedis أساسيتين. سياسة الوصول: `public` يتطلب `edge` للـTLS و`edge` محصور بـ`public`؛ يرفض resolver المخالفة بكود ثابت قبل `.env`/manifest/Docker. مسار Docker الصحيح يثبت إصداراً موقّعاً فقط؛ Native مخطط ولا ينفذ. الدليل: 37 اختبار Control Center في مراجعة التصحيح، مع controlled prompt parity وحالات رفض الوصول.
- [x] **V1-208G بوابة Setup الأساسية** — مكتملة 2026-07-14: صار `--json` يعيد غلافًا ثابتًا وآمنًا (`ok/code/message/details/nextActions`) لكل أوامر البوابة الأساسية، مع exit code صحيح ودون إدراج transcript أو أسرار في `details`. بقيت `plan/import/export/install/repair/wizard` بعقودها المتخصصة، وتستعمل دورة lifecycle إصدار Docker فقط؛ ويمر `migrate --yes` عبر runtime الإصدار المبني من manifest لا Compose التطويري. يمنع `migrate` و`rotate-secrets` في JSON التنفيذ الصامت: يلزمان `--yes`، ثم ينفذان الأمر الحقيقي؛ وتبقى update/rollback/uninstall غير مدعومة في adapter بلا تنفيذ وهمي. يصبح diagnostics صامتًا في JSON حتى لا يخلط مخرجات `pnpm verify` بالعقد. اختبارات CLI تمرر URL/password/token حقيقية وتثبت تعقيم stdout/stderr وsupport bundle، بما فيه أخطاء أوامر الإعداد المتخصصة؛ كما تثبت أن فشل ACL في Windows يحذف الحزمة ولا يكشف السر. التحقق: 78 اختبار Node مركزًا (Control Center/manifest/release/runtime/observability/platform) ناجح؛ `pnpm verify:infra` محجوب محليًا بإصدار Node/Docker المعروفين.
- [x] **V1-208M فحوص خدمات البيانات والتخزين** — مكتملة 2026-07-14: أُضيفت وحدة probes مستقلة قابلة للتركيب في Setup/adapters. PostgreSQL يقتصر على `SELECT 1` read-only؛ Redis والتخزين يستخدمان namespace عشوائياً داخلياً لإجراء write/read/verify/delete ثم تنظيفه في النجاح والفشل وtimeout، ولا يقبلان مساراً من المستخدم أو يلمسان خارجه. المخرجات JSON ثابتة ومعقمة من credentials، وتغطي اختبارات mock كل backend وحالات النجاح/الفشل/timeout/cleanup. الدليل: `node --test scripts/control-center/data-probes.test.mjs` ‏7/7 وsyntax/diff check؛ `pnpm verify:infra` محجوب بالبيئة المحلية المعروفة.
- [x] **V1-208N أوضاع الوصول والشهادات** — مكتملة 2026-07-14 (تصحيح مراجعة): أضيفت وحدة وصول مستقلة تمرر الطلب أولًا إلى resolver المعياري لـV1-208F، فترفض platform/profile/storage غير القانونية وسياسة `public`/`edge` قبل أي probe أو كتابة. تنفذ port preflight ثم DNS/certificate الصريحين لـpublic فقط. snapshot هو token معتم بذاكرة خاصة لا يكشف محتوى `.env`، وتطبق selectors غير السرية بكتابة ذرية وتستعيدها عند health فاشل. دليل TDD: 8 اختبارات للوصول والسياسة وport/DNS/cert والـrollback وredaction ومدخلات resolver الحساسة؛ `node --test scripts/control-center/access-mode.test.mjs` ‏8/8 و`git diff --check`. بوابة `pnpm verify:infra` محجوبة ببيئة Node/Docker المحلية المعروفة.
- [x] **V1-208O لغة إنجليزية إلزامية لمخرجات Setup** — مكتملة 2026-07-14: قرار مستخدم صريح — نصوص Setup التفاعلية (wizard: `WIZARD_RUNTIME_PROMPTS` في `scripts/control-center/setup-wizard.mjs`، وملخص/أسئلة `guidedSetup()` في `scripts/control-center.mjs`) كانت عربية منذ V1-208F وتظهر mojibake في ترميزات Windows terminal الشائعة؛ تُرجمت بالكامل للإنجليزية دون أي تغيير منطقي. اختبار `control-center.test.mjs` (سطر ~358) كان يفرض العربية صراحة ("every runtime choice prompt must have a concise Arabic explanation") — عُكس ليفرض غياب نطاق الأحرف العربية بدلاً من ذلك. هذا قرار سياسة لغة عامة لكل مخرجات Setup المستقبلية، وليس استثناءً لهذا التغيير وحده. التحقق: `node --test scripts/control-center.test.mjs scripts/control-center/*.test.mjs` ‏95/95.

#### P2 — دورة حياة الإصدار والبيانات عبر Setup

- [x] **V1-208H النسخ والاستعادة القانونية** — مكتملة 2026-07-14: `pg_dump`/`psql` في Setup استُبدلا بأربعة أوامر artisan (`archive:backup-run|list|verify|restore`) تُغلّف `BackupService` القانونية (DB+files+manifest+checksums) بعقد `{ok,code,message,details}` JSON. `restore` يرفض بلا `--force` قبل أي أثر جانبي؛ بوابة checksum الموجودة في `BackupService::restore()` لم تُعدَّل. أُضيف `setup verify-backup`. مراجعة أمنية مستقلة (Opus) أثبتت السلامة وأضافت تصحيحين: `catch (Throwable)` عام بدل تسريب stack trace خام، وتحذير Node صريح عند استعادة نسخة غير مُتحقَّقة (بلا sidecar). التفاصيل الكاملة في `ChangeLog.md`. التحقق: 95/95 Node، 585/585 Laravel (2736 تأكيدًا).
- [x] **V1-208I update ذري من artifacts** — مكتملة 2026-07-14: `setup update` (Docker release فقط) ينفذ preflight للـdescriptor غير القابل للتغيير ثم backup قانونيًا وpull/load متحققًا و`archive:migrate-safe` وswitch وhealth وrole smoke. فشل switch/health/smoke أو أي كتابة manifest بعد switch يوقف حالة target غير الآمنة ويستعيد تلقائيًا الإصدار/config المثبتين السابقين؛ smoke يثبت رفض anonymous وقبول مستخدم authenticated فعليًا عبر `ARCHIVE_UPDATE_SMOKE_TOKEN` المؤقت غير المخزن. manifest يسجل target أثناء التنفيذ وprevious release reference بعد النجاح ولا يحذف images. أخطاء manifest I/O تتحول إلى envelope JSON أحمر `UPDATE_MANIFEST_IO_FAILED` بلا raw rejection أو تسريب URL.
- [x] **V1-208J rollback حقيقي** — منجز 2026-07-15: `scripts/control-center/rollback-release.mjs` يعيد artifact/config السابقين عبر manifest، ويعرض أثر فقد البيانات ويطلب تأكيدًا صريحًا لmigration غير قابلة للعكس قبل استعادة النسخة السابقة. rollback ينجح بعد فشل health، ويُرفض downgrade غير المتوافق (platform/mode mismatch) بكود ثابت. مربوط في `scripts/control-center.mjs` وadapter. التحقق: `node --test scripts/control-center/rollback-release.test.mjs` ‏17/17.
- [x] **V1-208K uninstall وإعادة الربط** — منجز 2026-07-15: `scripts/control-center/uninstall.mjs` يُبقي البيانات افتراضيًا ويزيل فقط الخدمات/القواعد التي يملكها manifest، مع أمر `reconnect-data --storage=<path>` جديد. حذف البيانات يتطلب عبارة تأكيد حرفية وbackup ناجحًا حديثًا. مربوط في CLI (`uninstall`, `reconnect-data`). التحقق: `node --test scripts/control-center/uninstall.test.mjs` ‏16/16.
- [x] **V1-208L اختبارات فشل دورة الحياة** — منجز 2026-07-15: كشف الجرد أن سبعة من السيناريوهات التسعة كانت مغطاة أصلًا بأكواد ثابتة عبر وحداتها (checksum/signature في `release-descriptor.mjs`، المنفذ في `access-mode.mjs`، منتصف التثبيت/التكرار في `installation-manifest.mjs`، DB/Redis في `data-probes.mjs`، restore/update/rollback في `update-release.mjs`/`rollback-release.mjs`)، لكن **سيناريوهي القرص والاعتماد المفقود لم يكن لهما تنفيذ أصلًا** — لا كود `DISK_*` ولا `DEPENDENCY_*` في المستودع كله. أُضيفت وحدة `scripts/control-center/install-preflight.mjs` (probes محقونة، لا تلمس المضيف في الاختبار) بأربعة أكواد ثابتة: `INSUFFICIENT_DISK_SPACE` (نقص مع ذكر الفرق المطلوب)، `DISK_FULL` (كود مستقل لا يُخلط بالنقص)، `DEPENDENCY_MISSING` (يسمّي الناقص)، و`DISK_PROBE_FAILED` (**fail-closed**: probe غير مقروء يوقف التثبيت بدل افتراض وجود مساحة، ورسالة الخطأ الخام تُبتلع عمدًا لأنها تحمل مسارات المضيف). الفحصان يعملان دومًا معًا فيرى المشغّل كل الموانع في تقرير واحد. `lifecycle-failures.test.mjs` هو مصفوفة السيناريوهات: سجل `{scenario, module, code}` يغطي الاثني عشر سيناريو، مع بوابة تفشل عند اختفاء أي كود من التنفيذ (منع الفجوة الصامتة عند إعادة تسمية/حذف)، وبوابة ثانية تحرس مَخرج `driven` فلا يُدّعى إلا لكود يؤكده اختبار حي فعلًا. الأكواد المُركّبة وقت التشغيل (`data-probes` يبني `${BACKEND}_UNAVAILABLE` فلا يظهر النص في المصدر) تُثبَت بالتنفيذ الحي لا بمسح المصدر. السيناريوهات المقودة تؤكد أيضًا **عدم تسريب الاعتمادات**: خطأ سائق postgres/redis يحمل كلمة سر في URL ولا تظهر في النتيجة. أُثبتت البوابة بـmutation حقيقي (إعادة تسمية `DISK_FULL` في المصدر ← فشل، ثم استعادة ← نجاح) فليست مسرحًا. التحقق: الحزمة الكاملة 200/200 (كانت 182)، `node --check` و`git diff --check` نظيفان. خارج النطاق موثقًا: ربط `install-preflight` بمسار `install` الفعلي في `runtime-adapter` (الوحدة قائمة ومختبَرة لكن الاستدعاء الحي يحتاج قرار حجم `requiredBytes` لكل profile من عقد الموارد) — متابعة مستقلة، ولا يُدّعى هنا أن التثبيت الحي يفحص القرص بعد.

#### P3 — V1-210 Windows Native

- [x] **V1-210A حزمة Windows Native** — artifact موقعة من نفس commit تشغّل Next standalone وLaravel FastCGI والعامل وReverb والجدولة كخدمات Windows تحت حساب محدود؛ service wrapper مثبت الإصدار ومدرج في SBOM. *(2026-07-15: `windows-services.mjs` — طوبولوجيا 6 خدمات بحسابات NT SERVICE افتراضية، WinSW 2.12.0 مثبّت في SBOM، رفض `.exe` غير موقّع؛ قرارات موثقة في `docs/superpowers/specs/2026-07-15-v1-210-windows-native-decisions.md`. المنصة تبقى planned حتى V1-210D.)*
- [x] **V1-210B Windows runtime adapter** — تنفيذ دورة Setup كاملة للخدمات وACL/firewall/logs والـhealth، وإزالة الموارد التي سجل manifest ملكيتها فقط. *(2026-07-15: `windows-runtime-adapter.mjs` — نفس عقد `RUNTIME_OPERATIONS` بخطوات manifest قابلة للاستئناف data→acl→firewall→install→start؛ `createWindowsServiceRemover` يزيل المملوك بالـmanifest فقط عبر `createUninstall({supportedModes:["native"]})`. update/rollback تُحقن لاحقاً.)*
- [x] **V1-210C خدمات البيانات على Windows** — PostgreSQL محلي مُدار أو endpoint خارجي؛ database queue/cache baseline، وRedis-compatible endpoint خيار بعد probe. تغطية تبديل الخيار ورفض endpoint غير السليم قبل التثبيت. *(2026-07-15: `windows-data-services.mjs` — خطة محسومة + بوابة ما قبل التثبيت تحجب `DATA_ENDPOINT_UNHEALTHY`/`REDIS_ENDPOINT_UNHEALTHY` قبل إنشاء أي خدمة؛ اختبارات تبديل الخيار.)*
- [ ] **V1-210D قبول Windows نظيف — تحقق خارجي** — Windows 10 و11: online/offline، local/intranet/public TLS، reboot، backup/restore، update/rollback، uninstall/reconnect؛ إرفاق logs/manifest/support bundle منزوعة الأسرار.

#### P4 — V1-211 Linux Native

- [x] **V1-211A حزمة Linux Native** — artifact موقعة من نفس commit لـNext standalone وPHP-FPM/HTTP والعامل وReverb والجدولة، مع مستخدم خدمة غير تفاعلي. *(2026-07-15: `linux-services.mjs` — 6 وحدات systemd تحت مستخدم `archive` غير تفاعلي، مانيفست حزمة يرفض غياب التوقيع المنفصل؛ قرارات موثقة في `docs/superpowers/specs/2026-07-15-v1-211-linux-native-decisions.md`. المنصة planned حتى V1-211D.)*
- [x] **V1-211B Linux runtime adapter** — وحدات systemd منفصلة، ownership وlogrotate وfirewall اختياري، ودورة Setup كاملة دون تعديل موارد نظام لا يملكها manifest. *(2026-07-15: `linux-runtime-adapter.mjs` فوق محرك مشترك جديد `native-runtime-adapter.mjs` — خطوات ownership→logrotate→firewall(اختياري)→units قابلة للاستئناف؛ مزيل يزيل المملوك بالـmanifest فقط. غلاف Windows أعيد فوق نفس المحرك بلا تغيير واجهة.)*
- [x] **V1-211C خدمات البيانات على Linux** — PostgreSQL محلي/خارجي، database queue/cache baseline، وRedis محلي/خارجي اختياري بعد probe؛ اختبارات service restart وفشل الاتصال والتعافي. *(2026-07-15: بوابة مشتركة `native-data-services.mjs`؛ اختبارات فشل اتصال→حجب، تعافي→repair يكمل، وrestart لكل الوحدات في `linux-runtime-adapter.test.mjs`.)*
- [ ] **V1-211D قبول Linux نظيف — تحقق خارجي** — توزيعة Linux المدعومة في عقد المنصات: online/offline، local/intranet/public TLS، reboot، backup/restore، update/rollback، uninstall/reconnect مع أدلة منزوعة الأسرار.

#### P5 — V1-212B تكافؤ حي بين المنصات

- [x] **V1-212B harness قبول موحد** — تشغيل نفس scenario IDs على Windows Docker/Native وLinux Docker/Native: install/reconfigure/operate/data/release/uninstall/security، وحفظ النتائج كartifacts. *(2026-07-15: `acceptance-harness.mjs` — نفس 7 سيناريوهات على المنصات الأربع من `compatibility.v1.json`، منفذ السيناريو محقون (live runners لاحقاً)، ونتيجة لا تُحفظ كأثر تُبطل التشغيلة كلها.)*
- [x] **V1-212C بوابة ادعاء الدعم** — منع انتقال أي platform من `planned/conditional` إلى supported ما لم تمر مصفوفته الحية كاملة من artifact إصدار نهائي على clean host. *(2026-07-15: `support-claim-gate.mjs` — يرفض prerelease/غير موقع، مصفوفة ناقصة أو فاشلة، host غير نظيف أو دليل من إصدار آخر؛ يحكم على الأدلة ولا يعدّل العقد.)*

### الموجة 3 — المنتج وUX
- [x] **V1-302 admin safety** — منجز 2026-07-13 في ac7dfcc: منع حذف/تخفيض آخر admin + `LAST_ADMIN_PROTECTED`، والحزمة 532 تمر.
- [x] **V1-304A data correctness الأساسية** — منجز 2026-07-13 في eb40845: pagination envelope على خمس نقاط وإصلاح `summary.total` في sync.
- [x] **V1-305 offline truth** — منجز 2026-07-14: إزالة ادعاء PWA وتوثيق حدود queue المحلية الفعلية.

#### P6A — V1-301 onboarding محفوظ خادميًا

- [x] **V1-301A عقد تقدم onboarding** — منجز 2026-07-15: تقدم موحد على مستوى المؤسسة في `storage_rows` بمراحل ثابتة (`organization` و`storage` و`invitation` و`first_record` و`first_search`)؛ لكل مرحلة `pending|completed` و`completedAt`. `GET /onboarding/progress` متاح لكل مصادَق و`PATCH /onboarding/progress/{stage}` للـadmin فقط، مع OpenAPI وعميل TypeScript مطابقين. تحقق: `OnboardingProgressApiTest` 3/3 (23 assertion)، `RouteScopeTest` 8/8، API contracts، typecheck، وbuild.
- [x] **V1-301B واجهة first-run مستأنفة** — منجز 2026-07-15: `/first-run` يقرأ مراحل المؤسسة من API بعد المصادقة ويعرض loading/error/retry وحالة دخول قابلة للتنفيذ للضيف؛ لا يبقى `localStorage` مصدرًا لتقدم المراحل. الـadmin فقط يحدّث مرحلة وينتظر تأكيد الخادم، بينما editor/viewer يقرآن الحالة دون أدوات تغيير. تحقق: Vitest 8/8، typecheck، وbuild.
- [x] **V1-301C رحلة admin حية** — منجز 2026-07-15: رحلة Playwright لمدير عبر تسجيل الدخول الحقيقي تنفذ المؤسسة→التخزين→الدعوة→أول مادة→أول بحث. تحاكي فشل حفظ المرحلة الأولى ثم retry، ولا تُظهرها مكتملة قبل رد الخادم، ثم تعيد الدخول بعد reload لإثبات أن المراحل الخمس محفوظة خادميًا. تحقق: Vitest 7/7، typecheck، build، و`ARCHIVE_E2E_SPECS=e2e/onboarding-progress.authed.spec.ts pnpm verify:laravel-next:live` على Node 22 (2/2).

#### P6B — V1-303 responsive والوصولية

- [x] **V1-303A بوابة public axe الأساسية** — ثمانية مسارات عند 375/768/1280 في `archive-next/e2e/accessibility.spec.ts` بلا serious/critical.
- [ ] **V1-303B fixtures مصادقة حسب الدور** — admin/editor/viewer وبيانات records/rights/backups/jobs معزولة داخل live Playwright؛ لا تستخدم token مدير موحدًا.
- [ ] **V1-303C تغطية جميع المسارات المصنفة** — axe على المسارات المصادَق عليها والحالات loading/empty/error/ready عند 375/768/1280 وzoom 200%، وربط inventory بـRouteScope لمنع route بلا اختبار.
- [ ] **V1-303D لوحة المفاتيح وقارئ الشاشة** — tab order، focus traps، Escape، skip link، announcements وعينة فعلية لقارئ شاشة على onboarding/archive/record/upload/search/admin.
- [ ] **V1-303E مراجعة بصرية حية** — screenshots ثابتة للمسارات الأساسية عند نقاط العرض الثلاث، صفر overflow أفقي أو إجراء أساسي خارج الوصول، وتوثيق الاستثناءات المقبولة فقط.

#### P6C — V1-304 متابعات صحة البيانات

- [x] **V1-304B automation pagination** — منجز 2026-07-15: `AutomationRulesController::index` يستبدل `limit(25)` الصامت بـ`paginate()` حقيقي (`total/page/limit/hasMore`)، والعميل `archive-api.ts::automationRules` يقبل `{limit, page}` ويُعيد `pagination` اختياريًا. اختبار جديد `AutomationRulesApiTest`.
- [x] **V1-304C catalog cursor edge** — منجز 2026-07-15: `PublicCatalogController` يرتّب ويُرمّز cursor على زوج `(uid, store)` بدل `uid` وحده (المفتاح الأساسي فعليًا مركّب)، فيمنع فقد/تكرار سجلات عند تساوي `uid` بين مخازن مختلفة عبر حدود الصفحات؛ cursor القديم (uid فقط) يبقى مقبولاً للتوافق الخلفي. اختبار جديد `PublicCatalogApiTest`.
- [x] **V1-304D montage contract** — منجز 2026-07-15: أُضيف مسارا `/montage-projects` (GET/POST) و`/montage-projects/{id}` (GET/PUT/DELETE) إلى `docs/api/archive-contract.openapi.json` بخمسة مخططات (`MontageProject`، `MontageProjectsResponse`، `MontageProjectResponse`، `CreateMontageProjectRequest`، `UpdateMontageProjectRequest`). العقد يصف **الواقع** لا الطموح، مُتحقَّقًا مقابل ثلاثة مصادر: (1) `routes/api.php:185-189` — الفعل هو `PUT` وليس PATCH للتحديث، فالعقد يعلن PUT؛ (2) `MontageProjectsController::payload()` — الحقول الفعلية بما فيها `createdAt`/`updatedAt` بصيغة ISO؛ الاستجابة تعيد استخدام `PaginationMeta` المشترك لأن `index()` يُرجع `{total, page, limit, hasMore}` بالضبط؛ (3) العميل الحقيقي `archive-next/lib/montage.ts` (وليس `archive-api.ts` — montage يستخدم `fetch` مباشرًا) الذي يقرأ `data.projects`/`data.project` ويختار POST للمشروع الجديد وPUT للقائم — مطابق للعقد. الـ403 المُعلن على الكتابة حقيقي (`requireEditor` في store/update/destroy من V1-102F). `tracks`/`clips`/`markers`/`comments`/`transitions` موصوفة كمصفوفات كائنات مفتوحة الشكل لأن الخادم يخزّنها كما هي بلا تحقق بنيوي — توثيق للسلوك الفعلي لا فرض شكل غير مطبَّق. التحقق: `pnpm verify:api-contracts` نظيف، و`MontageProjectsApiTest` 13/13 (67 تأكيدًا).

#### P6D — V1-306 اللغة والمساعدة

- [x] **V1-306A إزالة dialogs الأصلية** — منجز 2026-07-15: `components/ui/ConfirmDialog.tsx` يقدّم `ConfirmDialogProvider` + `useConfirmDialog()` بثلاث دوال (`confirm`/`prompt`/`alert`) تُرجع Promise بنفس دلالة نظائرها الأصلية (`false`/`null` عند الإلغاء أو الإغلاق)، مبنية على `Dialog`/`DialogContent` (Radix) القائمة فيرث الحوار focus trap وEscape والـARIA منها. التركيز الابتدائي مضبوط صراحة عبر `onOpenAutoFocus`: حقل الإدخال في prompt، وزر الإجراء **الآمن** (إلغاء) في confirm — فالإجراءات الإتلافية (`destructive: true`) تُلوّن زر التأكيد بالخطر ولا تأخذ التركيز. المزوّد مركّب في `components/AppProviders.tsx` داخل `app/layout.tsx` الجذري فيغطي كل الصفحات. حُوِّل 17 موقع نداء عبر 11 ملفًا (archive، archive/[id]، automation، collections، errors، projects، search، shares، shares/with-me، transcriber، types، ShortcutsSettings)، وكل رسالة تصف أثر الإجراء لا مجرد "هل أنت متأكد؟". النصوص عربية متسقة مع الصفحات المحيطة والدلالة السلوكية محفوظة حرفيًا. التحقق: grep يثبت صفر `window.confirm/prompt/alert` في كود التطبيق، 11 اختبارًا جديدًا لـ`ConfirmDialog` (تغطي القيم المُعادة، الإلغاء، الإغلاق، رمي الاستثناء خارج المزوّد)، الحزمة الكاملة 133/133، `pnpm typecheck` نظيف، و`pnpm build:next` ناجح. يغلق هذا البند أيضًا **B40**.
- [ ] **V1-306B اتساق العربية وRTL** — تدقيق النصوص والمصطلحات والتواريخ والأرقام واتجاه الأيقونات عبر المسارات المصنفة، واختبار يمنع mojibake والنصوص التشغيلية الإنجليزية غير المعتمدة.
- [ ] **V1-306C أدلة حسب الدور** — مساعدة سياقية لـadmin/editor/viewer مرتبطة بالصفحة والإجراء، ولا تعرض للمستخدم إجراء لا تسمح به صلاحياته.

#### P6E — V1-307 الأداء

- [ ] **V1-307A مولد بيانات benchmark** — 100 ألف سجل عربي و10 آلاف ملف وعينة رفع 1GB ببذرة ثابتة، دون إدراج بيانات حقيقية أو حساسة.
- [ ] **V1-307B قياسات الواجهة** — LCP p75 ≤2.5s وCLS ≤0.1 وINP ≤200ms على جهاز baseline بعقد الموارد، للمسارات اليومية وعند نقاط العرض المطلوبة.
- [ ] **V1-307C قياسات API والرفع** — P95 البحث ≤1.5s، فتح السجل ≤1s، وبدء جلسة الرفع ≤2s دون زمن النقل، على Docker وNative بالأداة والبيانات نفسيهما.
- [ ] **V1-307D بوابة regression** — حفظ baseline ونتائج قابلة للمقارنة، وفشل CI/release rehearsal عند تجاوز budget دون استثناء إصدار موثق.

### الموجة 4 — CI والتوثيق
- [x] **V1-401 CI gates** (منجز 2026-07-14: وظيفة live-integration بـPlaywright الحي + رفع الآثار (798be19) + بوابة axe-core (`e2e/accessibility.spec.ts`) مدمجة في نفس التشغيل الحي عبر `scripts/verify-next-laravel-live.mjs`؛ راجع V1-303 لنطاق التغطية) / [x] **V1-402 security gates** (منجز 2026-07-13 في 798be19: gitleaks حاجب + baseline/audit + composer audit) / [x] **V1-403 release-readiness محتوى لا strings** (منجز 2026-07-13: فحص تماسك الإصدار/الرخصة/بنية release.yml/العقد/P0 المفتوحة/اكتمال env، 8 اختبارات) / [x] **V1-404 docs canonical-only** (منجز 2026-07-13 في b32a083) / [x] **V1-405 release notes** (منجز 2026-07-13 في b32a083: `docs/release-notes/v1.0.0-rc.1.md`).
- [x] **V1-406 بوابة المهام المانعة للإصدار** — منجز 2026-07-14: `verify-release-readiness.mjs` أضاف فحصين: (1) `tasks-v1-blockers` يفشل عند أي بند `- [ ] **V1-` غير مكتمل (باستثناء V1-X الاختيارية وBacklog) لكن **في وضع الإصدار فقط** (tag `v*` على HEAD — وهو ما يشغّل release.yml — أو `READINESS_RELEASE=1`)؛ في CI العادي يطبع تحذيرًا بعدد الموانع بدل كسر كل push بينما القرار NO-GO معلن. (2) `platform-support-evidence` يرفض أي منصة في `compatibility.v1.json` بحالة `supported` بلا حقل `evidence` — المنصات planned/conditional لا تمنع شيئًا (الميزة المعطلة حرة) لكن ترقية الادعاء تتطلب دليلًا (يخدم V1-212C). التحقق: 13/13 في `verify-release-readiness.test.mjs` (5 اختبارات جديدة)، والتشغيل الحقيقي يظهر تحذير 41 مانعًا مفتوحًا مع exit 0 في CI ورفضها في وضع الإصدار.

### الموجة 5 — RC وتجربة ميدانية / الموجة 6 — GA
- [ ] **V1-501 Alpha داخلي وgame-day** — فشل DB/cache/queue/worker/Reverb/network/disk/certificate على تثبيت Docker وNative؛ توثيق الكشف والتنبيه والتعافي وعدم فساد البيانات.
- [ ] **V1-502 نشر rc.1 ميداني — تحقق خارجي** — 3–5 بيئات تغطي Windows/Linux وDocker/Native وonline/offline، باستخدام Setup وartifacts الموقعة فقط.
- [ ] **V1-503 قياسات التشغيل — تحقق خارجي** — زمن التثبيت، نجاح onboarding لكل دور، budgets الأداء، RPO/RTO من DR drill، استهلاك الموارد ومعدل الأخطاء.
- [ ] **V1-504 triage pilot** — إغلاق كل P0/P1؛ كل P2 إما مغلق أو مؤجل بقرار Product يذكر الأثر والحل المؤقت والموعد.
- [ ] **V1-505 release rehearsal نظيف** — checkout/runner بلا cache يبني artifacts مرة واحدة، يتحقق من التواقيع، ثم يثبت ويختبر النسخة على clean hosts دون build عند العميل.
- [ ] **V1-601 Go/No-Go** — توقيع Product/Security/Operations/Support بعد إرفاق نتائج P5/P6 والـpilot وعدم وجود مانع مفتوح.
- [ ] **V1-602 إصدار `v1.0.0`** — tag من commit مجمد، بناء artifacts مرة واحدة، ومطابقة version/digest/signature/provenance.
- [ ] **V1-603 نشر الإصدار** — الصور وحزم Docker/Windows Native/Linux Native والدليل وملاحظات الإصدار وSBOM/checksums والتواقيع.
- [ ] **V1-604 اختبار التنزيل النهائي — تحقق خارجي** — تثبيت online وoffline من artifacts العامة نفسها، لا من workspace أو registry خاص.
- [ ] **V1-605 فتح التشغيل والدعم** — لوحات الصحة المحلية، سياسة الدعم والتصعيد، runbooks للنسخ/الاستعادة/التحديث/التراجع، وقناة استقبال العيوب.

### تحققات قدرات اختيارية — لا تمنع GA وهي معطلة

- [ ] **V1-X01 التخزين الخارجي — تحقق مشروط** — Dropbox/S3 أو المزود المعلن: اعتماد حي، read/write/delete، ملف كبير، انقطاع واعادة محاولة، وعدم تسرب الاعتماد. يصبح مانعًا فقط عند تضمين المزود في عرض الإصدار.
- [ ] **V1-X02 ODBC على Windows — تحقق مشروط** — DSN/driver حي وبيانات اختبار بعد إغلاق V1-102G؛ read/write المسموح ورفض الجدول/الدور غير المسموح. تبقى feature flag معطلة بدونه.
- [ ] **V1-X03 تفريغ عربي GPU — تحقق مشروط** — عينة عربية معتمدة ومقاييس دقة/زمن وموارد على GPU مستهدف؛ لا يُعلن profile media/التفريغ كمدعوم قبل الدليل.
- [ ] **V1-X04 AI/vision/embeddings — تحقق مشروط** — مزود وفهرس/خط معالجة حي، حدود timeout/rate/cost، عزل البيانات وفشل آمن؛ تبقى القدرة اختيارية ومعطلة افتراضيًا.

## بوابات التنفيذ لكل مهمة مفتوحة

- تبدأ باختبار فاشل يثبت السلوك أو العقد المطلوب، ثم أقل تنفيذ ينجحه، ثم refactor محدود.
- أثناء تنفيذ المهمة: تحقق محليًا بأضيق اختبار أولًا، ثم فحص النوع أو اختبار Laravel/Node المتأثر فقط. لا تُشغّل بوابة عامة لمجرد أن ميزة واحدة تغيرت.
- قبل دمج **دفعة** مستقرة: يشغّل مالك الدفعة `pnpm typecheck` و`pnpm test:next` أو `pnpm verify:laravel` حسب نطاقها، و`pnpm verify:api-contracts` عند لمس العقد، وbuild واحد للدفعة. تشغّل `pnpm verify` بعد اكتمال دفعات المميزات والبنية الأساسية أو قبل RC، لا بعد كل مهمة.
- دفعة Setup/Native تشغّل أيضًا `node --test scripts/control-center.test.mjs scripts/platform-contract.test.mjs` و`pnpm verify:infra` بعد استقرار العقد المشترك.
- دفعة الرحلات والأدوار والوصولية تشغّل `pnpm verify:laravel-next:live` وتحفظ screenshots/traces/reports بعد اكتمال المسارات والواجهات المستهدفة، لا أثناء تغيرها.
- مهام clean-host لا تُغلق بمحاكاة محلية؛ تُرفق platform/version/mode/source/manifest ونتيجة كل scenario ID من الجهاز المستهدف.
- بعد قبول الدفعة: كل مهمة منجزة تحصل على commit مستقل لا يضم تعديلات مستخدم غير مرتبطة، ثم تُحدّث `ChangeLog.md` و`TASKS.md` بحالة تثبتها بوابة الدفعة أو دليلها الخارجي.

## قاعدة إعادة الفتح

لا يُضاف أي بند هنا إلا إذا كان قابلاً للتنفيذ محلياً أو توفرت له البيئة/الاعتمادات الحية المطلوبة. عند إضافة بند جديد:

- ميزات المنتج الجديدة تكون في `archive-next/` و`archive-laravel/` فقط، والتشارك بين الواجهة والـAPI يمر عبر `docs/api/archive-contract.openapi.json`. أعمال التثبيت والتشغيل والبوابات الخاصة بهذه الخطة تكون في `scripts/` و`infra/` و`.github/workflows/` دون إنشاء runtime منتج موازٍ.
- حُذفت حزم `archive-app` و`archive-server` و`archive-core` نهائياً بتاريخ 2026-07-12 (راجع `ChangeLog.md`)؛ لا تُضاف إليها ميزات جديدة — هي متاحة فقط عبر تاريخ git عند الحاجة لمرجع legacy.
- تُنفذ كل شريحة ببوابات تحقق مناسبة، ثم تُوثق في `ChangeLog.md` وتُدمج في commit مستقل.

## الموجة 7 — مميزات الإصدار الأول (P8، مُرقّاة من Backlog بقرار المستخدم 2026-07-14)

> **قرار نطاق:** طلب المستخدم إدراج هذه المميزات في الإصدار الأول، فرُقّيت من Backlog إلى بنود `V1-7xx` رسمية (مع الاحتفاظ بمعرّف B الأصلي للتتبع). بموجب بوابة V1-406 هي الآن **مانعة للإصدار**؛ إعادة أي بند إلى Backlog لاحقًا قرار منتج يُوثَّق هنا. المصدر: مقارنة كود CLOUD-MediaDB + فحص كود archive-next الفعلي (2026-07-14).
>
> **بوابات كل بند:** نفس قسم "بوابات التنفيذ" أدناه (TDD → typecheck/tests → verify). أي بند يلمس API يحدّث `docs/api/archive-contract.openapi.json` في نفس الـcommit؛ شرائح UI تُرفق لقطات 375/768/1280. الترتيب المقترح: P8A→P8G، ويمكن تشغيل مجموعات متوازية بوكلاء على ملفات منفصلة.
>
> بندان أُدمجا في مهام قائمة: B40 ← V1-306A (الحوارات)، B50 ← V1-306B (اتساق RTL).

### P8A — إثراء السجل والبحث

- [x] **V1-701 (B01)** مؤشر اكتمال التوصيف (🟢🟡🔴) لكل سجل — منجز 2026-07-15 في `e7f68b5`: حساب خادمي موثوق للعنوان/الوصف/النوع/الوسوم، عقد API، وشارة عربية غير معتمدة على اللون وحده. تحقق: `RecordsApiTest` (12/84)، API contracts، typecheck والبناء.
- [x] **V1-702 (B02)** حقول شرطية في محرر الأنواع المخصصة (عرض حسب قيمة حقل آخر) — منجز 2026-07-15 في `f55be28`: شرط equality اختياري محقق خادميًا، محرر عربي، وعقد OpenAPI. تحقق: `TypesControllerTest` (9/33)، API contracts، typecheck والبناء، ومراجعة مستقلة.
- [ ] **V1-703 (B03)** خريطة موحدة لكل السجلات الموقّعة جغرافياً (ترقية من GeotagPanel لسجل واحد)
- [x] **V1-704 (B04)** ربط استيراد SRT/VTT بحفظ فعلي في حقل التفريغ — منجز 2026-07-15 في `809892d`: endpoint مخصص ومقيد بصلاحية المحرر يحفظ `transcript` فقط للسجل المرتبط؛ التشغيل المستقل يبقى معاينة محلية. تحقق: 12 اختبارًا/51 تحققًا، API contracts، typecheck والبناء ومراجعة مستقلة.
- [ ] **V1-705 (B11)** القفز من نتيجة البحث مباشرة للحظة الزمنية بالفيديو
- [x] **V1-706 (B32)** لغة بحث متقدمة بصياغة field:value وعوامل منطقية — منجز 2026-07-15 في `30ca230`: DSL اختياري للحقول المدعومة و`AND`/`OR`/`NOT` مع قيم مقتبسة، أولوية موثقة وحد 128 رمزًا؛ البحث الحر القديم محفوظ. تحقق: `SearchApiTest` (8/67)، API contracts، typecheck والبناء ومراجعة مستقلة.
- [ ] **V1-707 (B60)** معاينة سريعة (Hover Preview) لنتيجة البحث
- [x] **V1-708 (B57)** عرض فرق بصري (Diff View) لبيانات RecordHistoryController — منجز 2026-07-15 في `0faca18`: لقطتا before/after منقحتان للحقول العليا المتغيرة في تحديث سجل واحد، وجدول عربي متاح مع fallback للسجل القديم. تحقق: `RecordHistoryApiTest` (5/32)، API contracts، typecheck والبناء ومراجعة مستقلة.

### P8B — الرفع والاستيراد والتصدير

- [ ] **V1-711 (B06)** رفع مجزأ قابل للاستئناف للملفات الكبيرة — UploadsController
- [ ] **V1-712 (B12)** رفع مجدول (مؤجل) عبر طابور خلفي
- [ ] **V1-713 (B14)** استيراد/تصدير القاموس الموحد CSV/JSON مع دمج المترادفات (بعد تحقق من غيابه)
- [ ] **V1-714 (B20)** تصدير/استيراد جماعي للسجلات عبر CSV للتحرير الخارجي
- [x] **V1-715 (B10)** تصدير Premiere XML / FCPXML إضافي في lib/montage.ts (بجانب JSON وEDL الموجودين) *(2026-07-16: `buildPremiereXml` (xmeml v5) و`buildFcpXml` (v1.9) و`secondsToFrames` في `lib/montage.ts`، مربوطة بزرّين في صفحة المشاريع. توقيت frame-based لا ثوانٍ، هروب XML كامل (يحفظ العربية)، إسقاط القصاصات غير الصالحة، ومورد asset واحد لكل سجل مصدر. 13 اختباراً في `montage-nle-export.test.ts`.)*
- [ ] **V1-716 (B64)** إفلات ملفات مباشرة في أي مكان بصفحة الأرشيف

### P8C — التعاون والحضور والإشعارات

- [ ] **V1-721 (B05)** الإشارة بـ @ في الملاحظات والتعليقات مع إشعار
- [ ] **V1-722 (B15)** ربط محادثة Copilot بسياق السجل المفتوح حالياً
- [ ] **V1-723 (B17)** علامات زمنية (Timestamp Bookmarks) أثناء التشغيل
- [ ] **V1-724 (B18)** مؤشر "من متصل الآن" (Presence) على السجلات
- [ ] **V1-725 (B19)** تنبيه إنجاز المهام الطويلة في الخلفية (صوت/وميض عنوان/Notification API)
- [ ] **V1-726 (B34)** تفويض وصول مؤقت لزميل على مشروع/مجموعة (ينتهي تلقائياً)

### P8D — السلامة والموثوقية

- [x] **V1-731 (B07)** سلة مهملات مستقلة قابلة للتصفح والاستعادة — منجز 2026-07-15: `TrashController` + جدول `trashed_records` + صفحة `app/trash` + أمر `trash:prune`. **قرار معماري:** `SoftDeletes` الأصلي في Laravel **لا يصلح هنا** — السجلات ليست كيان Eloquent، بل صفوف في جدول عام `storage_rows` (مفتاح مركّب `[store, uid]`، حقل `data` JSON بلا مخطط) تُقرأ عبر **~45 استدعاء `DB::table('storage_rows')` خام** في البحث والمزامنة والاكتشاف والكتالوج العام والنسخ الاحتياطي والتضمينات والاستيراد وACL. و`SoftDeletes` يُرشِّح الاستعلامات المارّة **عبر النموذج فقط**، فإضافة `deleted_at` كانت ستُبقي المحذوف ظاهرًا في كل تلك القراءات ما لم يُضف `whereNull` في كل واحدة — نطاق انفجار كبير وخطأ صحة فور نسيان واحدة. البديل المنفَّذ: جدول منفصل؛ الحذف **ينقل** الصف خارج `storage_rows` (فكل قارئ قائم يبقى صحيحًا بلا تعديل)، والاستعادة تُعيد إدراج الحمولة و`sync_version` والطوابع حرفيًا. **RBAC:** القراءة لأي مصادَق (قراءة كـ`GET /records`)، الاستعادة `requireEditor` (إعادة إنشاء محتوى = نفس صلاحية الحذف، فمن حذف يتراجع بلا مدير)، و`purge` **`requireAdmin`** — التصعيد الوحيد لأنه الخطوة الوحيدة غير القابلة للعكس؛ ويبقى bulk-delete للـeditor **تحديدًا لأنه صار قابلاً للاسترجاع**. **الاحتفاظ:** `trash:prune` يوميًا، `TRASH_RETENTION_DAYS` افتراضي **30** (السلة نافذة تراجع لا أرشيف — الصف خرج أصلاً من `storage_rows` والنسخ الاحتياطية هي قصة الاسترجاع طويل الأمد؛ أقصر عمدًا من 365 للتدقيق و90 للوسائط). **سلوكان غير بديهيين:** الاستعادة **تُرفض** (`reason: "conflict"`) إن عاد uid مطابق للحياة أثناء وجود القديم في السلة — لا تدهس البيانات الحية والمدخل يبقى؛ وإعادة حذف نفس uid **تستبدل** المدخل (فريد على `store,uid`) بدل التراكم أو الخطأ. التحقق: `TrashApiTest` 12/12 (116 تأكيدًا) بعد RED مؤكد، الحزمة الكاملة **599 تمر**/0 فشل (الأساس كان 587)، `verify:api-contracts` نظيف، `typecheck` نظيف. خارج النطاق موثقًا: تدقيق restore/purge يُورَّث من middleware عبر تسجيل المسارات في `RouteScopeTest::FIXTURE` كمجموعة `V1` المُدقَّقة (لا `AuditLog::` يدوي في أي متحكم V1)؛ استعادة/إفراغ جماعي في الواجهة (الـAPI يقبل `ids[]` والصفحة تعمل صفًا صفًا)؛ وبحث السلة بـ`LIKE` على uid وJSON خام لا فهرس FTS (المخزن بلا مخطط فلا عمود عنوان يُفهرس) — موسوم بـ`ponytail:` مع مسار الترقية.
- [ ] **V1-732 (B08)** تراجع/إعادة فعلي للتعديلات (مكدس حقيقي، ليس نص تأكيد فقط)
- [ ] **V1-733 (B28)** فحص سلامة مجدول للملفات المخزنة (checksum دوري)
- [ ] **V1-734 (B30)** سلسلة تجزئة لسجل التدقيق (Tamper-evident Audit Log)
- [ ] **V1-735 (B36)** ربط صفحة الأخطاء بتنبيه تلقائي عند ارتفاع معدل الأعطال
- [ ] **V1-736 (B37)** بيئة معاينة ببيانات اصطناعية للعمليات الحساسة (استعادة/حذف جماعي)
- [ ] **V1-737 (B51)** تراجع سريع من التوست (Toast Undo) لإجراءات الحذف/الأرشفة
- [ ] **V1-738 (B61)** تحذير عند مغادرة صفحة بها تغييرات غير محفوظة (لا يوجد beforeunload في المشروع)

### P8E — الإنتاجية اليومية

- [ ] **V1-741 (B22)** لوحة "يومي" شخصية لكل مستخدم
- [ ] **V1-742 (B23)** وضع فرز سريع بلوحة المفاتيح للوارد الجديد (Inbox Triage)
- [ ] **V1-743 (B24)** تثبيت عوامل تصفية مفضّلة قابلة لإعادة الترتيب في الشريط الجانبي
- [ ] **V1-744 (B25)** اعتماد/رفض جماعي لاقتراحات الذكاء الاصطناعي
- [ ] **V1-745 (B26)** تحديد متعدد بالسحب (drag-select) في عرض الشبكة
- [ ] **V1-746 (B31)** تخصيص أعمدة الجدول لكل مستخدم
- [ ] **V1-747 (B33)** مسجّل إجراءات جماعية (Macro Recorder)
- [ ] **V1-748 (B41)** تحديد نطاقي بـ Shift+Click في شبكة الأرشيف
- [ ] **V1-749 (B44)** لوحة اختصارات "؟" سياقية (استثمار lib/keyboard-shortcuts.ts الموجود)
- [ ] **V1-750 (B52)** قائمة سياقية بالنقر الأيمن على بطاقات الأرشيف
- [ ] **V1-751 (B56)** إجراءات سريعة داخل Command Palette (لا للتنقل فقط)
- [ ] **V1-752 (B63)** حفظ حالة الفرز والفلترة لكل مستخدم عبر الجلسات
- [ ] **V1-753 (B65)** تحرير سريع للعنوان بالنقر المزدوج من البطاقة (inline rename)

### P8F — الأتمتة والتكامل والمراقبة

- [ ] **V1-756 (B13)** تنبؤ نمو التخزين في صفحة التقارير
- [ ] **V1-757 (B21)** كشف التكرار شبه المتطابق للفيديو (perceptual hash)
- [ ] **V1-758 (B27)** توسعة قواعد الأتمتة بشروط على محتوى الملف عند الاستيراد
- [ ] **V1-759 (B29)** مفاتيح API وWebhooks للأتمتة الخارجية
- [ ] **V1-760 (B35)** لوحة تحكم صحة الطوابير الخلفية (ingest/media/backups)
- [ ] **V1-761 (B38)** نظام أعلام ميزات (Feature Flags) لطرح تدريجي

### P8G — صقل الواجهة والتجربة

- [ ] **V1-765 (B09)** جولة تفاعلية بالتلميحات لأول استخدام (بدل قائمة first-run الثابتة)
- [ ] **V1-766 (B16)** عدسات تجميع (Lenses) لعرض الرسم البياني حسب النوع
- [x] **V1-767 (B39)** مكوّن Skeleton موحّد لحالات التحميل (بدل نص "جار تحميل..." الخام) — منجز 2026-07-15: `components/ui/Skeleton.tsx` مطبَّق على **31 موقعًا في 28 ملفًا**. **اكتشاف a11y مهم:** الغلاف السائد `<div className="panel panel-compact" role="status" aria-live="polite">` كان يحمل live region أصلاً، وتعشيش Skeleton (الذي يملك `role="status"`/`aria-live`/`aria-busy`) داخله كان سيُنتج **إعلانًا مزدوجًا** — فأُزيلت ARIA من الغلاف حيثما تولّى Skeleton، مع تحقق من عدم بقاء أي live region متداخل. الأشرطة `aria-hidden` ولا يُعلَن إلا نص `label` (في `ui-visually-hidden`)، والـshimmer بـCSS فقط ويتوقف تحت `prefers-reduced-motion`. خارج النطاق عمدًا (وليست إغفالاً): 5 مواقع `state-banner` بعنوان `<strong>` ونص شارح (Skeleton كان سيحذف نصًا حقيقيًا)، وموقعان يمرران نص التحميل كقيمة prop/ternary لا كعنصر، و`plugins/page.tsx:288` (نص داخل `title` لـ`EmptyState`)، و3 تلميحات `helper-text` سطرية بجانب عناصر تحكم، و`copilot:164` (حالة **فحص جاهزية** لا تحميل).
- [ ] **V1-768 (B42)** تفعيل التحقق الفوري لكل حقل في محرر الأنواع (FieldError/FormHint غير مُفعَّلين)
- [ ] **V1-769 (B43)** حفظ تلقائي/مسودة محلية للنماذج الطويلة (TypesEditor يُصفَّر بلا حفظ)
- [ ] **V1-770 (B45)** توسعة مكتبة motion لكل الحوارات والتوست (مستخدمة في kanban فقط حالياً)
- [x] **V1-771 (B46)** استخراج hook useMediaQuery موحّد بدل تكرار matchMedia اليدوي — منجز 2026-07-15: `lib/use-media-query.ts` مبني على `useSyncExternalStore` (البدائية الصحيحة للاشتراك بمخزن خارجي في React 19) وآمن للـSSR بلقطة خادم `() => false`. كشف الجرد أن **موقعين فقط** بهما matchMedia يدوي (`app/archive/page.tsx:141` و`app/files/page.tsx:138`) وحُوِّلا. **قرار سلوكي مقصود:** كلاهما داخل مُهيّئ `useState` كسول يغذّي حالة عرض **يضبطها المستخدم** (`setViewMode` موصول بـ`DataViewSwitcher` والعروض المحفوظة) — فجعلهما تفاعليين كان سيدهس اختيار المستخدم عند أي تغيير حجم، وهو **انحدار سلوكي**. لذا تُصدَّر دالتان: `useMediaQuery` (الـhook التفاعلي، يستهلكه `RouteProgress` لـreduced-motion فليس كودًا ميتًا) و`matchesMediaQuery` (قراءة أمرية لمرة واحدة بنفس حارس SSR) للمُهيّئَين.
- [ ] **V1-772 (B47)** تحسين تجربة اللمس للوحة Kanban والمونتاج على الجوال
- [ ] **V1-773 (B48)** عرض العناصر الأخيرة والمفضّلة مباشرة في الهيدر
- [ ] **V1-774 (B49)** مسار تنقّل هرمي كامل (Breadcrumb) يشمل اسم العنصر المفتوح
- [ ] **V1-775 (B53)** استعادة موضع التمرير عند الرجوع من السجل للقائمة
- [ ] **V1-776 (B54)** عرض مقسّم (Split View) لتفاصيل السجل بجانب القائمة
- [ ] **V1-777 (B55)** تبديل كثافة العرض (مريح/مضغوط) في الجداول والشبكات
- [ ] **V1-778 (B58)** مؤشرات حالة لا تعتمد على اللون فقط (دعم عمى الألوان)
- [ ] **V1-779 (B59)** شريط إجراءات ثابت (sticky) في نماذج السجل الطويلة
- [x] **V1-780 (B62)** شريط تقدّم علوي رفيع بين الصفحات — منجز 2026-07-15: `components/ui/RouteProgress.tsx` بمكتبة `motion` الموجودة أصلاً (بلا تبعية جديدة)، مركّب في `AppProviders`، و`aria-hidden="true"` بلا role ولا live region (تغيّر الصفحة معلَن أصلاً عبر العنوان، فإعلانه كل تنقّل = ثرثرة دائمة). **قرار تصميمي يستحق المراجعة:** `usePathname` لا يتحدث إلا **بعد** اكتمال التنقّل، فشريط يعتمد عليه كان سيظهر والتحميل منتهٍ؛ لذا يبدأ عند نقر مرحلة الالتقاط على روابط داخلية حقيقية (يرفض الأصل الخارجي و`target=_blank` و`download` والنقر المعدَّل ومراسي نفس الصفحة) ويُمسح عند استقرار المسار، مع صمام أمان 8 ثوانٍ فلا يعلق الشريط عند تنقّل مُلغى. التقدّم **تقريبي** — App Router لا يكشف نسبة تحميل عامة؛ `useLinkStatus` هو مسار الترقية إن لزم تقدّم حقيقي (موسوم بـ`ponytail:`).
- [ ] **V1-781 (B66)** توسعة تغطية ContextualTips لكل الصفحات (البنية موجودة أصلاً في lib/contextual-tips.ts)
- [ ] **V1-782 (B67)** وضع تباين عالٍ (High Contrast) صريح ضمن THEME_PRESETS
- [ ] **V1-783 (B68)** طبقة "ما الجديد" بعد كل تحديث

## مقترحات استراتيجية — لم تُعتمد بعد كمهام (لا تمنع الإصدار)

## صلابة المعمارية — ما بعد الإصدار الأول (لا تمنع الإصدار)

> القرار المعماري الحالي: يبقى Laravel **مصدر الحقيقة وواجهة API**، وتبقى Next.js واجهة التشغيل. لا تُنقل قواعد المجال إلى BFF داخل Next.js، ولا تُجزأ المنصة إلى microservices قبل تحقق عتبات حمل أو ملكية فريق موثقة.

- [ ] **V1-784 توحيد مصادر حقيقة المعمارية** — مواءمة `AGENTS.md` و`docs/api/README.md` و`archive-laravel/README.md` مع مسار Laravel + Next.js القانوني، وإزالة مراجع `archive-core` أو Node المرجعي التي حُذفت في 2026-07-12.
- [ ] **V1-785 توليد عميل TypeScript من عقد OpenAPI** — استبدال/تقليص التعريفات اليدوية المتكررة في `archive-next/lib/archive-api.ts` بخط توليد أو فحص drift يضمن توافق العميل مع `docs/api/archive-contract.openapi.json` في CI.
- [ ] **V1-786 فصل مستوى تنفيذ الوسائط تدريجياً** — تثبيت عقد versioned لـ`media_jobs` ومخرجاته، ثم إتاحة عامل media مستقل قابل للتوسع CPU/GPU مع بقاء Laravel مالك الجدولة والحالة والتدقيق؛ لا تغيير للـAPI العامة دون عقد وترحيل متوافقين.
- [ ] **V1-787 عتبات استخراج الخدمات والأحداث الموثوقة** — توثيق SLOs وعتبات throughput/زمن الانتظار التي تبرر فصل عامل الوسائط أو إضافة outbox للأحداث التكاملية؛ لا يُعتمد microservice أو event bus كمسار افتراضي قبل هذا الدليل.
- [ ] **V1-788 مراجعة RBAC وملكية الكتابات المتبقية** — قصر عمليات الكتابة على `rights` وrecord notes وأي مسارات V1 متبقية على editor/admin أو مالك المورد حسب سياسة صريحة؛ أضف مصفوفة اختبارات viewer/editor/admin وحالات author/non-author. **اكتشاف المراجعة:** `RightsController::store` و`RecordNotesController::{store,update,destroy}` لا يستدعون `requireEditor` أو فحص ملكية، بينما التعليقات تطبق author/admin عند الحذف.
- [ ] **V1-789 اكتمال سجل التدقيق للتعاون** — إدخال تغييرات collaboration documents/locks/presence المهمة تشغيليًا ضمن تصنيف audit منقح، مع منع ضجيج heartbeat؛ مسارات التعاون الآن خلف `archive.auth` فقط وخارج مجموعة `archive.audit`.
- [ ] **V1-790 حد وصول موحد لبيانات الأرشيف** — تصميم طبقة وصول محددة لـ`storage_rows` (هوية `[store, uid]`، read/write، معاملات، وفهارس JSON اللازمة) ثم ترحيل مسارات المجال تدريجيًا؛ يمنع تباين الاستعلامات الخام وانتشار منطق السجل العام عبر المتحكمات والخدمات.

أفكار أعمق تأثيراً على قيمة الأرشيف كمنشأة مؤسسية موثوقة، بانتظار قرار منتج قبل ترقيتها لبنود `V1-79x`:
1. سلسلة عهدة رقمية موقّعة (Chain of Custody) لكل ملف من الاستيراد للنشر
2. سوق تراخيص واستخدام مع تتبع فعلي لأماكن استخدام كل لقطة وإيراداتها
3. بحث بصري/دلالي على مستوى الإطار (Visual Frame Search)
4. تمارين استرداد كوارث آلية دورية (ربع سنوية) بدل الاستدعاء اليدوي لـ dr-drill
5. بيانات وصفية متعددة اللغات لكل سجل (عربي/إنجليزي/فرنسي)
6. وضع عمل ميداني بلا اتصال (Offline-first) لطواقم التوثيق الميداني
7. تحليل أثر الحذف قبل التنفيذ (Legal Hold) — فحص ارتباط برخصة/تقرير قبل حذف نهائي
8. تصدير بمعيار أرشفة دولي (PBCore / EBUCore / Dublin Core)

*مصدر البحث: مقارنة مباشرة مع كود CLOUD-MediaDB وكود archive-next/archive-laravel، 2026-07-14.*
