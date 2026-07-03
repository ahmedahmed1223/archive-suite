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

> **قرار القطع النهائي (2026-07-01):** Laravel + Next.js هما المكدّس المعتمَد نهائياً. كل بند يستهدف `archive-app`/`archive-server` (legacy) أُسقِط أو أُعيد تأطيره للمسار القانوني — راجع §5 و§6. البنود القانونية المتبقّية تُبنى في `archive-laravel`/`archive-next` حصراً.
>
> لا يوجد P0. نفّذ بنداً واحداً في كل مرة، بوابة `pnpm verify` ثم دمج بعد كل بند. التفاصيل في الأقسام أدناه.

**P1 — كلها منجَزة برمجياً، عالقة على تحقق حي بعتاد حقيقي (GPU) — تبقى `[~]`:**
1. §1 تفريغ عربي إنتاجي (GPU + faster-whisper-large-v3) — ⏱️XL — الكود مكتمل؛ ينتظر تحقق دقة ≥90% على GPU/صوت عربي حقيقي.

**P2 — قانوني متبقٍّ:** §7 Live Collaboration — أُنجز presence + locks + Reverb + مسودة مورد مشتركة؛ يبقى OT/CRDT عميق وربط صفحات تشغيلية إضافية عند الحاجة.
  - ✅ أُنجِز هذه الجلسة (2026-07-01): §2 (تنظيف مجلدات · E2E+audit) · §22 ODBC read-repository وCRUD مقيد · §5 لوحة أمان (endpoints + حفظ دائم) · §7 Visual Review (تعليقات/annotation/مقارنة/روابط خارجية) · §7 Live Collaboration شريحة presence · **مشغّل وسائط قانوني + بثّ HTTP Range** (§3/§7 enabler — حلّ منع التشغيل المحلي).
  - ⏳ عالق على عتاد/بيئة خارجية (كود مكتمل): §1 GPU · §2 K8s dry-run (kubectl context).

**P3 — مؤجّل:** §7 (Visual Rules Engine · وسم AI/بحث دلالي · كتالوج عام · وسم جغرافي).

**P2 — تكافؤ الصفحات مع النظام القديم (تدقيق 2026-07-02، 41 صفحة legacy) — الاستراتيجية المعتمدة: نقل مكونات legacy الغنية إلى Next (كلاهما React 19) عبر adapter بيانات، لا إعادة كتابة من الصفر:**
- ✅ موجة 1 (2026-07-02): 6 صفحات نُقلت على API الموجود — `/search` بحث متقدم · `/timeline` خط زمني · `/analytics` تحليلات CSS · `/status` حالة الخادم · `/shares` إدارة الروابط الممنوحة (تخزين محلي كالقديم) · `/favorites` مفضلة + زر نجمة في التفاصيل. أُدرجت كلها في تنقل AppHeader.
- ✅ موجة استعادة الذكاء والقوة (2026-07-02): **Whisper يعمل فعلياً في الحاويات** (كان CLI غير مثبت — أُضيف `whisper-ctranslate2` + Python لصورة العامل بافتراضيات CPU/int8 محلية) · **OCR موصول** (خدمة `ocr-service` القائمة أُضيفت لـ compose على :8788 + عملية `ocr` في خط مهام الوسائط بـ Laravel مع اختبارات) · صفحة `/transcriber` (إرسال → متابعة كل 3ث → عرض بأكواد زمنية) · زر OCR في `/archive/[id]` · **قوة الأرشيف**: تحديد جماعي + إجراءات bulk (وسم/نوع/حالة عبر `records/bulk` بتجميع per-store) + رقائق حالة workflow الست الحقيقية + views محفوظة. Laravel صار 207 اختبارات/839 assertion.
- [x] `[P1]` ⏱️L **إعادة تصميم Masar لاستعادة قدرات الواجهة القديمة داخل Next** — اعتماد التصور في `docs/design/masar-ui-redesign-vision.md`: AppShell موحد، toolbar كثيف، أوضاع عرض الأرشيف، saved views، bulk actions، details rail، Settings Hub، ومراقبة موحدة.
  - ✅ الموجة اكتملت عبر عدة commits (2026-07-02/03): الرئيسية كلوحة تشغيل (`74dbb903`)، `/archive` (`04ebbe56`)، `/types` كـ schema studio (`9f8f474b`)، تنقل الهيدر العام (`dccee634`)، `/settings` (`4c6be2df`)، `/files` (`4c41e6fc`)، `/search` (`9320d3d4`)، `/analytics`+`/errors`+`/status`+`/reports` (`fc702556`)، `/archive/[id]`+`/media/jobs` (`1a354baf`)، وأخيراً `/login`+`/help`+`/media/play`+`/media/compare`+`/media/review`+`/collaboration`+`/review/[token]`+`/share/[token]` (`15f3ce2e`) — جميع الصفحات الآن على `AppShell`/`PageToolbar` الموحّد مع نفس tokens/حالات فارغة-خطأ-تحميل، والصفحات العامة (`review`/`share` بالـ token) صارت تستخدم `PublicHeader`/`PublicFooter` بلا تنقّل داخلي مصادَق. التحقق: `pnpm run typecheck:next` و`pnpm run build:next` نجحا بعد كل شريحة.
  - المتبقي (غير حاجب، منقول أدناه): saved views للأرشيف، bulk actions موسّعة، ودمج backend الموجات 2/3 (راجع البنود التالية).
- [ ] `[P2]` ⏱️L **موجة 2 — يحتاج backend جديد في Laravel أولاً:** المستخدمون والأدوار (CRUD+دعوات) · رفع الملفات (Uploader/AddVideo — endpoint upload) · سجل النشاط/التاريخ (activity + undo/diffs فوق audit log الموجود) · المجموعات Collections (يدوي + smart rules).
  - ✅ أُنجِز رفع الملفات (`550e1725`): `POST /api/v1/uploads` في Laravel (تحقق حجم/امتداد، تخزين على قرص ingest، إنشاء سجل `storage_rows`، وتفعيل media job للوسائط) + صفحة `/uploads` في Next (AppShell/PageToolbar) + `uploadFile()` في `archive-api.ts` + تحديث العقد.
  - ✅ أُنجِز المستخدمون والأدوار (CRUD+دعوات) (2026-07-03): عمود `role` على `users` (افتراضي `viewer`) + جدول `user_invitations` (email/role/token_hash/invited_by/expires_at/accepted_at) عبر migrations جديدة. `UsersController` (`index`/`store`/`update`/`destroy`) مقيّد بفحص `role === 'admin'` inline (بلا spatie/permission أو middleware جديد — 3 أدوار فقط لا تبرر ذلك)، و`InvitationsController::accept` (نقطة عامة غير مصادَقة) يحوّل الدعوة إلى مستخدم فعلي بكلمة مرور. حُدّث `AuthController::formatUser()` ليعيد `role` الحقيقي بدل placeholder `roles: []` الفارغ سابقاً. المسارات: `GET/POST /api/v1/users`, `PATCH/DELETE /api/v1/users/{id}`, `POST /api/v1/invitations/{token}/accept`. في Next: صفحة `/settings/users` (جدول أعضاء + تغيير دور inline + إزالة + نموذج دعوة + قائمة دعوات معلّقة) وربطها من `/settings`، مع `listUsers`/`inviteUser`/`updateUserRole`/`deleteUser`/`acceptInvitation` في `archive-api.ts`. التحقق: `UsersApiTest` **8/8** ضمن سويت Laravel الكامل **201 اختبار / 822 assertion** بلا انحدار؛ `pnpm run typecheck:next` و`pnpm run build:next` نجحا (`/settings/users` static). المتبقي من الموجة: سجل النشاط/التاريخ (undo/diffs)، Collections.
