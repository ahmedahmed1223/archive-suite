# Archive Suite

هذا المستودع هو نسخة موحدة (monorepo) تشمل ثلاثة أجزاء رئيسية مرتبطة بمشروع أرشيف الفيديو:

- `archive app/` - واجهة المستخدم الأمامية React & Vite.
- `archive-core/` - مكتبة نواة مشتركة تحدد المنافذ والعقود بين الواجهة والخادم.
- `archive-server/` - خادم الإنتاج مع دعم Postgres/PocketBase وAI وملفات سحابة.

## ما الذي تغير

تم دمج المشاريع الثلاثة في مستودع واحد لجعل التطوير والتكامل أسهل:

- حذفنا `.git` من المستودعات الفرعية الأصلية.
- أنشأنا مستودع Git جديد واحد في جذر `Arch_App`.
- ملفات النسخ الاحتياطية لـ Git القديمة تم نقلها إلى `repo-git-backups/`.

## هل يمكن حذف المستودعات القديمة؟

نعم، يمكن حذف مستودعات Git القديمة بعد التأكد من أن:

1. المستودع الجديد يعمل بشكل صحيح.
2. لا تحتاج إلى استعادة أي تاريخ احتياطي.

لكن من الأفضل الاحتفاظ بـ `repo-git-backups/` حتى تتأكد أن كل شيء ثابت. بعد التأكد، يمكنك حذف هذا المجلد إذا أردت تنظيف المستودع.

## بنية المشروع الحالية

```text
Arch_App/
  ├─ archive app/      # الواجهة الأمامية
  ├─ archive-core/     # النواة المشتركة
  ├─ archive-server/   # الخادم والإعدادات السحابية
  ├─ repo-git-backups/ # نسخ احتياطية لملفات git القديمة
  ├─ .git/             # المستودع الموحد الجديد
  ├─ .gitignore
  └─ README.md         # هذا الملف
```

## تعليمات سريعة

### 0. تثبيت الحزم باستخدام workspace

من جذر المستودع:

```powershell
cd "d:\archiveaq\Arch_App"
pnpm install
```

هذا سيثبت كل الحزم ويربط `archive app` و `archive-server` بمحتوى `archive-core` المحلي.

### 1. تشغيل الواجهة الأمامية

يمكنك تشغيل الواجهة الأمامية مباشرة من الجذر:

```powershell
pnpm run dev
```

أو من داخل المجلد:

```powershell
cd "archive app"
pnpm install
pnpm run dev
```

### 2. تشغيل الخادم

يمكنك تشغيل الخادم من الجذر أيضاً:

```powershell
pnpm run server
```

أو من داخل المجلد:

```powershell
cd archive-server
pnpm install
pnpm run start
```

```bash
cd "archive app"
npm install
npm run dev
```

ثم افتح العنوان المعروض عادةً على `http://127.0.0.1:5173/`.

### 2. تشغيل الخادم

```bash
cd archive-server
npm install
npm run start
```

### 3. التحقق والبناء

من كل مجلد على حدة:

- `archive app/`
  - `npm run verify`
  - `npm run build:spa`
  - `npm run build:cloud`
- `archive-core/`
  - `npm run verify`
- `archive-server/`
  - `npm run verify`

## ماذا يفعل كل جزء

### `archive app/`

واجهة مستخدم تفاعلية تعتمد React وVite، وتدعم:

- نسخة محلية/offline-first.
- نسخة سحابية تتصل بخادم API.
- AI للتوصيف والتلخيص.
- تخزين محلي وcloud عبر `@archive/core`.

### `archive-core/`

طبقة النواة المشتركة التي تعرّف:

- منافذ التخزين.
- منافذ الملفات.
- منافذ المصادقة.
- منافذ الـ AI.

تُستخدم هذه الطبقة من `archive app` و `archive-server`.

### `archive-server/`

الطبقة الإنتاجية التي توفر:

- API وAuth وRealtime.
- دعم التخزين في PostgreSQL وPocketBase.
- تكامل مع Dropbox، S3، Azure Blob، Google Drive.
- دعم AI عبر موفّرين متعددين.

## ملاحظات إضافية

- هذا المستودع لا يحتوي على `package.json` في الجذر. كل حزمة تُدار بشكل مستقل داخل مجلدها.
- إذا أردت تبسيط إدارة الحزم لاحقًا، يمكن إضافة `npm workspaces` أو `pnpm workspaces`.

## رسالة للمساهمين

اعمل في الفرع الخاص بك، واختبر في المجلد الصحيح، ثم قدم PR واحد لكل مجموعة تغييرات.

---

`Archive Suite` الآن مستودع واحد منظم ويمكنك الاستمرار في تطوير الواجهة والنواة والخادم معًا.
