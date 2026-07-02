# تصور إعادة تصميم واجهات مسار

## الهدف

أثناء النقل إلى Laravel + Next.js ظهرت صفحات حديثة لكنها أبسط من الواجهة القديمة. الهدف من هذه الوثيقة هو اعتماد تصور كامل يعيد قدرات الواجهة القديمة داخل تجربة Next الحالية، لكن بلغة تصميم Masar الموحدة، وبكثافة تشغيلية مناسبة لنظام أرشيف ووسائط حقيقي.

القرار المعتمد: لا نعيد بناء Vite SPA القديمة، ولا ننقلها كما هي. نستخرج وظائفها، ونبنيها كصفحات ومكونات Next مرتبطة بعقد Laravel API، مع واجهة عربية RTL، تصميم مؤسسي دافئ، وأدوات تشغيل واضحة.

## مبادئ المنتج

1. شاشة التشغيل قبل التجميل: كل صفحة تبدأ بالعمل الأساسي للمستخدم، لا hero تسويقي ولا بطاقات تعريفية كبيرة.
2. تكافؤ قبل الإضافة: كل ميزة كانت موجودة في الواجهة القديمة إما تنقل، أو توثق كقرار عدم نقل، أو تؤجل مع سبب واضح.
3. صفحات كثيفة ومنظمة: أدوات البحث، الفلاتر، الجداول، المعاينة، والإجراءات الجماعية تبقى ظاهرة وقابلة للمسح السريع.
4. تصميم واحد لا جزر منفصلة: كل الصفحات تستخدم نفس shell، نفس tokens، نفس أزرار الأوامر، نفس حالات loading/error/empty.
5. التشغيل عبر API فقط: لا تخزين متشعب جديد في الواجهة إلا للـ preferences الخفيفة مثل pinned views أو last layout، أما البيانات التشغيلية فتعود إلى Laravel.

## خريطة القدرات القديمة التي يجب استعادتها

### مصفوفة الصفحات القديمة

هذه المصفوفة هي مرجع التكافؤ: لا تعتبر أي صفحة legacy منسية. كل صفحة إما لها مسار Next قائم، أو هدف نقل واضح، أو دمج مقصود داخل صفحة تشغيلية أكبر.

