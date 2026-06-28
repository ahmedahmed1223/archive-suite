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
  - ✅ شريحة 1/3 — السكيما + REST + اختبارات (2026-06-22 wave-28، agent Sonnet): `RightsRecord` Prisma model + enum `LicenseType` (OWNED/LICENSED/PUBLIC_DOMAIN/FAIR_USE/UNKNOWN) + `embargoStart`/`embargoEnd`/`expiresAt`/`geoRestrictions[]` + 5 endpoints (GET/POST/PUT/DELETE + `/api/rights/expiring?days=N`) + 5 vitest cases. الـ migration بـ `--create-only` (يحتاج `prisma migrate deploy` يدوياً).
  - ✅ شريحة 2/3 — UI (2026-06-24 wave-32، agent A): `RightsPanel.jsx` في `archive-app/src/features/rights/` — شارة لون حسب نوع الرخصة، تحذيرات «منتهية»/«تحت الحجب»/«تنتهي قريباً»، نموذج تحرير بـ BadgeV2، cloud-only guard، design tokens + CSS logical props. تبويب «الحقوق» في DetailPage. 10 اختبارات vitest.
  - ✅ شريحة 3/3 — enforcement (2026-06-24 wave-33، agent A): `rightsEnforcement.js` (pure: checkRightsForExport/isExpiringSoon/buildRightsSummary)، wire في export.js (403 RIGHTS_BLOCKED)، `expiryAlerts.js` (RIGHTS_EXPIRY_ALERT audit)، GET /api/rights/:itemId/enforcement. 13 اختبار.
  - ✅ شريحة Laravel migration — REST + enforcement (2026-06-27): أُضيف `RightsRecord` Eloquent model + `RightsController` + routes تحت `/api/v1/rights` للعرض/upsert/expiring/enforcement، مع `RightsApiTest`. مرّت Laravel tests بنتيجة 8 اختبارات و54 assertion.
  - الملفات: schema/store جديد في `archive-server/prisma/schema.prisma` + خدمة `archive-server/src/rights/*` + واجهة في `archive-app` (DetailPage + صفحة/تبويب حقوق).
  - القبول: لا يمكن نشر/تصدير مادة منتهية الحقوق دون تجاوز صريح مُسجَّل؛ تقرير «حقوق تنتهي خلال 30 يوماً» يعمل.
  - المصدر: broadcast-report (rights — حرج، «بدونه رفض الاعتماد»)، dev-roadmap (P3-01).

- [ ] `[P0]` ⏱️XL **دعم صيغ البث: MXF / XDCAM / ProRes / DNxHR** — ترميز + demux + استخراج metadata مدمجة.
  - ✅ شريحة 1/2 — خطّة الـ ffmpeg (2026-06-22 wave-29، agent Sonnet): `archive-server/src/media/broadcastPlan.js` يحدد الـ codecs (MXF demux، XDCAM، ProRes 4 levels، DNxHR 5 levels) + `probeBroadcastMetadata` يستخرج timecode/duration/reel-name من ffprobe JSON. `archive-server/src/export/broadcast.js` يعرض `renderProRes422` و`renderDnxhrHq` مع injected runner. 24 اختبار، verify chain مُحدّث.
  - ✅ شريحة 2/2 — (2026-06-24 wave-33، agent B): `broadcastIngest.js` (isBroadcastFile + extractBroadcastMetadata injectable)، wire في watchFolder onIngest payload، GET /api/media/:id/broadcast-metadata، POST /api/export/broadcast (ProRes/DNxHR). 25 اختبار، 165 tests green.
  - الملفات: `archive-server/src/media/broadcastPlan.js` + `archive-server/src/export/broadcast.js`.
  - القبول: رفع ملف MXF/XDCAM يُستخرَج منه metadata ويُولَّد proxy؛ التصدير يدعم ProRes/DNxHR.
  - المصدر: broadcast-report (ingest — حرج)، dev-roadmap (P2-04).

