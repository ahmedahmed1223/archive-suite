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

## ابدأ من هنا — ترتيب التنفيذ المقترح (للوكيل المنفّذ)

> 27 بنداً متبقّياً (لا يوجد P0 — كلها مُنجَزة). نفّذ بنداً واحداً في كل مرة، بوابة `pnpm verify` ثم دمج بعد كل بند. التفاصيل في الأقسام أدناه.

**P1 — أولاً:**
1. §1 تفريغ عربي إنتاجي (GPU + faster-whisper-large-v3) — ⏱️XL
2. §5 ترحيل Laravel/Next — 5e.2-cutover (إشرافي، يدوي) + تحقّق حيّ مؤجَّل
3. §22 دعم Microsoft SQL Server كـ backend — ⏱️XL

**P2 — بعدها:** §2 (K8s+Compose · E2E+أمن · تنظيف مجلدات) · §3 (مشغّل فيديو: Waveform/Transcript · علامة مائية+SRT/VTT/TTML) · §4 (PWA · تحسين الصور) · §5-تنقّل (توحيد Settings · Sidebar · لوحة أمان) · §6 (Conditional Fields · Dashboard widgets · GraphView · Timeline) · §7 (Visual Review · Live Collaboration) · §22 (ODBC).

**P3 — مؤجّل:** §6 بقية الصفحات · §7 (Visual Rules Engine · وسم AI/بحث دلالي · كتالوج عام · وسم جغرافي).

---

## 1. جاهزية البث المؤسسي (Enterprise / Broadcast) — net-new

> أكبر فجوة في تقرير التقييم المؤسسي (الامتثال الحالي 41%). هذه بنود غير موجودة في الكود (تم التحقق: لا `rights`/`MXF`/`embargo`/`MOS`).

- [ ] `[P1]` ⏱️XL **تفريغ عربي إنتاجي (GPU + faster-whisper-large-v3)** — رفع الدقة من ~70% إلى ≥90%.
  - يشمل: GPU، `large-v3`، **timestamps**، **تمييز المتحدثين (diarization)**، تصدير **SRT/VTT/TTML**.
  - الملفات: `archive-server/src/ai/transcription.js` (موجود client متعدد المزودين + خيار faster-whisper ذاتي الاستضافة — يُبنى فوقه)، deploy للـ GPU.
  - القبول: تفريغ مقابلة عربية بدقة ≥90% مع توقيتات وتصدير SRT.
  - المصدر: broadcast-report (transcription — حرج)، dev-roadmap (P3-03).

---

## 2. الأساس المعماري (Architecture & Foundation) — net-new

- [ ] `[P2]` ⏱️L **إكمال K8s + توحيد Docker Compose** — ملفات compose → ملف واحد بـ profiles؛ إضافة Redis+Whisper لـ K8s + kustomization.
  - ✅ إصلاح بوابة Compose وصورة السيرفر (2026-06-27): أُضيفت placeholder آمنة للمتغيرات المطلوبة في `archive-server/.env.example` (`POSTGRES_*`, `REDIS_PASSWORD`, `PGADMIN_*`, `GRAFANA_PASSWORD`, أسرار JWT)، ونُقلت التعليقات من inline إلى أسطر مستقلة حتى لا تُفسَّر كقيم داخل Docker Compose. أُضيف `tsconfig.base.json` إلى `archive-server/Dockerfile.server` في مراحل build/runtime حتى لا يفشل Prisma/tsx بعد بدء ترحيل TypeScript. مرّت `docker:config` و`docker:config:postgres` وبناء صورة السيرفر.
  - الملفات: `archive-server/deploy/*`, `archive-server/*.yml`.
  - المصدر: dev-roadmap (P1-07).

- [ ] `[P2]` ⏱️L **توسيع اختبارات E2E + ترقية الحزم الأمنية** — رفع تغطية Playwright + `npm/pnpm audit` للـ CVEs.
  - المصدر: dev-roadmap (P0-09, P1-08, P5-04).

- [ ] `[P2]` ⏱️M **ترتيب وتنظيف مجلدات المشروع + بوابة Playwright** — جرد الملفات والمجلدات غير المفيدة أو المولّدة عشوائياً، ثم حذف/نقل الآمن منها مع إثبات عدم كسر التشغيل.
  - يشمل: فحص مجلدات الجذر و`archive-app/` و`archive-server/` و`archive-core/`؛ تصنيف الملفات إلى: مصدر، توثيق، اختبارات، مخرجات بناء، نسخ احتياطية، لقطات/تقارير، مخلفات تشغيل؛ تحديث `.gitignore` عند الحاجة؛ نقل الوثائق المتناثرة إلى `docs/` أو مجلدها الصحيح؛ إزالة الملفات المكررة أو القديمة فقط بعد البحث عنها بـ `rg` والتأكد من عدم استخدامها.
  - Playwright: إضافة/توسيع اختبارات E2E تغطي التشغيل بعد التنظيف: التحميل الأول، التنقل الأساسي، صفحة الأرشيف، صفحة الإعدادات، مدير الملفات، وصفحة التفاصيل/المعاينة؛ وإضافة smoke بصري يلتقط أخطاء المسارات المكسورة أو assets المفقودة بعد نقل الملفات.
  - الملفات: `TASKS.md`، `.gitignore`، `README.md`/`docs/*` عند الحاجة، `archive-app/tests/*`، `archive-app/playwright.config.ts`، وربما سكربت جديد مثل `scripts/verify-repo-hygiene.mjs`.
  - القبول: تقرير جرد قصير يذكر ما أُبقي وما حُذف/نُقل ولماذا؛ لا حذف لملفات داخل `.git` أو ملفات مستخدمة؛ نجاح `pnpm verify`؛ نجاح `pnpm --filter @archive/app run e2e` أو مجموعة Playwright محددة موثقة؛ عدم ظهور 404/console errors حرجة في لقطات Playwright.
  - المصدر: طلب المستخدم 2026-06-27.

