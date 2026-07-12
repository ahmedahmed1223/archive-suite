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

- [ ] **عقد رموز أخطاء ثابتة (error codes) بين Laravel والواجهة** — حالياً تُعيد المتحكمات `$e->getMessage()` الخام كـ`error`، و~50 صفحة Next تعرض `response.error` مباشرة. الحل الصحيح: رموز آلية مستقرة (`code`) في مغلف الخطأ لتعرّبها الواجهة بلا كسر فحوص النص الحالية.
- [ ] **إزالة اقتران sentinel-string الهش** — صفحات `data-center` و`status` و`system/control` تحكم حالتها بمطابقة نص خلفي خام (`"Forbidden."`, `"System control actions are disabled."`)؛ أي تغيير صياغة يكسر بوابات الصلاحية بصمت. يجب التحويل إلى رمز حالة/`code`. (مرتبط بالبند أعلاه.)

## خطة الإصدار الأول (V1) — مدمجة من `docs/superpowers/specs/2026-07-12-v1-agent-execution-plan.md`

> القرار الحالي **NO-GO** حتى إغلاق مانعات P0. التسلسل الإلزامي: `W0 → W1 → W2 → RC → GA` (UX/CI بالتوازي بعد W0). التفاصيل الكاملة لكل بند في ملف الخطة والتقرير `2026-07-12-v1-release-readiness-report.md`.

### الموجة 0 — خط الأساس
- [x] **V1-000 مراجعة cutover** — حذف الإرث (1700 ملف) وcommit نظيف. (منجز 2026-07-12)
- [ ] **V1-001 قفل النطاق** — تصنيف كل route (V1/admin/experimental/hidden) + feature flags آمنة.
- [ ] **V1-002 versioning/legal** — اسم + ترخيص + SemVer + support window + `1.0.0-rc.1`. (لا يوجد `LICENSE` جذري بعد.)
- [ ] **V1-003 reproducibility** — clean install + حفظ نسخ Node/pnpm/PHP/Composer وbaseline. (جزئياً: ext-ftp runtime عبر `verify-laravel-runtime.mjs`.)
- [x] **V1-004 canonical deployment truth** — توحيد Setup/Control Center/compose وإزالة PocketBase/deploy-legacy/docker-compose.postgres. (منجز 2026-07-12 بالدمج؛ setup.bat يعمل.)
- [x] **V1-005 platform contract** — `infra/platform/compatibility.v1.json` + schema + `platform-contract.mjs` يستهلكها doctor. (منجز 2026-07-12 بالدمج.)

### الموجة 1 — أمن وبيانات (P0/P1)
- [x] **V1-101** رفض المدير الافتراضي/الضعيف و`ARCHIVE_SECURE_COOKIES=false` في الإنتاج (حارس Seeder + حارس boot، 12 اختباراً، 439 تمر). (منجز 2026-07-12) **(P0 #1)**
- [ ] **V1-102** مصفوفة RBAC + Policies لكل endpoint مع `RoleMatrixApiTest`. **(P0 #4)**
- [ ] **V1-103** قصر refresh cookie على `/auth/refresh` + Origin/CSRF/throttle + تحديث OpenAPI. **(P0 #5)**
- [x] **V1-104** share secrets في body/header لا query + rate limiting فعلي. (منجز 2026-07-12: throttle في 732b7c1، X-Share-Password في 9af5b6c)
- [ ] **V1-111** containment/ownership لـmedia jobs ومنع path traversal/arbitrary reads. **(P0 #2)**
- [ ] **V1-112** upload validation: MIME+magic، UUID، quotas، quarantine/AV.
- [ ] **V1-113** timeouts/backoff/idempotency/cancel للوظائف + تنقية الأخطاء والمسارات.
- [x] **V1-121** backup كامل: كل جداول التطبيق (schema-driven) + ملفات file_root + manifest/checksums لكل ملف. (منجز 2026-07-12 في d8537e2؛ 21 اختبارًا. خارج النطاق موثقًا: pg_dump-level وملفات السحابة.) **(P0 #7)**
- [x] **V1-122** استعادة غير مدمرة (معاملة DB ترجع الحيّة سليمة عند أي فشل) + تحقق checksum قبل الاستعادة (رفض النسخ التالفة 422، توافق خلفي للنسخ بلا sidecar بعلَم `verified:false`). (منجز 2026-07-12؛ 4 اختبارات جديدة، 15 تمر.) **(P0 #3)**
- [ ] **V1-123** retention/pruning للجلسات/audit/jobs/backups + RPO/RTO.

### الموجة 2 — التشغيل والتغليف
- [x] **V1-201 Control Center** — إصلاح رمز legacy المفقود + إزالة الأوامر القديمة + اختبارات. (منجز 2026-07-12؛ 18 اختباراً.) **(كان P0 #6)**
- [ ] **V1-202 production runtime** — استبدال PHP dev server + healthchecks عميقة + worker/Reverb readiness. (جزئياً: صورة Laravel حقيقية بـ ext-ftp.)
- [ ] **V1-203 migration safety** — preflight + prebackup + maintenance/drain + migrate-once + rollback. **(P0 #8)**
- [ ] **V1-204 immutable images** / **V1-205 supply chain (SBOM/checksums/signing)** / **V1-206 offline bundle**. **(P0 #9)**
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