| صفحة legacy | هدف Masar/Next | الحالة المخططة |
|---|---|---|
| `DashboardPage` | `/` | تحويلها إلى لوحة تشغيل حية بدل ملخص تقني. |
| `ArchivePage` | `/archive` | استعادة أوضاع العرض، الفلاتر، bulk، saved views، details rail. |
| `DetailPage` | `/archive/[id]` | تبويبات السجل: overview، media، metadata، rights، relations، activity، files. |
| `AddVideoPage` | `/archive/new` و`/files/upload` | يحتاج upload/record-create UX فوق Laravel. |
| `UploaderPage` | `/files/upload` | دمجه مع File Manager وingest flows. |
| `FileManagerPage` | `/files` | موجود جزئياً؛ يحتاج tree/breadcrumbs/preview/attach/import. |
| `SearchPage` | `/search` | موجود؛ يحتاج facets، saved searches، preview، history، voice search. |
| `SavedSearchesPage` | `/search/saved` أو tab داخل `/search` | نقل saved searches كجزء من البحث. |
| `TimelinePage` | `/timeline` | موجود؛ يحتاج filters وتفاصيل مختصرة وتفاعل مع السجلات. |
| `FavoritesPage` | `/favorites` | موجود؛ يحتاج أن يصبح قائمة عمل مرتبطة بالسجلات لا local فقط. |
| `CollectionsPage` | `/collections` | يحتاج backend collections ثم UI يدوي وsmart rules. |
| `ReadingListsPage` | `/reading-lists` | قائمة تنظيمية فوق السجلات، يمكن دمجها مع collections لاحقاً. |
| `InboxPage` | `/inbox` | مدخل التقاط وفرز سريع قبل الأرشفة. |
| `DuplicatesPage` | `/duplicates` | كشف hash/metadata/visual duplicates مع إجراءات merge/ignore. |
| `TypesPage` | `/types` | موجود؛ يتحول إلى schema studio كامل. |
| `VocabularyPage` | `/vocabulary` أو tab تنظيم | مفردات مضبوطة للحقول والبحث. |
| `HierarchicalTagsPage` | `/tags` أو tab تنظيم | وسوم هرمية مع drag/reparent وcounts. |
| `GraphViewPage` | `/graph` أو tab داخل التفاصيل | رسم علاقات السجلات والمجموعات. |
| `KanbanPage` | `/kanban` | عرض workflow للسجلات حسب الحالة. |
| `ProjectsPage` | `/projects` | مشاريع إنتاج/مونتاج عند طلب فعلي، مرتبطة بالوسائط. |
| `ProductionTasksPage` | `/production` | مهام إنتاج مرتبطة بالمشاريع والوسائط. |
| `TranscriberPage` | `/media/transcription` | واجهة تفريغ ومراجعة مخرجات whisper/jobs. |
| `AnalyticsPage` | `/analytics` | موجود؛ يحتاج metrics حية وتصفية حسب النوع والفترة. |
| `ReportsPage` | `/reports` | موجود؛ يحتاج export وcompliance reports. |
| `ActivityPage` | `/activity` | يعتمد audit log؛ يظهر النشاط وundo عند توفره. |
| `HistoryPage` | `/activity/history` أو tab داخل التفاصيل | تاريخ التغييرات لكل سجل. |
| `ErrorLogPage` | `/errors` | موجود؛ يندمج مع Sentry/client errors/server logs. |
| `ServerStatusPage` | `/status` | موجود؛ صحة API/DB/queues/Reverb/Sentry. |
| `SyncLogPage` | `/status/sync` | سجل مزامنة ضمن Observability. |
| `SystemControlPage` | `/settings/system` وControl Center خارجي | أوامر تشغيل/إيقاف/تحقق آمنة، لا داخل UI العام إلا read-only. |
| `DataCenterPage` | `/settings/data` و`/status` | مصادر البيانات، ODBC، التخزين، وحالة الاتصال. |
| `SettingsHubPage` | `/settings` | موجود؛ يصبح hub متعدد الأقسام. |
| `SettingsPage` | `/settings` | دمج كامل داخل hub. |
| `AppearanceSettingsPage` | `/settings/appearance` أو قسم داخل `/settings` | themes، density، language، layout preferences. |
| `UsersPage` | `/users` أو `/settings/users` | إدارة مستخدمين وأدوار ودعوات بعد backend. |
| `SharedLinksPage` | `/shares` | موجود؛ يحتاج backend دائم وروابط منتهية/نشطة. |
| `SharedWithMePage` | `/shares/with-me` | مشاركات واردة للمستخدم. |
| `HelpPage` | `/help` | موجود؛ يحتاج onboarding وfeature tour. |
| `FirstRunPage` | `/help/getting-started` وsetup checklist | لا تعود كمعالج طويل؛ تتحول إلى checklist قابلة للتجاهل. |
| `AutomationPage` | `/automation` | Visual Rules Engine عند تفعيل rules backend. |
| `DiscoverPage` | `/discover` أو قسم توصيات في `/search` | توصيات واكتشاف فجوات وتحسينات. |

### الأرشيف

- أوضاع عرض متعددة: grid، gallery، compact، list، details/table.
- حجم العناصر: xs، compact، comfortable، large، xl.
- صفوف وأعمدة grid قابلة للتخصيص.
- فلاتر النوع، النوع الفرعي، حالة workflow، المحذوفات، المفضلة، فجوات الوصف.
- بحث عربي مطبع داخل العنوان، المسار، الملاحظات، tags، metadata.
- ترتيب حسب العنوان، تاريخ الإنشاء، تاريخ التحديث، واتجاه asc/desc.
- عروض محفوظة Saved Views.
- حفظ حالة الصفحة في URL.
- تحديد جماعي وإجراءات bulk.
- ترتيب يدوي بالسحب عندما يكون الفرز الافتراضي نشطا.
- شريط إضافة سريع وساحر استيراد ملفات.
- لوحة تعديل جانبية سريعة.
- معاينة تفصيلية وسياق يمين أو يسار حسب حجم الشاشة.

### التفاصيل والسجل الواحد

- معاينة وسائط متقدمة مع waveform وsubtitles وtimecode.
- حقوق ومشاركة وتعليقات وعلاقات بين السجلات.
- تاريخ تغييرات، نشاط، undo حيث يسمح العقد.
- تحرير metadata حسب نوع المحتوى.
- مرفقات وملفات مرتبطة.

### الصفحات التشغيلية

