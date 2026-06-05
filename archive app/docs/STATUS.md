# حالة المشروع وخطة العمل — Video Archive (نسخة الإنتاج)

> آخر تحديث: 2026-06-04 · المصدر الموحّد لحالة النظام والمهام المتبقّية.
> تفصيل الأولويات: [ROADMAP.md](ROADMAP.md) · المهام الجارية: [../TASKS.md](../TASKS.md)
> سير العمل (تعدّد الوكلاء): [../AGENTS.md](../AGENTS.md) · التصميم: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)

---

## 1. تموضع المنتج — أرشيف إعلامي ذكي قابل للإنتاج

هذا النظام لم يعد “مشغّل فيديو محليًا”. هو منصة أرشيف إعلامي عربية تربط
التوصيف، البحث، التخزين السحابي، الذكاء الاصطناعي، المشاركة، وسير عمل المونتاج
في واجهة واحدة قابلة للعمل محليًا أو سحابيًا. معيار المقارنة العملي هو
`CLOUD-MediaDB` كتجربة منتج فقط: نستعير وضوح القصة وتدفّقات التعاون، ولا ننقل
معماريته. البنية المعتمدة تبقى منافذ `@archive/core` وخادم `archive-server`؛
لا `server.ts` أحادي، ولا Firestore داخل الواجهة، ولا SQLite داخل المستودع كمسار
إنتاجي بديل.

**القيمة للمستخدم:** تحويل المادة الخام إلى أصل أرشيفي قابل للبحث، المراجعة،
المشاركة، والتصدير لفريق إنتاج حقيقي، بدل أن تبقى الملفات مجرد مسارات وأسماء.

---

## 2. المعمارية — ثلاثة مستودعات بنواة منافذ

```
┌─────────────── @archive/core (v1.2.0) ───────────────┐
│ منافذ (حقن صرف، لا تعرف أي خلفية):                    │
│  StorageProvider(11) · FileStore · AuthProvider       │
│  SessionProvider · SyncProvider · AiProvider          │
└───────────────────────────────────────────────────────┘
        ▲                                   ▲
        │ يستهلك (git tag)                   │ يستهلك (git tag)
┌───────┴────────┐                  ┌────────┴───────────┐
│  archive-app   │   HTTP/SSE       │   archive-server   │
│  (SPA / React) │ ───────────────▶ │ (REST + SSE + AI)  │
│  محوّلات local  │                  │ محوّلات cloud:       │
│  + محوّلات cloud │                 │  postgres / pocketbase
│   (http/files/  │                 │  + auth(JWT) + AI   │
│    sync/ai/     │                 │  + realtime(SSE)    │
│    session)     │                 └─────────┬───────────┘
└────────────────┘                            │
                                    ┌──────────┴──────────┐
                                    │ Postgres 18 / PB 0.39
                                    └─────────────────────┘
```

**المبدأ:** كود الميزات يعتمد المنفذ فقط؛ كل خلفية = محوّل. تبديل
local↔cloud↔backend بلا لمس الميزات. ترقية النواة = رفع وسم git بوعي.

---

## 3. ما أُنجز ✅ (تطبيق إنتاج كامل الأركان)

| الطبقة | الحالة | الموقع |
|--------|--------|--------|
| فصل ٣ مستودعات + منافذ | ✅ | core v1.2.0 |
| تخزين محلي (IndexedDB) | ✅ offline | app `local-indexeddb` |
| تخزين سحابي **PostgreSQL 18 + Prisma 7** | ✅ مُتحقّق حيًّا | server `cloud-postgres-prisma` |
| تخزين سحابي **PocketBase 0.39** | ✅ | server `cloud-pocketbase` |
| REST RPC API | ✅ | server `/api/rpc` |
| **مصادقة JWT** + admin seeding | ✅ | server `auth/` + SPA `cloudSession` |
| تحقّق مدخلات + **rate limiting** | ✅ | server `validate`/`rateLimit` |
| **multi-port cloud** (session/files/sync) | ✅ | server + SPA محوّلات |
| **FileStore متعدّد** (اختيار بـ `FILE_STORE`): disk · Dropbox · **S3-متوافق** (Amazon S3 · R2 · B2 · Spaces · Wasabi · MinIO · GCS-interop) · **Azure Blob** · **Google Drive** | ✅ | server `files-disk`/`files-dropbox`/`files-s3`/`files-azure`/`files-gdrive` |
| **مشاركة عامة scoped** (روابط للقراءة، توكن موقّع) | ✅ خادم | server `share/` + `/api/share` |
| **مزامنة لحظية SSE** متعدّدة الأجهزة | ✅ مُتحقّق حيًّا | server event bus + SPA EventSource |
| **AI متعدّد المزوّدين** (Vercel AI SDK + يدويّ احتياطي) + **أزرار AI في المحتوى** (تلخيص/وسوم/تدقيق) + تبويب حالة المزوّد | ✅ | server `ai/` + SPA `cloud-ai` · `features/ai` · Settings #133 |
| **مشاريع المونتاج** (صفحة UI + store + snapshot + تصدير JSON/EDL/MP4 بـ ffmpeg مُضمَّن) | ✅ | app `pages/ProjectsPage` + server `export/` |
| **تجديد UX** (UX-A→UX-K): أولوية الأرشيف المحمول · Data Center task-flow · Add Video · سطح حالة مزوّد AI · كثافة الأرشيف/virtualization · saved views · شريط سياق الموبايل · ترحيل tokens · مصفوفة a11y · carousel لمعالج البداية · SR polish | ✅ | app #119/#125–#138 + `feat/ux-k-onboarding-polish` |
| Docker + Caddy + HTTPS + Hostinger guide | ✅ | server `docker-compose*` + `deploy/` |
| **Postgres مُجمَّع zero-config** (setup.sh بأسرار عشوائية) + **تبديل القاعدة من الإعدادات** (مُجمَّع/خارجي، اختبار+حفظ+إعادة تشغيل) | ✅ | server `deploy/setup.sh` · `config/serverConfig` · `/api/admin/*` + app `DatabaseSettings` |
| AI Studio packaging | ✅ | app `build:aistudio` |
| CI: verify + **integration-postgres** + **axe a11y gate** | ✅ | كل المستودعات |
| نظام تصميم موثّق + accent bridge + typography | ✅ | app `docs/DESIGN-SYSTEM.md` |
| معايير تعدّد الوكلاء (AGENTS.md) | ✅ | الثلاثة |