- [ ] `[P1]` ⏱️XXL **ترحيل معماري إلى Laravel API + Next.js TypeScript** — اعتماد Laravel كخادم نطاق وAPI، وNext.js كواجهة TypeScript تدريجية، دون إدخال Astro 5.
  - ✅ **المنجز (شرائح 0–5e.1 + 5e.2-harness):** عقود API، Next.js shell + عميل typed، Laravel API كامل (auth/records/search/files/share/rights/audit/media-jobs)، مصادقة httpOnly cookie، صفحات Next التشغيلية، وبوابة `e2e:next:integration` **10/10 حيّة خضراء** (2026-06-30). التفاصيل الكاملة في [`ChangeLog.md`](ChangeLog.md).
  - [ ] **المتبقّي — 5e.2-cutover (خطوة إنتاجية إشرافية، لا تُؤتمت):** بوابة التحقق الحيّ `e2e:next:integration` ✅ تمرّ؛ القطع نفسه يدوي بإشراف: قلب علم الإنتاج لتوجيه الواجهة إلى Laravel، ثم حذف مجموعات Node المقابلة (records/search/files/share/media/ingest) بعد تأكيد parity. قرار «إيقاف البناء net-new على Node» سارٍ.
  - [ ] **تحقّق حيّ مؤجَّل (يحتاج بنية حيّة):** smoke لـ `Dockerfile.worker` (ffmpeg/whisper) + خادمَي FTP/SMB بملف وسائط حقيقي — التنفيذات (`RealMediaProcessor`/`WhisperTranscriber`/`Ftp`/`Smb`) مبنية ومُختبَرة بـ fakes (71 اختبار Laravel، راجع ChangeLog).
  - الملفات: `docs/laravel-nextjs-migration-plan.md`, `TASKS.md`, عقود API لاحقاً تحت `docs/api/`, وحزم جديدة لاحقاً فقط بعد قرار scaffold.
  - القبول: لا اعتماديات Astro؛ `pnpm run typecheck` ينجح؛ Next.js هو مسار الواجهة TypeScript، وLaravel هو backend/API والـ queues؛ أي scaffold جديد لا يكسر Vite الحالي.
  - المصدر: طلب المستخدم 2026-06-27.

---

## 3. محرّر المونتاج متعدد المسارات (Montage) — net-new كبير

> الحالة: ProjectsPage فيه `roughCuts`/`inSec/outSec`/transitions/looks/filters/EDL+JSON+MP4 لكن **قائمة نصية بلا خط زمني مرئي** (تم التحقق: لا `MultiTrack`).

- [~] `[P2]` ⏱️L **مشغّل فيديو متقدم في DetailPage** — Frame stepping (`,`/`.`) + Mark In/Out + «أضف لمشروع» مباشرة + Waveform + Transcript Sync.
  - ✅ Frame stepping + Mark In/Out + «أضف لمشروع» مُنجَز (2026-06-30) — راجع [`ChangeLog.md`](ChangeLog.md).
  - متبقّي: Waveform (يحتاج تحليل صوتي)، Transcript Sync (جزئياً موجود في TranscriberPage).
  - الملفات: `archive-app/src/components/media/VideoPlayer.tsx` + `archive-app/src/pages/DetailPage.tsx` + `archive-app/src/components/media/VideoPlayer.test.tsx`.
  - المصدر: new_tail (F19, F20).

- [ ] `[P2]` ⏱️M **علامة مائية + تصدير SRT/VTT/TTML للفيديو** — ffmpeg overlay + ملفات ترجمة مع الفيديو.
  - الملفات: `archive-server/src/media/*`.
  - المصدر: dev-roadmap (P2-05, P2-06).

---

## 4. الأداء وإمكانية الوصول (Performance & a11y) — جزئياً net-new

- [ ] `[P2]` ⏱️L **PWA: Service Worker + Print Styles + تحديث جولة الإعداد** — Workbox offline-first للأصول + background sync + `@media print` للتقارير.
  - الملفات: `archive-app/` (manifest + SW)، `V1ProductTour`.
  - المصدر: ux_plan/guide_v6 (Sprint 6).