- Dashboard عملي يعرض مؤشرات حية، لا صفحة ترحيبية.
- File Manager مع browse، stream، import، وربط ملف بسجل.
- Search متقدم مع facets، history، saved searches، voice search عند توفره.
- Timeline يعرض مجموعات زمنية مع فلاتر وتفاصيل مختصرة.
- Favorites كقائمة عمل لا مجرد local favorites.
- Types/Vocabulary/Tags لإدارة schema والتصنيفات بشكل آمن.
- Collections وReading Lists وInbox وDuplicates وKanban.
- Activity/History/Error Log/Status كمنطقة مراقبة واحدة.
- Settings Hub منظم حسب المجالات: الهوية، الأمان، البيانات، التخزين، التكامل، المظهر، المراقبة.

## الهيكل المعلوماتي المقترح

### الشريط العلوي

- شعار Masar.
- بحث عام مختصر، يفتح صفحة Search بنتائج كاملة.
- أزرار سريعة: إضافة، استيراد، رفع، مشاركة.
- مؤشر صحة النظام وسجل الأخطاء عند وجود مشاكل.
- قائمة المستخدم والإعدادات.

### التنقل الرئيسي

المجموعات المقترحة:

- تشغيل: الرئيسية، الأرشيف، الملفات، البحث، الخط الزمني.
- إنتاج ومراجعة: الوسائط، المراجعة، المقارنة، التعاون.
- تنظيم: الأنواع، الوسوم، المفردات، المجموعات، المفضلة.
- مراقبة: التحليلات، التقارير، الحالة، الأخطاء، النشاط.
- إدارة: المستخدمون، الإعدادات، التكاملات.

على desktop يظهر كتقسيم واضح في header أو side rail مضغوط. على mobile يتحول إلى drawer مع بحث وأوامر سريعة.

## مواصفات الصفحات

### الرئيسية

تتحول من ملخص تقني إلى Control Dashboard:

- KPIs: عدد السجلات، ملفات غير مفهرسة، مهام وسائط جارية، روابط مشاركة نشطة، أخطاء آخر 24 ساعة.
- قائمة "يحتاج انتباه": حقوق منتهية، jobs فاشلة، سجلات بلا وصف، ملفات بلا سجل.
- آخر نشاط مع اختصارات undo أو فتح التفاصيل.
- اختصارات تشغيل: استيراد ملف، فحص مجلد، إنشاء نوع، فتح سجل الأخطاء.

### الأرشيف

هذه هي الصفحة الأهم ويجب أن تستعيد وزن الواجهة القديمة:

- Toolbar ثابت: بحث، فلاتر، view mode، item size، sort، saved views، reset.
- Results area قابلة للتبديل بين grid/gallery/compact/list/details.
- Details rail اختياري يعرض معاينة السجل المحدد دون مغادرة الصفحة.
- Bulk command bar عند تحديد عناصر.
- Empty states ذكية حسب الفلتر.
- URL state لكل الفلاتر المهمة.
- حفظ تفضيلات layout في Settings أو local preference مؤقتة.

### تفاصيل السجل

- Header مصغر يحتوي العنوان، النوع، الحالة، المفضلة، مشاركة، تحرير.
- Tabs: Overview، Media، Metadata، Rights، Relations، Activity، Files.
- Media tab يستخدم MediaPlayer الحالي مع subtitles وmarkers وروابط للمراجعة.
- Metadata tab يبنى من schema النوع، لا form ثابت.
- Activity tab يعتمد audit log عند توفر endpoint مناسب.

### الملفات

- File browser بكثافة عالية: tree أو breadcrumbs، جدول ملفات، معاينة.
- أوامر: stream/play، create record، attach to record، scan folder، ingest selected.
- دعم range/media موجود، لكن يحتاج ربط UX كامل.

### البحث

- بحث عام موحد فوق records/files/tags عند اكتمال backend.
- Facets: type، status، date، rights، media kind.
- Saved searches، recent searches، share search.
- عرض النتائج في list/details مع quick preview.

### الأنواع والمفردات والوسوم

- Types page تصبح schema studio:
  - قائمة أنواع يمين أو يسار.
  - محرر حقول مركزي.
  - preview لشكل metadata.
  - validation واضح قبل الحفظ.
- Vocabulary وHierarchical Tags تنقلان كصفحات تنظيم منفصلة أو كـ tabs داخل Organize.
- يمنع التداخل بين "نوع المحتوى" و"وسم" و"مفردة" بصرياً ولغوياً.

### الإعدادات