**التغطية مقابل CLOUD-MediaDB — مكتملة بالكامل (G1→G8):** G1(AI)✅ · G2(تفريغ محلي بالمتصفّح)✅ ·
G3(files: disk+Dropbox+S3 متعدّد+Azure+Google Drive)✅ · G4(cloud+auth+realtime)✅ · G5(مونتاج كامل)✅ ·
G6(مشاركة scoped: خادم+SPA)✅ · G7(timestamps)✅ · G8(صفحتا Uploader/Transcriber)✅.

---

## 4. المهام المتبقّية (مرتّبة بالأولوية)

### واجهة المستخدم للذكاء ✅ مكتملة
- [x] ~~**أزرار AI في الواجهة**~~ ✅ — شريط مساعدة (تلخيص/اقتراح وسوم/تدقيق) فوق حقول
  الملاحظات/الوسوم في `DetailPage`/`AddVideoPage`، يستدعي `getAiProvider()` ويظهر فقط حين
  `isAvailable()`؛ منطق الدمج نقيّ ومُختبَر في `features/ai/` (app #141)
- [x] ~~**واجهة اختيار/حالة مزوّد AI** في الإعدادات~~ ✅ — تبويب «مزود الذكاء» (الخلفية/التخزين/التفويض +
  الإجراءات المدعومة) دون إدخال مفاتيح في الواجهة (app #133 — UX-E)
- [x] ~~**التفريغ الصوتي (transcribe)**~~ ✅ — Whisper متعدّد المزوّدين على الخادم
  (openai/groq/whisper-local، اختيار عبر `TRANSCRIBE_PROVIDER`) + `/api/ai/transcribe`
  + خدمة Docker اختيارية + محوّل SPA يرفع الـ blob (server #15 + app spB14)

### تلميع UI (P2) — **خطّة UX مكتملة** ([`.design/archive-ux-audit/AGENT_TASKS.md`](../.design/archive-ux-audit/AGENT_TASKS.md))
أُنجِزت خطة UX refresh كاملة:
- [x] ~~UX-A أولوية نتائج الأرشيف في أوّل viewport على الموبايل~~ ✅ (#119)
- [x] ~~UX-B بديل/إعادة ربط الوسائط في DetailPage~~ ✅ (#125)
- [x] ~~UX-C تدفّق Data Center (task-first)~~ ✅ (#126–#131)
- [x] ~~UX-D تدفّق Add Video على الموبايل~~ ✅ (#132)
- [x] ~~UX-E تقسيم Settings + سطح حالة مزوّد AI~~ ✅ (#133)
- [x] ~~UX-F كثافة الأرشيف + قياس virtualization~~ ✅ (#134)
- [x] ~~UX-G بحث/saved views~~ ✅ (#135)
- [x] ~~UX-H شريط سياق الموبايل + overflow التنقّل~~ ✅ (#136)
- [x] ~~UX-I ترحيل tokens/typography (Help)~~ ✅ (#137)
- [x] ~~UX-J توسيع مصفوفة a11y (screenshot/axe)~~ ✅ (#138)
- [x] ~~UX-K معالج البداية carousel أفقي RTL + SR-1/SR-2/SR-3 polish~~ ✅ (`feat/ux-k-onboarding-polish`)

### ميزات منتج من CLOUD-MediaDB — ✅ كل الأهداف G1→G8 منجزة
- [x] **G5 المشاريع وسير عمل المونتاج** — ✅ مكتمل:
  - ✅ **الأساس** `features/projects/viewModel.js` (مشاريع + rough cuts بنقاط in/out +
    إعادة ترتيب + تصدير **timeline JSON** و **EDL CMX3600** لـ DaVinci/Premiere، نقيّ ومُختبَر)
  - ✅ **store slice + استمرارية** — `STORES.PROJECTS` + `addProject/updateProject/
    deleteProject` (audit log) في SPA؛ `projects` في snapshot السحابي (server #16/app #121)
  - ✅ **تصدير MP4** — `POST /api/projects/export` يعرض الـ timeline عبر **ffmpeg
    مُضمَّن في نفس صورة Docker** (لا خدمة عرض منفصلة)؛ بثّ MP4 + تنظيف مؤقّت (server #17)
  - ✅ **صفحة UI** `pages/ProjectsPage.jsx` — محرّر مونتاج: باني قصاصات + خطّ زمني بإعادة
    ترتيب (a11y) + timecodes + شريط تصدير JSON/EDL/MP4؛ زرّ MP4 مقيّد بالخلفية السحابية
    عبر `exportClient.js` (app #123)
- [x] ~~**G6 المشاركة الموجّهة** (روابط عامة scoped)~~ ✅ مكتمل — الخادم: `POST /api/share` (مصادقة)
  + `GET /api/share/:token` عام للقراءة فقط، نطاق all/items/collection، توكن موقّع، وفلترة آمنة
  الخصوصية (server #20). الـ SPA: زرّ مشاركة في المجموعات + عارض عام `?share=` (app #147).
- [x] ~~**G3 تخزين سحابي للملفات**~~ ✅ — محوّلات FileStore متعدّدة تُختار بـ `FILE_STORE`:
  `files-dropbox` (server #19) و**`files-s3` المتوافق مع S3** يغطّي Amazon S3 · Cloudflare R2 ·
  Backblaze B2 · DigitalOcean Spaces · Wasabi · MinIO · Google Cloud (S3 interop) (server #21).
  بالإضافة إلى **`files-azure`** (Azure Blob Storage من Microsoft، عبر connection string
  أو account+key أو SAS) (server #22). المفاتيح server-side، الـ SPA يبقى على `/api/files/*`.
  و**`files-gdrive`** (Google Drive عبر حساب خدمة + مجلّد مُشارَك) (server #23).
  **متابعة اختيارية:** محوّلات بواجهات أخرى (Box · OneDrive) بنفس النمط.
- [x] ~~**G2 التفريغ المحلي في المتصفّح**~~ ✅ — محوّل `ai-local-xenova` (Whisper عبر transformers.js
  من CDN كسولًا، بلا خادم/مفتاح)، يحقّق منفذ AiProvider (تفريغ فقط) (app #148).
- [x] ~~**G8 صفحتا Uploader و Transcriber**~~ ✅ — `UploaderPage` (رفع/إدارة عبر FileStore) و
  `TranscriberPage` (تفريغ سحابي أو محلي بطوابع زمنية) (app #149).

### تشغيل/جودة
- [ ] فحص بصري حيّ شامل (Settings/DataCenter/AI) — preview يدويّ (أداة Windows معطّلة)
- [ ] توثيق تشغيل full-stack بـ AI مفعّل (دليل خطوة-بخطوة)

---

## 5. قرارات معلّقة تحتاج المالك

1. ~~**التفريغ الصوتي**~~ ✅ مُقرَّر: متعدّد المزوّدين (Whisper API + ذاتي الاستضافة) مع اختيار المستخدم.
2. ~~**G5 المونتاج**: نطاق MVP~~ ✅ مُقرَّر ومُنفَّذ: rough cuts + تصدير (JSON/EDL/MP4)؛ المتبقّي صفحة UI فقط.
3. حذف الفروع البعيدة المهجورة (`codex/*` …) — مدمجة وآمنة، تحتاج إذنًا صريحًا.

---

## 6. التشغيل السريع (إنتاج)

```bash
# Postgres مُجمَّع + auth — إعداد بأمر واحد (أسرار عشوائية تلقائيًّا)
cd archive-server && sh deploy/setup.sh
#  ثم عدّل DOMAIN/ACME_EMAIL في .env (و AI_PROVIDER/AI_API_KEY اختياريًّا)
docker compose -f docker-compose.postgres.yml up -d --build
```
- تبديل القاعدة لاحقًا (مُجمَّع ↔ SQL خارجي): **الإعدادات ← الصيانة ← قاعدة البيانات**
  (اختبار + حفظ + إعادة تشغيل). الأولوية: ملف محفوظ > `DATABASE_URL` > افتراضي `POSTGRES_*`.

الدليل الكامل: [archive-server `deploy/hostinger-vps.md`](https://github.com/ahmedahmed1223/archive-server/blob/main/deploy/hostinger-vps.md)

## 7. عدّاد الاختبارات (بوّابات الجودة)
- **archive-core:** اختبارات العقد
- **archive-server:** 128 اختبار (pocketbase/postgres/api/auth/realtime/ai/ai-sdk/export/dropbox/s3/azure/gdrive/share/config/admin) + integration-postgres حيّ
- **archive-app:** verify-modules كامل (+ projects export-client · share-client · local-whisper · media) + theme-v2 + **مصفوفة axe a11y موسّعة عبر الصفحات** (20 صفحة native)
