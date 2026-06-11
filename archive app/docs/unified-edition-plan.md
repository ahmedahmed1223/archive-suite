# خطة الإصدار الموحّد الشامل — دمج Firebase وSQLite في نسخة cloud

> **الحالة:** خطة تصميم (11 يونيو 2026) — تنفّذ توجيه المستخدم: "تقليل تفرّع النظام والاتجاه إلى إصدار واحد شامل".
> **العلاقة بالخطط السابقة:** تَبني على `aistudio-firebase-sqlite-plan.md` (§19.2) وتوسّعها: بدل إضافة Firebase/SQLite لهدف aistudio فقط، نجعل **نسخة cloud هي الإصدار القانوني الواحد** وكل المحرّكات خيارات وقت تشغيل.

---

## 1. المشكلة: التفرّع الحالي

ثلاثة أهداف بناء في `archive app/vite.config.js` تتشارك شجرة مصدر واحدة لكنها تتفرّع سلوكياً:

| الهدف | التغليف | الباك-إندات المتاحة | آلية التفرّع |
|------|---------|---------------------|--------------|
| `spa` | ملف واحد (singlefile) | محلي فقط عملياً | افتراضي |
| `cloud` | chunked (dist-cloud) | محلي + pocketbase + postgres | `__VITE_TARGET__` |
| `aistudio` | ملف واحد | محلي مُجبَر (indexeddb ثابتاً) | `__VITE_AISTUDIO__` → `shouldForceLocalBackend()` |

**تكلفة التفرّع:** ثلاث مصفوفات اختبار، سلوك إقلاع مختلف حسب البناء (`resolveBackendChoice` يتجاهل الخيار المحفوظ في aistudio)، ميزات تصل لهدف وتتأخر عن آخر، ووثائق نشر مزدوجة.

## 2. الهدف: إصدار واحد + تغليفان

**المبدأ:** بناء **cloud** (chunked) هو **التطبيق القانوني الوحيد**. كل الباك-إندات تُختار **وقت التشغيل** من معالج الإعداد/الإعدادات. أهداف `spa`/`aistudio` تبقى **قوالب تغليف فقط** (singlefile inlining + قيمة افتراضية للباك-إند) **بلا أي تفرّع سلوكي في الكود**.

### مصفوفة الباك-إند المستهدفة (كلها وقت تشغيل، في كل تغليف)

| الخيار | المحوّل | الحالة |
|--------|---------|--------|
| محلي / IndexedDB | `local-indexeddb` | ✅ موجود |
| محلي / SQLite | `local-sqlite` (sql.js) | ✅ موجود — محجوب فقط عن aistudio |
| **Firebase** (Firestore/Auth/Storage) | `firebase-*` | ❌ جديد |
| خادم Postgres | `cloud-http` → archive-server | ✅ موجود |
| خادم PocketBase | `cloud-http` → archive-server | ✅ موجود |

**لماذا هذا يحقق "إصدار واحد شامل":** بنية ports/adapters في `@archive/core` جاهزة أصلاً — بذرة الإقلاع `registerByBackendChoice.js` نقطة التوصيل الوحيدة. التفرّع الحالي ليس معمارياً بل مجرد حُجُب (`__VITE_AISTUDIO__`) وقيود تغليف.

## 3. المراحل

### المرحلة أ — إزالة الحُجُب (S، أساس كل شيء)
1. `bootstrap/backendChoice.js`: استبدال `shouldForceLocalBackend()` (إجبار ثابت) بـ**كشف قدرات وقت تشغيل + افتراضي قابل للتهيئة**:
   - `__VITE_AISTUDIO__` يصبح مجرد **default hint** (`defaultBackend: "local"`) لا قفلاً.
   - يُحترم `localEngine` المحفوظ دائماً (sqlite متاح في كل التغليفات).
   - الخيارات الشبكية (postgres/pocketbase/firebase) تبقى متاحة في aistudio مع رسالة فشل اتصال واضحة إن حجبها CSP — بدل إخفائها مسبقاً.
