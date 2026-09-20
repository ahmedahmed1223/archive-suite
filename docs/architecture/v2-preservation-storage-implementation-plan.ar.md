# الخطة النهائية لتنفيذ تخزين تمثيلات الحفظ للإصدار 2

> **للوكلاء المنفذين:** استخدم `superpowers:executing-plans` لتنفيذ هذه الخطة
> مهمة بمهمة. تستخدم الخطوات مربعات اختيار لتتبع التقدم.

**الحالة:** معتمدة للتنفيذ على دفعات متسلسلة.

**الهدف:** بناء تمثيلات حفظ وMezzanine ونسخ مادية قابلة للتحقق، بسياسة محلية أو
خارجية أساسية وواجهات تشغيل عربية صادقة.

**البنية:** يبقى `MediaDerivative` هو التمثيل المنطقي المرتبط بإصدار المصدر، ويضاف
`MediaReplica` لوجوده في وجهة واحدة. تفصل طبقة موصلات التخزين بين قدرات المزود
والتدفقات، ويقود Laravel الطوابير والتدقيق، بينما يستهلك Next.js عقد OpenAPI فقط.

**التقنيات:** Laravel 13، PHP، Flysystem، SQLite للاختبارات، Docker، ffmpeg/ffprobe،
Next.js 16، React 19، TypeScript، OpenAPI، Vitest وPlaywright.

**المواصفة:** `docs/architecture/v2-preservation-storage-design.ar.md`

## القيود العامة

- المحلي هو السياسة الافتراضية؛ يدعم `external_primary` مزودًا خارجيًا واحدًا محددًا.
- لا تكشف الاستجابات مسارات أو مفاتيح أو رموز OAuth أو أسرار مزودات.
- لا تعتبر النسخة جاهزة قبل تحقق لاحق من الحجم وSHA-256.
- لا حذف نهائي لآخر نسخة `ready` أو مادة تحت تعليق قانوني؛ الحذف النهائي بموافقتين.
- لا تستخدم حسابات خارجية حقيقية في الاختبارات؛ استخدم موصلات مزيفة.
- كل تعديل عام يحدّث OpenAPI وLaravel والعميل المولّد وNext.js في الدفعة نفسها.

## تركيز المراجعة

- فشل التنزيل الخارجي بعد حجز المساحة المرحلية يجب أن يحرر الحجز وينتج `failed`.
- تغير إصدار الملف لدى المزود بين الرفع والتحقق يجب أن يمنع `ready`.
- موصل بلا قراءة نطاقية أو حذف نهائي يجب أن يخفي العملية ولا يقبل نداءها.
- محاولة حذف آخر نسخة جاهزة أو نسخة تحت تعليق قانوني يجب أن ترد 422 مدققة.
- لا يسمح الاستدعاء غير الإداري بتغيير سياسة التخزين أو بدء استعادة أو رؤية أسرار.

## قرار التنفيذ والدفعات

ينفذ العمل على `master` في ثماني دفعات، ولا تبدأ دفعة قبل أن تمر اختبارات الدفعة
السابقة. الدفعات 1–4 تبني الخادم ونزاهة البيانات، والدفعتان 5–6 تفتحان العقد
والواجهات، والدفعة 8 هي القبول الحي. لا ينشر أي موصل خارجي حقيقي أو يطلب صلاحية
OAuth قبل أن تنجح الموصلات المزيفة والعقد والواجهات.

| الدفعة | النتيجة | حاجز الانتقال |
| --- | --- | --- |
| 1 | نموذج `MediaReplica` والسياسة | اختبارات Laravel والهجرة الخضراء |
| 2 | قدرات الموصلات وموصلات مزيفة | اختبارات الوحدة الخضراء |
| 3 | موصلات المزودين الفعلية | اختبارات تكامل الموصلات الخضراء |
| 4 | النسخ والتحقق والتجهيز المرحلي | اختبارات الوسائط الخضراء |
| 5 | الاحتفاظ والحذف والاستعادة | اختبارات الصلاحيات والتدقيق الخضراء |
| 6 | OpenAPI ومسارات الإدارة | العقد والعميل المولّد أخضران |
| 7 | واجهات التشغيل العربية | Vitest وTypeScript أخضران |
| 8 | قبول حي وإصدار | `pnpm verify` والقبول الحي وجاهزية الإصدار خضراء |

## حدود الإصدار

- يطبق الإصدار الأول الموصل المحلي بالكامل وموصلات Dropbox وGoogle Drive وS3
  وAzure Blob عبر واجهات القدرات نفسها.
