# مهام Archive Suite — الموجة الجديدة (مستخرجة من تقارير P4)

> **المصدر:** 7 تقارير (HTML) في `D:\archiveaq\Reports\P4`:
> 1. `0987a78dd_ux_plan.html` — خطة UI/UX (6 Sprints، tokens، a11y، أداء، KPIs).
> 2. `80c5247d2_guide_v6_final.html` — خطة UI/UX + تحسين كل صفحة + إعدادات Cloud.
> 3. `a5e1d9774_new_tail.html` — UX للفيديو/الأنواع/المونتاج (23 مقترح).
> 4. `de91ca915_sessions_new.html` — 25 مقترح UX عبر رحلة المستخدم.
> 5. `f45ea5a29_tail.html` — UX لـ 22 صفحة متبقية (70+ مقترح إجمالاً).
> 6. `archive-suite-broadcast-report.html` — تقييم مؤسسي للبث (حقوق، صيغ بث، MOS/NRCS، تفريغ، TCO).
> 7. `archive-suite-dev-roadmap.html` — خارطة طريق 18 شهراً (P0–P5، 57 بند).
>
> **سجل المهام المكتملة سابقاً:** انتقل إلى [`ChangeLog.md`](ChangeLog.md) — الموجات 1–20 (234 بنداً مكتملاً).
>
> **⚠️ قاعدة التنفيذ للوكلاء (إلزامية):** كل بند هنا **مستخرَج من التقارير ولم يُصالَح بالكامل مقابل الكود**. قبل تنفيذ أي بند:
> 1. تحقّق أنه غير مُنفَّذ بالفعل (راجع `ChangeLog.md` + ابحث في الكود) — كثير من «المكوّنات الجاهزة للتفعيل» في التقارير **مُنفّذة فعلاً** في موجات سابقة (مثل `SessionRestoreBanner`، `DraftRecoveryDialog`، `SaveIndicator`، `FocusShell`، `QuickCaptureWidget`، Skeletons). إن وُجد البند منفّذاً، علّمه `[x]` مع ملاحظة «مُنجز مسبقاً» ولا تكرّره.
> 2. اكتب اختبارات أولاً (TDD) عند الإمكان، وحافظ على تغطية ≥80%.
> 3. استخدم design tokens حصراً (لا ألوان ثابتة)، وCSS Logical Properties (RTL).
> 4. مرّر `pnpm verify` قبل اعتبار البند مكتملاً.

## مفتاح الأولويات

| الوسم | المعنى | الأفق الزمني |
|---|---|---|
| `[P0]` | حرج — يحجب الاعتماد الإنتاجي/المؤسسي الآمن | 1–2 أسبوع |
| `[P1]` | عالٍ — مخاطرة أو فجوة وظيفية مهمة | 2–6 أسابيع |
| `[P2]` | متوسط — تحسين جوهري | 1–2 شهر |
| `[P3]` | مستقبلي — توسّع تنافسي اختياري | 3–6 أشهر |

**تقدير الجهد:** ⏱️S (<يوم) · ⏱️M (1–3 أيام) · ⏱️L (أسبوع) · ⏱️XL (أسابيع).

**صيغة كل بند:** `[ ] [أولوية] ⏱️جهد **العنوان** — الوصف.` متبوعاً بـ: الملفات/المكوّنات · معيار القبول · المصدر.

---

## 0. تصفية أولية — بنود التقارير المُرجَّح أنها مُنفّذة (تحقّق ثم علّم)

> هذه بنود وصفتها التقارير بأن «مكوّناتها جاهزة للتفعيل»، وقد رُصدت فعلاً في الكود/الموجات السابقة. مهمة الوكيل: **التحقق فقط** ثم وضع `[x]` أو نقلها لقسمها إن كانت ناقصة.

- [x] `[P1]` ⏱️S **التحقق من تفعيل بنرات/مؤشرات UX الجاهزة** — `SessionRestoreBanner.jsx`, `DraftRecoveryDialog.jsx`, `SaveIndicator.jsx`, `FocusShell.jsx`/`focusMode.js`, `QuickCaptureWidget.jsx`, Skeletons (`SkeletonBlock`/`SkeletonCard`/`va-skeleton`).
  - ✅ تحقق ووُصل (2026-06-21): FocusShell, DraftRecoveryDialog, SaveIndicator, QuickCaptureWidget, Skeletons — كلها موصولة. SessionRestoreBanner وُصلت في DashboardPage مع loadSessionsFromStorage+deleteSession في autosaveSlice.
  - الملفات: `archive-app/src/app/shell/ShellParts.jsx`، `pages/AddVideoPage.jsx`، `pages/InboxPage.jsx`، `pages/ActivityPage.jsx`، `pages/DashboardPage.jsx`.
  - القبول: كل مكوّن إمّا مُفعَّل ومربوط فعلاً (يُعلَّم `[x]`)، أو يُنقَل بنده لقسمه أدناه إن كان ناقصاً.
  - المصدر: sessions_new (F5,F6,F8,F11,F24,F25)، new_tail (F5,F17)، f45ea5a29 (Inbox/Activity skeleton).