- Settings Hub بتقسيم ثابت:
  - هوية النظام.
  - الأمان والجلسات.
  - قواعد البيانات وODBC.
  - التخزين والملفات.
  - الوسائط والتفريغ.
  - التكاملات وWebhooks وAPI keys.
  - المظهر واللغة.
  - المراقبة وSentry.
- كل قسم يستخدم نفس pattern: summary، status، editable controls، danger zone عند الحاجة.

### الأخطاء والحالة والنشاط

- دمج منطقي في Observability:
  - Status: صحة الخدمات.
  - Errors: أخطاء client وserver عند توفر Sentry أو logs API.
  - Activity: audit events.
- لا تكرر بطاقات متشابهة في ثلاث صفحات.
- كل حدث يملك action: فتح السجل، نسخ التفاصيل، تعليم كمحلول، إرسال تقرير.

### الوسائط والمراجعة

- Media Jobs: queue board مع filters حسب status/operation.
- Media Review: player، comments، annotations، resolved/unresolved.
- Compare: side-by-side مع sync controls.
- Play: player عام مع metadata rail.

## نظام المكونات

يجب استخراج مكونات مشتركة قبل تكبير الصفحات:

- `AppShell`: header، nav، content frame، responsive drawer.
- `PageToolbar`: title، search، filters، primary action، secondary actions.
- `DataViewSwitcher`: grid/list/table/gallery/details.
- `FilterBar`: chips، reset، saved views.
- `BulkActionBar`.
- `RecordPreviewRail`.
- `StatusBanner`.
- `EmptyState`.
- `ConfirmActionDialog`.
- `FormFieldRenderer` للحقول المبنية من schema.
- `SettingsSection`.

كل هذه المكونات تستخدم tokens من `theme.css` فقط. لا ألوان hardcoded، ولا cards داخل cards، ولا decorative backgrounds.

## خطة التنفيذ على دفعات

### الدفعة 1: أساس التصميم والتكافؤ

- بناء `AppShell` و`PageToolbar` و`DataViewSwitcher`.
- ترقية `/archive` إلى toolbar كامل وأوضاع عرض متعددة.
- إضافة URL state للفلاتر والأوضاع.
- ربط saved views مبدئياً بتخزين تفضيلات آمن.

### الدفعة 2: الأرشيف والتفاصيل

- Details rail في `/archive`.
- Bulk actions فوق endpoints الموجودة أو endpoints جديدة إذا لزم.
- إعادة بناء `/archive/[id]` بتبويبات Overview/Media/Metadata/Rights/Relations/Activity.
- استرجاع favorite/share/rights داخل flow واحد.

### الدفعة 3: التنظيم

- تحويل `/types` إلى schema studio.
- إضافة Vocabulary وHierarchical Tags أو دمجهما تحت Organize.
- تحسين `/favorites` و`/collections` عندما يكتمل backend.

### الدفعة 4: التشغيل والمراقبة

- تحويل `/` إلى dashboard حي.
- إعادة بناء `/errors`, `/status`, `/reports`, `/analytics` كنظام مراقبة واحد.
- إضافة Sentry status/config داخل settings والمراقبة.

### الدفعة 5: الملفات والوسائط

- File browser متقدم.
- Ingest flows.
- Media jobs board.
- تحسين review/compare/play بصرياً ووظيفياً.

## تقسيم وكلاء مقترح

- وكيل الأرشيف: `/archive`, `/archive/[id]`, record components.
- وكيل shell/design system: `AppShell`, `theme.css`, shared components.
- وكيل التنظيم: `/types`, vocabulary, tags, schema renderer.
- وكيل المراقبة: `/`, `/errors`, `/status`, `/analytics`, `/reports`.
- وكيل الملفات والوسائط: `/files`, `/media/*`.
- الوكيل الرئيسي يراجع، يدمج بعد كل دفعة، ويمنع تضارب tokens أو patterns.

## معايير القبول

- كل صفحة Next لها مقابل واضح في خريطة القدرات: منقول، مستبدل، أو مؤجل بسبب backend.
- `pnpm run typecheck:next` و`pnpm run build:next` يمران بعد كل دفعة.
- smoke بصري على desktop/mobile للصفحات الأساسية.
- لا overflow في header أو toolbars على mobile.
- لا تظهر صفحات "بسيطة مؤقتة" للمستخدم النهائي إلا خلف feature flag أو مذكورة بوضوح كـ pending backend.
- لا ازدواجية تصميمية: نفس buttons، badges، panels، empty states، filters، dialogs في كل الصفحات.
