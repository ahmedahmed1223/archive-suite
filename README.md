# Archive Suite

منصة أرشيف ميديا ذكية مبنية لتشغيل تجربة فيديو متكاملة في بيئة محلية وسحابة.

هذا المستودع هو monorepo يحتوي على ثلاثة أجزاء رئيسية:

- `archive app/` — واجهة المستخدم الأمامية المبنية بـ React و Vite.
- `archive-core/` — مكتبة النواة المشتركة التي تطرح منافذ التخزين وAI والمصادقة.
- `archive-server/` — خادم الإنتاج مع دعم Postgres/PocketBase وAI وخيارات تخزين متعددة.

## نظرة عامة

المشروع مصمم كي يعمل كمنصة أرشيف إعلامي:

- إدارة الفيديوهات والملفات والبيانات الوصفية.
- دعم البحث المتقدم والفلاتر والمخططات الزمنية.
- تكامل AI للوسوم والتلخيص والتفريغ.
- دعم تخزين متعدد: local, Dropbox, S3, Azure Blob, Google Drive.

## بنية المستودع

```text
Arch_App/
  ├─ archive app/      # الواجهة الأمامية
  ├─ archive-core/     # النواة المشتركة
  ├─ archive-server/   # الخادم والإنتاج
  ├─ .git/
  ├─ .gitignore
  ├─ package.json
  ├─ pnpm-workspace.yaml
  ├─ pnpm-lock.yaml
  └─ README.md
```

## إعداد بيئة التطوير

### تثبيت الحزم

من جذر المستودع:

```powershell
cd "d:\archiveaq\Arch_App"
pnpm install
```

### تشغيل الواجهة الأمامية

```powershell
pnpm run dev
```

### تشغيل الخادم

```powershell
pnpm run server
```

### التحقق من الصحة

```powershell
pnpm run verify
```

للتحقق الجزئي أثناء التطوير:

```powershell
pnpm run verify:app
pnpm run verify:core
pnpm run verify:server
```

## توصيف الأجزاء

### `archive app/`

واجهة SPA تدمج:

- تجربة مستخدم تفاعلية.
- وضع offline-first.
- اتصال API لخادم الإنتاج.
- تكامل `archive-core` كمكتبة مشتركة.

### `archive-core/`

الطبقة المشتركة بين الواجهة والخادم، وتوفر:

- عقود ومنافذ التخزين.
- منافذ المصادقة.
- منافذ AI.
- بنية قابلة للتوسعة دون ربط مباشر مع مزود تخزين معين.

### `archive-server/`

الخادم الإنتاجي الذي يوفر:

- واجهة API وAuth وRealtime.
- تكامل Postgres وPocketBase.
- دعم تخزين Dropbox وS3 وAzure Blob وGoogle Drive.
- تكامل AI متعدد المزودين.

## ملاحظات تقنية

- يعتمد المستودع على `pnpm` workspace.
- استخدام `pnpm-lock.yaml` لضمان اعتمادية قابلة للتكرار.
- أسماء الحزم داخل الـ workspace هي `@archive/app` و`@archive/core` و`archive-server`.
- جميع الحزم تُدار داخل نفس المستودع.

## للمطورين

- اعمل في فرع مستقل لكل ميزة أو إصلاح.
- استخدم `pnpm install` من جذر المشروع.
- شغل `pnpm run verify` قبل فتح أي PR.

---

Archive Suite هي نقطة انطلاق لتطوير منصة أرشيف ميديا متكاملة، وتوفر أساسًا نظيفًا للعمل بين واجهة مستخدم متقدمة وخادم إنتاج مرن.
