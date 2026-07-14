# مهام Masar الحالية

> هذا هو ملف المهام النشطة الوحيد بعد دمج خطط Laravel/Next وUI وlegacy parity.

> **للوكلاء المنفذين:** تُنفذ مهمة واحدة في كل مرة بـTDD ومراجعة مستقلة. بعد إغلاق P1 يمكن تشغيل P3 وP4 وP6 بالتوازي؛ لا يعمل وكيلان على الملفات نفسها، ولا تُدمج مهمة قبل بواباتها المدرجة أدناه.

## الحالة

- أُغلقت جميع مانعات P0 الأصلية، لكن الإصدار يبقى **NO-GO** للاستخدام العام حتى إكمال التشغيل المزدوج وSetup الشامل وجاهزية المستخدم والتجربة الميدانية وبوابات GA أدناه.
- توجد مهام تطوير محلية مفتوحة في المسار القانوني `archive-next/` و`archive-laravel/` (وأيضًا `scripts/` و`infra/` للتثبيت والتشغيل)؛ البنود التي تحتاج Windows/Linux نظيفين أو اعتمادات حية موسومة صراحة كتحقق خارجي.
- التصميم الحاكم: [`docs/superpowers/specs/2026-07-14-daily-use-dual-runtime-design.md`](docs/superpowers/specs/2026-07-14-daily-use-dual-runtime-design.md).
- ترتيب التنفيذ: `P1 Setup core → P2 lifecycle → (P3 Windows Native + P4 Linux Native + P6 daily UX) → P5 parity → P7 RC/GA`.
- البنود المكتملة نُفذت ووُثقت في `ChangeLog.md` ولا تُعاد إلا بمتابعة جديدة ذات معرّف مستقل.

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
- [ ] **V1-208D installation manifest قابل للاستئناف** — تسجيل version/source/mode/platform/profiles/capabilities/digests/services/data paths/last successful step/previous version بلا أسرار، وجعل install/repair idempotent وقابلين للاستئناف بعد فشل متوسط.
- [ ] **V1-208E Docker release adapter** — تنفيذ install/start/stop/restart/status/health/logs/exec عبر adapter يستهلك صور version+digest في online وoffline؛ يحظر `git pull` و`pnpm install` و`--build` في وضع المستخدم، مع إبقائها لأوامر التطوير فقط.
- [ ] **V1-208F واجهة wizard شاملة** — عرض Docker/Native وخيارات المنصة والمصدر والوصول والـprofiles والتخزين وخدمات البيانات بحسب العقد، ورفض غير المدعوم قبل الكتابة. الوضع التفاعلي وغير التفاعلي يستدعيان الدوال نفسها ويملكان اختبارات parity.
- [ ] **V1-208G بوابة Setup الأساسية** — تغطية help/plan/install/repair/start/stop/restart/status/health/logs/config/doctor/rotate-secrets/migrate/diagnostics/support-bundle عبر اختبارات CLI، وإضافة فحص redaction للمخرجات وmanifest. القبول المحلي: اختبارات Control Center + `pnpm verify`.
- [ ] **V1-208M فحوص خدمات البيانات والتخزين** — probes غير مدمرة لـPostgreSQL وRedis-compatible والتخزين المحلي والمزود الخارجي، مع اختبار read/write/delete داخل namespace مؤقت وتنظيفه. لا تُحفظ credentials في manifest أو support bundle.
- [ ] **V1-208N أوضاع الوصول والشهادات** — local وintranet وpublic TLS عبر العقد نفسه؛ فحص تعارض المنافذ وDNS/certificate قبل switch، وحفظ الإعداد السابق للرجوع عند فشل health.

#### P2 — دورة حياة الإصدار والبيانات عبر Setup