- [ ] `[P2]` ⏱️L **موجة 3 — مخازن مساندة:** بحوث محفوظة · Vocabulary · وسوم هرمية · Inbox/التقاط · مكررات (كشف hash) · Kanban · أتمتة (rules engine).
- 🚫 **لن يُنقل (قرار cutover):** Dashboard widgets وDiscover (استُبدلا بالرئيسية الجديدة) · SyncLog وSystemControl (بديلهما مركز التحكم) · FirstRun (بديله seeding التلقائي) · Projects/مونتاج (P3 عند طلب فعلي).
- ملاحظة ترقية جزئية: `/archive` يحتاج bulk actions (API `records/bulk` موجود) و`/archive/[id]` يحتاج تعليقات/علاقات — ضمن موجة 2.

**🚫 أُسقِط كـ legacy (القطع النهائي):** §5 توحيد Settings · §5 Sidebar · §6 بقية الصفحات — كلها كانت تستهدف `archive-app` المجمّد.

---

## 1. جاهزية البث المؤسسي (Enterprise / Broadcast) — net-new

> أكبر فجوة في تقرير التقييم المؤسسي (الامتثال الحالي 41%). هذه بنود غير موجودة في الكود (تم التحقق: لا `rights`/`MXF`/`embargo`/`MOS`).

- [ ] `[P1]` ⏱️XL **تفريغ عربي إنتاجي (GPU + faster-whisper-large-v3)** — رفع الدقة من ~70% إلى ≥90%.
  - يشمل: GPU، `large-v3`، **timestamps**، **تمييز المتحدثين (diarization)**، تصدير **SRT/VTT/TTML**.
  - ✅ شريحة Laravel GPU config منجزة (2026-06-30): `WhisperTranscriber` في المسار القانوني الجديد يقبل `WHISPER_DEVICE` و`WHISPER_COMPUTE_TYPE` ويمررهما إلى faster-whisper (`cuda`/`float16` افتراضياً)، مع بقاء `large-v3` + `ar` + `vtt`. التحقق: `php artisan test --filter=WhisperTranscriberTest` داخل Docker، 6 اختبارات / 13 assertion.
  - ✅ شريحة تصدير متعدد الصيغ + diarization flag منجزة (2026-07-01): `WhisperTranscriber::transcribe()` يطلب `--output_format srt,vtt` من faster-whisper بأمر واحد ويعيد 3 artifacts (`transcript_srt`, `transcript_vtt`, `transcript_ttml`)؛ TTML يُشتق محلياً من ملف الـ VTT عبر محوّل PHP بسيط بلا اعتماديات جديدة (`VttToTtmlConverter`). دعم diarization عبر علم `WHISPER_DIARIZE` (افتراضياً false) يمرر `--diarize` لأمر whisper-ctranslate2؛ يتطلب HF_TOKEN بيئي لنماذج pyannote المحمية (موثّق في `.env.example`، بدون أسرار مضمّنة). تم تحديث `RealMediaProcessor::processTranscription` ليعيد الـ artifacts الثلاثة مباشرة. التحقق: `php artisan test` كامل داخل Docker، 80 اختبار ناجح / 382 assertion (منها 10 اختبارات جديدة لـ WhisperTranscriberTest و4 لـ VttToTtmlConverterTest).
  - الملفات: `archive-laravel/app/Services/Media/WhisperTranscriber.php`, `archive-laravel/app/Services/Media/VttToTtmlConverter.php`, `archive-laravel/app/Services/Media/RealMediaProcessor.php`, `archive-laravel/app/Providers/AppServiceProvider.php`, `archive-laravel/config/media.php`, `archive-laravel/.env.example`, `archive-laravel/tests/Unit/WhisperTranscriberTest.php`, `archive-laravel/tests/Unit/VttToTtmlConverterTest.php`, `archive-laravel/tests/Unit/RealMediaProcessorTest.php`.
  - مؤجل: التحقق الحي من الدقة ≥90% على صوت عربي حقيقي وGPU حقيقي (خارج نطاق بيئة التطوير الحالية) — يبقى البند الرئيسي غير مؤشَّر لحين هذا التحقق.
  - القبول: تفريغ مقابلة عربية بدقة ≥90% مع توقيتات وتصدير SRT.
  - المصدر: broadcast-report (transcription — حرج)، dev-roadmap (P3-03).

---

## 2. الأساس المعماري (Architecture & Foundation) — net-new

- [~] `[P2]` ⏱️L **إكمال K8s + توحيد Docker Compose** — ملفات compose → ملف واحد بـ profiles؛ إضافة Redis+Whisper لـ K8s + kustomization.
  - ✅ إصلاح بوابة Compose وصورة السيرفر (2026-06-27): أُضيفت placeholder آمنة للمتغيرات المطلوبة في `archive-server/.env.example` (`POSTGRES_*`, `REDIS_PASSWORD`, `PGADMIN_*`, `GRAFANA_PASSWORD`, أسرار JWT)، ونُقلت التعليقات من inline إلى أسطر مستقلة حتى لا تُفسَّر كقيم داخل Docker Compose. أُضيف `tsconfig.base.json` إلى `archive-server/Dockerfile.server` في مراحل build/runtime حتى لا يفشل Prisma/tsx بعد بدء ترحيل TypeScript. مرّت `docker:config` و`docker:config:postgres` وبناء صورة السيرفر.
  - ✅ شريحة تحقق offline للبنية (2026-06-30): صُحّحت selectors في `archive-server/k8s/network-policy.yaml` لتطابق labels الفعلية (`server`/`frontend`/`postgres`)، وأُضيفت بوابة `pnpm run verify:infra` التي تتحقق من ملفات Docker Compose الأساسية/البدائل، وتفحص kustomize عند توفر `kubectl`. التحقق المحلي: `node --check scripts/verify-infra-config.mjs` و`pnpm run verify:infra` نجحا؛ تم تخطي dry-run الخاص بـ `kubectl` فقط لعدم وجود context محلي.
  - ✅ شريحة Redis + Whisper worker في K8s (2026-07-01): أُضيفت Redis Deployment/Service و`whisper-worker` Laravel queue deployment مع mount لملفات الأرشيف، إعدادات faster-whisper GPU (`cuda`/`float16`) وطلب `nvidia.com/gpu: 1`، وربط NetworkPolicy للـ worker وRedis. التحقق: `node --check scripts/verify-infra-config.mjs` و`pnpm run verify:infra` نجحا؛ بقي dry-run الحي محتاج Kubernetes context.
  - ✅ شريحة Compose Laravel/Next القانونية (2026-07-01): أضيف `archive-server/docker-compose.laravel-next.yml` لتشغيل Postgres + Redis + Laravel API + Laravel queue worker + Next standalone، وأضيف `archive-next/Dockerfile` لبناء الواجهة كـ `output: standalone`، وقُوّي `archive-laravel/Dockerfile.worker` بدعم `redis` extension. أضيف `docker:config:laravel-next` وربطت الشريحة في `verify:infra`. التحقق: `pnpm run docker:config:laravel-next` و`pnpm run verify:infra`.
  - ✅ شريحة Docker الافتراضي يعرض Masar/Next (2026-07-02): حُوّل `archive-server/docker-compose.yml` نفسه إلى Laravel + Next.js بدل PocketBase + Vite SPA، وضُبط Caddy على `next:3000`. حُدّث `archive-next/Dockerfile` لتمرير `ARCHIVE_API_BASE_URL` وقت البناء ونسخ `public/` داخل standalone حتى تظهر أصول Masar، وأضيفت متغيرات Reverb الناقصة إلى `.env.example`.
  - ✅ شريحة CI/CD + Sentry (2026-07-02): اعتمدت GitHub Actions كبوابة CI/CD (`ci.yml`, `docker.yml`) مع أوامر `pnpm run ci` و`pnpm run ci:docker`. أضيف Sentry اختياري إلى `archive-next` و`archive-laravel` مع source-map upload مشروط بأسرار GitHub وDSN معطل افتراضياً.
  - الملفات: `archive-server/deploy/*`, `archive-server/*.yml`.
  - المصدر: dev-roadmap (P1-07).

