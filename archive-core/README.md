# @archive/core

النواة **غير المرتبطة بخلفية** لتطبيق أرشيف الفيديو. هي مصدر الحقيقة المشترك داخل
`pnpm` workspace، وتستهلكها واجهة `@archive/app` وخادم `archive-server` عبر
اعتمادية `workspace:` بلا انجراف بين نسخ منفصلة.

## ما الذي يصدّره هذا الإصدار (v1.2.1)

- **المنافذ (Ports):** عقود مجرّدة + مدقّقات شكل لكلٍّ من:
  `StorageProvider`، `FileStore`، `AuthProvider`، `SyncProvider`، `AiProvider`.
- **سجلّ المزوّدات (Registry):** حقن صرف (Dependency Injection). النواة لا تسمّي أي
  خلفية؛ كل تطبيق يسجّل محوّلاته عند الإقلاع. تُرمى أخطاء واضحة قبل التهيئة.

> هذا الإصدار يثبت طبقة العقود والمنافذ المشتركة الخالية من الاعتماديات الثقيلة.

## الاستهلاك داخل workspace

```jsonc
// package.json في @archive/app أو archive-server
{
  "dependencies": {
    "@archive/core": "workspace:1.2.1"
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
pnpm run verify:core   # من جذر المستودع
```

الحزمة تُشحن كمصدر ESM بلا خطوة بناء؛ مُجمِّع التطبيق المستهلك (Vite) يتولّى الباقي.

## الإصدار

تزامن النسخة يتم داخل الـ workspace. عند تغيير عقد عام في `@archive/core`، حدّث
نسخة الحزمة واعتمادات `workspace:` المتأثرة في نفس التغيير.
