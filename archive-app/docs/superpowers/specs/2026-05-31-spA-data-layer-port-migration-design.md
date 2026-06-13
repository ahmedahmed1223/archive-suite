# المشروع الفرعي A — فكّ ارتباط طبقة البيانات بالمنفذ — التصميم

> جزء من معلم «استخراج الواجهة إلى @archive/core v1.1»
> (`2026-05-31-three-repo-split-shared-core-design.md`). A شرطٌ مسبق لـ B
> (الاستخراج): تجعل المتاجر مستقلّة عن الخلفية حتى تصبح قابلة للنقل إلى النواة.

## الهدف

جعل المتاجر وطبقة الوصول للبيانات تعتمد **منفذ `StorageProvider`** عبر
`getStorageProvider()` بدل استيراد تنفيذ IndexedDB (`services/storage`) مباشرةً —
**مع حفظ السلوك تمامًا** — فتصير المنافذ فعّالة وقت التشغيل، وتغدو المتاجر قابلة
للاستخراج إلى `@archive/core` لاحقًا.

## الوضع الحالي (الارتباط)

خمسة ملفات تستورد عمليات `db*` و`STORES` من `services/storage` مباشرةً:
`stores/slices/archiveSlice.js`، `stores/slices/settingsSlice.js`،
`stores/slices/dataTransferSlice.js`، `stores/storePersistence.js`،
`pages/DataCenterPage.jsx`. تنفيذ IndexedDB قشرةُ SPA ولا يمكن أن يعيش في النواة.

## المقاربة المعتمدة: واجهة تخزين رقيقة مدعومة بالمنفذ

بدل تعديل عشرات مواضع النداء (خطر انحدار)، نُدخل وحدة وصول واحدة تعيد تصدير عمليات
المزوّد النشط بالأسماء نفسها، فتتغيّر الملفات الخمسة في **سطر الاستيراد فقط**.

## المعمارية

- **`src/services/storageAccess.js`** (مؤهّلة للنواة):
  - تستورد `getStorageProvider` من `@archive/core` و`STORES` من `./storage/schema.js`.
  - تصدّر دوالًّا تفويضية تطابق توقيعات الحالية تمامًا:
    `dbGet(store,key)`، `dbGetAll(store)`، `dbPut(store,record)`، `dbAdd(store,record)`،
    `dbDelete(store,key)`، `dbClear(store)`، `dbPutBatch(store,items)`،
    `dbDeleteBatch(store,keys)` — كلٌّ ينادي `getStorageProvider().<method>(...)`.
  - تعيد تصدير `STORES`.
- **تبديل الاستيراد** في الملفات الخمسة: من `…/services/storage/index.js` إلى
  `…/services/storageAccess.js`. لا تتغيّر مواضع النداء ولا الأسماء.
- **ربط الإقلاع** في `src/main.js`: استدعاء `registerLocalProviders()` قبل
  `startVideoArchive()` (يهيّئ المزوّد قبل أي إجراء متجر).

> ملاحظة: `getStorageProvider()` يرمي إن لم يُهيّأ؛ ربط الإقلاع و(في verify) النداء
> المسبق لـ `registerLocalProviders()` يضمنان التهيئة قبل الاستخدام.

## تدفّق البيانات

إجراء متجر → `dbPut(STORES.ITEMS, rec)` (من storageAccess) →
`getStorageProvider().put(...)` → المحوّل المحلي `local-indexeddb` →
`services/storage` (IndexedDB). نفس المسار الفعلي، بإضافة طبقة منفذ واحدة.

## الاختبار (حفظ السلوك)

- `npm run verify` — مجموعة «store action smoke tests» تمرّ عبر المنفذ (verify يستدعي
  `registerLocalProviders()` مسبقًا؛ المحوّل المحلي يلفّ IndexedDB الوهمي).
- `npm run build:spa` + `npm run build:cloud` خضراء.
- **فحص حيّ:** تهيئة + إضافة عنصر + إعادة تحميل → بقاء البيانات (IndexedDB فعلي عبر المنفذ).

## غير-أهداف (لـ B لاحقًا)