- [x] `[P2]` ⏱️S **التحقق من بنود «الأنواع/الاكتمال» ذات الدوال الموجودة** — `analyzeTypeImpact`, `computeCompleteness`, `recentDefaults`, `getFieldsForSelection`, `STATE_META`, `buildMediaReadiness`, `buildProjectDeliveryPackage`, `addTemporalComment`, `buildDiscoverySections`.
  - ✅ مُنجز (2026-06-21 wave-22): كل الدوال معروضة في الواجهة — analyzeTypeImpact+TypeImpactSheet في TypesPage؛ computeCompleteness في ArchiveViews/ArchivePageResults؛ recentDefaults في SideEditPanel+ContextualQuickAddBar؛ getFieldsForSelection في AddVideoPage+DetailPage؛ STATE_META في ArchivePage+AutomationPage؛ buildMediaReadiness+buildProjectDeliveryPackage في ProjectsPage؛ addTemporalComment في ProjectsPage:1375؛ buildDiscoverySections في DiscoverPage.
  - المصدر: new_tail (F1,F4,F6,F10,F15,F17,F18,F21)، sessions_new (F13,F15).

---

## 1. جاهزية البث المؤسسي (Enterprise / Broadcast) — net-new

> أكبر فجوة في تقرير التقييم المؤسسي (الامتثال الحالي 41%). هذه بنود غير موجودة في الكود (تم التحقق: لا `rights`/`MXF`/`embargo`/`MOS`).

- [ ] `[P0]` ⏱️XL **نظام إدارة الحقوق الكامل (Rights/License)** — نموذج بيانات + منطق أعمال + واجهة.
  - يشمل: `rightsHolder`, `licenseType`, نافذة `embargo`، تاريخ انتهاء + **تنبيهات انتهاء**، **منع بث تلقائي** للمواد منتهية/المحظورة، **قيود جغرافية**، تقارير حقوق.
  - الملفات: schema/store جديد في `archive-server/prisma/schema.prisma` + خدمة `archive-server/src/rights/*` + واجهة في `archive-app` (DetailPage + صفحة/تبويب حقوق).
  - القبول: لا يمكن نشر/تصدير مادة منتهية الحقوق دون تجاوز صريح مُسجَّل؛ تقرير «حقوق تنتهي خلال 30 يوماً» يعمل.
  - المصدر: broadcast-report (rights — حرج، «بدونه رفض الاعتماد»)، dev-roadmap (P3-01).

- [ ] `[P0]` ⏱️XL **دعم صيغ البث: MXF / XDCAM / ProRes / DNxHR** — ترميز + demux + استخراج metadata مدمجة.
  - الملفات: `archive-server/src/media/ffmpegPlan.js`/`mediaPlan.js` (إضافة encoders + parsers)، إعدادات FFmpeg.
  - القبول: رفع ملف MXF/XDCAM يُستخرَج منه metadata ويُولَّد proxy؛ التصدير يدعم ProRes/DNxHR.
  - المصدر: broadcast-report (ingest — حرج)، dev-roadmap (P2-04).