- يبدأ Dropbox وGoogle Drive بحساب إعداد خادمي أو اتصال OAuth إداري؛ لا تحفظ
  رموز الوصول في قاعدة البيانات أو ترسل للمتصفح. تخزن في إعداد خادم مشفر أو
  مدير أسرار تابع لبيئة النشر.
- لا يسمح `external_primary` لـ Dropbox أو Google Drive إلا بعد أن يعلن الموصل
  رفعًا قابلًا للاستئناف والتحقق بالقراءة واسترجاع إصدار. وإلا يبقيهما النظام
  وجهتي استيراد أو نسخ احتياطي فقط.
- LTO وBagIt/PREMIS والتكرار التلقائي بين مزودين خارجيين خارج هذه الدفعات.

---

### المهمة 1: مخطط النسخ المادية والسياسة

**الملفات:**
- أنشئ: `archive-laravel/database/migrations/2026_09_20_000002_create_media_replicas_and_storage_policy_tables.php`
- أنشئ: `archive-laravel/app/Models/MediaReplica.php`
- أنشئ: `archive-laravel/app/Models/StoragePolicy.php`
- عدّل: `archive-laravel/app/Models/MediaDerivative.php`
- اختبر: `archive-laravel/tests/Feature/MediaReplicaSchemaTest.php`

**الواجهات:** ينتج `MediaReplica` بحقول `derivative_id`, `disk`, `provider_object_id`,
`provider_version`, `status`, `byte_size`, `sha256`, `attempt_count`, `verified_at`؛
وينتج `StoragePolicy` بقيم `local_primary|external_primary` و`primary_disk`.

- [ ] اكتب اختبارًا فاشلًا يثبت فهرسًا فريدًا للنسخة والقرص ومعرف المزود ومنع
  سياسة خارجية بلا قرص أساسي.
- [ ] شغّل: `node scripts/laravel-docker.mjs test tests/Feature/MediaReplicaSchemaTest.php`.
  المتوقع: فشل لأن النماذج والجداول غير موجودة.
- [ ] أضف الهجرة والنماذج والعلاقات، مع check constraints للحالات المذكورة في المواصفة.
- [ ] شغّل الاختبار نفسه ثم `node scripts/laravel-docker.mjs test`؛ المتوقع: نجاح.
- [ ] ثبّت: `git commit -m "feat(media): add replica and storage policy models"`.

### المهمة 2: كتالوج القدرات وموصلات الاختبار

**الملفات:**
- أنشئ: `archive-laravel/app/Services/Storage/ReplicaConnector.php`
- أنشئ: `archive-laravel/app/Services/Storage/ReplicaConnectorCatalog.php`
- أنشئ: `archive-laravel/app/Services/Storage/ReplicaCredentialResolver.php`
- أنشئ: `archive-laravel/tests/Fakes/FakeReplicaConnector.php`
- اختبر: `archive-laravel/tests/Unit/Services/Storage/ReplicaConnectorCatalogTest.php`

**الواجهات:** `ReplicaConnector` يعرّف `capabilities(): array`, `put()`, `verify()`,
`stage()`, `restore()` و`delete()`؛ يعيد كل نقل `ReplicaTransferResult` يحوي معرف
المزود وإصداره والحجم وSHA-256.

- [ ] اكتب اختبارًا فاشلًا يثبت أن موصل Dropbox بلا `range_read` لا يعرض العملية،
  وأن موصل S3 يعلن الرفع المستأنف والتحقق.
- [ ] شغّل اختبار الوحدة؛ المتوقع: فشل لغياب الكتالوج.
- [ ] نفذ الواجهة والكتالوج والموصل المزيف؛ لا تستدعِ SDK خارجيًا في هذا الطور.
- [ ] نفذ `ReplicaCredentialResolver` ليعيد بيانات اعتماد الخادم للقرص المختار
  فقط، وليمنع إرجاع أي سر إلى controller أو response أو سجل تدقيق.
- [ ] شغّل الاختبار واختبارات خدمة التخزين الحالية؛ المتوقع: نجاح.
- [ ] ثبّت: `git commit -m "feat(storage): add replica connector capability catalog"`.

### المهمة 3: موصلات المزودين الفعلية وحساباتهم

