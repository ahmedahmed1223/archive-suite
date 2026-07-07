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
- نقل parity الأساسي من النظام القديم منجز للصفحات التشغيلية الرئيسية.
- المتبقي أدناه هو فجوات منتج متقدمة، تخزين دائم لكيانات محلية، أو تحقق خارجي على بيئات حية.

## P1 — فجوات إنتاجية عالية

- [ ] **Activity/history دائم مع undo/diffs** — تحويل `/activity` من سطح مركب/محلي إلى API دائم فوق audit log، وإضافة diff/restore decisions في `/archive/[id]`.
  - القبول: سجل نشاط مصادق، قابل للتصفية، يعرض تغييرات السجلات وتعليقات الفريق ويتيح قرار استعادة آمن حيث ينطبق.
  - الحالة: نُفذ endpoint `/api/v1/activity` العام، ووُصلت صفحة `/activity` به، وأضيفت diff/restore metadata في `/archive/[id]`. المتبقي قبل الإغلاق: تشغيل بوابة Laravel داخل Docker عند توفر صلاحية/رصيد Docker في البيئة.

- [ ] **تخزين Laravel دائم للكيانات المحلية** — نقل Collections، Inbox، Vocabulary، Tags hierarchy، Saved views، Workflow presets، Dashboard widgets، وAutomation drafts من التخزين المحلي إلى Laravel.
  - القبول: لا تضيع هذه الكيانات بعد تبديل المتصفح/الجهاز، وتظهر في API بعقود واختبارات.
  - الحالة: **Collections**، **Inbox**، **Vocabulary**، و**Tags hierarchy** منجزة وموثّقة في `ChangeLog.md` (قسم 2026-07-07، شرائح 1–4). أما بقية الكيانات المذكورة فلا تحتاج نقلاً: **Saved views** مخزّنة سلفاً عبر `/saved-searches`، و**Automation drafts** عبر `/automation/rules`، بينما **Workflow presets** و**Dashboard widgets** غير موجودة كسطح localStorage. البند يبقى مفتوحاً فقط حتى تُشغَّل بوابة Laravel/PHPUnit داخل Docker.

- [ ] **Search/archive power features** — إضافة backend facets، saved views persistence، details rail أعمق، وinline relation add/edit داخل صفحة التفاصيل.
  - القبول: فلاتر search/archive محفوظة ومسنودة من Laravel، والعلاقات يمكن إنشاؤها/تعديلها من التفاصيل بدون مغادرة السياق.
  - الحالة: نُفذت فلاتر `/search` وfacets، وربطت بحوث `/search` وعروض `/archive` المحفوظة بـ `/saved-searches`، وأضيف `PATCH /relations/{id}` ومحرر علاقات داخل `/archive/[id]`. المتبقي قبل الإغلاق: تشغيل بوابة Laravel داخل Docker عند توفر صلاحية/رصيد Docker في البيئة.

- [ ] **Automation backend** — تنفيذ rules engine فعلي، execution log، permissions، وجدولة/تشغيل آمن بدلاً من dry-run المحلي فقط.
  - القبول: القواعد تُحفظ في Laravel، تُنفذ بإذن واضح، وتملك سجل تشغيل قابل للمراجعة.
  - الحالة: نُفذت جداول `automation_rules` و`automation_rule_runs`، ومسارات CRUD + dry-run/run، وربطت صفحة `/automation` بـ Laravel مع سجل تشغيل. المتبقي قبل الإغلاق: تشغيل بوابة Laravel داخل Docker عند توفر صلاحية/رصيد Docker في البيئة.

- [ ] **تفريغ عربي إنتاجي على GPU** — التحقق الحي من `faster-whisper-large-v3` على GPU وصوت عربي حقيقي للوصول إلى دقة لا تقل عن 90%.
  - المنجز برمجياً: إعدادات GPU، large-v3، SRT/VTT/TTML، وdiarization flag.
  - القبول: تقرير smoke حي يتضمن عينة عربية، الجهاز المستخدم، المقاييس، ومخرجات SRT/VTT/TTML.

## P2 — تكافؤ متقدم وتجربة تشغيل

- [ ] **Settings/Admin extras** — استكمال appearance editor/presets، file-store tests، Dropbox OAuth، preset setup، DB tests، وربط data-center/settings hub بعمق.

- [ ] **Appearance/theme management** — presets، custom theme export/import، وجدولة theme إذا بقيت مطلوبة.

- [ ] **Advanced tags and vocabulary** — ترتيب شجرة الوسوم، ألوان، merge، عمليات hierarchy، ومخزن Laravel للقاموس والمرادفات.

- [ ] **Field ACL في الأنواع** — قواعد رؤية/تحرير لكل حقل داخل `/types` وعقود Laravel المقابلة.

- [ ] **Notifications center** — إشعارات تشغيل دائمة، وربط اختياري مع Email/Push/Slack/Teams لاحقاً.

- [ ] **Offline/degraded mode** — connectivity probe، offline queue، banners للحالة المتدهورة، وخطة reconciliation.

- [ ] **Shortcuts customization** — تعلم/تخصيص اختصارات لوحة الأوامر وحفظ التفضيلات.

- [ ] **Focus/contextual guide** — focus mode فقط إذا بقيت حاجة تشغيلية، وجولة/نصائح سياقية من help.

- [ ] **Montage advanced editor** — multi-track، markers/comments، transitions، persistent projects، وتوسيع async MP4 export الحالي.

- [ ] **Backup hardening** — checksum، encryption، retention policies، وDR drill دوري قابل للتدقيق.

- [ ] **Kubernetes live validation** — تشغيل dry-run/تطبيق حي عند توفر Kubernetes context، خصوصاً Redis/Whisper worker وGPU.

- [ ] **ODBC live smoke** — تحقق Windows ODBC فعلي، ومعاملات/دفعات متعددة الصفوف إذا احتاجها التشغيل.

- [ ] **Sentry live validation** — تجربة DSN حي، release tagging، source maps، وPII settings في بيئة staging.

## P3 — توسعات تنافسية

- [ ] **AI/Copilot** — صفحة `/copilot` أو سطح مساعد داخل البحث/التفاصيل مع provider gating آمن عند غياب المفاتيح.

- [ ] **Auto-tagging + semantic search v2** — vision tagging، embeddings، named entities، visual duplicate detection، وfaceted semantic search.

- [ ] **Suggestions engine** — اقتراحات تحسين على discover/search/detail مع feedback hooks.

- [ ] **Public catalog gateway** — بوابة كتالوج عامة بضوابط نشر ومراجعة.

- [ ] **Plugin marketplace** — بنية إضافات آمنة ومراجعة صلاحيات.

- [ ] **Live broadcast simulation** — محاكاة بث حي/غرفة مراجعة تشغيلية.

- [ ] **Compliance reports engine** — تقارير امتثال قابلة للتخصيص والتصدير.

- [ ] **Geotagging** — خرائط/GPS وربط مكاني بالسجلات.

- [ ] **Media derivatives tree** — شجرة اشتقاق الوسائط والتحويلات.

- [ ] **M365/Google Workspace + SSO** — تكامل مستندات/مجلدات وهوية مؤسسية.

## صيانة التوثيق

- [ ] عند إغلاق أي بند أعلاه، انقل موجزه إلى `ChangeLog.md` واحذف تفاصيله من هنا أو غيّر حالته إلى بند أصغر متبقٍ.
- [ ] إذا عادت ملفات خطة فرعية، يجب دمجها في هذا الملف قبل الدمج إلى `master`.