- [x] `[P2]` ⏱️L **توسيع اختبارات E2E + ترقية الحزم الأمنية** — رفع تغطية Playwright + `npm/pnpm audit` للـ CVEs.
  - ✅ شريحة Next UI smoke (2026-07-01): حُدّث `archive-app/tests/next-migration-shell.spec.ts` ليتوافق مع واجهة Next المعتمدة بعد polish، وأُضيف smoke لمسار `/archive` مع تفاعل بحث لا يتطلب Laravel حي. التحقق: `E2E_BASE_URL=http://127.0.0.1:9064 pnpm run e2e:next` نجح 16/16 عبر chromium وmobile-chrome.
  - ✅ شريحة أمان الحزم (2026-07-01): أُضيفت بوابة `pnpm run security:audit` (سكربت `scripts/verify-dependency-audit.mjs`) تفحص الثغرات عبر `pnpm audit --audit-level moderate` وتسمح فقط بـ 2 ثغرة معروفة في `xlsx` (GHSA-4r6h-8v6p-xvw6، GHSA-5pgg-2g8v-p4x9) بدون أصلاح آمن، مع توثيق السبب. البوابة مدمجة في `pnpm run release:verify`. التحقق: `pnpm run security:audit` نجحت، 2 ثغرة مسموحة.
  - المصدر: dev-roadmap (P0-09, P1-08, P5-04).

- [x] `[P2]` ⏱️M **ترتيب وتنظيف مجلدات المشروع + بوابة Playwright** — جرد الملفات والمجلدات غير المفيدة أو المولّدة عشوائياً، ثم حذف/نقل الآمن منها مع إثبات عدم كسر التشغيل.
  - ✅ شريحة بوابة hygiene (2026-07-01): أُضيف `pnpm run verify:repo-hygiene` (سكربت `scripts/verify-repo-hygiene.mjs`) لمنع بقاء مخرجات Playwright (`test-results`/`playwright-report`/`blob-report`) ولقطات/logs الجذر المؤقتة، وربطت البوابة ضمن `verify:laravel-next`. التحقق المحلي كشف `archive-app/playwright-report` و`archive-app/test-results` المتبقي من تشغيل E2E السابق وتم تنظيفه يدويّاً، ثم نجح `pnpm run verify:repo-hygiene`.
  - ✅ شريحة جرد الملفات (2026-07-01): فحص مجلدات الجذر و`archive-app/` و`archive-server/` و`archive-core/` و`archive-next/` كشف: ملف واحد stray (`verify-detail-media-fallback.mjs` في الجذر — سكربت قديم لاختبار fallback فيديو عبر `archive-ux-detail-media-fallback` و`playwright`، غير مرجعي في أي مكان، و `.gitignore` يغطي بالفعل `*.log` للـ `debug.log` من Chromium). الملفات المحفوظة: جميع المصادر والاختبارات والتوثيق المُحدّثة (`docs/`، `ChangeLog.md`، `TASKS.md`، `README.md`، `CLAUDE.md`، `INSTALL.md`، `DEPLOYMENT.md`). لم تُحذف أي ملفات (الملف stray موثق أدناه كعنصر مستقبل).
  - الملفات المراجعة: كل من `.gitignore` و`scripts/verify-repo-hygiene.mjs` و`package.json` و`playwright.config.ts`، وجميع موثقة وآمنة.
  - القبول: تقرير جرد قصير (بالأعلى)؛ لا حذف لملفات داخل `.git` أو ملفات مستخدمة؛ نجاح `pnpm run verify:repo-hygiene` ✅؛ نجاح `pnpm run typecheck:next` ✅؛ E2E tests جاهزة للتشغيل (عند توفر خادم Next على المنفذ).
  - المصدر: طلب المستخدم 2026-06-27.

- [x] `[P1]` ⏱️XXL **ترحيل معماري إلى Laravel API + Next.js TypeScript** — اعتماد Laravel كخادم نطاق وAPI، وNext.js كواجهة TypeScript تدريجية، دون إدخال Astro 5.
  - ✅ **المنجز (شرائح 0–5e.1 + 5e.2-harness):** عقود API، Next.js shell + عميل typed، Laravel API كامل (auth/records/search/files/share/rights/audit/media-jobs)، مصادقة httpOnly cookie، صفحات Next التشغيلية، وبوابة `e2e:next:integration` **10/10 حيّة خضراء** (2026-06-30). التفاصيل الكاملة في [`ChangeLog.md`](ChangeLog.md).
  - ✅ **cutover الافتراضي منجز (2026-06-30):** أوامر الجذر `pnpm dev` و`pnpm build` و`pnpm verify` تعتمد Laravel + Next.js، وأوامر Vite/Node نُقلت إلى `legacy:*`. أضيفت بوابة `pnpm verify:cutover` لمنع الرجوع غير المقصود، وبوابة حيّة `pnpm verify:laravel-next:live` تشغّل Laravel+Next وتنفذ Playwright integration.
  - ✅ **قرار التطوير:** أي ميزة جديدة في records/search/files/share/media/ingest تُبنى في Laravel/Next حصراً. `archive-app` و`archive-server` بقيا legacy/reference فقط حتى إطفاء الفجوات التشغيلية غير المكافئة.
  - ملاحظة hardening غير حاجبة للقطع: smoke حي لـ `Dockerfile.worker` مع ffmpeg/whisper وخادمَي FTP/SMB بملف وسائط حقيقي يبقى بوابة بنية/تشغيل لاحقة؛ التنفيذات مبنية ومختبرة بـ fakes وليست شرطاً لاعتماد Laravel/Next كمسار التطوير.
  - الملفات: `docs/laravel-nextjs-migration-plan.md`, `archive-laravel/ARCHIVE_MIGRATION.md`, `package.json`, `scripts/*`, `TASKS.md`, `docs/api/*`.
  - القبول: لا اعتماديات Astro؛ `pnpm run verify` ينجح؛ Next.js هو مسار الواجهة TypeScript، وLaravel هو backend/API والـ queues؛ لا تطوير net-new على Vite/Node.
  - المصدر: طلب المستخدم 2026-06-27.

---

## 3. محرّر المونتاج متعدد المسارات (Montage) — net-new كبير

> الحالة: ProjectsPage فيه `roughCuts`/`inSec/outSec`/transitions/looks/filters/EDL+JSON+MP4 لكن **قائمة نصية بلا خط زمني مرئي** (تم التحقق: لا `MultiTrack`).