- [ ] `[P2]` ⏱️M **تحسين الصور (srcset + lazy)** — استخدام WebP variants من Sharp (موجودة في الخادم) في الواجهة.
  - الملفات: مكوّنات الوسائط في `archive-app`.
  - المصدر: ux_plan (Sprint 4)، guide_v6 (DetailPage).

---

## 5. إعادة هيكلة الإعدادات والتنقّل — جزئياً net-new

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

- [ ] `[P2]` ⏱️L **Conditional Fields Visual Builder + حقل Relation جديد** — واجهة بناء `normalizeShowWhen` + `{ id: "relation" }` في `FIELD_TYPE_OPTIONS` لربط المواد.
  - الملفات: `archive-app/src/pages/TypesPage.jsx`، `RelationsPanel.jsx`.
  - المصدر: new_tail (F8, F9).

### البحث / Dashboard

- [ ] `[P2]` ⏱️M **Dashboard: Widget Gallery + DnD كامل + Getting-Started Checklist** — تفعيل `react-grid-layout` + قائمة مهام أول 7 أيام.
  - الملفات: `archive-app/src/pages/DashboardPage.jsx`.
  - المصدر: guide_v6 (Dashboard)، sessions_new (F4).

### صفحات متخصصة

- [ ] `[P2]` ⏱️XL **GraphViewPage: تفعيل Cytoscape الكامل** — Force-directed + ألوان حسب النوع + حجم حسب الروابط + Zoom/Pan/Filter + Node hover + lazy load.
  - الملفات: `archive-app/src/pages/GraphViewPage.jsx`.
  - المصدر: f45ea5a29 (GraphView)، guide_v6 (#9)، dev-roadmap (P5/Graph).

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

## 22. تبسيط جذري لتجربة الإطلاق + Setup.bat (طلب المستخدم 2026-06-21)

> **السياق:** تجربة الإطلاق الحالية (`V1OnboardingWizard`، 9 خطوات في `ONBOARDING_STEPS`) كثيرة وتُعقّد الدخول الأول. المطلوب: شاشة هبوط بخيارين فقط (سريع/متقدم)، ودمج كل الجولات والتعريفات في معالج «جولة الميزات» واحد قابل للتجاهل ولإعادة التشغيل من المساعدة، ونقل الخطوات الثانوية إلى صفحة المساعدة، وتحسين `setup.bat`/`control-center` ليكون أكثر مرونة ووضوحاً.

- [ ] `[P1]` ⏱️XL **دعم Microsoft SQL Server كـ backend جديد** — إضافة `sqlserver` كخيار في `BACKEND_CHOICES` + Prisma provider جديد + ترحيل schema المعادل + نقطة في `/api/setup/preset-config` تكشف `SQLSERVER_URL`.
  - الملفات: `archive-server/prisma/schema.prisma` (provider="sqlserver" بصيغة `Server=...;Database=...;User Id=...;Password=...;`)، `archive-server/scripts/set-db-provider.mjs` (إضافة sqlserver)، `archive-app/src/bootstrap/backendChoice.js` (BACKEND_CHOICES + label عربي)، `archive-app/src/features/onboarding/flow.js` (ONBOARDING_STORAGE_OPTIONS)، `docker-compose.sqlserver.yml` (جديد، صورة mcr.microsoft.com/mssql/server).
  - القبول: تشغيل التطبيق على SQL Server يعمل من معالج البدء أو من `pnpm --filter archive-server exec prisma migrate deploy` بعد ضبط `DATABASE_URL`.
  - المصدر: طلب المستخدم 2026-06-21.

- [ ] `[P2]` ⏱️XL **دعم ODBC (عام لقواعد بيانات Windows القديمة)** — جسر عبر `node-odbc` لتشغيل الاستعلامات بدون Prisma (الجزء غير المنطقي من الـ schema). يتطلب طبقة Repository بديلة في `archive-server/src/db/odbcAdapter.js` تكشف نفس واجهة Prisma لمجموعة محدودة من الجداول الأساسية (items, users, settings, audit) — وذلك للمستخدمين الذين يربطون قاعدة بيانات قائمة (DSN موجود في ODBC Data Source Administrator على Windows).
  - الملفات: `archive-server/src/db/odbcAdapter.js` (جديد)، `archive-server/package.json` (تبعية اختيارية `odbc`)، `archive-app/src/bootstrap/backendChoice.js` (BACKEND_CHOICES.odbc)، توثيق DSN في `docs/`.
  - القبول: إدخال DSN في معالج الإعداد المتقدم يكشف الاتصال، يجلب جداول المستخدمين، ويسمح بعمليات قراءة/كتابة أساسية.
  - ملاحظة: حدود المخطّط (لا migrations Prisma) يجب توثيقها بوضوح للمستخدم.
  - المصدر: طلب المستخدم 2026-06-21.

---

> **البنود المُنجَزة نُقلت إلى [`ChangeLog.md`](ChangeLog.md).** هذا الملف يحوي فقط المهام المتبقّية للتنفيذ.
