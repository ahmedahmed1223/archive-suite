# مهام Masar المتبقية

> هذا هو ملف المهام الوحيد المعتمد بعد دمج خطط Laravel/Next وUI وlegacy parity.
> البنود المنتهية انتقلت إلى `ChangeLog.md`. ملفات الخطط والتدقيق الفرعية القديمة حُذفت بعد دمج خلاصتها هنا.

## قواعد التنفيذ

- التطوير الجديد يكون في `archive-next/` و`archive-laravel/`، مع تحديث `archive-core/` فقط عند تغيير عقد مشترك.
- لا تضف ميزات جديدة إلى `archive-app/` أو `archive-server/` إلا لصيانة legacy صريحة.
- نفذ مهمة واحدة أو شريحة مستقلة في كل مرة، ثم شغّل البوابات المناسبة وادمج إلى `master`.
- قبل إغلاق أي مهمة: حدّث هذا الملف، وانقل ملخص الإنجاز إلى `ChangeLog.md`.
- بوابات القبول الافتراضية: `pnpm run typecheck`, `pnpm run build:next`, `pnpm run verify:api-contracts`, `pnpm run verify:repo-hygiene`, `git diff --check`. لمهام Laravel: `pnpm run verify:laravel` عبر Docker.

## الحالة الحالية

- `master` هو المسار المعتمد.
- Laravel + Next.js هما المنتج القانوني.
- UI Masar، الهوية، نظام المكونات، الجداول، النماذج، Kanban، التحليلات، لوحة الأوامر، وdark mode منجزة.
- الهجرة الأساسية للصفحات التشغيلية القانونية منجزة.
- المتبقي أدناه هو توسعات منتج متقدمة أو تحقق خارجي لا يمكن إغلاقه بلا بيئة حية معتمدة.

## P1 — فجوات إنتاجية عالية

- [ ] **تفريغ عربي — تحقق حي فقط (محظور ببيئة GPU وعينة عربية معتمدة)** — التحقق الحي من `faster-whisper-large-v3` على GPU وصوت عربي حقيقي للوصول إلى دقة لا تقل عن 90%.
  - المنجز برمجياً (2026-07-09): اختيار device لكل مهمة (gpu/cpu/auto)، استخراج صوت + تقسيم على الصمت، تقدم لحظي لكل مقطع، إلغاء، واختيار صيغ المخرجات — انظر ChangeLog.
  - المتبقي: تقرير smoke حي يتضمن عينة عربية، الجهاز المستخدم، المقاييس، ومخرجات SRT/VTT/TTML.

## P2 — تكافؤ متقدم وتجربة تشغيل

- [ ] **Settings/Admin extras — بقايا حية فقط (محظور باعتمادات Dropbox/S3/DB الحية)** — Dropbox OAuth الحي واختبار S3/DB على بيئات فعلية. (المنجز 2026-07-09: test-connection endpoints للتخزين وقاعدة البيانات، setup checklist، وربط hub — انظر ChangeLog.)

- [ ] **Kubernetes live validation (محظور بـKubernetes context وصلاحيات النشر)** — تشغيل dry-run/تطبيق حي عند توفر Kubernetes context، خصوصاً Redis/Whisper worker وGPU.

- [ ] **ODBC live smoke (محظور بجهاز Windows وDSN/driver وبيانات اختبار معتمدة)** — تحقق Windows ODBC فعلي، ومعاملات/دفعات متعددة الصفوف إذا احتاجها التشغيل.

- [ ] **Sentry live validation (محظور بـDSN وبيئة staging معتمدة)** — تجربة DSN حي، release tagging، source maps، وPII settings في بيئة staging.

## P3 — توسعات تنافسية

- [ ] **Auto-tagging + semantic search v2** — vision tagging، embeddings، named entities، visual duplicate detection، وfaceted semantic search.

- [ ] **Public catalog gateway** — بوابة كتالوج عامة بضوابط نشر ومراجعة.

- [ ] **Plugin marketplace** — بنية إضافات آمنة ومراجعة صلاحيات.

- [ ] **Live broadcast simulation** — محاكاة بث حي/غرفة مراجعة تشغيلية.

- [ ] **M365/Google Workspace + SSO** — تكامل مستندات/مجلدات وهوية مؤسسية.

## صيانة التوثيق

- [ ] عند إغلاق أي بند أعلاه، انقل موجزه إلى `ChangeLog.md` واحذف تفاصيله من هنا أو غيّر حالته إلى بند أصغر متبقٍ.
- [ ] إذا عادت ملفات خطة فرعية، يجب دمجها في هذا الملف قبل الدمج إلى `master`.