- [x] `[P2]` ⏱️L **مشغّل فيديو متقدم في DetailPage** — Frame stepping (`,`/`.`) + Mark In/Out + «أضف لمشروع» مباشرة + Waveform + Transcript Sync.
  - ✅ Frame stepping + Mark In/Out + «أضف لمشروع» + **Waveform** مُنجَز (2026-06-30) — راجع [`ChangeLog.md`](ChangeLog.md).
  - ✅ Transcript Sync كان منفذاً بالفعل داخل `DetailPage`: `TranscriptSyncWorkbench` يتابع وقت التشغيل، يبرز السطر النشط، يسمح بالبحث والقفز للزمن، ويشتق cues للترجمة من التفريغ الزمني أو من SRT/VTT مستورد. دعمه `SubtitleRenderer`, `subtitleParser`, و`transcriptToSrt`.
  - ✅ التحقق: `pnpm --filter @archive/app run test -- src/features/media/subtitleParser.test.ts src/features/media/transcriptToSrt.test.ts src/components/media/VideoPlayer.test.tsx` مرّ ضمن 147 ملف اختبار / 1319 اختبار.
  - الملفات: `archive-app/src/components/media/VideoPlayer.tsx` + `archive-app/src/pages/DetailPage.tsx` + `archive-app/src/components/media/VideoPlayer.test.tsx`.
  - المصدر: new_tail (F19, F20).

- [x] `[P2]` ⏱️M **علامة مائية + تصدير SRT/VTT/TTML للفيديو** — ffmpeg overlay + ملفات ترجمة مع الفيديو.
  - ✅ شريحة Laravel watermark overlay (2026-07-01): `RealMediaProcessor` صار يدعم watermark اختياري في transcode عبر `options.watermark` أو إعدادات `MEDIA_WATERMARK_*`، ويولّد أمر ffmpeg بمدخل ثانٍ و`filter_complex` مع مواضع `top-left/top-right/bottom-left/bottom-right/center` وopacity/margin مضبوطين. التحقق: RED ثم GREEN لـ `RealMediaProcessorTest`، وفلتر `Media` داخل Docker مرّ: 22 اختبار / 85 assertion.
  - ✅ شريحة Next media job preset (2026-07-01): نموذج `/media/jobs` صار يرسل `sourcePath` وخيارات `options.watermark` عند اختيار عملية `transcode`، مع حقول path/position/opacity/margin، ويدعم `atSec` للـ thumbnail ويعرض خيارات job المخزّنة في القائمة للمراجعة.
  - ✅ smoke حي (2026-07-02): أضيف `scripts/smoke-watermark-ffmpeg.mjs` وأمر `pnpm run smoke:watermark`؛ يولّد فيديو MP4 قصير وPNG علامة مائية فعليين عبر ffmpeg، يركّب overlay بنفس صيغة `filter_complex`، يفحص الناتج عبر ffprobe، ويقارن crop منطقة العلامة للتأكد من أثر overlay. التحقق المحلي: `outputSize=43182`, `cropDifference=95.83`.
  - الملفات: `archive-laravel/app/Services/Media/RealMediaProcessor.php`, `archive-laravel/config/media.php`, `archive-laravel/.env.example`, `archive-laravel/app/Providers/AppServiceProvider.php`, `archive-laravel/tests/Unit/RealMediaProcessorTest.php`, `scripts/smoke-watermark-ffmpeg.mjs`, `package.json`، والمسار القديم `archive-server/src/media/*` بقي للميراث/Node.
  - المصدر: dev-roadmap (P2-05, P2-06).

- [~] `[P2]` ⏱️L **مشغّل وسائط قانوني في Next + بثّ HTTP Range (حلّ التشغيل المحلي + كل أماكن التخزين)** — يستبدل مشغّل archive-app المجمّد ويحلّ منع المتصفح لتشغيل `file://`.
  - ✅ شريحة backbone البثّ (2026-07-01): أُضيف `GET /api/v1/files/stream?path=` في `FilesController::stream` تحت `archive.auth` فقط (بلا audit لتفادي ضجيج كل range request)، يبثّ من `ARCHIVE_FILE_ROOT` عبر `response()->file()` (Symfony `BinaryFileResponse`) الذي يعالج **Range/206/416/Accept-Ranges** ناتيفياً — فالمتصفح يبثّ ويسحب (seek) بلا تحميل الملف كاملاً بالذاكرة، ومصادقة الكوكي `va_refresh` تعمل مع `<video>` (same-origin عبر بروكسي Next). أمان المسار عبر `resolvePath` الموجود (منع traversal). التحقق: `FilesApiTest` **10/10 (41 assertion)** — كامل + جزئي (206) + 416 + 401 + 400 traversal.
  - ✅ شريحة مشغّل Next (2026-07-01): `archive-next/components/MediaPlayer.tsx` (يميّز صوت/فيديو، `preload="metadata"`، معالجة أخطاء الصيغ، RTL، `onReady` للسحب من تعليقات المراجعة لاحقاً) + صفحة `app/media/play/page.tsx`. التحقق: `typecheck:next` + `build:next` نجحا (`/media/play` static).
  - ✅ شريحة بثّ أماكن التخزين المتعدد (2026-07-01): أُضيف معامل اختياري `disk` إلى `stream()` — عند الغياب أو `''` يبقى السلوك الأصلي (`ARCHIVE_FILE_ROOT` + Range 206 ناتيفي)؛ عند التحديد يتحقّق من قائمة الـ disks المسموحة (`config('filesystems.disks')`)، يرفض `disk` غير معروف بـ 400، ينظّف المسار (يرفض `..` والـ leading slash)، يتحقّق من الوجود عبر `Storage::disk($disk)->exists()` (404 إن فُقِد)، ويبثّ عبر `Storage::disk($disk)->readStream()` مع `response()->stream()` و`Accept-Ranges: none` (الـ sequential streaming لـ disks البعيدة). أمان: allowlist + traversal-check + auth. **4 اختبارات جديدة** (disk من قائمة + unknown disk 400 + traversal 400 + regression: no disk param = ARCHIVE_FILE_ROOT مع Range). التحقق: `FilesApiTest` **14/14 (59 assertion)** نجحت؛ suite كامل `pnpm verify:laravel` نجح — **155 اختبار / 584 assertion** (no regressions).
  - ✅ شريحة ربط متصفح الملفات (2026-07-01): `MediaPlayer` صار يقبل `disk` اختياري، وصفحة `/media/play` تقرأ `path/disk` من query params، و`/files` تعرض زر تشغيل للملفات الصوتية/المرئية وتفتحها مباشرة عبر المشغّل القانوني.
  - ✅ شريحة Range للـ configured local disks (2026-07-02): أُثبت GREEN بعد إصلاح تلوّث بيانات اختبار متبقٍّ من تشغيل سابق (`mkdir(): File exists` بسبب مجلد fixture لم يُنظَّف). أُضيف `File::deleteDirectory` قبل `File::makeDirectory` في الاختبارات الثلاثة المتأثرة لضمان idempotency. التحقق: `FilesApiTest` **15/15 (64 assertion)**، والسويت الكامل لـ Laravel **172 اختبار / 682 assertion** بلا انحدار.
  - ✅ شريحة waveform/transcript-sync في Next (2026-07-02): أضيفت helpers نقية في `archive-next/lib/media/` لتحليل VTT/SRT وتوليد waveform peaks/fallback، وتوسع `MediaPlayer` ليعرض timeline قابل للنقر، وقت التشغيل، cue نشط، وقائمة تفريغ قابلة للقفز. صفحة `/media/play` تقبل نص VTT/SRT اختياري وتفعّل timeline. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - المتبقّي: بثّ byte-range للـ disks البعيدة (s3/ftp/sftp) عبر تقسيم طلبات seek عند توفر بيئة تخزين بعيدة للاختبار.
  - الملفات: `archive-laravel/app/Http/Controllers/Api/V1/FilesController.php`، `archive-laravel/routes/api.php`، `archive-laravel/tests/Feature/FilesApiTest.php`، `archive-next/components/MediaPlayer.tsx`، `archive-next/app/media/play/page.tsx`, `archive-next/lib/media/subtitles.ts`, `archive-next/lib/media/waveform.ts`.
  - المصدر: طلب المستخدم 2026-07-01 (تشغيل محلي + كل أماكن التخزين + streaming).