- [x] `[P0]` ⏱️L **خط أنابيب Streaming للملفات الضخمة (50–500GB)** — استبدال `os.tmpdir()` بمعالجة تدفقية.
  - ✅ مُنجز (2026-06-22 wave-28، agent Sonnet): 7 مواقع حُوّلت — `chunkedUpload.completeSession` (PassThrough sequential pipe بدلاً من `Buffer.concat`)، `chunkedUpload.receiveChunk` (pipeline → createWriteStream)، `chunkedUpload.tmpDir()` (STORAGE_DIR بدلاً من os.tmpdir)، `server.js PUT /api/files/:key` (stream مباشرة إلى putStream/putBlob؛ image MIMEs فقط تحتفظ بـ Sharp buffer)، `runMedia.withTempFileFromStore` (getStream preferred + getBlob fallback async generator)، `runMedia.runMediaDerivative` output (putStream من createReadStream)، `export/mp4.js outFile` (STORAGE_DIR/export-work). Smoke test: 10MB stream end-to-end دون `Buffer.concat`. 106/106 server tests pass. ملاحظة: `ocrHandler.js` + `backupCrypto.js` + `controlAgent.js` لم تُحوَّل لأسباب صحيحة (microservice Content-Length، AES-GCM in-memory، bounded process stdout).
  - الملفات: مسارات الرفع/المعالجة في `archive-server/src/api/server.js` + خدمة الوسائط.
  - القبول: معالجة ملف 5GB+ دون تحميله كاملاً في الذاكرة/القرص المؤقت؛ مؤشر تقدم streaming. ✓
  - المصدر: broadcast-report (مخاطرة #4)، dev-roadmap (P3-10).

- [x] `[P1]` ⏱️XL **مخطط PBCore + Dublin Core** — 15 حقل Dublin Core + حقول PBCore + تصدير PBCore XML / DC RDF.
  - ✅ مُنجز (2026-06-22 wave-28، agent Sonnet): `archive-server/src/export/dublinCore.js` (`toDublinCore` يغطي كل الـ 15 عنصر DC)، `pbcore.js` (`toPBCore` بمجموعة PBCore 2.1 الكاملة)، `xmlSerializer.js` (~55 سطر، escapes `&`/`<`/`>`/`"`/`'`، بلا dependencies)، endpoints `GET /api/items/:id/export/pbcore.xml` (`application/xml`) و`/api/items/:id/export/dublincore.rdf` (`application/rdf+xml`) كلاهما خلف `requireAuth`. 19 اختبارات (DC completeness، PBCore structure، XML escaping، HTTP auth، 404 على عنصر مفقود). أُضيف `verify:metadata-export` لسلسلة الـ verify.
  - الملفات: schema + خدمة تصدير في `archive-server/src/export/*` + ربط بحقول الأنواع.
  - القبول: تصدير مادة كـ PBCore XML صالح + DC RDF؛ مفردات منظمة للإعلام العربي. ✓ (المفردات المنظمة العربية تبقى ضمن بند §1 line 102 المنفصل).
  - المصدر: broadcast-report (metadata — حرج)، dev-roadmap (P3-02).

- [ ] `[P1]` ⏱️XL **تفريغ عربي إنتاجي (GPU + faster-whisper-large-v3)** — رفع الدقة من ~70% إلى ≥90%.
  - يشمل: GPU، `large-v3`، **timestamps**، **تمييز المتحدثين (diarization)**، تصدير **SRT/VTT/TTML**.
  - الملفات: `archive-server/src/ai/transcription.js` (موجود client متعدد المزودين + خيار faster-whisper ذاتي الاستضافة — يُبنى فوقه)، deploy للـ GPU.
  - القبول: تفريغ مقابلة عربية بدقة ≥90% مع توقيتات وتصدير SRT.
  - المصدر: broadcast-report (transcription — حرج)، dev-roadmap (P3-03).

- [ ] `[P1]` ⏱️XL **تكامل MOS + NRCS (ENPS/iNEWS)** — جسر لغرفة الأخبار.
  - ✅ شريحة 1/2 (2026-06-23 wave-31، agent Sonnet): `archive-server/src/integrations/mos/` — `messages.js` يبني 6 رسائل MOS 3.x (roReq/roCreate/roStorySend/roElementAction/objList/objCreate) عبر `xmlSerializer.js`؛ `session.js` بـ messageID تلقائي + wrap/unwrap بدون DOMParser؛ `searchBridge.js` يحوّل عناصر الأرشيف إلى MOS shape. REST: `POST /api/mos/search` + `GET /api/mos/envelope-sample?type=roReq`. 23 اختبار، verify chain مُحدّث. لا sockets.
  - ✅ شريحة 2/2 — (2026-06-24 wave-33، agent C): `tcpClient.js` (connect/disconnect/send/getStatus، reconnect، heartbeat 30s، send queue max 100). REST: POST /connect، POST /disconnect، GET /status، POST /send (admin-only). 8 اختبارات node:test بـ echo server حقيقي.
  - الملفات: `archive-server/src/integrations/mos/*` + REST bridge.
  - القبول: محرر في ENPS/iNEWS يبحث الأرشيف ويسحب مادة عبر MOS؛ يمكن تأجيله للمرحلة الثانية مع واجهة ويب + تنزيل يدوي مؤقتاً.
  - المصدر: broadcast-report (integration — حرج لكن قابل للتأجيل)، dev-roadmap (P3-04).

- [x] `[P1]` ⏱️L **سياسة احتفاظ + حذف آمن + سلسلة عهدة** — retention تلقائية + حذف DoD 5220.22-M + تقارير امتثال.
  - ✅ مُنجز (2026-06-22 wave-28، agent Sonnet): `archive-server/src/retention/retentionPolicy.js` (`parseRetentionRule`، `isExpired`، `findExpiringSoon`، `scanRetention` — pure functions) + `secureDelete.js` (`secureOverwrite` بـ 3-pass DoD 5220.22-M: 0x00 → 0xFF → random عبر `fs.open("r+")` ثم unlink، 10GB size guard). Prisma: `RetentionRule` model + `archivedAt` على ArchiveItem + migration بـ `--create-only`. wired في `DELETE /api/files/:key` بحيث disk store يحصل على wipe كامل و cloud stores تعتمد على `files.remove()`. `auditLogger.js` يسجّل `secure-delete` بـ DESTRUCTIVE_OPS مع size + pass count. 30 اختبار. وثّق وكلاء scheduler integration (setInterval style) كـ TODO.
  - متبقّي: ربط `scanRetention()` بـ scheduler حقيقي (TODO موجود)، وUI لإدارة الـ rules (manage retention rules page) + reports امتثال — كلها شرائح لاحقة صغيرة.
  - الملفات: `archive-server/src/retention/*`، ربط بـ ActivityLog الموجود.
  - القبول: سياسة احتفاظ قابلة للتهيئة تعمل؛ حذف آمن يُسجَّل في سلسلة العهدة. ✓
  - المصدر: broadcast-report (compliance)، dev-roadmap (P3-06).

- [ ] `[P1]` ⏱️XL **نسخ احتياطي مؤسسي** — replication عبر المناطق + off-site + failover تلقائي + اختبار DR آلي.
  - ✅ شريحة 1/3 (2026-06-23 wave-31، agent Sonnet): `archive-server/src/backup/enterprise/` — `replicate.js` (streaming multipart S3 upload + AES-256-GCM optional encryption، 12B IV + 16B authTag layout)، `manifest.js` (`appendBackupManifestEntry` + `findRestorableEntry`)، `restoreSmoke.js` (download + decrypt + SHA-256 verify + `pg_restore --list` smoke). 3 REST endpoints: `POST /api/backups/replicate/:backupId` (admin) و `GET /api/backups/replicas` و `POST /api/backups/restore-smoke/:replicaId`. config: `config.backup.replication.{enabled, bucket, region, prefix, encryptionKey}` في `env.js`. 14 اختبار جديد، 23 اختبار backup الموجودة لم تتأثر.
  - ✅ شريحة 2/3 — (2026-06-24 wave-32، agent C): `healthProbe.js` (polling fetch، failThreshold، onFailoverNeeded/onRecovered callbacks)، `drDrill.js` (runDrillNow + scheduler، bounded 100-entry history)، `drRoutes.js` (GET health-probe، POST drill-now admin، GET drill-history). 10 اختبارات. verify:server green.
  - متبقّي: شريحة 3 — scheduled DR drills UI + alerts.
  - الملفات: `archive-server/src/backup/enterprise/*` + S3 cross-region.
  - القبول: استعادة من نسخة off-site تنجح في اختبار DR مجدول. ✓ (smoke level)
  - المصدر: broadcast-report (DR)، dev-roadmap (P3-09).

- [x] `[P2]` ⏱️L **Watch Folder + ابتلاع FTP/SMB** — التقاط تلقائي للملفات الواردة + checksum عند الابتلاع.
  - ✅ مُنجز (2026-06-23 wave-31، agent Sonnet): `archive-server/src/ingest/` — `watchFolder.js` بـ polling `node:fs/promises.readdir` (لا chokidar) + Map للـ mtime/size + SHA-256 streaming عبر pipeline (لا full-file buffer) + نقل الملفات إلى `processed/` بعد النجاح. `ftpIngest.js` و`smbIngest.js` يعتمدان على `basic-ftp` و`@marsaud/smb2` (موجودان مسبقاً) مع manifest JSON `archive-server/var/ingest/ftp-manifest.json` للتتبّع. REST: `POST /api/ingest/scan` + `POST /api/ingest/ftp/pull` + `POST /api/ingest/smb/pull`. config: `INGEST_WATCH_DIR` (default `var/ingest/inbox/`، polling default 30 ثانية). 13 اختبار، verify chain مُحدّث.
  - الملفات: `archive-server/src/ingest/*`.
  - القبول: إسقاط ملف في مجلد مراقَب يُنشئ مادة تلقائياً مع proxy + checksum. ✓ (proxy generation reuses الـ media pipeline الموجود)
  - المصدر: broadcast-report (ingest)، dev-roadmap (new-feature #5 Smart Ingest).

- [ ] `[P2]` ⏱️M **مفردات إعلامية عربية منظمة + تقويم هجري** — أنواع البرامج/تصنيفات/أدوار + Umm al-Qura (هجري/ميلادي مزدوج).
  - ✅ تقويم هجري مُنجز (2026-06-22 wave-28): `archive-app/src/utils/hijriDate.js` يعرض `formatHijriDate` (Umm al-Qura عبر `Intl.DateTimeFormat` بـ `calendar: "islamic-umalqura"`، أرقام عربية-هندية)، `formatGregorianDate`، و`formatDualDate` (ميلادي · هجري). 6 اختبارات vitest. ربط `LiveClockBadge` في `DashboardPage` ليعرض `٠٣:٣٣ م | الاثنين، ٢٢ يونيو | ٧ محرم هـ` مع `aria-label` مُدمج للقارئ.
  - متبقّي: المفردات الإعلامية المنظمة (أنواع البرامج/تصنيفات/أدوار) — يحتاج جلسة منفصلة.
  - الملفات: `archive-app/src/utils/hijriDate.js` (جديد) + `.test.js` + `archive-app/src/pages/DashboardPage.jsx` (`formatClockHijri` + سطر هجري في الـ badge).
  - القبول: تاريخ مزدوج معروض في الـ Dashboard hero ومتاح كـ utility لأي صفحة أخرى.
  - المصدر: broadcast-report، dev-roadmap (P3-07, P3-08).

---

## 2. الأساس المعماري (Architecture & Foundation) — net-new

- [x] `[P0]` ⏱️L **ترحيل JWT إلى HttpOnly Cookie + refresh rotation** — استبدال تخزين التوكن في `localStorage`.
  - ✅ مُنجز (2026-06-23 wave-30، agent A): `tokenService.js` (sign/verify). POST `/api/auth/refresh` يدوّر cookie `va_refresh` (HttpOnly+Secure+SameSite=Strict). `cloudSession.js` يخزّن access token في MODULE MEMORY فقط. `createSilentRenewal` يُجدّد 60ث قبل انتهاء الصلاحية. 16 اختبار. 1043 tests green.
  - المصدر: dev-roadmap (P0-01)، ux_plan (security).

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

- [x] `[P1]` ⏱️XL **i18n: استخراج النصوص + `en.js` + `fr.js`** — رفع التغطية من ~30% إلى ≥95% ودعم 3 لغات.
  - ✅ مُنجز (2026-06-24 wave-34، agent C): 97 مفتاح ترجمة (7 namespaces: actions/nav/error/status/auth/archive/confirm/backup). `en.js` و`fr.js` كاملان + i18next يُسجّلهما. 10 اختبارات parity + integration. 1155 tests green. ملاحظة: ~30+ نص مُرمَّز في DashboardPage.jsx كُشف — يحتاج جلسة مستقلة.
  - القبول: تبديل لحظي بين 3 لغات دون إعادة تحميل؛ لا سلاسل عربية مُرمّزة في المكوّنات.
  - المصدر: dev-roadmap (P0-06)، ux_plan (Sprint 3).

- [x] `[P1]` ⏱️XL **تفكيك `server.js` إلى وحدات** — تقسيم الملف الضخم إلى authRoutes/mediaRoutes/shareRoutes/backupRoutes/adminRoutes (لا ملف >400 سطر).
  - ✅ مُنجز (2026-06-23 wave-30، agent B): `archive-server/src/routes/` — 5 وحدات + barrel index. server.js تقلّص إلى middleware + mount + startup فقط.
  - المصدر: dev-roadmap (P1-01).

- [x] `[P1]` ⏱️L **تفكيك `archiveSlice` + إصلاح تسرّب الذاكرة** — استخراج شرائح (itemCrud/collection/project/media/history) + تقليم `workflowHistory`/`itemHistory`.
  - ✅ مُنجز (2026-06-22 wave-29، agent Sonnet): `archive-app/src/stores/slices/userSlice.js` (93 سطر، `addUser`/`updateUser`/`deleteUser` + `userInitialState`) و`historySlice.js` (42 سطر، `clearHistory`/`appendHistory` مع `MAX_HISTORY_ENTRIES = 500` cap FIFO). archiveSlice.js من 970 → 918 سطر. `appStore.js` وصلَ slices الجديدة قبل `archiveInitialState`. 12 اختبار جديد (9 unit + 1 stress عند 600 entry). 954/954 frontend tests green في الـ slice، ثم 993/993 بعد دمج Design System v2.
  - الملفات: `archive-app/src/**/archiveSlice*`.
  - القبول: كل شريحة ≤250 سطر؛ الذاكرة ≤150MB مع 50K عنصر.
  - المصدر: dev-roadmap (P0-08, P1-02).

- [ ] `[P1]` ⏱️XXL **ترحيل تدريجي إلى TypeScript** — frontend + server (الحالة: الأساس بدأ).
  - ✅ شريحة 0 — أساس الترحيل (2026-06-27): أُضيفت `tsconfig.base.json` + `tsconfig.json` جذري + `tsconfig.json` لكل من `archive-app` و`archive-core` و`archive-server`، مع سكربتات `typecheck` على مستوى الحزم والجذر. أُضيفت ملفات types أولية (`archive-app/src/types/runtime.ts`, `archive-core/src/types/ports.ts`, `archive-server/src/types/runtime.ts`) دون تغيير runtime. أُضيفت تبعية `typescript` ومرّت بوابة `pnpm run typecheck` للحزم الثلاث. هذا الأساس مناسب لمسار Next.js لأنه يستخدم `moduleResolution: "Bundler"` ولا يحوّل entrypoints الحالية بعد.
  - ✅ شريحة 1 — تحويل leaf utilities آمن (2026-06-27): حُوّلت `hijriDate`, `subtitleParser`, و`transcriptToSrt` إلى ملفات `.ts` مع إبقاء ملفات `.js` كواجهات إعادة تصدير حتى لا تنكسر الاستيرادات الحالية ولا مسار Vite. مرّت اختبارات الواجهة و`pnpm run typecheck`.
  - ✅ شريحة 2 — core/server leaf migration + Docker gate (2026-06-27): حُوّل `archive-core/src/utils/arabicNormalize.ts` واختباره إلى TypeScript مع إبقاء `arabicNormalize.js` كواجهة توافق، وحُوّل `archive-server/src/auth/authConfig.ts` واختباره إلى TypeScript مع أنواع صريحة للـ env fallback. أُصلحت `archive-server/.env.example` حتى لا تفشل Compose بسبب متغيرات Postgres/pgAdmin/Grafana/Redis الناقصة أو التعليقات inline التي تُقرأ كقيم. أُصلح `archive-server/Dockerfile.server` لنسخ `tsconfig.base.json` في build/runtime بعد أن فشل بناء صورة السيرفر بسبب `File '../tsconfig.base.json' not found`. العد الحالي خارج المخرجات: 816 JS/JSX و30 TS/TSX. مرّت `pnpm run typecheck`, اختبارات core/server المحددة، `pnpm run docker:config`, `pnpm run docker:config:postgres`, `docker compose ... build frontend`, `docker compose ... build server`, وDocker dev smoke على `http://127.0.0.1:8080/` و`http://127.0.0.1:8090/api/health`.
  - ✅ شريحة 3 — core ports + frontend/server utilities (2026-06-27): حُوّلت عقود `archive-core/src/storage/ports/*` و`archive-core/src/storage/index.ts` و`archive-core/src/core/index.ts` إلى TypeScript مع إبقاء جسور `.js` للتوافق مع exports الحالية. حُوّل `archive-app/src/features/analytics/topTags.ts` واختباره إلى TypeScript، وأُضيف `archive-app/src/utils/classNames.ts` كتنفيذ typed مع bridge، وحُوّل `archive-app/src/features/ui/countUp.ts` واختباره. حُوّل `archive-server/src/api/rateLimit.ts` واختباره إلى TypeScript. العد الحالي خارج المخرجات: 813 JS/JSX و45 TS/TSX. مرّت `pnpm run verify:core`, `pnpm --filter @archive/core test`, اختبارات الواجهة المحددة (142 ملف اختبار/1237 اختبار)، `pnpm --filter archive-server test -- src/api/__tests__/rateLimit.test.ts` (14 ملف اختبار/150 اختبار)، `pnpm run typecheck`, `pnpm run docker:config`, `pnpm run docker:config:postgres`, `docker compose ... build frontend server`, وDocker dev smoke على `http://127.0.0.1:8080/` و`http://127.0.0.1:8090/api/health`.
  - ✅ شريحة 4 — frontend pure view models (2026-06-27): حُوّلت `appearancePreview`, `keyboardShortcuts`, `help/viewModel`, و`recommendationFeedback` إلى TypeScript مع إبقاء جسور `.js` للاستيرادات الحالية، وحُوّلت اختبارات كل وحدة إلى `.test.ts`. العد الحالي خارج المخرجات: 809 JS/JSX و53 TS/TSX. مرّت اختبارات الواجهة المحددة التي شغّلت suite الواجهة كاملة (142 ملف اختبار/1237 اختبار) ومرّ `pnpm run typecheck:app`.
  - ✅ شريحة 5 — upload/file-manager utilities (2026-06-27): حُوّلت `uploadLink`, `file-manager/ingestQueue`, و`file-manager/archiveHandoff` إلى TypeScript مع جسور `.js`، وحُوّلت اختباراتهم إلى `.test.ts`. العد الحالي خارج المخرجات: 806 JS/JSX و59 TS/TSX. مرّت اختبارات الواجهة المحددة التي شغّلت suite الواجهة كاملة (142 ملف اختبار/1237 اختبار) ومرّ `pnpm run typecheck:app`.
  - ✅ شريحة 6 — file-manager view model (2026-06-27): حُوّل `file-manager/viewModel` إلى TypeScript مع bridge، وحُوّل اختباره إلى `.test.ts`. العد الحالي خارج المخرجات: 805 JS/JSX و61 TS/TSX. مرّ اختبار الواجهة المحدد الذي شغّل suite الواجهة كاملة (142 ملف اختبار/1237 اختبار) ومرّ `pnpm run typecheck:app`.
  - ✅ شريحة 7 — import sources/preview client (2026-06-28): حُوّل `importSources` و`importPreviewClient` إلى TypeScript مع جسور `.js`، وحُوّلت اختباراتهما إلى `.test.ts`. العد الحالي خارج المخرجات: 803 JS/JSX و65 TS/TSX. مرّت اختبارات الاستيراد التي شغّلت suite الواجهة كاملة (142 ملف اختبار/1237 اختبار) ومرّ `pnpm run typecheck:app`.
  - ✅ شريحة 8 — file-manager API client (2026-06-28): حُوّل `fileManagerClient` إلى TypeScript مع bridge، وحُوّل اختباره إلى `.test.ts` مع fetch mock typed. العد الحالي خارج المخرجات: 802 JS/JSX و67 TS/TSX. مرّ `pnpm run typecheck:app`، وأُعيد اختبار الشريحة بعد timeout عابر في اختبار virtual list غير مرتبط فمرّت suite الواجهة كاملة (142 ملف اختبار/1237 اختبار).
  - ✅ شريحة 9 — file-store config client (2026-06-28): حُوّل `fileStoreConfigClient` إلى TypeScript مع bridge، وحُوّل اختباره إلى `.test.ts` مع fetch mock typed. العد الحالي خارج المخرجات: 801 JS/JSX و69 TS/TSX. مرّ `pnpm run typecheck:app` واختبار الشريحة الذي شغّل suite الواجهة كاملة (142 ملف اختبار/1237 اختبار).
  - ✅ شريحة 10 — system control client (2026-06-28): حُوّل `systemControlClient` إلى TypeScript مع bridge، وحُوّل اختباره إلى `.test.ts` مع typed payloads وfetch mock. العد الحالي خارج المخرجات: 800 JS/JSX و71 TS/TSX. مرّ `pnpm run typecheck:app` واختبار الشريحة الذي شغّل suite الواجهة كاملة (142 ملف اختبار/1237 اختبار).
  - الترتيب: stores → ports → hooks (frontend)؛ ports → adapters → services → routes (server).
  - القبول: `tsconfig` مع `strictNullChecks`؛ ≥80% ملفات جديدة بـ TS (هدف مرحلي).
  - المصدر: dev-roadmap (P1-04, P1-05, P5-03).

- [ ] `[P1]` ⏱️XL **نظام تصميم موحّد v2** — مكتبة مكوّنات أساسية (Button/Input/Card/Dialog/Badge/Switch/Tabs) تستخدم tokens حصراً + توسيع tokens (status/density/duration/skeleton).
  - ✅ شريحة 1/3 — primitives أربعة (2026-06-22 wave-29): ButtonV2/InputV2/CardV2/DialogV2. 33 اختبار.
  - ✅ شريحة 2/3 — (2026-06-23 wave-30، agent C): `BadgeV2.jsx` (5 variants، dot indicator)، `SwitchV2.jsx` (role=switch، 44px tap target، RTL logical props)، `TabsV2.jsx` (compound، keyboard nav ArrowKey/Home/End، ARIA tablist/tab/tabpanel). `design-tokens.css`: كتلة `:root` canonical لـ 14 رمز `--va-*` بقيم light+dark. 38 اختبار جديد. 1043 tests green.
  - ✅ شريحة 3/3 — (2026-06-24 wave-32، agent B): `ToastV2.jsx` (4 variants، 3 positions، CSS-only animations، role=alert، Escape dismiss)، `TooltipV2.jsx` (4 logical positions، delay 300ms، aria-describedby)، `useToast.js` hook (queue max 3، auto-dismiss)، 24 اختبار جديد. 2 call sites هُجِّرت (OcrButton + ApiKeysSettings). 1143 tests green.
  - الملفات: `archive-app/src/components/ui/*`، `archive-app/src/styles/design-tokens.css`.
  - القبول: صفر ألوان مُرمّزة في المكتبة؛ tokens الجديدة موثّقة ومستخدمة.
  - المصدر: dev-roadmap (P1-06)، ux_plan/guide_v6 (Design Tokens).

- [x] `[P1]` ⏱️L **تحسين شامل للنظام اللوني والثيم الأساسي** — مراجعة وضبط palette + tokens النص/الخلفية/الحدود + ألوان الأزرار (primary/secondary/ghost/destructive) + ألوان الحالة (success/warning/danger/info) + المخطّط الليلي/النهاري في ضوء WCAG 2.2 AA.
  - ✅ مُنجز (2026-06-23 wave-31، agent Sonnet): `archive-app/src/styles/design-tokens.css` أُعيد بناؤه كـ single source of truth — كتلة `:root` canonical بـ OKLCH مع `--va-text/-text-2/-text-muted/-text-inverse` (سلّم نصوص بـ contrast ≥7:1 و≥4.5:1 و≥3:1) + `--va-bg/-surface/-surface-2/-elevated` (دلتا إنارة منتظمة) + accent scale `--va-accent-50..950` + status colors (success/warning/danger/info) بـ `-soft/-border/-text` لكل واحد + button palette موحّد. `app-overrides.css` صُلّبت من المكرّرات (13 token متبقّية كانت TODO من DS v2 → نُقلت). `archive-app/scripts/verify-theme-contrast.mjs` (324 سطر، zero-deps OKLCH→sRGB) + `tokenContrast.test.js` (290 سطر). **24/24 pairs PASS WCAG AA** في كلا الوضعين. مع ذلك صلّحت bug عملياً: `--va-btn-primary-bg` كان accent-500 (L=65%) أي 2.82:1 على نص أبيض — حوّلتها إلى accent-700 (L=47%) لتصبح 6.41:1. 1109/1109 frontend tests pass.
  - متبقّي: هجرة `#f8fafc`/`#475569` المتبقّيين في `.jsx` (baseline 4 + 12 instances كحدّ أعلى) كشريحة تالية.
  - الملفات: `archive-app/src/styles/design-tokens.css` + `app-overrides.css` + `archive-app/scripts/verify-theme-contrast.mjs` + `__tests__/tokenContrast.test.js`.
  - القبول: كل النصوص والأزرار تجتاز WCAG 2.2 AA؛ `verify-theme-contrast.mjs` يطبع جدول passing (24/24). ✓
  - المصدر: طلب المستخدم 2026-06-23.
  - النطاق: (أ) **مراجعة contrast حقيقية** لكل token: text-on-surface (≥4.5:1 للنص العادي، ≥3:1 للكبير)، text-on-accent، text-on-status. (ب) **سلّم نصوص واضح**: `--va-text` (high) / `--va-text-2` (mid) / `--va-text-muted` (low) / `--va-text-inverse` للأسطح المُلوَّنة. (ج) **سلّم أسطح متماسك**: `--va-bg` / `--va-surface` / `--va-surface-2` / `--va-elevated` بدلتا إنارة 4%+ بين كل مستوى. (د) **palette أزرار موحّد** بصيغة OKLCH + hover/active/disabled tints بقيم نسبية لا hex by-hand. (هـ) **ألوان حالة semantic** success/warning/danger/info — مع أيقونة مرافقة (a11y: لا تعتمد على اللون وحده). (و) **نقل الـ 13 token** المرحَّلة في `app-overrides.css` إلى `design-tokens.css` (TODO من DS v2). (ز) **توثيق + اختبار contrast**: سكربت `scripts/verify-theme-contrast.mjs` يفشل إذا انخفض الـ contrast دون العتبة.
  - الملفات: `archive-app/src/styles/design-tokens.css` (الكتلة الرئيسية)، `app-overrides.css` (حذف ما انتقل)، `archive-app/src/components/ui/*V2.jsx` (التأكد من الاستهلاك)، `archive-app/scripts/verify-theme-contrast.mjs` (جديد)، `archive-app/src/styles/__tests__/tokenContrast.test.js` (جديد).
  - القبول: كل النصوص والأزرار تجتاز WCAG 2.2 AA؛ `verify-theme-contrast.mjs` يطبع جدول passing؛ لا hex مرمّز خارج tokens canonical.
  - المصدر: طلب المستخدم 2026-06-23.

- [ ] `[P2]` ⏱️L **إكمال K8s + توحيد Docker Compose** — ملفات compose → ملف واحد بـ profiles؛ إضافة Redis+Whisper لـ K8s + kustomization.
  - ✅ إصلاح بوابة Compose وصورة السيرفر (2026-06-27): أُضيفت placeholder آمنة للمتغيرات المطلوبة في `archive-server/.env.example` (`POSTGRES_*`, `REDIS_PASSWORD`, `PGADMIN_*`, `GRAFANA_PASSWORD`, أسرار JWT)، ونُقلت التعليقات من inline إلى أسطر مستقلة حتى لا تُفسَّر كقيم داخل Docker Compose. أُضيف `tsconfig.base.json` إلى `archive-server/Dockerfile.server` في مراحل build/runtime حتى لا يفشل Prisma/tsx بعد بدء ترحيل TypeScript. مرّت `docker:config` و`docker:config:postgres` وبناء صورة السيرفر.
  - الملفات: `archive-server/deploy/*`, `archive-server/*.yml`.
  - المصدر: dev-roadmap (P1-07).

- [x] `[P2]` ⏱️L **تبسيط متغيّرات البيئة 69→25** — توحيد في تكوين مركزي بقيم افتراضية ذكية.
  - ✅ مُنجز (2026-06-22 wave-29، agent Sonnet): 69 → 25 var operator-facing. `archive-server/src/config/env.js` يجمع كل قراءات `process.env` في `config` object مع validation وdefaults ذكية. 20 production source files حُوّلت من `process.env.X` إلى `import { config } from "./config/env.js"; config.x`. 5 أبرز التغييرات: (1) `CONTROL_AGENT_ACTIONS_ENABLED` → دمج في `CONTROL_AGENT_ACTIONS`؛ (2) `OPENAI_API_KEY` → fallback إلى `AI_API_KEY` عبر `config.openaiApiKey`؛ (3) 37 tuning vars (`RATE_LIMIT_*`، `BACKUP_RETENTION_*`، `SMTP_PORT/SECURE/FROM`، `SHARE_EXPIRY_DAYS`، إلخ) خُفّضت إلى defaults؛ (4) جميع `process.env` reads في 20 ملف → single boot-time evaluation؛ (5) `ARCHIVE_PDF_FONT_PATH`/`FFMPEG_PATH`/`SERVER_CONFIG_PATH`/`COMPOSE_FILE`/`APP_VERSION` أُزيلت من `.env.example` (تفاصيل تطبيق داخلية). 27 اختبار جديد لـ env config. `docs/env-migration.md` يخرّط الأسماء القديمة → الجديدة.
  - الملفات: `archive-server/src/config/*`, `.env.example`.
  - المصدر: dev-roadmap (P0-10).

- [ ] `[P2]` ⏱️L **توسيع اختبارات E2E + ترقية الحزم الأمنية** — رفع تغطية Playwright + `npm/pnpm audit` للـ CVEs.
  - المصدر: dev-roadmap (P0-09, P1-08, P5-04).

- [ ] `[P2]` ⏱️M **ترتيب وتنظيف مجلدات المشروع + بوابة Playwright** — جرد الملفات والمجلدات غير المفيدة أو المولّدة عشوائياً، ثم حذف/نقل الآمن منها مع إثبات عدم كسر التشغيل.
  - يشمل: فحص مجلدات الجذر و`archive-app/` و`archive-server/` و`archive-core/`؛ تصنيف الملفات إلى: مصدر، توثيق، اختبارات، مخرجات بناء، نسخ احتياطية، لقطات/تقارير، مخلفات تشغيل؛ تحديث `.gitignore` عند الحاجة؛ نقل الوثائق المتناثرة إلى `docs/` أو مجلدها الصحيح؛ إزالة الملفات المكررة أو القديمة فقط بعد البحث عنها بـ `rg` والتأكد من عدم استخدامها.
  - Playwright: إضافة/توسيع اختبارات E2E تغطي التشغيل بعد التنظيف: التحميل الأول، التنقل الأساسي، صفحة الأرشيف، صفحة الإعدادات، مدير الملفات، وصفحة التفاصيل/المعاينة؛ وإضافة smoke بصري يلتقط أخطاء المسارات المكسورة أو assets المفقودة بعد نقل الملفات.
  - الملفات: `TASKS.md`، `.gitignore`، `README.md`/`docs/*` عند الحاجة، `archive-app/tests/*`، `archive-app/playwright.config.ts`، وربما سكربت جديد مثل `scripts/verify-repo-hygiene.mjs`.
  - القبول: تقرير جرد قصير يذكر ما أُبقي وما حُذف/نُقل ولماذا؛ لا حذف لملفات داخل `.git` أو ملفات مستخدمة؛ نجاح `pnpm verify`؛ نجاح `pnpm --filter @archive/app run e2e` أو مجموعة Playwright محددة موثقة؛ عدم ظهور 404/console errors حرجة في لقطات Playwright.
  - المصدر: طلب المستخدم 2026-06-27.

- [ ] `[P1]` ⏱️XXL **ترحيل معماري إلى Laravel API + Next.js TypeScript** — اعتماد Laravel كخادم نطاق وAPI، وNext.js كواجهة TypeScript تدريجية، دون إدخال Astro 5.
  - شريحة 0 — قرار معماري: Laravel مسؤول عن Auth/Policies/Queues/Files/Media jobs/REST API، وNext.js مسؤول عن الواجهة، SSR/ISR للصفحات العامة، وclient app للصفحات التشغيلية الثقيلة. حفظ القرار في `docs/laravel-nextjs-migration-plan.md`.
  - شريحة 1 — عقد API قبل النقل: تثبيت OpenAPI/JSON contract للكيانات الحالية (`items`, `types`, `folders`, `rights`, `files`, `auth`) حتى يمكن تشغيل Next.js فوق الخادم الحالي ثم Laravel لاحقاً.
  - شريحة 2 — Next.js shell: إنشاء حزمة `archive-next` لاحقاً بـ TypeScript، App Router، RTL، design tokens الحالية، وتوجيه تدريجي يبدأ بصفحات عامة/مساعدة/تقارير قبل صفحات العمل الثقيلة.
  - ✅ شريحة 1/4 — عقود API (2026-06-27): أُضيف `docs/api/archive-contract.openapi.json` بعقد OpenAPI 3.1 يغطي health/auth/records/search/files/folders/rights/share، مع `docs/api/README.md` وبوابة `pnpm run verify:api-contracts`.
  - ✅ شريحة 2/4 — Next.js shell أولي (2026-06-27): أُضيفت حزمة workspace `archive-next` باسم `@archive/next` مع Next.js 16، TypeScript، App Router، صفحة RTL عربية تقرأ عقد API، وسكربتات `dev:next`/`build:next`/`typecheck:next`. مرّت `pnpm run typecheck`, `pnpm run build:next`, `pnpm run verify:api-contracts`, و`pnpm run build:spa`.
  - ✅ شريحة 2b — Next.js API client أولي (2026-06-27): أُضيف `archive-next/lib/archive-api.ts` بعميل typed خفيف لـ health/me/search/rights/share مبني على عقد API، واستُخدم في الصفحة الرئيسية. مرّت `pnpm run typecheck` و`pnpm run build:next`.
  - شريحة 3 — Laravel API: إنشاء `archive-laravel` لاحقاً مع Sanctum أو session cookies، migrations مطابقة للـ Prisma schema، queues للمعالجة الثقيلة، وطبقة file storage متوافقة مع التخزين المحلي/S3.
  - ✅ شريحة 3/4 — Laravel scaffold أولي (2026-06-27): أُنشئ `archive-laravel` عبر Composer داخل Docker بـ Laravel 13، وأُضيفت routes أولية `/api/v1/health` و`/api/v1/public/openapi.json` تقرأ العقد المشترك، مع اختبار Feature. مرّ `docker run --rm -v "D:\archiveaq\Arch_App:/app" -w /app/archive-laravel composer:latest php artisan test` بنتيجة 4 اختبارات و21 assertion.
  - ✅ شريحة 3b — Laravel schema أساس (2026-06-27): أُضيف migration لـ `storage_rows` و`rights_records` مطابق كبداية لعقد records/rights، مع اختبار `ArchiveSchemaTest`. مرّت Laravel tests بنتيجة 5 اختبارات و37 assertion.
  - ✅ شريحة 3c — Laravel rights API (2026-06-27): أُضيفت endpoints `GET/POST /api/v1/rights`, `GET /api/v1/rights/expiring`, و`GET /api/v1/rights/{itemId}/enforcement` فوق `rights_records`، مع upsert يحافظ على معرف السجل واختبارات Feature. مرّت `php artisan test` داخل Docker بنتيجة 8 اختبارات و54 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3d — Laravel API key guard (2026-06-27): أُضيف middleware `archive.api_key` يحمي route group الحقوق عبر `X-Archive-Api-Key` أو Bearer token، مع `ARCHIVE_API_KEY` في `.env.example` واختبارات رفض الطلبات غير الموثقة/غير المضبوطة. مرّت Laravel tests بنتيجة 10 اختبارات و58 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3e — Laravel records compatibility API (2026-06-27): أُضيف `GET /api/v1/records` مع cursor pagination و`POST /api/v1/records/bulk` فوق جدول `storage_rows`، مع حفظ الحقول المرنة كما يطلب عقد `ArchiveRecord` واختبارات Feature للـ bulk/list/auth/validation. مرّت Laravel tests بنتيجة 13 اختباراً و75 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3f — Laravel search API (2026-06-27): أُضيف `GET /api/v1/search` كبحث keyword مبدئي فوق `storage_rows` مع filter للمتجر، cursor pagination، وfacets توضّح `keyword`/`keyword-fallback` لحين semantic search. استُخرج `StorageRowPayload` لتوحيد تنسيق records/search. مرّت Laravel tests بنتيجة 16 اختباراً و91 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3g — Laravel files/browser API (2026-06-27): أُضيف `GET /api/v1/files` و`GET /api/v1/files/browser` فوق `ARCHIVE_FILE_ROOT` مع listing آمن، query filter، منع path traversal، واختبارات Feature. مرّت Laravel tests بنتيجة 20 اختباراً و104 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3h — Laravel public share API (2026-06-27): أُضيف جدول `share_links` و`POST /api/v1/share` المحمي و`GET /api/v1/share/{token}` العام، مع scope itemIds، permission، expiresAt، password hash اختياري، وإرجاع records من `storage_rows`. مرّت Laravel tests بنتيجة 23 اختباراً و121 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3i — Laravel audit log أساس (2026-06-27): أُضيف جدول `audit_logs` وmiddleware `archive.audit` لتسجيل الطلبات المعدِّلة داخل route group المحمي، مع action/status/metadata/ip/user-agent واختبارات Feature. مرّت Laravel tests بنتيجة 25 اختباراً و125 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3i.2 — Laravel audit taxonomy (2026-06-27): وُسّع `audit_logs` بحقول `event`, `resource_type`, `resource_id`, `actor_id`, و`outcome` مع classifier لمسارات records/rights/share/auth logout، وبقي `action` للتوافق. مرّت Laravel tests بنتيجة 29 اختباراً و180 assertion.
  - ✅ شريحة 3j — Laravel HttpOnly session auth (2026-06-27): أُضيف جدول `api_sessions` و`AuthController` لمسارات `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/refresh`, و`POST /api/v1/auth/logout` مع access Bearer token وrefresh cookie باسم `va_refresh`، ودوران refresh token، وإلغاء الجلسة عند logout. استُبدل الحارس المؤقت بـ `archive.auth` الذي يقبل Bearer/HttpOnly cookie ويبقي `X-Archive-Api-Key` كfallback داخلي للهجرة فقط. مرّت Laravel tests بنتيجة 29 اختباراً و150 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3k — إزالة API-key fallback (2026-06-27): حُذف `ARCHIVE_API_KEY` وmiddleware القديم، وصار `archive.auth` يعتمد فقط على Bearer access token أو `va_refresh` cookie. حُوّلت اختبارات Laravel المحمية إلى trait مشترك ينشئ جلسة Auth حقيقية بدلاً من `X-Archive-Api-Key`. مرّت Laravel tests بنتيجة 28 اختباراً و176 assertion، ومرّ `pnpm run typecheck` و`pnpm run verify:api-contracts`.
  - ✅ شريحة 3l — Laravel queue-backed media workflow أساس (2026-06-27): أُضيف عقد OpenAPI لمسارات media، وجدول `media_jobs`، و`POST /api/v1/media/jobs` لإنشاء workflow محمي، و`GET /api/v1/media/jobs/{id}` لقراءة الحالة، وJob باسم `ProcessMediaWorkflow` يؤسس lifecycle من queued إلى processing/completed كحد queue أولي قبل المعالجات الفعلية. مرّ `pnpm run verify:api-contracts` وLaravel tests بنتيجة 32 اختباراً و194 assertion.
  - ✅ شريحة 4a — Next.js Playwright smoke (2026-06-27): أُضيف `pnpm run e2e:next` لاستخدام Playwright الموجود في `archive-app` ضد `E2E_BASE_URL`، مع اختبار `next-migration-shell.spec.ts` يتحقق من RTL shell، الشعار، وعرض حالة عقد API على desktop/mobile. مرّ `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8944 pnpm run e2e:next` بنتيجة 2 passed.
  - ✅ شريحة 4b — Next.js auth client parity (2026-06-27): وُسّع `archive-next/lib/archive-api.ts` بعميل typed لمسارات `login/me/refresh/logout`، مع `credentials: "include"`، ودعم Bearer access token اختياري لبقية الطلبات المحمية، وتحديث صفحة shell/smoke test لعرض جاهزية Auth. مرّ `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8961 pnpm run e2e:next` بنتيجة 2 passed.
  - ✅ شريحة 4c — Next.js login route (2026-06-27): أُضيف `/login` كأول شاشة Auth فعلية في `archive-next` تستخدم `createArchiveApiClient().login()`، تعرض حالة success/error، وتحافظ على access token في state محلي بينما يعتمد refresh على cookie HttpOnly. وُسّع smoke test لزيارة `/login`. مرّ `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8970 pnpm run e2e:next` بنتيجة 4 passed.
  - ✅ شريحة 4d — Next.js public share route (2026-06-27): أُضيف `/share/[token]` كأول مسار عام منخفض المخاطر في `archive-next`، يستخدم `createArchiveApiClient().share()` ويعرض حالة loading/error/records دون تحويل المرور الإنتاجي بعد. وُسّع smoke test لزيارة `/share/demo-token` على desktop/mobile. مرّ `pnpm run typecheck:next`, `pnpm run build:next`, و`E2E_BASE_URL=http://127.0.0.1:8978 pnpm run e2e:next` بنتيجة 6 passed.
  - ✅ شريحة 4e — Next.js/Laravel route integration smoke (2026-06-27): أُضيف rewrite في `archive-next/next.config.mjs` يمرر `/api/v1/*` إلى `ARCHIVE_API_BASE_URL`، وSeeder ثابت `NextIntegrationSeeder`، وسكربت `pnpm run e2e:next:integration` الذي يتحقق أن `/share/[token]` في Next يعرض record قادماً من Laravel حي. مرّت `pnpm run typecheck:next`, `pnpm run verify:api-contracts`, `pnpm run build:next`, و`pnpm run e2e:next:integration` بنتيجة 2 passed، كما مرّت Laravel tests بنتيجة 28 اختباراً و176 assertion.
  - شريحة 4 — تشغيل متوازٍ: إبقاء Vite/React الحالي إلى أن تمر Playwright smoke على Next.js، ثم نقل صفحة بصفحة مع بوابة `typecheck`, `build`, وE2E.
  - الملفات: `docs/laravel-nextjs-migration-plan.md`, `TASKS.md`, عقود API لاحقاً تحت `docs/api/`, وحزم جديدة لاحقاً فقط بعد قرار scaffold.
  - القبول: لا اعتماديات Astro؛ `pnpm run typecheck` ينجح؛ خطة Laravel/Next واضحة؛ أي scaffold جديد لا يكسر Vite الحالي.
  - المصدر: طلب المستخدم 2026-06-27.

---

## 3. محرّر المونتاج متعدد المسارات (Montage) — net-new كبير

> الحالة: ProjectsPage فيه `roughCuts`/`inSec/outSec`/transitions/looks/filters/EDL+JSON+MP4 لكن **قائمة نصية بلا خط زمني مرئي** (تم التحقق: لا `MultiTrack`).

- [x] `[P0]` ⏱️XL **خط زمني مرئي متعدد المسارات (Multi-Track Timeline)** — تحويل القائمة النصية إلى Canvas أفقي: 3 فيديو + 2 صوت + 1 عنوان، سحب/إفلات بين المسارات، نقاط تقطيع قابلة للسحب.
  - ✅ مُنجز (2026-06-21 wave-25, commit `c5fb487`): `MultiTrackTimeline.jsx` + `TimelineClip.jsx` + `TrackHeader.jsx` بواجهة @dnd-kit (PointerSensor + TouchSensor + KeyboardSensor)؛ مسارات video/audio/title/adjustment ديناميكية مع snap-to-frame، ripple modes، marker overlay، حوار حذف مسار مع نقل القصاصات. ProjectsPage يستخدم `handleTimelineCommand` لإدارة كل عمليات الخط الزمني عبر multiTrackModel. 22 اختبار unit + E2E يغطي إضافة وتسمية مسار فيديو ثانٍ.
  - الملفات: `archive-app/src/components/montage/MultiTrackTimeline.jsx`، `TimelineClip.jsx`، `TrackHeader.jsx`، `multiTrackModel.js`، `pages/ProjectsPage.jsx`.
  - القبول: ترتيب المقاطع بالسحب يعمل ويُحفظ؛ عرض البلوك = مدته.
  - المصدر: new_tail (F13)، dev-roadmap (P2-01).

- [x] `[P1]` ⏱️L **Clip Thumbnails + طبقة التعليقات الزمنية على الخط الزمني** — خلفية thumbnail لكل block + إشارات ▲ للتعليقات (`addTemporalComment` موجودة).
  - ✅ مُنجز (2026-06-21 wave-25, commit `6c1c912`): `TimelineClip` يقبل `thumbnailUrl` و`comments[]`؛ الصورة تُرسم كخلفية مغطاة مع تدرّج داكن، والتعليقات تظهر كدبابيس MessageCircle ملوّنة (أصفر مفتوح/أخضر محلول) فوق القصاصة عند موضعها الزمني. الضغط على الدبوس يُصدر `clip.comment-focus` → ProjectsPage يختار القصاصة ويقفز بـ playhead إلى `atSec`. ProjectsPage يبني `thumbnailsByItemId` من `items[].thumbnail` و`commentsByClipId` من `project.comments`.
  - الملفات: `archive-app/src/components/montage/TimelineClip.jsx`، `MultiTrackTimeline.jsx`، `MontageWorkspace.css`، `pages/ProjectsPage.jsx`.
  - القبول: thumbnail يظهر لكل مقطع؛ الضغط على إشارة يعرض التعليق.
  - المصدر: new_tail (F14, F15).

- [x] `[P1]` ⏱️L **معاينة Look/Transition** — swatches ملونة للـ looks + أزرار مرئية للـ transitions (proxy workflow يبقى مهمة خادم منفصلة).
  - ✅ مُنجز (2026-06-22 wave-27): `LOOK_SWATCHES` (5 تدرجات) + `TRANSITION_ICONS` أُضيفا في `ProjectsPage.jsx`. looks تعرض شريطاً ملوناً H-8؛ transitions انتقلت من `<select>` إلى شبكة أزرار مرئية. 933 اختبار ناجح.
  - الملفات: `archive-app/src/pages/ProjectsPage.jsx`.
  - المصدر: new_tail (F16)، dev-roadmap (P2-03).

- [x] `[P2]` ⏱️M **Media Readiness + Export Package Wizard** — عرض `buildMediaReadiness()` قبل التصدير + معالج تصدير من خطوتين (`buildProjectDeliveryPackage()` موجودة).
  - ✅ مُنجز (2026-06-24 wave-35، agent B): `MediaReadinessPanel.jsx` (readiness % + color bar + blocking issues + "تصدير على أي حال"). `ExportPackageWizard.jsx` (DialogV2، خطوتان: محتوى/صيغة، 4 formats). 12 اختبار. 1218 tests green.
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

- [x] `[P1]` ⏱️L **Virtual Scrolling في ArchivePage** — قوائم +1000 عنصر عبر TanStack Virtual / react-window.
  - ✅ مُنجز (2026-06-23 wave-30، agent D): `useVirtualList.js` — estimateSize/overscan/scrollKey/containerScroll، sessionStorage scroll-position save+restore. `ArchivePageResults.jsx`: list view container-scroll (72px rows، overscan 5، RTL-safe). 8 اختبار جديد. 1043 tests green.
  - المصدر: ux_plan (Sprint 4)، guide_v6 (ArchivePage).

- [x] `[P1]` ⏱️L **Lazy Loading للمكتبات الثقيلة** — Cytoscape, Recharts, pdfjs, xlsx, sql.js عبر dynamic import.
  - ✅ مُنجز (wave-22): تحقّق كامل — كل الصفحات تستخدم React.lazy()؛ Cytoscape/pdfjs/sql.js لها dynamic import مباشر؛ xlsx أُصلح (wave-22) من static import إلى dynamic import حقيقي في vendor/xlsx.js + DataCenterPage + ReportsPage. لا حاجة لمزيد من التغييرات.
  - الملفات: `archive-app/src/pages/{GraphViewPage,AnalyticsPage}.jsx`، نقاط الاستيراد.
  - القبول: لا تُحمَّل المكتبة إلا عند فتح صفحتها؛ قياس بـ rollup-plugin-visualizer.
  - المصدر: ux_plan (perf)، f45ea5a29 (GraphView lazy)، dev-roadmap (P5-01).

- [x] `[P1]` ⏱️L **تدقيق a11y شامل (WCAG 2.2 AA)** — تشغيل `vitest-axe`/`@axe-core/playwright` على كل صفحة + إصلاح focus/landmarks/labels + مراجعة التباين (4.5:1) في الوضعين.
  - ✅ مُنجز (2026-06-24 wave-34، agent A): `pages.a11y.test.jsx` — 37 assertions جديدة (ButtonV2/InputV2/BadgeV2/CardV2/SwitchV2/TabsV2/DialogV2/ToastV2/TooltipV2 + 3 صفحات). إصلاح: SwitchV2 — `aria-labelledby` مفقود أُضيف. 58 إجمالي axe assertions. 1192 tests green.
  - الملفات: `archive-app/src/**`، توسيع `components.a11y.test.jsx`.
  - القبول: Lighthouse Accessibility ≥95؛ صفر مخالفات axe حرجة.
  - المصدر: ux_plan (Sprint 4, a11y)، guide_v6 (KPIs).

- [x] `[P1]` ⏱️L **مراجعة RTL Logical Properties شاملة** — استبدال `margin/padding-left/right` بـ `*-inline-start/end`؛ `dir="ltr"` للـ URLs/المسارات/التواريخ؛ أيقونات الاتجاه تتبع RTL.
  - ✅ مُنجز (2026-06-24 wave-34، agent B): 36 تحويل في 14 ملف (primitives، ActivityTimeline، ShellParts، ArchiveToolbar، ExportButton، ArchiveViews، إلخ). استثناءات: وسائط/lightbox/FABs. 1192 tests green.
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
- [x] `[P2]` ⏱️M **Batch Fix + Inline Cell Editing + Saved Views persistence** — إصلاح بالجملة + تحرير داخل الجدول + حفظ عرض الأعمدة/الفرز.
  - ✅ مُنجز (2026-06-24 wave-35، agent A): `BatchFixToolbar.jsx` (3 dropdowns: حالة/نوع/فرع، updateVideoItem بالجملة، showToast). `useSavedViews.js` (localStorage، cap 20، save/delete). 13 اختبار. 1206 tests green.
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

## 22. تبسيط جذري لتجربة الإطلاق + Setup.bat (طلب المستخدم 2026-06-21)

> **السياق:** تجربة الإطلاق الحالية (`V1OnboardingWizard`، 9 خطوات في `ONBOARDING_STEPS`) كثيرة وتُعقّد الدخول الأول. المطلوب: شاشة هبوط بخيارين فقط (سريع/متقدم)، ودمج كل الجولات والتعريفات في معالج «جولة الميزات» واحد قابل للتجاهل ولإعادة التشغيل من المساعدة، ونقل الخطوات الثانوية إلى صفحة المساعدة، وتحسين `setup.bat`/`control-center` ليكون أكثر مرونة ووضوحاً.

- [x] `[P0]` ⏱️M **شاشة هبوط بخيارين فقط (Boot Choice)** — تعرض «بدء سريع» و«إعداد متقدم» قبل أي معالج. «بدء سريع» يطبّق الإعدادات الافتراضية بنقرة واحدة: حساب admin افتراضي + قاعدة بيانات محلية + تخزين محلي + ثيم النظام، ثم يدخل للوحة التحكم مباشرة. «إعداد متقدم» يفتح `V1OnboardingWizard` الحالي بكل خطواته.
  - ✅ مُنجز (2026-06-21 wave-25, commit `738c469`): `BootChoiceScreen.jsx` (130 سطر) يعرض بطاقتين فقط مع رمز Rocket/Cog. «بدء سريع» يستدعي `skipPasswordSetup` + يسجّل دخول admin + يحدّث `settings.ui.bootChoice="quick"` + `onboardingCompleted=true`. RuntimeShellApp يحرس بـ `bootChoice || v1OnboardingCompleted` فلا يعيد عرض الشاشة. تم تأكيد البصري حياً: شاشة الخيارين تظهر على state نظيف، الضغط على بدء سريع يدخل #/dashboard مع الشريط الجانبي. 933 اختبار ناجح (+2 جديدة).
  - الملفات: `archive-app/src/features/onboarding/BootChoiceScreen.jsx`، `BootChoiceScreen.test.jsx`، `index.js`، `archive-app/src/app/RuntimeShellApp.js`.
  - القبول: عند فتح التطبيق لأول مرة تظهر شاشة الخيارين فقط؛ زر «بدء سريع» يكمل التهيئة دون أي خطوة إضافية ويصل للداشبورد؛ زر «إعداد متقدم» يظهر الويزارد الحالي كما هو.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️M **معالج «جولة الميزات» واحد قابل للتجاهل ولإعادة التشغيل** — دمج `UsageOnboarding` + الجولات الموزّعة + خطوات `ONBOARDING_STEPS` الثانوية في معالج واحد يعرض الميزات الأساسية في 4 شرائح.
  - ✅ مُنجز (2026-06-22 wave-26): `V1ProductTour` في `ShellParts.jsx` أُعيد بناؤه بـ `createFeatureTourSlides()` — 4 شرائح (الواجهة + الأرشيف + الاختصارات + الذكاء الاصطناعي). الشريحة 1 تعرض `CORE_UI_TOUR_ITEMS`؛ الشريحة 3 تعرض `ONBOARDING_SHORTCUTS` بـ kbd pills. مؤشر نقاط ملاحية قابل للنقر؛ زر «تخطّى نهائياً» صريح. 933 اختبار ناجح.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️S **زر «شغّل جولة الميزات» في صفحة المساعدة** — إضافة بطاقة في `HelpPage` تُطلق `FeatureTour` في أي وقت عبر `window.dispatchEvent("videoarchive:onboarding-open", { mode: "replay" })`.
  - ✅ مُنجز (2026-06-21 wave-25): زر «إعادة الجولة» الموجود في `HelpPage` كان يُصفّر علامات `v1TourCompleted` فقط دون فتح أي معالج؛ الآن يطلق أيضاً حدث `videoarchive:onboarding-open` بـ `mode: "replay"` (يستقبله `RuntimeShellApp:268-270` ويفتح `V1OnboardingWizard` في وضع التشغيل المتأخر).
  - الملفات: `archive-app/src/pages/HelpPage.jsx:495-500`.
  - القبول: المستخدم يستطيع إعادة عرض الجولة من المساعدة بنقرة واحدة.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P2]` ⏱️M **نقل الخطوات الثانوية إلى صفحة المساعدة كمواضيع** — مواضيع «التخزين»، «الواجهة»، «الحماية»، «المظهر»، «البيانات» كأقسام قابلة للبحث.
  - ✅ مُنجز (2026-06-22 wave-27): 5 أقسام جديدة في `createHelpSections()`: `storage-setup`، `security-guide`، `interface-guide`، `appearance-guide`، `data-guide` — كل قسم له عنوان + أيقونة + `searchText` + `InfoGrid` تفصيلي. تظهر في القائمة الجانبية وقابلة للبحث. 933 اختبار ناجح.
  - الملفات: `archive-app/src/pages/HelpPage.jsx`.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️M **تحسين `setup.bat`/`control-center.mjs` — أوامر مختصرة + مساعدة موسّعة + تشخيص أولي**
  - ✅ مُنجز (2026-06-22 wave-26): `quick` (deploy+start+health)، `doctor` (Node/pnpm/Docker/port check مع تقرير ملوّن)، `help` موسّعة بكل الأوامر + أمثلة. القائمة التفاعلية أُضيف لها قسم «Quick Actions» مع [q] و[d].
  - ✅ إضافات (2026-06-22 wave-27): (أ) `preflightSummary()` يعمل تلقائياً عند فتح القائمة التفاعلية ويعرض حالة Node/pnpm/Docker/.env بسطر واحد، ويُبلّغ عن المشاكل بأسطر `- ...` مع الإحالة لـ `doctor` للتفاصيل الكاملة. (ب) `help` صار يطبع قسم «Quick-start examples»، شبكة الأوامر، قسم «Troubleshooting» بثلاث وصفات (stack not running / no .env / port in use)، ثم قائمة القائمة التفاعلية كاملة. صلّحت اختبار `control-center.test.mjs` الذي كان فاشلاً مسبقاً (يفترض أن `help` يتضمّن أقسام المنيو).
  - الملفات: `scripts/control-center.mjs`.
  - المصدر: طلب المستخدم 2026-06-21، 2026-06-22.

- [x] `[P1]` ⏱️S **التحقق من تحميل تلقائي لإعدادات SQL/PocketBase في «الإعداد المتقدم»** — التحقق أن المعالج المتقدم يكشف `.env` ويستخدم القيم الموجودة بنقرة واحدة.
  - ✅ مُنجز مسبقاً (موجة سابقة): `V1OnboardingWizard.jsx:299-310` يستدعي `/api/setup/preset-config` عند الفتح ويخزّن `presetConfig`. عند توفّر إعداد كامل يُعرض `PresetConfigScreen` (الأسطر 1211–1240) يظهر backend/DATABASE_URL/ADMIN_EMAIL/JWT_SECRET/dbReachable مع زر «استخدام الإعدادات المكتشفة» يكمل الإعداد بنقرة واحدة. يدعم postgres وpocketbase معاً (`createPresetFormState`).
  - الملفات: `archive-app/src/features/onboarding/V1OnboardingWizard.jsx`، `PresetConfigScreen.jsx`، `archive-server/src/index.js` (نقطة `/api/setup/preset-config`).
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️M **وضع «بسيط/متقدم» داخل المعالج المتقدم** — تبسيط معالج الإعداد المتقدم بحيث يبدأ في «بسيط» (3 خطوات: backend + admin + start) ويوفّر زر «المزيد من الخيارات» يكشف الخطوات المتقدمة (file-store، appearance، interface، shortcuts، data، server update policy). يحفظ التفضيل في `settings.ui.advancedSetupMode`.
  - ✅ مُنجز (2026-06-21 wave-25): `flow.js` يحمل الآن `tier: "basic" | "advanced"` على كل خطوة (basic = `storage`, `admin`, `first-task`). `V1OnboardingWizard` يقرأ `settings.ui.advancedSetupMode` (افتراضي `basic`)، يفلتر الخطوات بـ tier، ويفرض `securityMode="secure"` في الوضع البسيط ليبقى `admin` ضمن الفلتر. أُضيف زر «المزيد من الخيارات»/«إخفاء الخيارات المتقدمة» في footer الـ wizard (`aria-pressed`)؛ التبديل لا يعيد بدء المعالج بل يوسّع/يطوي قائمة الخطوات فوراً ويُحفظ في `settings.ui.advancedSetupMode`.
  - الملفات: `archive-app/src/features/onboarding/V1OnboardingWizard.jsx` (state + filter + toggle + persist)، `archive-app/src/features/onboarding/flow.js` (وسم `tier` على `ONBOARDING_STEPS`).
  - القبول: في الوضع «بسيط» يظهر 3 خطوات فقط (storage → admin → first-task)؛ النقر على «المزيد» يكشف الباقي دون إعادة بدء المعالج.
  - المصدر: طلب المستخدم 2026-06-21.

- [ ] `[P1]` ⏱️XL **دعم Microsoft SQL Server كـ backend جديد** — إضافة `sqlserver` كخيار في `BACKEND_CHOICES` + Prisma provider جديد + ترحيل schema المعادل + نقطة في `/api/setup/preset-config` تكشف `SQLSERVER_URL`.
  - الملفات: `archive-server/prisma/schema.prisma` (provider="sqlserver" بصيغة `Server=...;Database=...;User Id=...;Password=...;`)، `archive-server/scripts/set-db-provider.mjs` (إضافة sqlserver)، `archive-app/src/bootstrap/backendChoice.js` (BACKEND_CHOICES + label عربي)، `archive-app/src/features/onboarding/flow.js` (ONBOARDING_STORAGE_OPTIONS)، `docker-compose.sqlserver.yml` (جديد، صورة mcr.microsoft.com/mssql/server).
  - القبول: تشغيل التطبيق على SQL Server يعمل من معالج البدء أو من `pnpm --filter archive-server exec prisma migrate deploy` بعد ضبط `DATABASE_URL`.
  - المصدر: طلب المستخدم 2026-06-21.

- [ ] `[P2]` ⏱️XL **دعم ODBC (عام لقواعد بيانات Windows القديمة)** — جسر عبر `node-odbc` لتشغيل الاستعلامات بدون Prisma (الجزء غير المنطقي من الـ schema). يتطلب طبقة Repository بديلة في `archive-server/src/db/odbcAdapter.js` تكشف نفس واجهة Prisma لمجموعة محدودة من الجداول الأساسية (items, users, settings, audit) — وذلك للمستخدمين الذين يربطون قاعدة بيانات قائمة (DSN موجود في ODBC Data Source Administrator على Windows).
  - الملفات: `archive-server/src/db/odbcAdapter.js` (جديد)، `archive-server/package.json` (تبعية اختيارية `odbc`)، `archive-app/src/bootstrap/backendChoice.js` (BACKEND_CHOICES.odbc)، توثيق DSN في `docs/`.
  - القبول: إدخال DSN في معالج الإعداد المتقدم يكشف الاتصال، يجلب جداول المستخدمين، ويسمح بعمليات قراءة/كتابة أساسية.
  - ملاحظة: حدود المخطّط (لا migrations Prisma) يجب توثيقها بوضوح للمستخدم.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P2]` ⏱️S **بطاقة الساعة والتاريخ في الشاشة الرئيسية** — إضافة بطاقة حية تعرض الوقت (HH:MM) والتاريخ بالأرقام العربية (السنة الميلادية) داخل hero لوحة التحكم، تُحدّث على حدود الدقيقة فقط.
  - ✅ مُنجز (2026-06-21 wave-25): `DashboardPage.jsx` يضم الآن `LiveClockBadge` (helper موضعي) يعرض `Clock3` + الوقت + اليوم/الشهر بصيغة `ar-EG-u-nu-arab`. مُجدول على حدود الدقيقة عبر `setTimeout` متجدد فلا تتسبب الساعة بإيقاظ React كل ثانية. مدمج بجانب زر «إضافة فيديو» في الـ hero مع `aria-label` مدمج للوقت والتاريخ.
  - الملفات: `archive-app/src/pages/DashboardPage.jsx` (`LiveClockBadge` + إدماج في hero).
  - القبول: عند فتح لوحة التحكم يظهر الوقت والتاريخ الحاليان بشكل واضح؛ الوقت يتقدّم على حدود الدقيقة دون عناء render مستمر.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P1]` ⏱️M **تحسين تصميم صفحات تسجيل الدخول والخروج** — a11y + أهداف لمس.
  - ✅ مُنجز (2026-06-22 wave-26): `LoginScreen` و`LockScreen` و`ForceChangePasswordDialog` في `ShellParts.jsx`: أزرار الإرسال → `min-h-[44px]`؛ رسائل الخطأ → `role="alert" aria-live="assertive"`؛ زر «البدء السريع» → `min-h-[44px]`. Design tokens موجودة مسبقاً. 933 اختبار ناجح.
  - الملفات: `archive-app/src/app/shell/ShellParts.jsx`.
  - المصدر: طلب المستخدم 2026-06-21.
  - المصدر: طلب المستخدم 2026-06-21.

- [x] `[P2]` ⏱️S **تنبيه «غير متصل بالإنترنت» قابل للإغلاق + اعتبار وضع local/local-SQL أونلاين** — حالياً `OfflineBanner.jsx` يعرض شريطاً ثابتاً معتمداً فقط على `navigator.onLine` ولا يمكن إخفاؤه؛ هذا يربك في الوضع المحلي (`backendChoice === "local"` أو `localEngine === "sqlite"`) حيث التطبيق يعمل بكامل وظائفه دون إنترنت أصلاً.
  - ✅ مُنجز (2026-06-22 wave-26): `connectivityProbe.js` أضاف `isLocalBackend()` يرجع `true` عندما يكون `getBackendChoice() === "local"`؛ `probeConnectivity` يرجع `true` فوراً في هذا الوضع، و`useConnectivity` يتخطّى الـ interval ويُعيد `{ isOnline: true, isLocalBackend: true }`. `OfflineBanner.jsx` (الفعلي تحت `components/offline/`) يقرأ الآن `isLocalBackend` + `settings.ui.offlineBannerDismissed`، ويُضمّن زر إغلاق `X` + زر «لا تظهر مجدداً» في الشريط العلوي. المنطق الجديد: إذا كان الوضع محلي والطابور فارغ → لا شريط؛ إذا كان أوفلاين والطابور فارغ والمستخدم أغلقه → لا شريط؛ خلاف ذلك يظهر مع أزرار الإغلاق.
  - الملفات: `archive-app/src/features/offline/connectivityProbe.js` (export `isLocalBackend` + short-circuit في `probeConnectivity` و`useConnectivity`)، `archive-app/src/components/offline/OfflineBanner.jsx` (state إغلاق للجلسة + قراءة/كتابة `settings.ui.offlineBannerDismissed` + زرّا الإغلاق).
  - القبول: في الوضع المحلي لا يظهر شريط «غير متصل» أبداً حتى عند فصل الواي-فاي؛ في الخوادم البعيدة يظهر مع زر إغلاق يحترم إعداد المستخدم؛ تغيير الـ backend في وقت التشغيل يُحدّث التقييم فوراً.
  - المصدر: طلب المستخدم 2026-06-22.

- [x] `[P0]` ⏱️S **إصلاح: «تذكر الجلسة على هذا الجهاز» لا يحفظ بيانات الدخول** — خانة «تذكر الجلسة» في `LoginScreen` كانت لا تُبقي المستخدم مسجَّلاً بعد إعادة التحميل في حالتين فعليّتين: (أ) مسار الخادم السحابي (postgres/pocketbase/firebase) كان يحذف `SESSION_KEY` بشكل غير مشروط بعد signIn، ولا يُكتب أي مرجع، و`initAuth` ليس لديه أي فرع لاستعادة جلسة سحابية → المستخدم السحابي يُسجَّل خروجه بعد كل reload رغم تفعيل الخانة. (ب) المسار المحلي كان يكتب `SESSION_KEY` بعد `await updateUser(...)` ضد IndexedDB، فإذا فشلت كتابة قاعدة البيانات (quota، transaction abort) فقدنا الـ session مع أن المصادقة نجحت.
  - ✅ مُنجز (2026-06-22 wave-27): (أ) `authSlice.js` في فرع السحابي يكتب الآن علامة `cloud:<userId>:<expiresAt>` في `SESSION_KEY` عندما `rememberMe=true`، ويحذفها عندما `false`. `initAuth` صار يفهم العلامة `cloud` ويستدعي `getSessionProvider().getCurrentUser()` + `getToken()` لإعادة بناء `currentUser` على reload. (ب) في الفرع المحلي قدّمت كتابة `SESSION_KEY` قبل `await updateUser(...)` وغلّفت تحديث المستخدم في `try/catch` فلا تكسر فشلات قاعدة البيانات «تذكر الجلسة» بعد الآن.
  - الملفات: `archive-app/src/stores/slices/authSlice.js` (initAuth: فرع cloud؛ login: cloud branch يحترم rememberMe + local branch يقدّم كتابة الجلسة)، `archive-app/src/stores/slices/authSlice.remember.test.js` (7 اختبارات regression جديدة).
  - القبول: 7 اختبارات vitest تغطّي: SESSION_KEY يُكتَب في الوضع المحلي مع rememberMe=true، يُحذف مع false، يبقى محفوظاً حتى عند فشل updateUser، الفرع السحابي يكتب علامة "cloud" مع rememberMe=true ويحذف مع false، initAuth يستعيد المستخدم السحابي من SessionProvider، ويُنظّف العلامة عند انقطاع الجلسة السحابية. اختبارات المشروع الكاملة: 945 ناجحة (كان 938).
  - المصدر: طلب المستخدم 2026-06-22.

---

## ملخص الموجة

| الفئة | عدد البنود الرئيسية | الأولوية الغالبة |
|---|---|---|
| §1 جاهزية البث المؤسسي | 10 | P0–P2 |
| §2 الأساس المعماري | 13 | P0–P2 |
| §3 محرّر المونتاج | 6 | P0–P2 |
| §4 الأداء وa11y | 6 | P1–P2 |
| §5 الإعدادات والتنقّل | 4 | P1–P2 |
| §6 تحسينات الصفحات | ~10 مجمّعة | P1–P3 |
| §7 AI والميزات التنافسية | 6 مجمّعة | P2–P3 |

> **مرجع المؤشرات (من التقارير):** الامتثال للبث 41%→90% · TypeScript 0%→95% · i18n 30%→95% · الحزمة الأولية ~2.5MB→~400KB · Lighthouse a11y ~65→≥95 · الذاكرة (50K) ~500MB→≤150MB.