- [ ] `[P0]` ⏱️L **خط أنابيب Streaming للملفات الضخمة (50–500GB)** — استبدال `os.tmpdir()` بمعالجة تدفقية.
  - الملفات: مسارات الرفع/المعالجة في `archive-server/src/api/server.js` + خدمة الوسائط.
  - القبول: معالجة ملف 5GB+ دون تحميله كاملاً في الذاكرة/القرص المؤقت؛ مؤشر تقدم streaming.
  - المصدر: broadcast-report (مخاطرة #4)، dev-roadmap (P3-10).

- [ ] `[P1]` ⏱️XL **مخطط PBCore + Dublin Core** — 15 حقل Dublin Core + حقول PBCore + تصدير PBCore XML / DC RDF.
  - الملفات: schema + خدمة تصدير في `archive-server/src/export/*` + ربط بحقول الأنواع.
  - القبول: تصدير مادة كـ PBCore XML صالح + DC RDF؛ مفردات منظمة للإعلام العربي.
  - المصدر: broadcast-report (metadata — حرج)، dev-roadmap (P3-02).

- [ ] `[P1]` ⏱️XL **تفريغ عربي إنتاجي (GPU + faster-whisper-large-v3)** — رفع الدقة من ~70% إلى ≥90%.
  - يشمل: GPU، `large-v3`، **timestamps**، **تمييز المتحدثين (diarization)**، تصدير **SRT/VTT/TTML**.
  - الملفات: `archive-server/src/ai/transcription.js` (موجود client متعدد المزودين + خيار faster-whisper ذاتي الاستضافة — يُبنى فوقه)، deploy للـ GPU.
  - القبول: تفريغ مقابلة عربية بدقة ≥90% مع توقيتات وتصدير SRT.
  - المصدر: broadcast-report (transcription — حرج)، dev-roadmap (P3-03).

- [ ] `[P1]` ⏱️XL **تكامل MOS + NRCS (ENPS/iNEWS)** — جسر لغرفة الأخبار.
  - الملفات: `archive-server/src/integrations/mos/*` + REST bridge.
  - القبول: محرر في ENPS/iNEWS يبحث الأرشيف ويسحب مادة عبر MOS؛ يمكن تأجيله للمرحلة الثانية مع واجهة ويب + تنزيل يدوي مؤقتاً.
  - المصدر: broadcast-report (integration — حرج لكن قابل للتأجيل)، dev-roadmap (P3-04).

- [ ] `[P1]` ⏱️L **سياسة احتفاظ + حذف آمن + سلسلة عهدة** — retention تلقائية + حذف DoD 5220.22-M + تقارير امتثال.
  - الملفات: `archive-server/src/retention/*`، ربط بـ ActivityLog الموجود.
  - القبول: سياسة احتفاظ قابلة للتهيئة تعمل؛ حذف آمن يُسجَّل في سلسلة العهدة.
  - المصدر: broadcast-report (compliance)، dev-roadmap (P3-06).

- [ ] `[P1]` ⏱️XL **نسخ احتياطي مؤسسي** — replication عبر المناطق + off-site + failover تلقائي + اختبار DR آلي.
  - الملفات: `archive-server/src/backup/*` + S3 cross-region.
  - القبول: استعادة من نسخة off-site تنجح في اختبار DR مجدول.
  - المصدر: broadcast-report (DR)، dev-roadmap (P3-09).

- [ ] `[P2]` ⏱️L **Watch Folder + ابتلاع FTP/SMB** — التقاط تلقائي للملفات الواردة + checksum عند الابتلاع.
  - الملفات: `archive-server/src/ingest/*`.
  - القبول: إسقاط ملف في مجلد مراقَب يُنشئ مادة تلقائياً مع proxy + checksum.
  - المصدر: broadcast-report (ingest)، dev-roadmap (new-feature #5 Smart Ingest).

- [ ] `[P2]` ⏱️M **مفردات إعلامية عربية منظمة + تقويم هجري** — أنواع البرامج/تصنيفات/أدوار + Umm al-Qura (هجري/ميلادي مزدوج).
  - الملفات: `archive-app/src/features/vocabulary/*`، أدوات التاريخ.
  - القبول: عرض تاريخ مزدوج؛ مفردات معتمدة قابلة للاختيار.
  - المصدر: broadcast-report، dev-roadmap (P3-07, P3-08).

---

## 2. الأساس المعماري (Architecture & Foundation) — net-new

- [ ] `[P0]` ⏱️L **ترحيل JWT إلى HttpOnly Cookie + refresh rotation** — استبدال تخزين التوكن في `localStorage`.
  - الملفات: `archive-server/src/auth/*`, `archive-server/src/api/server.js`, عميل الـ frontend.
  - القبول: لا توكن في `localStorage`؛ Cookie بـ `HttpOnly+Secure+SameSite=Strict` + تدوير refresh.
  - المصدر: dev-roadmap (P0-01)، ux_plan (security).
  - **تحقّق:** قد يكون جزءاً من عمل الأمان المكتمل — راجع `ChangeLog.md` §1.

- [x] `[P0]` ⏱️L **إصلاح الوضع الفاتح (Light Mode) — جزئي** — `useTheme` + مراجعة المكوّنات بألوان داكنة ثابتة.
  - ✅ أُصلح الجزء الحرج (2026-06-21): `--va-v1-text/secondary/muted` في `:root` أُعيدت لـ semantic tokens. SessionRestoreBanner أُصلحت.
  - ✅ مُكمَّل (2026-06-21 wave-22): SettingsHubPage.jsx — كل `text-white/border-white/10/bg-white/[0.0X]/text-gray-X` → design tokens. TimelinePage.jsx — stat cards `border-white/10 bg-white/5` → tokens. باقي الملفات (gray-7/8/9 في سياق media/players) مقبولة لأنها تعلو خلفيات ملونة.
  - الملفات: `archive-app/src/**` (المكوّنات ذات الألوان الثابتة)، `design-tokens.css`.
  - القبول: التبديل للوضع الفاتح يعطي تباينات صحيحة في كل الصفحات الرئيسية (لا نص داكن على خلفية داكنة).
  - المصدر: dev-roadmap (P0-03، 53+ ملف).

- [x] `[P0]` ⏱️S **إصلاح مكوّن Switch في RTL + أهداف لمس ≥44px** — `left/right` → `start/end` المنطقي؛ توسيع مناطق اللمس.
  - ✅ مُنجز (2026-06-21): الإبهام يستخدم `end-0.5`/`start-0.5`؛ غلاف `min-h-[44px] min-w-[44px]` يوسّع منطقة اللمس.
  - الملفات: `archive-app/src/components/ui/primitives.jsx`، `BottomNav`.
  - القبول: Switch يتجه صحيحاً في RTL؛ كل هدف لمس ≥44px (WCAG 2.5.5).
  - المصدر: dev-roadmap (P0-04, P0-05).

- [ ] `[P1]` ⏱️XL **i18n: استخراج النصوص + `en.js` + `fr.js`** — رفع التغطية من ~30% إلى ≥95% ودعم 3 لغات.
  - الحالة: `archive-app/src/i18n/locales/ar.js` فقط موجود (تم التحقق). أنشئ `en.js` و`fr.js`، واستخرج السلاسل المُرمّزة في JSX.
  - القبول: تبديل لحظي بين 3 لغات دون إعادة تحميل؛ لا سلاسل عربية مُرمّزة في المكوّنات.
  - المصدر: dev-roadmap (P0-06)، ux_plan (Sprint 3).

- [ ] `[P1]` ⏱️XL **تفكيك `server.js` إلى وحدات** — تقسيم الملف الضخم إلى authRoutes/mediaRoutes/shareRoutes/backupRoutes/adminRoutes (لا ملف >400 سطر).
  - الملفات: `archive-server/src/api/server.js` → `archive-server/src/api/routes/*`.
  - القبول: كل ملف ≤400 سطر؛ `pnpm verify:server` أخضر.
  - المصدر: dev-roadmap (P1-01).

- [ ] `[P1]` ⏱️L **تفكيك `archiveSlice` + إصلاح تسرّب الذاكرة** — استخراج شرائح (itemCrud/collection/project/media/history) + تقليم `workflowHistory`/`itemHistory`.
  - الملفات: `archive-app/src/**/archiveSlice*`.
  - القبول: كل شريحة ≤250 سطر؛ الذاكرة ≤150MB مع 50K عنصر.
  - المصدر: dev-roadmap (P0-08, P1-02).

- [ ] `[P1]` ⏱️XXL **ترحيل تدريجي إلى TypeScript** — frontend + server (الحالة: لا `tsconfig` على مستوى التطبيق — تم التحقق).
  - الترتيب: stores → ports → hooks (frontend)؛ ports → adapters → services → routes (server).
  - القبول: `tsconfig` مع `strictNullChecks`؛ ≥80% ملفات جديدة بـ TS (هدف مرحلي).
  - المصدر: dev-roadmap (P1-04, P1-05, P5-03).

- [ ] `[P1]` ⏱️XL **نظام تصميم موحّد v2** — مكتبة مكوّنات أساسية (Button/Input/Card/Dialog/Badge/Switch/Tabs) تستخدم tokens حصراً + توسيع tokens (status/density/duration/skeleton).
  - الملفات: `archive-app/src/components/ui/*`، `archive-app/src/styles/design-tokens.css`.
  - القبول: صفر ألوان مُرمّزة في المكتبة؛ tokens الجديدة موثّقة ومستخدمة.
  - المصدر: dev-roadmap (P1-06)، ux_plan/guide_v6 (Design Tokens).

- [ ] `[P2]` ⏱️L **إكمال K8s + توحيد Docker Compose** — ملفات compose → ملف واحد بـ profiles؛ إضافة Redis+Whisper لـ K8s + kustomization.
  - الملفات: `archive-server/deploy/*`, `archive-server/*.yml`.
  - المصدر: dev-roadmap (P1-07).

- [ ] `[P2]` ⏱️L **تبسيط متغيّرات البيئة 69→25** — توحيد في تكوين مركزي بقيم افتراضية ذكية.
  - الملفات: `archive-server/src/config/*`, `.env.example`.
  - المصدر: dev-roadmap (P0-10).

- [ ] `[P2]` ⏱️L **توسيع اختبارات E2E + ترقية الحزم الأمنية** — رفع تغطية Playwright + `npm/pnpm audit` للـ CVEs.
  - المصدر: dev-roadmap (P0-09, P1-08, P5-04).

---

## 3. محرّر المونتاج متعدد المسارات (Montage) — net-new كبير

> الحالة: ProjectsPage فيه `roughCuts`/`inSec/outSec`/transitions/looks/filters/EDL+JSON+MP4 لكن **قائمة نصية بلا خط زمني مرئي** (تم التحقق: لا `MultiTrack`).

- [x] `[P0]` ⏱️XL **خط زمني مرئي متعدد المسارات (Multi-Track Timeline)** — تحويل القائمة النصية إلى Canvas أفقي: 3 فيديو + 2 صوت + 1 عنوان، سحب/إفلات بين المسارات، نقاط تقطيع قابلة للسحب.
  - ✅ مُنجز (2026-06-21 wave-25, commit `c5fb487`): `MultiTrackTimeline.jsx` + `TimelineClip.jsx` + `TrackHeader.jsx` بواجهة @dnd-kit (PointerSensor + TouchSensor + KeyboardSensor)؛ مسارات video/audio/title/adjustment ديناميكية مع snap-to-frame، ripple modes، marker overlay، حوار حذف مسار مع نقل القصاصات. ProjectsPage يستخدم `handleTimelineCommand` لإدارة كل عمليات الخط الزمني عبر multiTrackModel. 22 اختبار unit + E2E يغطي إضافة وتسمية مسار فيديو ثانٍ.
  - الملفات: `archive-app/src/components/montage/MultiTrackTimeline.jsx`، `TimelineClip.jsx`، `TrackHeader.jsx`، `multiTrackModel.js`، `pages/ProjectsPage.jsx`.
  - القبول: ترتيب المقاطع بالسحب يعمل ويُحفظ؛ عرض البلوك = مدته.
  - المصدر: new_tail (F13)، dev-roadmap (P2-01).

- [ ] `[P1]` ⏱️L **Clip Thumbnails + طبقة التعليقات الزمنية على الخط الزمني** — خلفية thumbnail لكل block + إشارات ▲ للتعليقات (`addTemporalComment` موجودة).
  - الملفات: `archive-app/src/pages/ProjectsPage.jsx`.
  - القبول: thumbnail يظهر لكل مقطع؛ الضغط على إشارة يعرض التعليق.
  - المصدر: new_tail (F14, F15).

- [ ] `[P1]` ⏱️L **معاينة Look/Transition + Proxy Workflow** — swatches للـ looks + أيقونات متحركة للـ transitions + توليد proxy 480p تلقائياً عند الرفع والتبديل للأصل عند التصدير.
  - الملفات: `archive-app/src/pages/ProjectsPage.jsx`، `archive-server/src/media/*` (buildTranscodeArgs يولّد 480p).
  - المصدر: new_tail (F16)، dev-roadmap (P2-03).

- [ ] `[P2]` ⏱️M **Media Readiness + Export Package Wizard** — عرض `buildMediaReadiness()` قبل التصدير + معالج تصدير من خطوتين (`buildProjectDeliveryPackage()` موجودة).
  - الملفات: `archive-app/src/pages/ProjectsPage.jsx`.
  - المصدر: new_tail (F17, F18).

- [ ] `[P2]` ⏱️L **مشغّل فيديو متقدم في DetailPage** — Frame stepping (`,`/`.`) + Mark In/Out + «أضف لمشروع» مباشرة + Waveform + Transcript Sync.
  - الملفات: `archive-app/src/pages/DetailPage.jsx`، ربط `TranscriberPage`/`createRoughCutValue`.
  - المصدر: new_tail (F19, F20).

- [ ] `[P2]` ⏱️M **علامة مائية + تصدير SRT/VTT/TTML للفيديو** — ffmpeg overlay + ملفات ترجمة مع الفيديو.
  - الملفات: `archive-server/src/media/*`.
  - المصدر: dev-roadmap (P2-05, P2-06).

---

## 4. الأداء وإمكانية الوصول (Performance & a11y) — جزئياً net-new

- [ ] `[P1]` ⏱️L **Virtual Scrolling في ArchivePage** — قوائم +1000 عنصر عبر TanStack Virtual / react-window.
  - الملفات: `archive-app/src/features/archive/*`.
  - القبول: قائمة 5000 عنصر تتمرّر بسلاسة دون تجمّد.
  - المصدر: ux_plan (Sprint 4)، guide_v6 (ArchivePage).

- [x] `[P1]` ⏱️L **Lazy Loading للمكتبات الثقيلة** — Cytoscape, Recharts, pdfjs, xlsx, sql.js عبر dynamic import.
  - ✅ مُنجز (wave-22): تحقّق كامل — كل الصفحات تستخدم React.lazy()؛ Cytoscape/pdfjs/sql.js لها dynamic import مباشر؛ xlsx أُصلح (wave-22) من static import إلى dynamic import حقيقي في vendor/xlsx.js + DataCenterPage + ReportsPage. لا حاجة لمزيد من التغييرات.
  - الملفات: `archive-app/src/pages/{GraphViewPage,AnalyticsPage}.jsx`، نقاط الاستيراد.
  - القبول: لا تُحمَّل المكتبة إلا عند فتح صفحتها؛ قياس بـ rollup-plugin-visualizer.
  - المصدر: ux_plan (perf)، f45ea5a29 (GraphView lazy)، dev-roadmap (P5-01).

- [ ] `[P1]` ⏱️L **تدقيق a11y شامل (WCAG 2.2 AA)** — تشغيل `vitest-axe`/`@axe-core/playwright` على كل صفحة + إصلاح focus/landmarks/labels + مراجعة التباين (4.5:1) في الوضعين.
  - الملفات: `archive-app/src/**`، توسيع `components.a11y.test.jsx`.
  - القبول: Lighthouse Accessibility ≥95؛ صفر مخالفات axe حرجة.
  - المصدر: ux_plan (Sprint 4, a11y)، guide_v6 (KPIs).

- [ ] `[P1]` ⏱️L **مراجعة RTL Logical Properties شاملة** — استبدال `margin/padding-left/right` بـ `*-inline-start/end`؛ `dir="ltr"` للـ URLs/المسارات/التواريخ؛ أيقونات الاتجاه تتبع RTL.
  - الملفات: `archive-app/src/**`.
  - القبول: ESLint rule مخصصة تمنع الخصائص الفيزيائية؛ صفر مخالفات.
  - المصدر: ux_plan (Sprint 3).

- [ ] `[P2]` ⏱️L **PWA: Service Worker + Print Styles + تحديث جولة الإعداد** — Workbox offline-first للأصول + background sync + `@media print` للتقارير.
  - الملفات: `archive-app/` (manifest + SW)، `V1ProductTour`.
  - المصدر: ux_plan/guide_v6 (Sprint 6).

- [ ] `[P2]` ⏱️M **تحسين الصور (srcset + lazy)** — استخدام WebP variants من Sharp (موجودة في الخادم) في الواجهة.
  - الملفات: مكوّنات الوسائط في `archive-app`.
  - المصدر: ux_plan (Sprint 4)، guide_v6 (DetailPage).

---

## 5. إعادة هيكلة الإعدادات والتنقّل — جزئياً net-new

- [x] `[P1]` ⏱️L **تبويب «Cloud Control» موحّد في الإعدادات** — تجميع DatabaseSettings + FileStoreSettings + Health Dashboard في تبويب واحد بمؤشرات حالة حية.
  - ✅ مُنجز (2026-06-21): `CloudControlTab.jsx` جديد يضم HealthDashboard (server/DB/storage status pills) + DatabaseSettings + FileStoreSettings. تبويب "cloud" مضاف في `settingsTabs.js`. LocalModeCard يظهر في الوضع المحلي.
  - الحالة: لا مكوّن `CloudControl` (تم التحقق) — جديد. يُبنى فوق `DatabaseSettings`/`FileStoreSettings` الموجودين.
  - الملفات: `archive-app/src/features/settings/CloudControlTab.jsx` (جديد)، `pages/SettingsPage.jsx`.
  - القبول: في وضع Cloud يعرض حالة DB/Storage/JWT/Redis/CORS حيّة؛ في وضع local يعرض `LocalModeCard`.
  - المصدر: guide_v6 (§3 Cloud Settings).

- [ ] `[P2]` ⏱️M **توحيد SettingsPage/SettingsHubPage + دمج SystemControlPage** — إزالة التكرار وتبسيط التنقّل.
  - الملفات: `archive-app/src/pages/{SettingsPage,SettingsHubPage,SystemControlPage}.jsx`.
  - المصدر: guide_v6 (§3 جدول التحسينات).

- [ ] `[P2]` ⏱️L **إعادة تنظيم Sidebar إلى 7 مجموعات + BottomNav 5 عناصر + Breadcrumbs موحّدة + Command Palette سياقي** — تقليل حمل الـ 45 صفحة.
  - الملفات: `archive-app/src/app/shell/*`, `BottomNav.jsx`, `Breadcrumb.jsx`.
  - المصدر: ux_plan (Sprint 2)، guide_v6 (S2).

- [ ] `[P2]` ⏱️M **لوحة أمان موسّعة** — CSP toggle + CORS field + JWT TTL + Legacy Password Upgrade + Webhook URL allowlist + Rate-limit per-user.
  - الملفات: `archive-app/src/features/settings/*`.
  - المصدر: guide_v6 (§3)، broadcast/ux security.

---

## 6. تحسينات الصفحات والميزات (Per-Page UX) — تحقّق ثم نفّذ net-new

> معظم البنود الصغيرة «الجاهزة» مُنفّذة سابقاً (راجع §0 وChangeLog). أدناه الأبرز net-new أو غير المؤكَّد.

### AddVideoPage / الأنواع
- [x] `[P1]` ⏱️M **AI Auto-fill عند URL/رفع + Step Preview Header + Save & Add Another** — اقتراح العنوان/الوسوم/النوع/التاريخ تلقائياً (`useAiAssist`/`AiAssistBar` موجودان) + عرض عدد حقول النوع قبل الدخول + زر حفظ-وإضافة.
  - ✅ مُنجز (2026-06-21): "حفظ وإضافة آخر" كان موجوداً. Step Preview Header: `stepsWithDetail` memoized يُحدّث تفصيل خطوة الحقول بالعدد الفعلي (مثل «4 حقل (2 مطلوب)»). AiAssistBar موجودة ومفعّلة.
  - الملفات: `archive-app/src/pages/AddVideoPage.jsx`.
  - المصدر: new_tail (F1, F3, F4).
- [x] `[P2]` ⏱️M **Inline Review Edit** — تعديل مباشر لكل حقل في خطوة المراجعة دون العودة للخطوات.
  - ✅ مُنجز (2026-06-21 wave-22): كل بطاقة في خطوة المراجعة في AddVideoPage تحتوي زر «تعديل» يقفز مباشرة للخطوة المناسبة (الأساسيات=0، التصنيف=1، الحقول=2) عبر setStepIndex.
  - المصدر: new_tail (F2).
- [x] `[P1]` ⏱️M **Type Impact Preview + Type Template Gallery** — عرض `analyzeTypeImpact()` قبل الحفظ + قوالب أنواع جاهزة (تقرير/مقابلة/لقطة خام/مادة أرشيفية).
  - ✅ مُنجز (2026-06-21 wave-23): أُضيفت قوالب «تقرير» و«لقطة خام» و«مادة أرشيفية» إلى TYPE_CREATION_TEMPLATES (8 قوالب الآن). TypeEditor — خطوة المراجعة تعرض لوحة «تأثير التعديل» عند تعديل نوع موجود: عدد المواد المتأثرة + الحقول المضافة/المحذوفة + 3 عينات.
  - الملفات: `archive-app/src/pages/TypesPage.jsx`.
  - المصدر: new_tail (F6, F7).
- [ ] `[P2]` ⏱️L **Conditional Fields Visual Builder + حقل Relation جديد** — واجهة بناء `normalizeShowWhen` + `{ id: "relation" }` في `FIELD_TYPE_OPTIONS` لربط المواد.
  - الملفات: `archive-app/src/pages/TypesPage.jsx`، `RelationsPanel.jsx`.
  - المصدر: new_tail (F8, F9).

### Workflow / الأرشيف
- [x] `[P1]` ⏱️M **Workflow Pipeline Bar + Transition Reason + Due Dates** — شريط أعداد الحالات (فلتر فوري) + نموذج تأكيد الانتقال مع سبب وتاريخ استحقاق.
  - ✅ مُنجز (2026-06-21): `WorkflowPipelineBar` مضاف في ArchivePage — يعرض أعداد الحالات مع فلترة فورية بالنقر.
  - ✅ مُكمَّل (2026-06-21 wave-23): `StatusTransitionMenu` — تدفق تأكيد من خطوتين: اختيار الحالة → نموذج مصغر بحقل «سبب التغيير» (اختياري، 500 حرف) وحقل «تاريخ الاستحقاق» (اختياري) → زر تأكيد. الحقلان يُرسَلان في POST /api/workflow/transition (note + dueDate) التي يدعمها الخادم فعلاً.
  - الملفات: `archive-app/src/pages/{ArchivePage,DetailPage}.jsx`، `itemStatus.js`.
  - المصدر: new_tail (F10, F11, F12).
- [x] `[P2]` ⏱️M **Completeness Column** — عمود اكتمال اختياري في جدول الأرشيف.
  - ✅ مُنجز (2026-06-21 wave-22): عمود «الاكتمال» أُضيف في tableColumns.js (default=false) مع renderer في ArchiveViews.jsx — شريط تقدم ملون + نسبة مئوية. يُفعَّل من قائمة الأعمدة.
  - Batch Fix + Inline Cell Editing + Saved Views — لا تزال مطلوبة.
- [ ] `[P2]` ⏱️M **Batch Fix + Inline Cell Editing + Saved Views persistence** — إصلاح بالجملة + تحرير داخل الجدول + حفظ عرض الأعمدة/الفرز.
  - الملفات: `archive-app/src/features/archive/*`, `tableColumns.js`, `InlineCellEditor.jsx`.
  - المصدر: new_tail (F21)، guide_v6 (ArchivePage).

### البحث / Dashboard
- [x] `[P1]` ⏱️M **Instant Search (debounce 150ms) + Query Suggestions + Filter Panel** — نتائج فورية أثناء الكتابة + اقتراحات + لوحة فلاتر قابلة للطي.
  - ✅ مُنجز (2026-06-21 wave-23): `debouncedQuery` 150ms؛ `SearchInputWithSuggestions` يعرض 7 اقتراحات؛ زر «فلاتر» مع شارة عدد الفلاتر النشطة يُفتح/يُغلق لوحة الفلاتر بحركة انزلاق — تضم النوع/الفرع/التاريخ/المفضلة/حقول ناقصة/الكثافة.
  - الملفات: `archive-app/src/pages/SearchPage.jsx`.
  - المصدر: guide_v6 (SearchPage)، ux_plan (S2).
- [ ] `[P2]` ⏱️M **Dashboard: Widget Gallery + DnD كامل + Getting-Started Checklist** — تفعيل `react-grid-layout` + قائمة مهام أول 7 أيام.
  - الملفات: `archive-app/src/pages/DashboardPage.jsx`.
  - المصدر: guide_v6 (Dashboard)، sessions_new (F4).
- [x] `[P2]` ⏱️S **Dashboard: Today's Digest** — بطاقة «اكتشاف اليوم» تعرض ٣ مواد منسيّة من `buildDiscoverySections()` (forgotten section, daily seed). أُضيفت لوحة جديدة `todaysDigest` في `DashboardPage.jsx`.
  - ✅ مُنجز (2026-06-21 wave-24): import + useMemo + CommandPanel + DASHBOARD_PANEL_TITLES. تمرير `pnpm verify:app` + 925 اختبار vitest أخضر.
  - المصدر: sessions_new (F15)، f45ea5a29 (DiscoverPage).

### صفحات متخصصة
- [ ] `[P2]` ⏱️XL **GraphViewPage: تفعيل Cytoscape الكامل** — Force-directed + ألوان حسب النوع + حجم حسب الروابط + Zoom/Pan/Filter + Node hover + lazy load.
  - الملفات: `archive-app/src/pages/GraphViewPage.jsx`.
  - المصدر: f45ea5a29 (GraphView)، guide_v6 (#9)، dev-roadmap (P5/Graph).
- [x] `[P2]` ⏱️M **AnalyticsPage: Time Range Picker + Export CSV** — فلتر زمني موحّد يؤثر على كل الرسوم + تصدير.
  - ✅ مُنجز (2026-06-21): فلتر (30 يوم/90 يوم/سنة/الكل) يُصفّي videoItems قبل buildArchiveAnalytics. زر تصدير CSV يُنزّل العناصر المُصفّاة. Bento Grid لا يزال مطلوباً.
  - الملفات: `archive-app/src/pages/AnalyticsPage.jsx`.
  - المصدر: guide_v6 (#8)، f45ea5a29 (Analytics).
- [ ] `[P2]` ⏱️L **TimelinePage أفقي + Zoom levels + Export SVG/PDF** — تصوّر زمني تفاعلي (`granularity`/`groupBy` موجودان).
  - المصدر: guide_v6 (#10)، f45ea5a29 (Timeline).
- [ ] `[P3]` ⏱️L **بقية الصفحات (تحسينات مفردة)** — Collections (cover/share)، Inbox (swipe)، ReadingLists (progress ring)، Favorites (filters/folders)، SavedSearches (alerts/run)، Duplicates (side-by-side + confidence)، SharedLinks (analytics/expiry)، HierarchicalTags (tree view + usage count + drag re-parent)، Vocabulary (fuzzy + export)، Reports (templates + scheduled)، ProductionTasks (assignee/due)، Activity/History (undo/restore)، Automation (templates + test-run)، Transcriber (timecodes + DetailPage link)، SyncLog (status + health chart)، ErrorLog (grouping + recovery queue)، Help (search + context-sensitive)، Files (provider tabs + preview + quota)، Users (avatar/presence/invite).
  - الملفات: الصفحات المعنية في `archive-app/src/pages/*`.
  - القبول: كل بند يُنفَّذ مستقلاً ويُعلَّم؛ تحقّق من عدم الإنجاز المسبق.
  - المصدر: f45ea5a29 (كل المجموعات)، guide_v6 (#15–20).

---

## 7. الذكاء الاصطناعي والميزات التنافسية (AI & Competitive) — P3 net-new

- [ ] `[P2]` ⏱️XL **مراجعة بصرية واعتماد (Visual Review — منافس Frame.io)** — تعليق على إطار محدد + annotation + مقارنة side-by-side + رابط مراجعة خارجي.
  - المصدر: dev-roadmap (new-feature #1).
- [ ] `[P2]` ⏱️XL **تعاون حي (Live Collaboration)** — حضور فوري + تحرير متزامن + إشعارات WebSocket حقيقية (`PresenceIndicator` موجود).
  - المصدر: dev-roadmap (new-feature #2)، sessions_new (F16, F17).
- [ ] `[P3]` ⏱️XL **محرّك قواعد مرئي (Visual Rules Engine)** — سحب/إفلات trigger+conditions+actions فوق `automationSlice`.
  - المصدر: dev-roadmap (#3)، f45ea5a29 (Automation templates/test-run).
- [ ] `[P3]` ⏱️XL **وسم تلقائي بالـ AI + بحث دلالي v2 + كيانات مسماة + كشف مكرّرات بصري** — رؤية حاسوبية + faceted search + embeddings dedup.
  - المصدر: dev-roadmap (P4-02..05).
- [ ] `[P3]` ⏱️XL **بوابة كتالوج عام + سوق إضافات + محاكاة بث حي + محرّك تقارير امتثال** — توسّعات تنافسية.
  - المصدر: dev-roadmap (new-features #4, #8, #9, #10).
- [ ] `[P3]` ⏱️L **وسم جغرافي + شجرة اشتقاق الوسائط + تكامل M365/Google Workspace + إشعارات متعددة القنوات** — خريطة/GPS + derivatives tree + SSO + Email/Push/Slack/Teams.
  - المصدر: dev-roadmap (new-features #6, #7, #11, #12).

---

## ملخص الموجة

| الفئة | عدد البنود الرئيسية | الأولوية الغالبة |
|---|---|---|
| §1 جاهزية البث المؤسسي | 10 | P0–P2 |
| §2 الأساس المعماري | 11 | P0–P2 |
| §3 محرّر المونتاج | 6 | P0–P2 |
| §4 الأداء وa11y | 6 | P1–P2 |
| §5 الإعدادات والتنقّل | 4 | P1–P2 |
| §6 تحسينات الصفحات | ~10 مجمّعة | P1–P3 |
| §7 AI والميزات التنافسية | 6 مجمّعة | P2–P3 |

> **مرجع المؤشرات (من التقارير):** الامتثال للبث 41%→90% · TypeScript 0%→95% · i18n 30%→95% · الحزمة الأولية ~2.5MB→~400KB · Lighthouse a11y ~65→≥95 · الذاكرة (50K) ~500MB→≤150MB.
