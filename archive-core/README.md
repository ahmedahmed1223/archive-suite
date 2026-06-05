# @archive/core

النواة **غير المرتبطة بخلفية** لتطبيق أرشيف الفيديو. مصدر حقيقة واحد تتشاركه نسختا
التطبيق (`archive-spa` دون اتصال، و`archive-server` للإنتاج) عبر **وسم git** —
بلا انجراف وبلا سجل npm.

## ما الذي يصدّره هذا الإصدار (v1.0.0 — طبقة العقد)

- **المنافذ (Ports):** عقود مجرّدة + مدقّقات شكل لكلٍّ من:
  `StorageProvider`، `FileStore`، `AuthProvider`، `SyncProvider`، `AiProvider`.
- **سجلّ المزوّدات (Registry):** حقن صرف (Dependency Injection). النواة لا تسمّي أي
  خلفية؛ كل تطبيق يسجّل محوّلاته عند الإقلاع. تُرمى أخطاء واضحة قبل التهيئة.

> الإصدارات اللاحقة توسّع المدخل العام ليشمل المتاجر والميزات والواجهة (JSX) بعد
> ضبط بناء المكتبة. v1.0.0 مقصور على طبقة العقد الخالية من الاعتماديات.

## الاستهلاك (عبر وسم git)

```jsonc
// package.json في archive-spa / archive-server
{
  "dependencies": {
    "@archive/core": "github:ahmedahmed1223/archive-core#v1.0.0"
  }
}
```

```js
// bootstrap التطبيق
import { registerStorageProvider, getStorageProvider } from "@archive/core";
import { localStorageProvider } from "./storage/adapters/local-indexeddb/index.js";

registerStorageProvider(localStorageProvider); // SPA: محوّل محلي
const data = getStorageProvider();             // كود الميزات لا يعرف الخلفية
```

## التطوير

```bash
npm run verify   # اختبارات عقد بلا اعتماديات (Node فقط)
```

الحزمة تُشحن كمصدر ESM بلا خطوة بناء؛ مُجمِّع التطبيق المستهلك (Vite) يتولّى الباقي.

## الإصدار

وسوم semver (`vX.Y.Z`). الترقية في التطبيقات = رفع الوسم في `package.json` بوعي.
