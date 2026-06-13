# خطة §19.2 — إعادة بناء نسخة AI Studio: دعم Firebase + SQLite

> **الحالة:** خطة تصميم (لا كود) — جلسة 10 يونيو 2026.
> **النطاق:** مهمة TASKS.md §19.2. هذه وثيقة تخطيط تسبق التنفيذ كما طُلب ("Plan it first").

---

## 1. الوضع الحالي (مؤكَّد بالكود)

بنية التخزين تعتمد منافذ (ports) في `@archive/core` + محوّلات (adapters) في `archive-app/src/storage/adapters/`، تُربط عبر بذرة إقلاع واحدة `bootstrap/registerByBackendChoice.js`.

**خيارات الباك-إند الحالية** (`bootstrap/backendChoice.js`):
- `BACKEND_CHOICES = ["local", "pocketbase", "postgres"]`
- `LOCAL_ENGINES = ["indexeddb", "sqlite"]`

**المحوّلات الموجودة فعلاً:**
| المنفذ | محلي | سحابي |
|--------|------|-------|
| StorageProvider | `local-indexeddb` ✅، `local-sqlite` ✅ | `cloud-http` (RPC لـ archive-server) |
| Auth/Session | `local-auth`, `local-session` | `cloudSession` |
| FileStore | `files-local` | `cloud-files` |
| Sync | `local-sync` | `cloud-sync` |
| AI | `ai-local-stub`, `ai-local-xenova` | `cloud-ai` |

**سلوك AI Studio الحالي** (`backendChoice.js:96-117`): عند `__VITE_AISTUDIO__=true` يُجبر `resolveBackendChoice` الباك-إند على `local` **بمحرّك `indexeddb` ثابتاً** (يتجاهل الخيار المحفوظ والمحرّك المحفوظ). السبب: PocketBase/Postgres يحتاجان خادماً لا يصله iframe الـ AI Studio (CSP + cross-origin).

### الخلاصة
- **SQLite:** المحوّل موجود ومُسجَّل، لكن **AI Studio لا يصله** لأن الإجبار يثبّت `indexeddb`. الإصلاح صغير.
- **Firebase:** **غير موجود** كخيار باك-إند ولا كمحوّل. عمل جديد كامل.
- **توافق السيرفر مع أحدث AI Studio:** يحتاج بحثاً + مواءمة (أدناه §4).

---

## 2. القرارات التصميمية

### لماذا Firebase مناسب لـ AI Studio (بخلاف pocketbase/postgres)
Firebase SDK يعمل **من جانب العميل عبر HTTPS** إلى `*.googleapis.com` (Firestore/Auth/Storage) — لا يحتاج خادماً مملوكاً للمستخدم. لذا يعمل داخل iframe الـ AI Studio (خدمة Google داخل منصّة Google)، وهو ما يجعله "خياراً أفضل" من المحلي فقط. **نقطة تحقّق:** تأكيد أن CSP الخاص بـ AI Studio Apps يسمح بالاتصال بـ Firebase endpoints (بحث/اختبار في §4).

### المصفوفة المستهدفة لكل هدف بناء
| الهدف | indexeddb | sqlite | firebase | pocketbase | postgres |
|------|-----------|--------|----------|-----------|----------|
| spa (offline) | ✅ افتراضي | ✅ | ⚠️ اختياري | ❌ | ❌ |
| cloud | ✅ | ✅ | ✅ | ✅ | ✅ |
| **aistudio (الهدف)** | ✅ | ✅ **(جديد)** | ✅ **(جديد)** | ❌ | ❌ |

---

## 3. خطة التنفيذ (مراحل)

### المرحلة أ — فتح SQLite لـ AI Studio (صغير، منخفض الخطر)
1. `bootstrap/backendChoice.js`: تعديل `resolveBackendChoice`/`shouldForceLocalBackend` بحيث يُجبر AI Studio على **`local`** لكن **يحترم `localEngine` المحفوظ** (indexeddb أو sqlite) بدل تثبيت `indexeddb`.
2. خطوة التخزين في `V1OnboardingWizard` + `LocalStorageEngineSettings.jsx`: إتاحة اختيار محرّك SQLite في وضع AI Studio.
3. اختبارات: توسعة اختبارات `backendChoice` لتغطية مصفوفة AI Studio × المحرّك.
- **الملفات:** `backendChoice.js`، `registerByBackendChoice.js` (يمرّر `localEngine` بالفعل)، `LocalStorageEngineSettings.jsx`.