**الملفات:**
- أنشئ: `archive-laravel/app/Services/Storage/Connectors/LocalReplicaConnector.php`
- أنشئ: `archive-laravel/app/Services/Storage/Connectors/S3ReplicaConnector.php`
- أنشئ: `archive-laravel/app/Services/Storage/Connectors/AzureReplicaConnector.php`
- أنشئ: `archive-laravel/app/Services/Storage/Connectors/DropboxReplicaConnector.php`
- أنشئ: `archive-laravel/app/Services/Storage/Connectors/GoogleDriveReplicaConnector.php`
- أنشئ: `archive-laravel/tests/Feature/ReplicaConnectorIntegrationTest.php`

**الواجهات:** تسجل الموصلات قدراتها عند الإقلاع ولا تتصل بالمزود إلا عبر
`ReplicaCredentialResolver`. يستخدم موصل Google Drive الرفع القابل للاستئناف
والتحقق بـ API رسمي؛ ويعيد موصل Dropbox وGoogle Drive `provider_version` إن
وفره المزود وإلا يعلن غيابه صراحة.

- [ ] اكتب اختبارات فاشلة بمحاكاة HTTP للتحقق من رفع محلي وS3/Azure، ومنع
  `external_primary` لموصل Drive أو Dropbox لا يعلن القدرة المطلوبة.
- [ ] شغّل: `node scripts/laravel-docker.mjs test tests/Feature/ReplicaConnectorIntegrationTest.php`.
- [ ] نفذ الموصلات ووقت انتهاء بيانات الاعتماد واختبار الاتصال من دون كتابة
  رموز OAuth في قاعدة البيانات أو السجل أو الردود.
- [ ] شغّل الاختبار واختبارات الكتالوج؛ المتوقع: نجاح.
- [ ] ثبّت: `git commit -m "feat(storage): add verified replica provider connectors"`.

### المهمة 4: خدمة النسخ والتحقق والاستعادة

**الملفات:**
- أنشئ: `archive-laravel/app/Services/Media/MediaReplicaService.php`
- أنشئ: `archive-laravel/app/Jobs/VerifyMediaReplica.php`
- أنشئ: `archive-laravel/app/Jobs/StagePrimaryMediaReplica.php`
- عدّل: `archive-laravel/app/Services/Media/IngestDerivativeService.php`
- اختبر: `archive-laravel/tests/Feature/MediaReplicaServiceTest.php`

**الواجهات:** `MediaReplicaService::queueBackup(MediaDerivative $derivative, string $disk)`
و`::requestRestore(MediaReplica $replica, string $targetDisk, User $actor)` لا يغيران
حالة النسخة إلى `ready` إلا من `VerifyMediaReplica`.

- [ ] اكتب اختبارات فاشلة للنسخ الناجح، عدم تطابق SHA-256، تغير نسخة المزود،
  وفشل التنزيل المرحلي الذي يحرر الحجز.
- [ ] شغّل: `node scripts/laravel-docker.mjs test tests/Feature/MediaReplicaServiceTest.php`.
- [ ] نفذ الخدمة والوظائف، واستخدم مساحة مرحلية محدودة من إعداد `media.php`؛
  نظفها في `finally` وسجل خطأ منقح.
- [ ] شغّل الاختبار ثم اختبارات `MediaDerivativesApiTest`؛ المتوقع: نجاح.
- [ ] ثبّت: `git commit -m "feat(media): verify and restore physical replicas"`.

### المهمة 5: الاحتفاظ والحذف والتدقيق

**الملفات:**
- أنشئ: `archive-laravel/app/Services/Storage/ReplicaRetentionService.php`
- أنشئ: `archive-laravel/app/Policies/MediaReplicaPolicy.php`
- عدّل: `archive-laravel/app/Services/Storage/StorageOperationService.php`
- اختبر: `archive-laravel/tests/Feature/ReplicaRetentionApiTest.php`

- [ ] اكتب اختبارات فاشلة لحذف آخر نسخة جاهزة، تعليق قانوني، غياب موافقة ثانية،
  وحذف صالح يسجل حدث تدقيق منقحًا.
- [ ] شغّل اختبار الميزة؛ المتوقع: فشل لغياب الخدمة والسياسة.
- [ ] نفذ الحذف المنطقي وفترة الاحتفاظ وطلب الموافقة الثانية؛ لا تنفذ حذف مزود
  خارجي قبل اكتمال الموافقتين.
- [ ] شغّل اختبار الميزة واختبارات التدقيق؛ المتوقع: نجاح.
- [ ] ثبّت: `git commit -m "feat(storage): guard replica retention and deletion"`.

### المهمة 6: العقد ومسارات الإدارة