- [ ] **V1-208H النسخ والاستعادة القانونية** — استبدال `pg_dump`/`psql` المعروضين كنسخة كاملة باستدعاء BackupService/أوامر Laravel القانونية التي تشمل DB+files+manifest+checksums؛ إضافة `setup verify-backup` ورفض النسخة التالفة قبل أي تغيير.
- [ ] **V1-208I update ذري من artifacts** — preflight → backup كامل → تثبيت الإصدار بجانب الحالي → `archive:migrate-safe` → switch → health + smoke حسب الدور. يفشل بأمان عند download/signature/migration/health ولا يحذف الإصدار السابق.
- [ ] **V1-208J rollback حقيقي** — إعادة artifact/config السابقين، ومع migration غير قابلة للعكس عرض أثر فقد بيانات ما بعد التحديث وطلب تأكيد قبل استعادة النسخة السابقة. القبول: نجاح rollback بعد فشل health، ورفض downgrade غير المتوافق.
- [ ] **V1-208K uninstall وإعادة الربط** — إبقاء البيانات افتراضيًا، إزالة الخدمات والقواعد التي يملكها manifest فقط، وإضافة `reconnect-data`. حذف البيانات خيار منفصل يتطلب عبارة تأكيد وbackup حديثًا ناجحًا.
- [ ] **V1-208L اختبارات فشل دورة الحياة** — checksum/signature تالف، منفذ مشغول، مساحة ناقصة، اعتماد مفقود، فشل منتصف التثبيت، تشغيل الأمر مرتين، DB/worker/Reverb down، قرص ممتلئ، وفشل restore/update/rollback؛ لكل سيناريو code وnextActions ثابتان.

#### P3 — V1-210 Windows Native

- [ ] **V1-210A حزمة Windows Native** — artifact موقعة من نفس commit تشغّل Next standalone وLaravel FastCGI والعامل وReverb والجدولة كخدمات Windows تحت حساب محدود؛ service wrapper مثبت الإصدار ومدرج في SBOM.
- [ ] **V1-210B Windows runtime adapter** — تنفيذ دورة Setup كاملة للخدمات وACL/firewall/logs والـhealth، وإزالة الموارد التي سجل manifest ملكيتها فقط.
- [ ] **V1-210C خدمات البيانات على Windows** — PostgreSQL محلي مُدار أو endpoint خارجي؛ database queue/cache baseline، وRedis-compatible endpoint خيار بعد probe. تغطية تبديل الخيار ورفض endpoint غير السليم قبل التثبيت.
- [ ] **V1-210D قبول Windows نظيف — تحقق خارجي** — Windows 10 و11: online/offline، local/intranet/public TLS، reboot، backup/restore، update/rollback، uninstall/reconnect؛ إرفاق logs/manifest/support bundle منزوعة الأسرار.

#### P4 — V1-211 Linux Native

- [ ] **V1-211A حزمة Linux Native** — artifact موقعة من نفس commit لـNext standalone وPHP-FPM/HTTP والعامل وReverb والجدولة، مع مستخدم خدمة غير تفاعلي.
- [ ] **V1-211B Linux runtime adapter** — وحدات systemd منفصلة، ownership وlogrotate وfirewall اختياري، ودورة Setup كاملة دون تعديل موارد نظام لا يملكها manifest.
- [ ] **V1-211C خدمات البيانات على Linux** — PostgreSQL محلي/خارجي، database queue/cache baseline، وRedis محلي/خارجي اختياري بعد probe؛ اختبارات service restart وفشل الاتصال والتعافي.
- [ ] **V1-211D قبول Linux نظيف — تحقق خارجي** — توزيعة Linux المدعومة في عقد المنصات: online/offline، local/intranet/public TLS، reboot، backup/restore، update/rollback، uninstall/reconnect مع أدلة منزوعة الأسرار.

#### P5 — V1-212B تكافؤ حي بين المنصات

- [ ] **V1-212B harness قبول موحد** — تشغيل نفس scenario IDs على Windows Docker/Native وLinux Docker/Native: install/reconfigure/operate/data/release/uninstall/security، وحفظ النتائج كartifacts.
- [ ] **V1-212C بوابة ادعاء الدعم** — منع انتقال أي platform من `planned/conditional` إلى supported ما لم تمر مصفوفته الحية كاملة من artifact إصدار نهائي على clean host.