2. حصر كل استخدامات `__VITE_AISTUDIO__`/`__VITE_TARGET__` في الكود (grep) واستبدال أي تفرّع سلوكي بكشف قدرات أو إعداد.
3. اختبارات: مصفوفة `resolveBackendChoice` (تغليف × خيار محفوظ × محرّك).

### المرحلة ب — محوّل Firebase (L، قلب العمل الجديد)
كما في خطة §19.2 (المراحل ب+ج هناك) دون تغيير، مع نقطتين تخصان التوحيد:
1. `BACKEND_CHOICES` += `"firebase"`؛ تهيئة Firebase (projectId/apiKey…) تُخزَّن مع الخيار.
2. `storage/adapters/firebase-firestore/` يطبّق منفذ StorageProvider كاملاً (`snapshot`/`replaceAll` عبر batched writes ≤500/دفعة)؛ `firebase-auth` و`firebase-files` للمنفذين الآخرين.
3. **حتمي للتوحيد:** `import("firebase/…")` ديناميكي داخل فرع `backend === "firebase"` فقط — كي لا يتضخم التغليف الأحادي (singlefile يضمّن كل شيء ثابت الاستيراد).

### المرحلة ج — توحيد التغليف (M)
1. `vite.config.js`: يبقى `--mode spa|cloud|aistudio` لكن الفرق **فقط**: outDir + singlefile flag + `defaultBackend` hint. لا أي `define` يغيّر سلوكاً آخر.
2. توثيق: "إصدار واحد، ثلاث حزم نشر" في README/docs، وتثبيت ذلك في CI (`release:verify` يبني الثلاثة من نفس الكود).
3. **اختبار التكافؤ:** اختبار vitest يؤكد أن `PAGE_MANIFEST` والمسارات والمحوّلات المتاحة متطابقة عبر الأوضاع (لا ميزة محجوبة ببناء).

### المرحلة د — واجهة موحّدة للاختيار (M)
1. خطوة التخزين في `V1OnboardingWizard`: تعرض الخيارات الخمسة كلها (مع شارة "موصى به" حسب السياق المكتشَف: داخل iframe → محلي/Firebase أولاً).
2. `DatabaseSettings.jsx`/`LocalStorageEngineSettings.jsx`: إدارة تهيئة Firebase + تبديل ساخن عبر `switchBackendHot.js` الموجود.
3. ترحيل بيانات بين أي خيارين عبر `snapshot()` → `replaceAll()` (المنفذ يدعمهما) + شريط تقدّم.

### المرحلة هـ — التنظيف والإغلاق (S)
1. حذف أي كود ميت خاص بالأوضاع (بعد grep المرحلة أ).
2. تحديث `aistudio-deployment.md` ليصف التغليف لا التفرّع.
3. إغلاق §19.2 القديمة وربطها بهذه الخطة.

## 4. المخاطر

| المخاطرة | التخفيف |
|----------|---------|
| Firebase SDK يضخّم الملف الأحادي | dynamic import حصراً؛ التغليف الأحادي يبقى محلياً افتراضياً ويحمّل Firebase عند الاختيار فقط — وإن تعذّر مع singlefile، يُوجَّه مستخدمو Firebase لحزمة cloud (نفس التطبيق) |
| CSP في AI Studio يحجب `*.googleapis.com` | كشف قدرات + رسالة واضحة؛ المحلي/SQLite يبقى الافتراضي هناك |
| اختلاف نموذج المصادقة (Firebase Auth ضد JWT المحلي/الخادمي) | `firebase-auth` خلف منفذ SessionProvider نفسه؛ لا يلمس مسارات JWT |
| `replaceAll` الذرّي على Firestore | معاملات/batched chunks + علامة نسخة قبل/بعد للاسترداد |
| تغليف singlefile مع dynamic imports | vite-plugin-singlefile يضمّن الـ chunks — يلزم التحقق مبكراً (spike) قبل المرحلة ب |

## 5. الترتيب والجهد

**أ (S) → spike تغليف Firebase (يومان) → ب (L) → ج (M) → د (M) → هـ (S)** — إجمالي ⏱️XL (4–7 أسابيع)، لكن كل مرحلة تُسلَّم مستقلة وقابلة للدمج، والمرحلة أ وحدها تنهي أكبر تفرّع (إجبار aistudio).