**الملفات:**
- عدّل: `docs/api/archive-contract.openapi.json`
- أنشئ: `archive-laravel/app/Http/Controllers/Api/V1/MediaReplicasController.php`
- أنشئ: `archive-laravel/app/Http/Controllers/Api/V1/StoragePolicyController.php`
- عدّل: `archive-laravel/routes/api.php`
- عدّل: `archive-next/lib/archive-api.ts`
- أعد توليد: `archive-next/lib/generated/archive-api.ts`
- اختبر: `archive-laravel/tests/Feature/MediaReplicasApiTest.php`

- [ ] اكتب اختبار API فاشل لقائمة نسخ مادية منقحة، معاينة سياسة، استعادة إدارية،
  ومنع غير الإداري.
- [ ] شغّل الاختبار؛ المتوقع: 404 أو فشل مخطط الاستجابة.
- [ ] أضف مخططات `MediaReplica`, `StoragePolicy` وطلبات الاستعادة والحذف واختبار
  الموصل إلى OpenAPI، ثم نفذ المسارات التي تعيد حقولًا منقحة فقط.
- [ ] شغّل `pnpm verify:api-contracts` و`pnpm verify:api-generated` واختبارات
  Laravel API؛ المتوقع: نجاح.
- [ ] ثبّت: `git commit -m "feat(api): expose safe media replica operations"`.

### المهمة 7: واجهات السجل والاستوديو والإدارة

**الملفات:**
- عدّل: `archive-next/app/archive/[id]/MediaRepresentationsPanel.tsx`
- عدّل: `archive-next/app/archive/[id]/MediaRepresentationsPanel.test.tsx`
- أنشئ: `archive-next/app/settings/storage/page.tsx`
- أنشئ: `archive-next/app/settings/storage/page.test.tsx`
- عدّل: `archive-next/app/media/studio/page.tsx`
- عدّل: قاموسَي `archive-next/lib/i18n/dictionaries/{ar,en}/`

- [ ] اكتب اختبارات Vitest فاشلة تعرض السيادة والحالة ووقت التحقق، وتخفي زر
  استعادة غير متاح، وتعرض رسالة عربية صادقة للموصل بلا قدرة.
- [ ] شغّل: `pnpm --filter @archive/next test -- MediaRepresentationsPanel`.
- [ ] نفذ لوحات النسخ والسياسة ومركز العمليات باستخدام العميل المولّد، مع حالات
  تحميل وفشل وفراغ ولمس 44px على الهاتف؛ لا تعرض مسارًا أو سرًا.
- [ ] شغّل اختبارات المكونات و`pnpm typecheck`؛ المتوقع: نجاح.
- [ ] ثبّت: `git commit -m "feat(ui): manage preservation replicas and policy"`.

### المهمة 8: القبول الحي ووثائق التشغيل

**الملفات:**
- أنشئ: `archive-next/e2e/v2-preservation-replicas.authed.spec.ts`
- عدّل: `docs/operations-runbook.ar.md`
- عدّل: `docs/restore-plan.ar.md`
- عدّل: `TASKS.md`

- [ ] اكتب اختبار Playwright فاشلًا لمادة محلية، نسخة احتياطية مزيفة، نسخة
  مفقودة، واستعادة مدققة، عند 1280 و375.
- [ ] شغّل: `pnpm verify:laravel-next:live`؛ المتوقع: فشل حتى تتكامل الواجهة.
- [ ] أضف سيناريو تشغيل RPO وتمرين RTO وخطوات تدوير الموصل واستعادة نسخة؛ حدّث
  المهمة بدليل الأمر والنتيجة فقط بعد نجاح القبول.
- [ ] أعد تشغيل `pnpm verify`, `pnpm verify:laravel-next:live`, و`pnpm release:verify`.
- [ ] ثبّت: `git commit -m "test(release): accept v2 preservation replicas"`.

## تعريف الإنجاز

لا تعد V2-MEDIA-002 مكتملة قبل تحقق جميع الآتي: تمثيل حفظ وMezzanine فعليان
لملف فيديو حقيقي؛ نسخة مادية محلية متحققة؛ نسخة خارجية متحققة عند تفعيل موصل
مدعوم؛ سياسة `local_primary` و`external_primary` مفهومة ومفروضة؛ الاستعادة
والحذف المحكوم والتعليق القانوني مدققة؛ الواجهة العربية تعمل عند 1280 و768 و375
من دون أسرار؛ و`pnpm verify` و`pnpm verify:laravel-next:live` و`pnpm release:verify`
تنجح على SHA نفسه.