---

## 5. إعادة هيكلة الإعدادات والتنقّل — جزئياً net-new

- [x] `[P2]` ⏱️M **توحيد SettingsPage/SettingsHubPage + دمج SystemControlPage** — ~~إزالة التكرار وتبسيط التنقّل~~.
  - 🚫 **أُسقِط كـ legacy (2026-07-01):** بعد اعتماد Laravel + Next.js **نهائياً**، صفحات `archive-app/*.jsx` مجمّدة (reference فقط) ولن تُوحَّد. المسار القانوني هو لوحة `/settings` في `archive-next` (منجزة read-only). لا بديل مطلوب — البند مغلق.
  - المصدر: guide_v6 (§3 جدول التحسينات).

- [x] `[P2]` ⏱️L **إعادة تنظيم Sidebar إلى 7 مجموعات + BottomNav 5 عناصر + Breadcrumbs موحّدة + Command Palette سياقي** — ~~تقليل حمل الـ 45 صفحة~~.
  - 🚫 **أُسقِط كـ legacy (2026-07-01):** الـ shell و45 صفحة في `archive-app` مجمّدة بعد القطع النهائي. تنظيم التنقّل يُبنى في shell الخاص بـ `archive-next` عند الحاجة الفعلية (YAGNI — لا نعيد بناء تنقّل legacy). البند مغلق.
  - المصدر: ux_plan (Sprint 2)، guide_v6 (S2).

- [x] `[P2]` ⏱️M **لوحة أمان موسّعة (endpoints في Laravel)** — CSP toggle + CORS field + JWT TTL + Legacy Password Upgrade + Webhook URL allowlist + Rate-limit per-user.
  - ✅ شريحة قراءة فقط في Next (2026-06-30): أُضيفت لوحة "وضع الأمان" داخل `archive-next/app/settings/page.tsx` تعرض password/session timeout/failed attempts وتوضح أن المصادقة الثنائية وWebhook allowlist مخططان.
  - ✅ شريحة endpoints + service منجزة (2026-07-01): أُضيفت `SecuritySettingsService` في Laravel (`archive-laravel/app/Services/Security/`) توفر getSettings() وupdate* methods للمجموعة الآمنة (accessTokenTtlMinutes, perUserRateLimit, webhookUrlAllowlist, legacyPasswordUpgrade)؛ أضيف `UpdateSecuritySettingsRequest` FormRequest لتحقق المدخلات + allowlist للحقول القابلة للكتابة؛ أضيفت endpoints GET/PATCH `/api/v1/system/security-settings` في SystemController تحت `archive.auth`+`archive.audit`. CSP و CORS تُعاد قراءة فقط من config (deploy-time، غير قابلة للكتابة بالتصميم).
  - 🔧 تصحيح حفظ دائم (2026-07-01، مراجعة المشرف): النسخة الأولى من الوكيل كانت تُخزّن عبر `config()`+`Cache` — وهي **لا تحفظ عبر الطلبات** (تعود للافتراضي في الطلب التالي؛ عطل صامت). أُعيدت كتابة `SecuritySettingsService` لتخزّن overrides المجموعة الآمنة **دائماً** في جدول `storage_rows` المشترك (مفتاح مركّب `store+uid`، بلا migration جديد)، مع دمجها فوق افتراضيات config عند القراءة. كما دُمج قسم `security` (rate-limit/legacy/csp/cors) في `config/archive.php` وحُذف `config/security.php` اليتيم (كان prefix خاطئ `security.*` لا يقرؤه أحد).
  - ✅ شريحة تكامل Next (2026-07-01): حُدثت `archive-next/lib/archive-api.ts` لإضافة `SecuritySettings` type و `getSecuritySettings()` في ArchiveApiClient؛ حُدثت `archive-next/app/settings/page.tsx` لتصبح Client Component، تجلب الإعدادات عند التحميل، وتعرض accessTokenTtlMinutes + perUserRateLimit + webhookUrlAllowlist (count) + legacyPasswordUpgrade + cspPolicy + corsOrigins (read-only) بصيغة مقروءة.
  - الملفات: `archive-laravel/config/archive.php` (قسم `security` مضاف)، `archive-laravel/app/Services/Security/SecuritySettingsService.php` (جديد، حفظ عبر StorageRow)، `archive-laravel/app/Http/Requests/UpdateSecuritySettingsRequest.php` (جديد)، `archive-laravel/app/Http/Controllers/Api/V1/SystemController.php` (محدّث)، `archive-laravel/routes/api.php` (محدّث)، `archive-laravel/tests/Unit/SecuritySettingsServiceTest.php` (جديد، 18 اختبار)، `archive-laravel/tests/Feature/SecuritySettingsApiTest.php` (جديد، 12 اختبار)، `archive-next/lib/archive-api.ts` (محدّث)، `archive-next/app/settings/page.tsx` (محدّث).
  - التحقق: `pnpm run verify:laravel` نجح — 135 اختبار / 516 assertion (شامل، بما فيها 18 + 12 = 30 اختبار جديد); `pnpm run typecheck:next` و `pnpm run build:next` نجحا بدون أخطاء.
  - **scoping decision (ponytail):** CSP و CORS بقيا deploy-time (قراءة فقط في API)؛ المجموعة الآمنة فقط (TTL/rate-limit/webhook/legacy-flag) تُعدَّل عبر PATCH endpoint. لا runtime toggles لـ CSP/CORS وفقاً للقيد الأمني.
  - المصدر: guide_v6 (§3)، broadcast/ux security.

---

## 6. تحسينات الصفحات والميزات (Per-Page UX) — تحقّق ثم نفّذ net-new

> معظم البنود الصغيرة «الجاهزة» مُنفّذة سابقاً (راجع §0 وChangeLog). أدناه الأبرز net-new أو غير المؤكَّد.

### صفحات متخصصة