### الموجة 3 — المنتج وUX
- [x] **V1-302 admin safety** — منجز 2026-07-13 في ac7dfcc: منع حذف/تخفيض آخر admin + `LAST_ADMIN_PROTECTED`، والحزمة 532 تمر.
- [x] **V1-304A data correctness الأساسية** — منجز 2026-07-13 في eb40845: pagination envelope على خمس نقاط وإصلاح `summary.total` في sync.
- [x] **V1-305 offline truth** — منجز 2026-07-14: إزالة ادعاء PWA وتوثيق حدود queue المحلية الفعلية.

#### P6A — V1-301 onboarding محفوظ خادميًا

- [ ] **V1-301A عقد تقدم onboarding** — نموذج/تخزين خادمي لمراحل المؤسسة والتخزين والدعوة وأول مادة وأول بحث، مع API typed وتحديث OpenAPI. لكل مرحلة timestamp وحالة، ويمنع viewer من تعديلها.
- [ ] **V1-301B واجهة first-run مستأنفة** — ربط `archive-next/app/first-run` بالعقد الخادمي، استئناف التقدم بعد logout/login وعلى جهاز آخر، وإظهار خطوة قابلة للتنفيذ لا checklist محلية كاذبة.
- [ ] **V1-301C رحلة admin حية** — fixture مدير جديد ينفذ المؤسسة→التخزين→الدعوة→أول مادة→أول بحث، مع حالات فشل/retry وعدم وسم الخطوة مكتملة قبل تأكيد الخادم.

#### P6B — V1-303 responsive والوصولية

- [x] **V1-303A بوابة public axe الأساسية** — ثمانية مسارات عند 375/768/1280 في `archive-next/e2e/accessibility.spec.ts` بلا serious/critical.
- [ ] **V1-303B fixtures مصادقة حسب الدور** — admin/editor/viewer وبيانات records/rights/backups/jobs معزولة داخل live Playwright؛ لا تستخدم token مدير موحدًا.
- [ ] **V1-303C تغطية جميع المسارات المصنفة** — axe على المسارات المصادَق عليها والحالات loading/empty/error/ready عند 375/768/1280 وzoom 200%، وربط inventory بـRouteScope لمنع route بلا اختبار.
- [ ] **V1-303D لوحة المفاتيح وقارئ الشاشة** — tab order، focus traps، Escape، skip link، announcements وعينة فعلية لقارئ شاشة على onboarding/archive/record/upload/search/admin.
- [ ] **V1-303E مراجعة بصرية حية** — screenshots ثابتة للمسارات الأساسية عند نقاط العرض الثلاث، صفر overflow أفقي أو إجراء أساسي خارج الوصول، وتوثيق الاستثناءات المقبولة فقط.

#### P6C — V1-304 متابعات صحة البيانات

- [ ] **V1-304B automation pagination** — إزالة `limit(25)` الصامت أو إرجاع pagination envelope كامل مع total/next cursor، وتحديث العميل والعقد والاختبارات.
- [ ] **V1-304C catalog cursor edge** — اختبار وإصلاح حافة التكرار/الفقد عند تساوي sort keys وبين الصفحات.
- [ ] **V1-304D montage contract** — إضافة montage-projects إلى OpenAPI والتحقق من توافق request/response مع العميل الفعلي.

#### P6D — V1-306 اللغة والمساعدة

- [ ] **V1-306A إزالة dialogs الأصلية** — استبدال كل `window.prompt/window.confirm/confirm` الموجودة في Next بحوارات Metric UI/Radix قابلة للوحة المفاتيح، مع وصف الأثر والإجراء الآمن والتركيز الصحيح.
- [ ] **V1-306B اتساق العربية وRTL** — تدقيق النصوص والمصطلحات والتواريخ والأرقام واتجاه الأيقونات عبر المسارات المصنفة، واختبار يمنع mojibake والنصوص التشغيلية الإنجليزية غير المعتمدة.
- [ ] **V1-306C أدلة حسب الدور** — مساعدة سياقية لـadmin/editor/viewer مرتبطة بالصفحة والإجراء، ولا تعرض للمستخدم إجراء لا تسمح به صلاحياته.

#### P6E — V1-307 الأداء

