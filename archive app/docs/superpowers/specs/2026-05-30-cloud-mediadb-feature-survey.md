# مسح ميزات CLOUD‑MediaDB ومصفوفة النقل إلى النسخة السحابية

> **الغرض:** بعد جلب أحدث نسخة من مستودع `CLOUD-MediaDB` (المرجع المحلي:
> `D:/archiveaq/cloud-mediadb-ref`، آخر التزام `765e387`)، نوثّق هنا ميزاته
> الكاملة، ونقارنها بما يملكه نظامنا الحالي (`archive-app`)، ونحدّد ما يجب نقله
> في مرحلة التطوير التالية (النسخة السحابية)، مربوطًا بمعمارية المنافذ/المحوّلات
> وأهداف البناء التي أُرسيت في المرحلة 0 (PR #79).

---

## 1) ما هو CLOUD‑MediaDB؟

نظام **خادمي (server‑based)** لإدارة الأصول الإعلامية والتوثيق الذكي، مبني كـ
**Express + better‑sqlite3** للخلفية (`server.ts` ~65KB، ~95 مسار API) مع واجهة
**React 19 + Vite + Tailwind 4** (توجيه عبر `react-router-dom`). يتميّز بثلاث طبقات
لا يملكها نظامنا بعد: **محرّك ذكاء اصطناعي**، و**تخزين سحابي للملفات (Dropbox)**،
و**سير عمل المونتاج (Projects/NLE)**.

### المكدّس التقني (من `package.json`)
- خلفية: `express`, `express-session`, `better-sqlite3`, `multer` (رفع), `firebase` (+ Firestore بديلًا للمزامنة).
- ذكاء اصطناعي: `@google/genai` (Gemini)، توافق OpenAI/OpenRouter عبر REST، و`@xenova/transformers` (تفريغ صوتي محلي في المتصفّح).
- تخزين: `dropbox` SDK.
- واجهة: `react`, `react-router-dom`, `motion`, `recharts`, `react-markdown`, `react-hot-toast`, `xlsx`.

### نموذج البيانات (SQLite — `src/server/db.ts`)
`indexed_files`، `projects`، `project_files` (notes, ترتيب، rough cut)، `dropbox_accounts`،
`categories` (هرمية + لون + order_index)، `custom_fields` (type/options/is_required/
condition_field_id/condition_value/is_active)، `file_categories`، `file_custom_values`،
`dictionary_terms` (term/type/definition/synonyms)، `users` (role)، `collections` +
`collection_files` (sort_order)، `user_preferences` (theme + keyboard_shortcuts)،
`activity_logs`، `config`.

### الصفحات (frontend)
ArchiveManager, Collections, Dashboard, DataCenter, FileView, GraphView, Help, Home,
Login, **Projects/ProjectView/SharedProjectView**, Settings, TaxonomyManager,
**Transcriber, Uploader**, UserManager.

### سطح الـ API (مجموعات مختارة)
auth (login/logout/status)، collections، users، settings، **dropbox/** (accounts،
OAuth: url/callback/exchange/disconnect، list/upload/create_folder/search/link/
thumbnail/move_bulk)، **transcribe / transcribe-bulk**، **sync (+ sync/events SSE)**،
files (+tags، taxonomy، manual، bulk-tag، bulk-delete)، categories (+reorder)،
dictionary، custom_fields (+reorder)، tags (rename/manual/delete/bulk)، **ai/**
(chat، suggest-tags، proofread، autocomplete، test)، openrouter/models، reports،
data-center (download/import)، **projects/** (files bulk، notes، roughcut، **export/mp4**،
order)، **shared/:token** (مشاركة عامة).

---

## 2) ماذا يملك نظامنا (archive-app) بالفعل؟

نظامنا (offline‑first SPA) سبق أن نفّذ **خارطة طريق CLOUD‑MediaDB غير‑الذكية
بالكامل** عبر PR0–PR11 + التقييم:

- مؤشّرات اكتمال التوصيف (Completeness) ✅
- المواد ذات الصلة / محرك التقاطع (Intersection/Related) ✅
- كشف الفجوات في التوصيف (Gap detection) ✅
- الإكمال التلقائي التنبؤي المدبَّر بالقاموس ✅
- المجموعات الذكية القائمة على الاستعلام (Smart/Query collections) ✅
- الحقول المخصّصة الشرطية + المجموعات/التبويبات/الترتيب/الخيارات ✅
- خريطة العلاقات (Graph view) ✅
- سجل الإصدارات والتراجع (Version history + rollback) ✅
- تفاصيل بمساحة منقسمة (Split‑pane DetailPage) ✅
- إشارات مرجعية بقفز زمني على الفيديو (Bookmarks + seek) ✅
- التصنيف الهرمي، القاموس/المعجم، المستخدمون/RBAC، سجل التدقيق ✅
- تصدير Excel/CSV (Data Center) ✅، التقييم (Rating) ✅
- اختصارات لوحة المفاتيح + لوحة الأوامر ✅
- سقّالة المزامنة (deviceId, syncVersion, كشف التعارض، delta export) ✅
- **المرحلة 0**: منافذ `StorageProvider`/`FileStore` + محوّلات محلية + هدفا بناء spa/cloud ✅

**الخلاصة:** الفجوة بيننا وبين CLOUD‑MediaDB لم تعد في ميزات الأرشفة الأساسية،
بل محصورة في **السحابة + الذكاء الاصطناعي + سير عمل المونتاج**.

---

## 3) الفجوة: ما يملكه CLOUD‑MediaDB ولا نملكه بعد

| # | الميزة | الوصف | الطبقة المعمارية لدينا | الهدف |
|---|--------|-------|------------------------|-------|
| G1 | **محرّك الذكاء الاصطناعي** | تفريغ+تلخيص+وسوم من صوت/مستند، اقتراح وسوم/تصنيفات، إكمال حقول، تدقيق لغوي عربي، محادثة مع المستند، ترتيب نتائج البحث دلاليًّا. متعدّد المزوّدين (Google/OpenAI/OpenRouter) + اختيار النموذج + اختبار الاتصال. | منفذ جديد **`AiProvider`** + محوّلات (`ai-gemini`/`ai-openai`/`ai-openrouter`) | cloud (وكيل خادمي لإخفاء المفاتيح) |
| G2 | **تفريغ صوتي محلي في المتصفّح** | `@xenova/transformers` (whisper‑tiny) مع طوابع زمنية، بلا خادم. | محوّل **`ai-local-xenova`** خلف نفس منفذ `AiProvider` (تفريغ فقط) | **spa + cloud** (يعمل دون اتصال!) |
| G3 | **تخزين سحابي للملفات (Dropbox)** | OAuth متعدّد الحسابات/الفريق، list/upload/folder/search/link/thumbnail/move، فهرسة مجلّد كامل. | منفذ **`FileStore`** الموجود + محوّل **`files-dropbox`** (و`files-ftp` لاحقًا) | cloud |
| G4 | **خلفية بيانات سحابية + لحظية** | في المرجع: Express+SQLite + مزامنة Firestore + SSE (`/api/sync/events`). لدينا القرار: **PocketBase** (auth+REST+realtime+تخزين). | منفذ **`StorageProvider`** الموجود + محوّل **`cloud-pocketbase`** + منفذ **`SyncProvider`** (اشتراكات لحظية) | cloud |
| G5 | **المشاريع وسير عمل المونتاج (NLE)** | مساحات عمل (Projects) + ملاحظات + ترتيب، **قصاصات بنقاط in/out (rough cuts)**، **تصدير MP4** وخريطة NLE (JSON) لـ DaVinci/Premiere، Storyboarding. | ميزة منتج جديدة (مخازن/شرائح Zustand؛ غير مرتبطة بالخلفية) | spa + cloud (التصدير MP4 يحتاج خادمًا → cloud) |
| G6 | **المشاركة الموجّهة (Scoped sharing)** | رمز مشاركة لكل مشروع + صفحة عرض عامة (`SharedProjectView`)، ومخطّط لاحق: انتهاء صلاحية + كلمة مرور + إخفاء بيانات. | يحتاج خادمًا للرابط العام | cloud فقط |
| G7 | **ربط الطوابع الزمنية في النص** | اكتشاف `[02:15]`/`12:45` داخل التفريغ/الملخّص وجعلها روابط قفز قابلة للنقر. | تحسين بسيط على مكوّن DetailPage الحالي (لدينا seek بالفعل) | spa + cloud |
| G8 | **صفحتا Uploader و Transcriber** | تدفّقات مخصّصة للرفع والتفريغ الذكي. | صفحات جديدة تستهلك `AiProvider`/`FileStore` | يعتمد على G1/G2/G3 |

---

## 4) التسلسل المقترح (مدمَج في خطة الإنتاج ذات الـ7 مراحل)

المرحلة 0 (الفصل والأساس) **منجزة** (PR #79). التسلسل التالي:

1. **المرحلة 1 — ربط المحوّلات + منافذ Auth/Sync:** توصيل `getStorageProvider()`/
   `FileStore` فعليًّا داخل التطبيق (بدل الاستيراد المباشر لـ `services/storage`)،
   وإضافة منفذي `AuthProvider` و`SyncProvider`. (لا ميزة مرئية جديدة؛ تمكين.)
2. **المرحلة 2 — محوّل `cloud-pocketbase`:** `StorageProvider` سحابي + auth +
   اشتراكات لحظية (يحلّ محلّ Express+SQLite+Firestore+SSE من المرجع دفعةً واحدة). (G4)
3. **المرحلة 3 (جديدة، أكبر فارق) — طبقة الذكاء الاصطناعي:** منفذ `AiProvider` +
   محوّلات Gemini/OpenAI/OpenRouter (وكيل خادمي في cloud) + محوّل التفريغ المحلي
   `ai-local-xenova` (يعمل في spa أيضًا) + واجهة إعدادات المزوّد/المفتاح/النموذج +
   صفحتا Uploader/Transcriber. (G1، G2، G8)
4. **المرحلة 4 — محوّلات `FileStore` السحابية:** Dropbox أولًا ثم FTP. (G3)
5. **المرحلة 4.5 (جديدة) — المشاريع وسير عمل المونتاج:** Projects + rough cuts +
   تصدير NLE/MP4 + المشاركة الموجّهة (العرض العام cloud‑only). (G5، G6)
6. **المرحلة 5 — تقوية الإنتاج + Docker** (compose: app + PocketBase + volumes).
7. **المرحلة 6 — الإصدار والترحيل.**

### تحسينات سريعة مستقلّة (يمكن دمجها متى شئنا)
- **G7** (ربط الطوابع الزمنية في النص) تحسين صغير على `DetailPage` يصلح للنسختين.

---

## 5) ملاحظات نقل مهمّة

- **لا ننقل خادم Express كما هو.** قرار المعمارية (PocketBase + منافذ/محوّلات) يستبدل
  طبقة `server.ts`/SQLite/Firestore بمحوّل `cloud-pocketbase` واحد خلف `StorageProvider`.
  ما يُنقَل من المرجع هو **المنطق والمخطّطات والـ prompts**، لا بنية الخادم.
- **أمن مفاتيح الذكاء الاصطناعي:** لا تُوضع مفاتيح المزوّدين في حزمة الـ SPA. في هدف
  cloud تُستدعى عبر وكيل خادمي (PocketBase hook/route). في هدف spa يُتاح **التفريغ
  المحلي فقط** (بلا مفتاح) عبر `ai-local-xenova`.
- **prompts جاهزة للنقل** موجودة في `src/server/gemini.ts` بالمرجع (تفريغ/تلخيص،
  اقتراح وسوم+تصنيفات، تدقيق لغوي عربي مع قائمة تصحيحات، إكمال الحقول، ترتيب البحث،
  محادثة المستند) — تُعاد صياغتها خلف `AiProvider` مع مخطّطات استجابة JSON.
- **نموذج البيانات متوافق إلى حدٍّ كبير** مع مخازننا الحالية (types/fields/dictionary/
  collections/users/audit)؛ الإضافات الجديدة المطلوبة: كيانات **Projects/ProjectFiles
  (مع rough cut)** و**share tokens**.

---

## 6) تحديث الحالة (2026-05-31) — بعد معلم نسخة الإنتاج

التقدّم منذ كتابة المسح: **G4 (العمود الفقري السحابي) أُنجز جوهريًّا ومُتحقّق حيًّا.**

| الفجوة | الحالة | ما أُنجز / ما تبقّى |
|--------|--------|---------------------|
| **G4** خلفية سحابية + مصادقة | ✅ منجز جوهريًّا | محوّلا `cloud-pocketbase` (0.39) + `cloud-postgres-prisma` (Postgres 18 / Prisma 7) خلف منفذ 11 دالّة · REST RPC API · **مصادقة JWT** · Docker/Caddy/Hostinger · SPA `cloud-http`. **متبقّي: المزامنة اللحظية** (SyncProvider لا يزال stub) |
| **G1** محرّك AI متعدّد المزوّدين | 🟡 جزئي | منفذ `AiProvider` (8 دوال) + `ai-local-stub` موجودان؛ محوّلات Gemini/OpenAI/OpenRouter لم تُبنَ |
| **G3** تخزين ملفات سحابي | 🟡 جزئي | منفذ `FileStore` + المحلي موجودان؛ محوّل Dropbox لم يُبنَ |
| **G2** تفريغ محلي · **G5** المونتاج · **G6** المشاركة · **G7** الطوابع · **G8** الصفحات | ⬜ لم تبدأ | G6 صار **مُمكَّنًا** (الخادم جاهز) · G7 تحسين صغير |

**الخلاصة المحدّثة:** الفجوة المتبقّية محصورة الآن في **الذكاء الاصطناعي
(G1/G2/G8)** و**سير عمل المونتاج (G5/G6)** — كلاهما مُمكَّن لأن البنية السحابية
والمنافذ جاهزة. الترتيب المقترح: المزامنة اللحظية (إكمال G4) → AI (G1/G2) →
المونتاج (G5/G6). انظر `docs/ROADMAP.md`.

---

*المرجع المحلي للاستشهاد بالشيفرة: `D:/archiveaq/cloud-mediadb-ref` (للقراءة فقط،
خارج شجرة هذا المستودع).*