- [x] `[P3]` ⏱️L **بقية الصفحات (تحسينات مفردة)** — Collections، Inbox، ReadingLists، Favorites، SavedSearches، Duplicates، SharedLinks، HierarchicalTags، Vocabulary، Reports، ProductionTasks، Activity/History، Automation، Transcriber، SyncLog، ErrorLog، Help، Files، Users.
  - 🚫 **أُعيد تأطيره بعد القطع النهائي (2026-07-01):** القائمة أعلاه كلها صفحات `archive-app/src/pages/*` **legacy مجمّدة** — لن تُحسَّن فردياً. أي صفحة تُعاد الحاجة إليها تُبنى في `archive-next` كمسار قانوني عند الطلب الفعلي (لا نستبق 19 صفحة — YAGNI). البند مغلق كـ legacy.
  - ✅ شريحة Next UI polish (2026-07-01): تمريرة متوسطة على المسار القانوني `/archive`, `/files`, `/login`, `/settings` (hierarchy، empty/error/success states، spacing، classes مشتركة في `globals.css`). التحقق: `pnpm run typecheck:next`, `pnpm run build:next`, وPlaywright desktop/mobile ببيانات mock بدون overflow أو console/page errors.
  - ✅ شريحة استعادة الصفحات المعطّلة (2026-07-01): بعد فحص المسارات تبيّن أن `إدارة الأنواع` و`سجل الأخطاء` كانتا موجودتين فقط في `archive-app` legacy ولا توجد لهما routes في `archive-next`. أُضيفت `/types` لإدارة أنواع المحتوى والفروع والحقول عبر مخزن Laravel `content_types`، وأُضيفت `/errors` كسجل أخطاء واجهة Next مع التقاط `window.error` و`unhandledrejection`. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة UI foundation (2026-07-01): أُضيف `archive-next/app/theme.css` كطبقة tokens مفصلة للألوان، المسافات، الخط، الحالات، الظلال، الحركة، dark mode، وreduced-motion، وأُعيد بناء `globals.css` فوق tokens موحدة مع الحفاظ على توافق classes الحالية. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة AppHeader/navigation (2026-07-01): أُضيف `archive-next/components/AppHeader.tsx` كخريطة تنقل موحدة مع حالة `aria-current`، واستُبدلت الرؤوس المتكررة في صفحات Next القانونية المستقرة حتى تتوقف قوائم الروابط عن الانحراف بين الصفحات. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة operational UI polish (2026-07-01): أضيفت utilities مشتركة (`split-layout`, `dense-grid`, `scroll-x`, `data-table`, `button-danger`, `wrap-anywhere`, `section-divider`) واستُخدمت في `/settings`, `/types`, `/errors`, `/files`, و`/archive/[id]` لتقليل inline styles، تحسين القراءة على RTL، وضبط الأفعال الخطرة. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة media UI polish (2026-07-01): أُعيد بناء `/media/review` و`/media/compare` على نظام CSS الفعلي بدل Tailwind غير المفعّل، وأضيفت layouts مشتركة للمقارنة والمراجعة وإطار وسائط ثابت، مع نقل مزامنة المشغلات إلى props في `MediaPlayer`. حُسنت `/media/jobs` بتفاصيل قابلة للطي وتعريب أوضح. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة secondary/public UI polish (2026-07-01): حُسنت صفحات `/collaboration`, `/reports`, `/help`, `/share/[token]`, و`/review/[token]` بإزالة لغة الترحيل، تعريب metadata العامة، تحسين حالات loading/error/empty، وإزالة inline styles/tokens القديمة من التعاون. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة product copy + style cleanup (2026-07-01): أُزيلت بقايا نصوص التحويل والتقنيات الداخلية من الصفحات الظاهرة، واكتملت تعريبة إعدادات النظام ومهام الوسائط، ونُقلت أنماط متفرقة إلى classes مشتركة للملفات وسجل الأخطاء وODBC وannotation overlay. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة Masar identity system (2026-07-02): اعتُمد اسم `مسار / Masar` كهوية واجهة Next، مع أصول SVG للعلامة والـ wordmark والـ lockup والـ favicon، وثوابت brand مركزية، وتحديث الهيدر والـ metadata والصفحات الظاهرة، وتوسيع tokens إلى palette مؤسسية دافئة مع dark mode وقسم “هوية النظام” في `/settings`. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`.
  - الملفات: `archive-next/app/*` (القانوني). المسار القديم `archive-app/src/pages/*` مجمّد.
  - المصدر: f45ea5a29 (كل المجموعات)، guide_v6 (#15–20).

---

## 7. الذكاء الاصطناعي والميزات التنافسية (AI & Competitive) — P3 net-new

- [x] `[P2]` ⏱️XL **مراجعة بصرية واعتماد (Visual Review — منافس Frame.io)** — تعليق على إطار محدد + annotation + مقارنة side-by-side + رابط مراجعة خارجي.
  - ✅ شريحة 1 (2026-07-01): تعليقات مؤطَّرة بالتوقيت (frame comments). أضيفت migration لـ `review_comments` (id, media_uid, timecode_seconds، author، body، resolved، timestamps)؛ Laravel model وcontroller endpoints (GET/POST/PATCH `/api/v1/media/{mediaUid}/review-comments`، `/review-comments/{id}`)؛ FormRequests للتحقق (body required+4000 char max، timecode ≥0)؛ قيد `archive.auth` + `archive.audit`؛ مسار Next.js minimal `/media/review` مع عميل typed و UI بسيط (قائمة مرتبة حسب timecode، إضافة، تبديل resolved). التحقق: Feature tests 10/10 ✅ (auth, order, CRUD, validation)؛ full suite 145 tests ✅؛ `typecheck:next` و`build:next` ✅.
  - ✅ شريحة 1a (2026-07-01): **وسائط متسلسل في صفحة المراجعة**. أضيفت `<MediaPlayer path={mediaUid} onReady={playerRef} />` لتشغيل ملفات الأرشيف من الخادم (بثّ `/api/v1/files/stream?path=` + Range + httpOnly cookies)، مع مراجع للسحب من تعليقات (seek-to-comment عند النقر على timecode، يقرأ وقت التشغيل الحالي بدقة 2 عشري)، وإضافة تعليقات عند اللحظة الحالية (checkbox لاستخدام `playerRef.current.currentTime` أو manual override). تنسيق timecode mm:ss بجانب كل تعليق. التخطيط: شبكة 3 أعمدة (player يسار/وسط + comments يمين)، style RTL محفوظ، classes موجودة. التحقق: `typecheck:next` ✅ و`build:next` ✅ (no errors).
  - الملفات: `archive-laravel/database/migrations/2026_07_01_000001_create_review_comments_table.php`، `app/Models/ReviewComment.php`، `app/Http/Controllers/Api/V1/ReviewCommentsController.php`، `app/Http/Requests/{Store,Update}ReviewCommentRequest.php`، `routes/api.php`، `tests/Feature/ReviewCommentsApiTest.php`؛ `archive-next/lib/archive-api.ts` (interface ReviewComment + methods)، `app/media/review/page.tsx` (محدّث مع MediaPlayer + seek/current-time).
  - ✅ شريحة 2 (2026-07-01): **صفحة مقارنة side-by-side متزامنة (Synced Side-by-Side Compare)**. أضيفت مسار Next.js جديد `/media/compare` (client component)، يقبل مسارَي ملفين (A و B)، يعرض `<MediaPlayer>` بجنب بعضهما (responsive: stack على شاشات ضيقة، side-by-side على واسعة)، وtoggle مزامنة التشغيل ("مزامنة التشغيل") يرقّع الأحداث `timeupdate`/`play`/`pause` من أحد المشغّل إلى الآخر مع حماية ضد حلقات feedback (guards `isSyncingRef`، عتبة 0.3s لتجاهل الفروقات الدقيقة)، وأسلوب inline RTL/minimalَ (no new deps). التحقق: `pnpm run typecheck:next` ✅ (no errors)، `pnpm run build:next` ✅ (route `/media/compare` static، compilation successful 1014ms).
  - الملفات: `archive-next/app/media/compare/page.tsx` (جديد)، استخدام `MediaPlayer` الموجود (componentlib — no changes).
  - ✅ شريحة 3 (2026-07-01): **annotation drawing**. أضيف `AnnotationCanvas` فوق مشغّل `/media/review` برسم مستطيلات normalized 0..1، وضع تحرير/عرض، ومسح draft؛ وتُحفظ `annotation` ضمن `review_comments` وتُعرض عند اختيار التعليق. التحقق: `pnpm run typecheck:next`, `pnpm run build:next`, وفلتر Review داخل Laravel.
  - ✅ شريحة 4 (2026-07-01): **روابط مراجعة خارجية**. أضيف جدول/model `review_links` وendpoint مصادق `POST /api/v1/media/{mediaUid}/review-links` لإنشاء token طويل مع صلاحية `view/comment` وانتهاء اختياري، وendpoint عام `GET /api/v1/review-links/{token}` يعيد media UID وmetadata وتعليقات المراجعة المرتبة دون كشف الرمز في payload، مع مسار Next عام `/review/[token]`. التحقق: `node scripts/laravel-docker.mjs test --filter=Review` نجح 17 اختبار / 62 assertion، و`pnpm run typecheck:next` + `pnpm run build:next`.
  - ملاحظة مستقبلية غير حاجبة: تشغيل الوسيط نفسه داخل الرابط العام يحتاج stream token منفصل أو public signed media endpoint؛ الرابط الحالي يعرض بيانات المراجعة والتعليقات العامة بأمان.
  - المصدر: dev-roadmap (new-feature #1).

- [~] `[P2]` ⏱️XL **تعاون حي (Live Collaboration)** — حضور فوري + تحرير متزامن + إشعارات WebSocket حقيقية (`PresenceIndicator` موجود).
  - ✅ شريحة 1 (2026-07-01): **presence heartbeat قانوني في Laravel + Next**. أضيف جدول/model `collaboration_presence` و`CollaborationController` مع endpoints محمية بدون audit spam: `GET/POST /api/v1/collaboration/rooms/{roomKey}/presence`. الـ heartbeat يحدث حضور المستخدم في الغرفة مع `status/resourceId/cursor`، ويعرض المشاركين النشطين ضمن نافذة 45 ثانية، مع فلترة stale participants. أضيفت صفحة Next `/collaboration` وعميل typed في `archive-next/lib/archive-api.ts`، وتوثيق OpenAPI + تحقق `verify:api-contracts`. التحقق: RED ثم GREEN لـ `CollaborationPresenceApiTest` (4 اختبارات / 25 assertion)، و`pnpm run typecheck:next`, `pnpm run build:next`, `pnpm run verify:api-contracts`.
  - ✅ شريحة 2 (2026-07-01): **editing locks conflict-aware**. أضيف جدول/model `collaboration_locks` وواجهات `GET/POST /api/v1/collaboration/rooms/{roomKey}/locks` و`POST /locks/release` لحجز مورد داخل غرفة، refresh لنفس المستخدم، 409 `lock_conflict` عند قفل مستخدم آخر، وانتهاء TTL آمن. صفحة `/collaboration` تعرض الأقفال وتتيح حجز/تحرير المورد الحالي. التحقق: RED ثم GREEN لـ `CollaborationLocksApiTest`، وفلتر `Collaboration` مرّ 8 اختبارات / 55 assertion، مع `pnpm run verify:api-contracts`, `pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة 3 (2026-07-02): **WebSocket/Reverb حقيقي (بديل جزئي عن polling)**. أضيف `laravel/reverb` (composer)، `config/broadcasting.php` + `config/reverb.php`، `routes/channels.php` (قناة خاصة `collaboration.room.{roomKey}` مصادقة عبر `archive.auth` نفس middleware الـ bearer/cookie الحالي)، و`Broadcast::routes` مسجّلة تحت `api/v1/broadcasting/auth`. عند heartbeat، يُطلَق `CollaborationPresenceUpdated implements ShouldBroadcastNow` على القناة بحمولة مشارك واحد فقط (delta، ليس القائمة كاملة). أضيفت خدمة `laravel-reverb` إلى `archive-server/docker-compose.laravel-next.yml` بنفس نمط `laravel-worker` القائم. الجهة الأمامية: `laravel-echo` + `pusher-js`، عميل singleton في `archive-next/lib/echo.ts` (authorizer مخصّص لأن مصادقة الـ API تعتمد كوكي `va_refresh` وليس XHR الافتراضي)، صفحة `/collaboration` تشترك في القناة وتدمج التحديثات الفورية فوق الـ polling الموجود (polling يبقى fallback/reconciliation، لم يُحذف). التحقق: `Event::fake` + `Event::assertDispatched` ضمن `CollaborationPresenceApiTest` (فلتر `Collaboration` مرّ 9 اختبارات / 59 assertion)، `pnpm run typecheck:next` ✅، `pnpm run build:next` ✅.
  - ✅ شريحة 4 (2026-07-02): **مسودة مورد مشتركة بإصدار متفائل + بث حي**. أضيف جدول/model `collaboration_documents` ومسارا `GET/POST /api/v1/collaboration/rooms/{roomKey}/documents/{resourceId}`؛ الحفظ يتطلب `version` مطابقاً للنسخة الحالية، يعيد 409 `document_version_conflict` عند تعارض النسخ، ويحترم أقفال مستخدم آخر بـ 409 `lock_conflict`. عند الحفظ يُطلَق `CollaborationDocumentUpdated implements ShouldBroadcastNow` على قناة الغرفة، وصفحة `/collaboration` تعرض textarea للمورد الحالي وتدمج تحديثات `.document.updated` فورياً. وُثق العقد في OpenAPI وربط بـ `verify:api-contracts`. التحقق: فلتر `Collaboration` مرّ **14 اختبار / 93 assertion**، و`pnpm run typecheck:next`, `pnpm run build:next`.
  - ✅ شريحة 5 (2026-07-02): **بث حي لتعليقات المراجعة داخل `/media/review`**. أضيف `ReviewCommentBroadcasted implements ShouldBroadcastNow` على قناة خاصة `review.media.{mediaUid}` باسم حدث `.review-comment.updated` عند إنشاء/تحديث تعليق مراجعة، مع auth channel في `routes/channels.php`. صفحة `/media/review` تشترك عبر `getEchoClient()` وتدمج التعليقات الواردة دون تكرار وبترتيب زمني، مع إبقاء fetch الحالي fallback/reconciliation. التحقق: `node scripts/laravel-docker.mjs test --filter=ReviewComments` نجح **12 اختبار / 34 assertion**، و`pnpm run typecheck:next`.
  - نطاق مؤجَّل عن قصد: (1) OT/CRDT كامل على مستوى العمليات/الأحرف بدلاً من optimistic shared draft؛ (2) ربط إشعارات فورية بصفحات تشغيلية أخرى غير `/collaboration` و`/media/review` عند تحديد أحداث مفيدة لكل صفحة (مثل `/files`). البند يبقى `[~]` لحين تغطية هاتين النقطتين أو تجزئتهما إلى بند مستقل.
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

- [x] `[P1]` ⏱️XL **دعم Microsoft SQL Server كـ backend جديد** — إضافة `sqlserver` كخيار في `BACKEND_CHOICES` + Prisma provider جديد + ترحيل schema المعادل + نقطة في `/api/setup/preset-config` تكشف `SQLSERVER_URL`.
  - ✅ شريحة إعداد/تهيئة منجزة (2026-06-30): أضيف `sqlserver` كخيار في الواجهة ومعالج البداية وقراءة preset/config، وأضيف `archive-server/docker-compose.sqlserver.yml` مع `SQLSERVER_URL` وفحص `docker:config:sqlserver`.
  - ✅ شريحة runtime حي منجزة (2026-06-30): أضيف `@prisma/adapter-mssql` مع اختيار adapter حسب `DATABASE_PROVIDER`، وتحول صيغة SQL Server إلى `sqlserver://host:1433;database=...;user=...;password=...;encrypt=true;trustServerCertificate=true`. أضيف توليد `prisma/schema.active.prisma` لمواءمة قيود SQL Server (`Json`/arrays/enums كنص)، ومسار `prisma/migrations-sqlserver`، وتخزين JSON كنص في `StorageRow` مع decode عند القراءة.
  - ✅ شريحة توافق الجداول المباشرة منجزة (2026-06-30): أضيف wrapper لـ Prisma عند `DATABASE_PROVIDER=sqlserver` يرمّز/يفك `Json` و`String[]` المخزّنة كنص في `ArchiveItem` و`RecordVersion` و`SavedFilter` و`Webhook` و`ApiKey` و`ActivityLog` و`ShareInvitation` و`RightsRecord`، مع ترجمة فلتر `events.has` إلى بحث نصي ملائم.
  - ✅ التحقق: `pnpm verify`، `pnpm run docker:config:sqlserver`، بناء `docker compose ... up -d --build server`، وsmoke حي داخل الحاوية على SQL Server يغطي `/api/health` + `/api/auth/login` + `/api/rpc` + record versions/restore + saved filters + webhooks + API keys + public records + rights + share invitations.
  - الملفات: `archive-server/src/db/prismaAdapter.ts`, `archive-server/src/db/prismaJsonCompat.ts`, `archive-server/prisma/migrations-sqlserver/`, `archive-server/scripts/set-db-provider.mjs`, `archive-server/prisma.config.mjs`, `archive-server/src/adapters/cloud-postgres-prisma/storage.ts`, `archive-app/src/features/settings/dbConfigClient.ts`, `archive-server/docker-compose.sqlserver.yml`.
  - القبول: SQL Server backend يعمل عبر المسار العام ومسارات Prisma المباشرة الأساسية؛ يبقى ODBC كبند مستقل أدناه.
  - المصدر: طلب المستخدم 2026-06-21.

- [~] `[P2]` ⏱️XL **دعم ODBC (عام لقواعد بيانات Windows القديمة)** — بعد اعتماد Laravel + Next.js كمسار قانوني، ينتقل الجسر من خطة `node-odbc`/Prisma القديمة إلى طبقة Laravel آمنة لفحص DSN ثم Repository محدود للجداول الأساسية (items, users, settings, audit) — وذلك للمستخدمين الذين يربطون قاعدة بيانات قائمة (DSN موجود في ODBC Data Source Administrator على Windows).
  - ✅ شريحة Laravel readiness/probe (2026-07-01): بعد اعتماد Laravel + Next.js كمسار قانوني، أُضيفت طبقة ODBC أولية في Laravel (`OdbcConnectionProbe`, `NativeOdbcConnectionFactory`) ونقطة مصادقة `GET /api/v1/system/odbc` تعيد حالات `disabled/missing-dsn/driver-unavailable/connected/failed` مع إخفاء `PWD`/`Password`، وتعرض أسماء الجداول عند نجاح الاتصال. لا تضيف هذه الشريحة read/write repository بعد. التحقق: RED ثم GREEN لـ `OdbcConnectionProbeTest` و`OdbcStatusApiTest`، ثم فلتر API/ODBC: 57 اختبار / 305 assertion.
  - ✅ شريحة read-only repository + endpoint (2026-07-01): أُضيفت `OdbcReadRepository` في `app/Services/Odbc/` مع allowlist صارم للجداول الأساسية الأربعة (items/users/settings/audit) وقناع تلقائي لأعمدة secrets/passwords (password, password_hash, pwd, token, api_key، إلخ بـ pattern matching)، ودعم pagination محدود (max 250 صف). حُدثت interface `OdbcConnection` بـ `readRows(table, offset, limit)` وحُقّقت في `NativeOdbcConnection` بأمر SQL محكم (لا string concatenation — allowlist فقط). أُضيف endpoint `GET /api/v1/system/odbc/tables/{table}?limit=N` مع نفس المصادقة والحماية، يرفع الجداول الممنوعة بـ 403 Forbidden. TDD كامل: 6 اختبارات unit + 7 اختبارات feature (13 اختبار جديد) مع fake connections لـ testing. التحقق: `pnpm run verify:laravel` — 102 اختبار / 457 assertion نجح (شامل).
  - ✅ شريحة setup UI في Next + عقد API (2026-07-01): أضيفت بطاقة ODBC داخل `/settings` في `archive-next` تعرض حالة الجسر (`disabled/missing-dsn/driver-unavailable/connected/failed`)، DSN المقنّع، توفر driver، وعدد الجداول، مع اختيار جدول أساسي ومعاينة read-only آمنة عبر endpoint الجداول. حُدّث `archive-next/lib/archive-api.ts` بتعريفات typed لـ ODBC، ووُثقت مسارات `/system/odbc` و`/system/odbc/tables/{table}` في OpenAPI وربطت بـ `verify:api-contracts`.
  - ✅ شريحة CRUD مقيد (2026-07-02): أضيفت عمليات `POST/PATCH/DELETE /api/v1/system/odbc/tables/{table}/rows` للجداول الأساسية المسموحة فقط، مع حصر مفاتيح التحديث/الحذف (`id`, `uid`, `username`, `key` حسب الجدول)، ومنع الأعمدة الحساسة (`password`, `token`, `api_key`, `secret`...)، وقبول قيم scalar/null فقط. حُدّثت واجهة `/settings` لتنفذ الإضافة/التحديث/الحذف من بطاقة ODBC مع إعادة تحميل المعاينة، ووُثق العقد في OpenAPI وربط بـ `verify:api-contracts`.
  - الملفات: `archive-laravel/app/Services/Odbc/OdbcReadRepository.php`، `archive-laravel/app/Services/Odbc/OdbcConnection.php`، `archive-laravel/app/Services/Odbc/NativeOdbcConnection.php`، `archive-laravel/app/Http/Controllers/Api/V1/SystemController.php`، `archive-laravel/routes/api.php`، `archive-laravel/tests/Unit/OdbcReadRepositoryTest.php`، `archive-laravel/tests/Feature/OdbcReadApiTest.php`، `archive-laravel/tests/Unit/OdbcConnectionProbeTest.php`، `archive-laravel/tests/Feature/OdbcStatusApiTest.php`، `archive-next/lib/archive-api.ts`، `archive-next/app/settings/page.tsx`، `docs/api/archive-contract.openapi.json`، `scripts/verify-api-contracts.mjs`.
  - القبول: قراءة وكتابة مقيدة للجداول المسموحة عبر endpoints محمية (auth required)، allowlist صارم، قناع secrets في القراءة، منع كتابة الأسرار، مفاتيح محددة للتحديث/الحذف، pagination آمن، وواجهة إعداد/فحص في Next تربط probe + preview + CRUD بالعقد.
  - ملاحظة: يبقى smoke حي على ODBC Windows فعلي، ومعاملات/دفعات متعددة الصفوف إذا احتاجها التشغيل لاحقاً.
  - المصدر: طلب المستخدم 2026-06-21.

---

> **البنود المُنجَزة نُقلت إلى [`ChangeLog.md`](ChangeLog.md).** هذا الملف يحوي فقط المهام المتبقّية للتنفيذ.
