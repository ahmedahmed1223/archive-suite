# ملكية الكتابات وتدقيق التعاون

## الهدف

إغلاق V1-788 وV1-789 بسياسة أقل صلاحية واضحة وقابلة للاختبار: تقييد كتابة الحقوق، حماية الملاحظات الخاصة بملكية المؤلف، واستكمال تدقيق تغييرات التعاون المهمة دون تسجيل heartbeat أو محتوى المستندات.

## قرارات الصلاحيات

### الحقوق

- تبقى `GET /rights` و`GET /rights/expiring` و`GET /rights/{itemId}/enforcement` متاحة لكل مستخدم مصادق.
- يصبح `POST /rights` متاحاً للمحرر والمدير فقط عبر `requireEditor()`.
- لا تُستحدث ملكية فردية لسجل الحقوق؛ هو توصيف مؤسسي مشترك.

### ملاحظات السجل

- تبقى قراءة الملاحظات وإنشاؤها متاحة لكل مستخدم مصادق؛ الإنشاء يثبت `author_id` من جلسة الخادم ولا يقبل هوية من payload.
- التعديل والحذف متاحان للمؤلف نفسه أو المدير.
- طلب مستخدم آخر يعيد 404 `not_found` بدلاً من 403 حتى لا يكشف وجود ملاحظة خاصة أو معرّفها.
- المدير يستطيع إدارة ملاحظة أي مستخدم لأغراض الإشراف والدعم. المحرر لا يتجاوز الملكية لمجرد دوره.
- الملاحظات القديمة التي لا تحمل `author_id` لا يعدلها أو يحذفها إلا المدير؛ لا تُنسب تلقائياً إلى أول مستخدم يلمسها.

### جرد بقية الكتابات

- يبقى `RouteScopeTest::ROLE_FIXTURE` مصدر التوقع لكل route مصادق: `admin` أو`editor` أو`any`.
- تضاف مصفوفة ملكية مستقلة للمسارات التي تعتمد المؤلف، لأن `ROLE_ANY` وحدها لا تصف author/non-author.
- تشمل اختبارات HTTP الفعلية في هذه الدفعة `POST /rights` و`POST/PATCH/DELETE` للملاحظات. لا تعاد كتابة سياسات مجالات أخرى التي لديها بالفعل owner أو editor gates واختبارات متخصصة.
- يوثق ملف نطاق المسارات أن `ROLE_ANY` في إنشاء الملاحظة لا يعني السماح بتعديل مورد مستخدم آخر.

## تدقيق التعاون

### المسارات المدققة

- `POST /collaboration/rooms/{roomKey}/locks`: حدث `collaboration_locks.acquire` أو `collaboration_locks.refresh` حسب النتيجة.
- `POST /collaboration/rooms/{roomKey}/locks/release`: حدث `collaboration_locks.release`.
- `POST /collaboration/rooms/{roomKey}/documents/{resourceId}`: حدث `collaboration_documents.update`.
- تضارب القفل 409 يسجل outcome=`rejected`، ويظل resource id هو المورد المطلوب.

### المسارات غير المدققة

- `GET` لجميع موارد التعاون لأنها قراءات آمنة.
- `POST .../presence` heartbeat لتجنب audit spam؛ يبقى قابلاً للمراقبة عبر presence state والسجلات التشغيلية.

### بنية سجل التدقيق

- `resource_type` يكون `collaboration_lock` أو `collaboration_document`.
- `resource_id` يكون `resourceId`، وتضاف `roomKey` المنقحة إلى metadata.
- للمستند تسجل النسخة المطلوبة والنسخة الناتجة وحجم update بالبايت، ولا يسجل `update` نفسه أو snapshot أو أي محتوى تعاوني.
- للقفل تسجل مدة TTL والعملية (`acquire`/`refresh`/`release`) دون رموز اعتماد.
- redaction العام يبقى خط دفاع إضافياً، لكن الاستبعاد البنيوي للمحتوى يتم قبل بناء audit payload.

## البنية والتنفيذ

- يضاف helper محلي في `RecordNotesController` يفحص `author_id` أو دور admin ويرجع استجابة 404 موحدة عند غياب الملكية.
- يضاف `requireEditor()` في بداية `RightsController::store` قبل validation والكتابة.
- تنقل مسارات locks/documents المتغيرة إلى middleware `archive.audit` أو يطبق عليها middleware منفرداً؛ presence يبقى خارج المجموعة المدققة.
- يوسع `AuditArchiveApiRequest` بتصنيف أحداث التعاون وباني metadata آمن خاص بها. لا تُسجل request payload الخام لمسار تحديث المستند.
- تحدّث `RouteScopeTest` و`docs/scope/v1-route-scope.md` لتعكس editor للحقوق وسياسة ملكية الملاحظات وتدقيق مسارات التعاون.

## TDD والتحقق

- RED ثم GREEN لاختبارات viewer/editor/admin على كتابة الحقوق.
- RED ثم GREEN لإنشاء ملاحظة بواسطة viewer، وتعديل/حذف المؤلف، و404 لغير المؤلف حتى لو كان editor، وسماح المدير، وحماية الملاحظة القديمة بلا مؤلف.
- RED ثم GREEN لأحداث acquire/refresh/release/update وoutcome 409، مع assertion صريح أن body/update/snapshot غير موجودة في metadata المخزنة.
- assertion أن heartbeat لا يزيد عدد audit logs.
- تشغيل اختبارات `RoleMatrixApiTest` و`RecordNotesApiTest` و`Collaboration*` و`AuditLogTest` و`RouteScopeTest`، ثم `pnpm verify` على Node 25.9.0.

## التوثيق والإغلاق

- تزال V1-788 وV1-789 من `TASKS.md` بعد نجاح البوابة ويخفض العدد الأساسي من 46 إلى 44.
- تؤرشف تفاصيل كل ميزة في `ChangeLog.md`، ولكل واحدة commit مستقل بعد commit التصميم.

## خارج النطاق

- تغيير صلاحيات التعليقات العامة أو review comments التي تحمل سياسات مؤلف قائمة ومختبرة.
- تشفير محتوى collaboration documents أو تغيير بروتوكول CRDT.
- تدقيق heartbeat أو القراءات الآمنة.
- إضافة أدوار جديدة أو ACL على مستوى الحقل.
