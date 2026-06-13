# بيان حدود النواة (Core Boundary Manifest)

المرجع المعتمد لما سيُنقل إلى حزمة `archive-core` (SP2) مقابل ما يبقى داخل كل تطبيق.
القاعدة: ما لا يسمّي خلفيةً ملموسة → نواة؛ ما يلمس خلفية/تشغيلًا → قشرة تطبيق.

## نواة (→ archive-core)
- `src/core/` — المدخل العام (barrel).
- `src/storage/ports/` — كل المنافذ (Storage/File/Auth/Sync/Ai، ولاحقًا Session).
- `src/storage/index.js` — سجلّ المزوّدات الموحّد.
- `src/stores/`, `src/features/`, `src/pages/`, `src/components/`, `src/app/`,
  `src/services/` (عدا طبقة IndexedDB)، `src/theme/`, `src/utils/`, `src/styles/`.
- `scripts/verify-modules*.mjs` — اختبارات النواة.

## قشرة SPA (→ archive-spa)
- `src/storage/adapters/local-indexeddb/`, `files-local/`, `local-auth/`, `local-sync/`,
  `ai-local-stub/`.
- `src/services/storage/` — تنفيذ IndexedDB الفعلي (DB_NAME/الترقيات/المخطّط).
- `src/bootstrap/registerLocalProviders.js`، `src/main.js` (المدخل)، إعداد بناء الملف‑الواحد.

## قشرة السيرفر (→ archive-server)
- `src/storage/adapters/cloud-pocketbase/` (يُنشأ في SP4)، `registerCloudProviders`،
  مدخل cloud، `pocketbase/` (مخطّط + docker)، إعداد البناء متعدّد الملفات.

## ملاحظات نقل
- المدخل العام `src/core/index.js` يُوسَّع وقت الاستخراج ليشمل مدخل التطبيق والواجهة
  (JSX) بعد ضبط بناء المكتبة؛ في SP1 يبقى Node-safe (منافذ + سجلّ فقط).
- `src/services/storage/` (IndexedDB) قشرةُ SPA وليست نواة — النواة تعتمد المنفذ لا التنفيذ.