- [ ] **V1-307A مولد بيانات benchmark** — 100 ألف سجل عربي و10 آلاف ملف وعينة رفع 1GB ببذرة ثابتة، دون إدراج بيانات حقيقية أو حساسة.
- [ ] **V1-307B قياسات الواجهة** — LCP p75 ≤2.5s وCLS ≤0.1 وINP ≤200ms على جهاز baseline بعقد الموارد، للمسارات اليومية وعند نقاط العرض المطلوبة.
- [ ] **V1-307C قياسات API والرفع** — P95 البحث ≤1.5s، فتح السجل ≤1s، وبدء جلسة الرفع ≤2s دون زمن النقل، على Docker وNative بالأداة والبيانات نفسيهما.
- [ ] **V1-307D بوابة regression** — حفظ baseline ونتائج قابلة للمقارنة، وفشل CI/release rehearsal عند تجاوز budget دون استثناء إصدار موثق.

### الموجة 4 — CI والتوثيق
- [x] **V1-401 CI gates** (منجز 2026-07-14: وظيفة live-integration بـPlaywright الحي + رفع الآثار (798be19) + بوابة axe-core (`e2e/accessibility.spec.ts`) مدمجة في نفس التشغيل الحي عبر `scripts/verify-next-laravel-live.mjs`؛ راجع V1-303 لنطاق التغطية) / [x] **V1-402 security gates** (منجز 2026-07-13 في 798be19: gitleaks حاجب + baseline/audit + composer audit) / [x] **V1-403 release-readiness محتوى لا strings** (منجز 2026-07-13: فحص تماسك الإصدار/الرخصة/بنية release.yml/العقد/P0 المفتوحة/اكتمال env، 8 اختبارات) / [x] **V1-404 docs canonical-only** (منجز 2026-07-13 في b32a083) / [x] **V1-405 release notes** (منجز 2026-07-13 في b32a083: `docs/release-notes/v1.0.0-rc.1.md`).
- [ ] **V1-406 بوابة المهام المانعة للإصدار** — تحديث release-readiness ليفشل عند بقاء أي بند P1–P6 موسوم كمانع أو غياب أدلة المنصة، بدل الاقتصار على P0 التاريخية. لا تمنع البنود الخارجية ميزة معطلة، لكنها تمنع تفعيلها دون دليل.

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
- تحقق المهمة محليًا بأضيق اختبار أولًا، ثم `pnpm typecheck` و`pnpm test:next` أو `pnpm verify:laravel` حسب النطاق، ثم `pnpm verify` قبل الإغلاق.
- مهام Setup تشغّل أيضًا `node --test scripts/control-center.test.mjs scripts/platform-contract.test.mjs` و`pnpm verify:infra`.
- مهام الرحلات والأدوار والوصولية تشغّل `pnpm verify:laravel-next:live` وتحفظ screenshots/traces/reports اللازمة.
- مهام clean-host لا تُغلق بمحاكاة محلية؛ تُرفق platform/version/mode/source/manifest ونتيجة كل scenario ID من الجهاز المستهدف.
- كل مهمة تغلق بتحديث `ChangeLog.md` و`TASKS.md` وcommit مستقل لا يضم تعديلات مستخدم غير مرتبطة.

## قاعدة إعادة الفتح

لا يُضاف أي بند هنا إلا إذا كان قابلاً للتنفيذ محلياً أو توفرت له البيئة/الاعتمادات الحية المطلوبة. عند إضافة بند جديد:

- ميزات المنتج الجديدة تكون في `archive-next/` و`archive-laravel/` فقط، والتشارك بين الواجهة والـAPI يمر عبر `docs/api/archive-contract.openapi.json`. أعمال التثبيت والتشغيل والبوابات الخاصة بهذه الخطة تكون في `scripts/` و`infra/` و`.github/workflows/` دون إنشاء runtime منتج موازٍ.
- حُذفت حزم `archive-app` و`archive-server` و`archive-core` نهائياً بتاريخ 2026-07-12 (راجع `ChangeLog.md`)؛ لا تُضاف إليها ميزات جديدة — هي متاحة فقط عبر تاريخ git عند الحاجة لمرجع legacy.
- تُنفذ كل شريحة ببوابات تحقق مناسبة، ثم تُوثق في `ChangeLog.md` وتُدمج في commit مستقل.
