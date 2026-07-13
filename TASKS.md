# مهام Masar الحالية

> هذا هو ملف المهام النشطة الوحيد بعد دمج خطط Laravel/Next وUI وlegacy parity.

## الحالة

- لا توجد مهام محلية مفتوحة في المسار القانوني `archive-next/` + `archive-laravel/` ضمن خطة UX/UI الحالية.
- البنود المكتملة نُفذت ووُثقت في `ChangeLog.md`.

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

> القرار الحالي **NO-GO** حتى إغلاق مانعات P0. التسلسل الإلزامي: `W0 → W1 → W2 → RC → GA` (UX/CI بالتوازي بعد W0). التفاصيل الكاملة لكل بند في ملف الخطة والتقرير `2026-07-12-v1-release-readiness-report.md`.

### الموجة 0 — خط الأساس
- [x] **V1-000 مراجعة cutover** — حذف الإرث (1700 ملف) وcommit نظيف. (منجز 2026-07-12)
- [x] **V1-001 قفل النطاق** — منجز 2026-07-13 في d071fa2: تصنيف 135 مسارًا (108 v1 / 20 admin / 7 experimental خلف ARCHIVE_FEATURE_* معطلة في الإنتاج / 0 hidden) + `RouteScopeTest` يمنع شحن مسار غير مصنّف + جدول `docs/scope/v1-route-scope.md`. متابعة مفتوحة: إضافة requireAdmin لمسارات ODBC (chip).
- [x] **V1-002 versioning/legal** — منجز 2026-07-13: LICENSE جذري MIT (قرار المستخدم)، `package.json` إلى `1.0.0-rc.1` + حقل license، سياسة SemVer ونافذة الدعم في `docs/versioning.md`؛ الإطلاق الرسمي بدفع tag مطابق عبر بوابة `release.yml`.
- [ ] **V1-003 reproducibility** — clean install + حفظ نسخ Node/pnpm/PHP/Composer وbaseline. (جزئياً: ext-ftp runtime عبر `verify-laravel-runtime.mjs`.)
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

### الموجة 2 — التشغيل والتغليف
- [x] **V1-201 Control Center** — إصلاح رمز legacy المفقود + إزالة الأوامر القديمة + اختبارات. (منجز 2026-07-12؛ 18 اختباراً.) **(كان P0 #6)**
- [ ] **V1-202 production runtime** — استبدال PHP dev server + healthchecks عميقة + worker/Reverb readiness. (جزئياً: صورة Laravel حقيقية بـ ext-ftp.)
- [x] **V1-203 migration safety** — منجز 2026-07-13 في 7ae55f4: أمر `archive:migrate-safe` (preflight → prebackup عبر BackupService → maintenance عند الحاجة فقط → `--isolated` migrate-once → up عند النجاح/بقاء down + تعليمات rollback عند الفشل)، مربوط في compose الملفين وControl Center. 4 اختبارات جديدة، الحزمة 510 تمر. **(P0 #8)**
- [ ] **V1-204 immutable images** / **V1-205 supply chain (SBOM/checksums/signing)** / **V1-206 offline bundle**. (جزئياً 2026-07-13 في 40f1011: SBOM+provenance للصورتين + release-images.txt بمراجع digest ثابتة تُرفق بالـ Release. المتبقي: توقيع cosign، offline bundle.) **(P0 #9)**
- [ ] **V1-207 observability** / **V1-208 cross-platform installer** / **V1-209 Docker profiles** / **V1-210 native Windows** / **V1-211 native Linux** / **V1-212 parity matrix**.

### الموجة 3 — المنتج وUX
- [ ] **V1-301 onboarding خادمي** / **V1-302 admin safety (last-admin/self guards)** / **V1-303 responsive+a11y (375/768/1280, axe)** / **V1-304 data correctness (إزالة الحدود الصامتة)** / **V1-305 offline truth** / **V1-306 language/help** / **V1-307 performance**.

### الموجة 4 — CI والتوثيق
- [ ] **V1-401 CI gates (Next+Laravel+live Playwright+axe)** / **V1-402 security gates** / **V1-403 release-readiness محتوى لا strings** / **V1-404 docs canonical-only** / **V1-405 release notes**.

### الموجة 5 — RC وتجربة ميدانية / الموجة 6 — GA
- [ ] **V1-501..505** Alpha/game-day، rc.1 في 3–5 بيئات، قياس RPO/RTO، تصنيف عيوب pilot، rehearsal نظيف.
- [ ] **V1-601..605** Go/No-Go، tag `v1.0.0`، نشر artifacts/SBOM، اختبار تنزيل نهائي، فتح مراقبة/دعم.

## قاعدة إعادة الفتح

لا يُضاف أي بند هنا إلا إذا كان قابلاً للتنفيذ محلياً أو توفرت له البيئة/الاعتمادات الحية المطلوبة. عند إضافة بند جديد:

- يكون التطوير الجديد في `archive-next/` و`archive-laravel/` فقط؛ التشارك بين الواجهة والـ API يمر عبر عقد `docs/api/archive-contract.openapi.json`.
- حُذفت حزم `archive-app` و`archive-server` و`archive-core` نهائياً بتاريخ 2026-07-12 (راجع `ChangeLog.md`)؛ لا تُضاف إليها ميزات جديدة — هي متاحة فقط عبر تاريخ git عند الحاجة لمرجع legacy.
- تُنفذ كل شريحة ببوابات تحقق مناسبة، ثم تُوثق في `ChangeLog.md` وتُدمج في commit مستقل.