### المرحلة ب — محوّل Firebase (StorageProvider) — القلب
1. `BACKEND_CHOICES` → إضافة `"firebase"`؛ تخزين تهيئة Firebase (apiKey/projectId/…) بجانب الخيار.
2. محوّل جديد `storage/adapters/firebase-firestore/index.js` يُطبّق منفذ `StorageProvider` (`get`/`getAll`/`put`/`putBatch`/`delete`/`deleteBatch`/`clear`/`snapshot`/`replaceAll`) فوق Firestore. مطابقة مخطّط `STORES` لمجموعات Firestore، مع batched writes للذرّية في `replaceAll`.
3. تسجيل في `registerByBackendChoice.js`: فرع `backend === "firebase"`.
4. تبعية: `firebase` (Web SDK v10+, modular) في `archive-app` deps.
- **الملفات الجديدة:** `firebase-firestore/index.js`، `firebase-firestore/mapping.js`، `bootstrap/firebaseConfig.js`.

### المرحلة ج — Firebase للمنافذ الأخرى (Auth/FileStore)
1. `firebase-auth` يُطبّق `AuthProvider`/`SessionProvider` فوق Firebase Auth.
2. `firebase-files` يُطبّق `FileStore` فوق Firebase Storage.
3. ربطها في بذرة الإقلاع لخيار firebase (مع إبقاء AI/Sync محلية أو سحابية حسب التهيئة).

### المرحلة د — واجهة التهيئة
1. خطوة تخزين في `V1OnboardingWizard`: خيار "Firebase" + نموذج لصق تهيئة Firebase (JSON config).
2. `DatabaseSettings.jsx`: عرض/تعديل تهيئة Firebase بعد الإعداد.
3. تحقّق من التهيئة + رسائل خطأ واضحة عند فشل الاتصال.

### المرحلة هـ — التبديل الساخن والترحيل
1. `bootstrap/switchBackendHot.js` (موجود): دعم التبديل من/إلى firebase.
2. ترحيل بيانات اختياري local ⇆ firebase عبر `snapshot()`/`replaceAll()` (المنفذ يدعمهما بالفعل).

---

## 4. توافق السيرفر مع أحدث AI Studio Apps (بحث + مواءمة)

> يتطلّب بحثاً في أحدث قدرات Google AI Studio Apps (تغيّرت 2026).

نقاط للتحقّق قبل التنفيذ:
1. **نموذج النشر:** هل ما زال AI Studio Apps = SPA في iframe، أم أصبح يدعم backend/functions؟ يحدّد ما إذا كان `cloud-http` (RPC لـ archive-server) قابلاً للاستخدام داخل AI Studio.
2. **CSP/الشبكة:** هل يسمح iframe بالاتصال بـ `*.googleapis.com` (Firebase)؟ (يحدّد جدوى المرحلة ب).
3. **حقن المفاتيح:** كيف يوفّر AI Studio مفاتيح Gemini للتطبيق؟ مواءمة `ai-*` adapters و`sdkProvider.js` في الخادم.
4. **archive-server:** إن دعم AI Studio الجديد backend، مواءمة نقاط الـ RPC/الإصدار مع أحدث SDK.

أدوات البحث: Context7/الوثائق الرسمية + Exa عند الحاجة.

---

## 5. المخاطر والاعتماديات

| المخاطرة | التخفيف |
|----------|---------|
| CSP في AI Studio يحجب Firebase | تحقّق مبكر (§4.2)؛ إن حُجب → الاكتفاء بـ SQLite لـ AI Studio |
| `firebase` SDK يضخّم حجم الحزمة (aistudio = ملف واحد) | dynamic import؛ تحميل firebase فقط عند اختياره |
| تعارض مع نظام السمات/الإقلاع | لا — المحوّل خلف منفذ StorageProvider، معزول |
| ذرّية `replaceAll` على Firestore | batched/transaction writes؛ حدود Firestore (500/دفعة) تُقسَّم |

## 6. ترتيب مقترح
أ (SQLite لـ AI Studio — سريع) → §4 بحث (يحسم جدوى Firebase) → ب → ج → د → هـ.

**الجهد الكلي:** XL (أسابيع). المرحلة أ وحدها: ⏱️S–M وتعطي قيمة فورية (SQLite في AI Studio).