استخراج المتاجر/الميزات/الواجهة إلى `@archive/core v1.1`؛ نقل `STORES`/`schema.js`
إلى النواة؛ قرار بناء-مكتبة مقابل شحن-مصدر؛ مسح Tailwind عبر حدود الحزمة.

## المخاطر والتخفيف

- **انحدار طبقة البيانات:** عمليات المحوّل المحلي تطابق `db*` حرفًا بحرف (لافّ رقيق) →
  لا تغيير سلوك؛ smoke tests + البناءان + فحص حيّ بوّابات.
- **رمي getStorageProvider قبل التهيئة:** ربط الإقلاع + النداء المسبق في verify.
- **نمو حزمة SPA:** ضمّ `@archive/core` + المحوّلات في رسم الإقلاع — متوقَّع ومقبول.

## معايير القبول

verify أخضر (بما فيه smoke) · البناءان أخضران · لا استيراد مباشر لـ `services/storage`
في المتاجر/الصفحات (عدا المحوّلات وstorageAccess) · فحص حيّ يثبت بقاء البيانات.

---

## مراجعة التصميم (قرار المستخدم 2026-05-31): توسيع المنفذ بـ snapshot/replaceAll

**اكتشاف أثناء التحليل:** نظام الاستيراد/الاستعادة (`dataTransferSlice` +
`services/data-portability/normalizedImport.js`) يعتمد `getIndexedDbDataSnapshot`
و`writeNormalizedDataToIndexedDb`، والأخيرة تستخدم **معاملة IndexedDB ذرّية عبر كل
المخازن** (مسح+كتابة مع تراجع). لا بدائية «معاملة عبر المخازن» في المنفذ، وPocketBase
بلا معاملات عبر المجموعات — فالعملية خاصّة بالخلفية جوهريًّا.

**القرار:** **توسيع منفذ `StorageProvider`** بدالّتين عاليتين تنفّذهما كل خلفية بطريقتها:
- `snapshot()` → كائن البيانات الكامل عبر كل المخازن.
- `replaceAll(payload)` → استبدال ذرّي/أفضل-جهد لكل المخازن، يعيد عدّادات الكتابة.

هذا يحوّل المنفذ من 9 إلى **11 دالّة**، ويُحقّق فصلًا كاملًا (نظام الاستيراد يمرّ عبر المنفذ).

### التسلسل متعدّد المستودعات (إصدار منسّق)
1. **`archive-core` v1.1.0:** إضافة `snapshot`+`replaceAll` إلى `STORAGE_PROVIDER_METHODS`
   (و`isStorageProvider` يطلبهما) + تحديث اختبارات العقد + وسم `v1.1.0`. (يدفعه المستخدم.)
2. **`archive-app`:** ترقية `@archive/core` إلى `#v1.1.0`؛ المحوّل المحلي `local-indexeddb`
   ينفّذ `snapshot`/`replaceAll` بتفويضٍ لـ `getIndexedDbDataSnapshot`/
   `writeNormalizedDataToIndexedDb` (المحوّل قشرة، فله أن يستورد `services/storage`)؛
   `storageAccess` يكشف القدرتين؛ ينتقل نظام الاستيراد (`normalizedImport`,
   `dataTransferSlice`) + CRUD إلى المزوّد؛ ربط الإقلاع. verify + بناءان + فحص حيّ. (أدفعه أنا.)
3. **`archive-server`:** محوّل PocketBase ينفّذ `snapshot`/`replaceAll` (أفضل-جهد) + ترقية
   الاعتمادية؛ تحديث اختبارات العميل الوهمي. (يدفعه المستخدم.)

### قيد التنسيق
`archive-app` لا يمكن التحقّق منه حتى يصبح وسم `core v1.1.0` على البعيد — لذا الخطوة 1
تُعدّ محليًّا ثم يدفعها المستخدم قبل الخطوة 2.

### معايير القبول (المنقّحة)
المنفذ 11 دالّة في الثلاثة · نظام الاستيراد يمرّ عبر `getStorageProvider().snapshot/replaceAll`
(لا استيراد مباشر للمُحلّلات الذرّية من المتاجر) · `replaceAll` المحلي يحفظ الذرّية ·
verify لكل مستودع + بناءا spa/cloud خضراء · فحص حيّ لاستيراد/استعادة يثبت السلوك.
