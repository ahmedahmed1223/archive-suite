# مسار / Masar

منصة أرشيف ميديا ذكية مبنية لتشغيل تجربة فيديو متكاملة في بيئة محلية وسحابة.

هذا المستودع هو monorepo يعتمد الآن **Next.js + Laravel** كمسار التطوير الأساسي:

- `archive-next/` — canonical frontend بواجهة Next.js 16 + TypeScript.
- `archive-laravel/` — canonical backend/API مبني على Laravel 13.
- `archive-core/` — مكتبة النواة المشتركة التي تطرح منافذ التخزين وAI والمصادقة.
- `archive-app/` — legacy Vite SPA، مرجع قديم فقط.
- `archive-server/` — legacy Node/Prisma server، مرجع/ fallback فقط حتى تُغلق فجوات parity المتبقية.

## نظرة عامة

المشروع مصمم كي يعمل كمنصة أرشيف إعلامي:

- إدارة الفيديوهات والملفات والبيانات الوصفية.
- دعم البحث المتقدم والفلاتر والمخططات الزمنية.
- تكامل AI للوسوم والتلخيص والتفريغ.
- دعم تخزين متعدد: local, Dropbox, S3, Azure Blob, Google Drive.

## بنية المستودع

```text
Arch_App/
  ├─ archive-next/     # canonical frontend
  ├─ archive-laravel/  # canonical backend/API
  ├─ archive-core/     # النواة المشتركة
  ├─ archive-app/      # legacy Vite SPA
  ├─ archive-server/   # legacy Node/Prisma server
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
cd ".\Arch_App"
pnpm install
```

### تشغيل الواجهة الأمامية

```powershell
pnpm run dev
```

يشغّل هذا الأمر Laravel داخل Docker وNext.js محلياً. لا تحتاج PHP/Composer محلياً.

### تشغيل أجزاء منفردة

```powershell
pnpm run dev:next       # Next.js فقط
pnpm run dev:laravel    # Laravel API فقط عبر Docker
pnpm run dev:legacy     # واجهة Vite القديمة عند الحاجة للمقارنة
pnpm run server:legacy  # خادم Node القديم عند الحاجة للمقارنة
```

### التحقق من الصحة

```powershell
pnpm run verify
```

هذا هو gate الجديد للمسار المعتمد: عقد API، TypeScript لـ core/Next، بناء Next، واختبارات Laravel عبر Docker.

للتحقق الجزئي أثناء التطوير:

```powershell
pnpm run verify:laravel
pnpm run verify:laravel-next:live
pnpm run verify:core
pnpm run verify:legacy
```

`verify:laravel-next:live` يبني Next.js مع `ARCHIVE_API_BASE_URL` موجهاً إلى Laravel ثم يشغّل اختبار Playwright على المسار الإنتاجي. عند تشغيل build إنتاجي يدوي، اضبط نفس المتغير وقت البناء حتى تُولد rewrites:

```powershell
$env:ARCHIVE_API_BASE_URL="https://api.example.com/api/v1"
pnpm run build:next
```

## النشر الموجّه (الأسرع)

تنبيه: معالج النشر Docker القديم ما زال يطلق stack legacy Node/SPA. التطوير اليومي والبوابة الرسمية انتقلا إلى Laravel/Next؛ استخدم أوامر `pnpm dev` و`pnpm verify` للمسار الجديد حتى تُستبدل وصفات Docker الإنتاجية نهائياً.

للنشر legacy على PostgreSQL عبر معالج واحد على Windows أو Linux:

```bash
# Windows: انقر نقراً مزدوجاً على Setup-Archive.bat
# Linux/macOS:
bash setup.sh        # أو: pnpm deploy
```

يفحص البيئة، يولّد الأسرار، ويرفع الحزمة المُحصّنة. التفاصيل في [`DEPLOYMENT.md`](DEPLOYMENT.md).

## النشر السحابي السريع

يمكن تشغيل نسخة إنتاجية من مسار / Masar عبر Docker images الموجودة في `archive-server/` وقوالب المنصات الجاهزة:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-org/archive-suite)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/archive-suite?referralCode=archive-suite)

- **Render:** استخدم [archive-server/deploy/render.yaml](archive-server/deploy/render.yaml) كـ Blueprint، ثم عيّن `APP_BASE_URL` و`ADMIN_PASSWORD` وأي مزود تخزين خارجي.
- **Railway:** استخدم [archive-server/deploy/railway.json](archive-server/deploy/railway.json) كقالب مشروع مع Postgres وRedis، ثم أضف أسرار `JWT_AUTH_SECRET` و`JWT_SHARE_SECRET` و`OAUTH_STATE_SECRET`.
- **DigitalOcean App Platform:** استخدم [archive-server/deploy/digitalocean-app.yaml](archive-server/deploy/digitalocean-app.yaml)، وعدّل `github.repo` إلى مستودعك قبل الإنشاء.

بعد أول نشر، غيّر كلمة مرور المدير فورًا وراجع [دليل Docker الإنتاجي](archive-server/DOCKER_DEPLOYMENT.md) لإعداد النطاق، التخزين، النسخ الاحتياطي، والمراقبة.

### إعداد Cloud وFileStore

- يقرأ معالج البداية القيم الافتراضية من `archive-server/.env` عبر `/api/setup/preset-config` ويملأ نوع الخادم وعنوانه وحساب المدير ومزوّد الملفات تلقائيًا.
- كلمة مرور `ADMIN_PASSWORD` تظهر في معالج البداية لأول دخول فقط؛ يجب تغييرها فور اكتمال الإعداد.
- `PGADMIN_PASSWORD` مخصّصة لتسجيل الدخول إلى واجهة pgAdmin، بينما `POSTGRES_PASSWORD` مخصّصة لاتصال قاعدة البيانات المحفوظ داخلها. مهمة `pgadmin-init` تزامنهما على volumes الجديدة والقديمة.
- يدعم FileStore: القرص، Dropbox، S3، Azure Blob، Google Drive، FTP/FTPS، SMB/CIFS، SFTP/SSH، وWebDAV.
- صفحة **مدير الملفات** مستقلة عن الأرشيف: رفع، بحث، مجلدات، تنزيل، نسخ، نقل، وحذف. الرفع يضاف افتراضيًا إلى صندوق التجهيز، لكنه لا ينشئ مادة أرشيف تلقائيًا؛ تبدأ الأرشفة فقط بأمر المستخدم.

## توصيف الأجزاء

### `archive-next/`

واجهة Next.js المعتمدة، وتملك:

- App Router وTypeScript.
- مسارات archive/files/share/media/jobs/login/help/reports/settings.
- اتصال `/api/v1/*` عبر Laravel API.

### `archive-laravel/`

خادم API المعتمد، ويوفر:

- Auth عبر access token وHttpOnly refresh cookie.
- records/search/files/share/rights/media/ingest.
- queues ومعالجات وسائط قابلة للتبديل.
- audit logs وسياسات API.

### `archive-core/`

الطبقة المشتركة بين الواجهة والخادم، وتوفر:

- عقود ومنافذ التخزين.
- منافذ المصادقة.
- منافذ AI.
- بنية قابلة للتوسعة دون ربط مباشر مع مزود تخزين معين.

### `archive-app/` و`archive-server/`

مسار legacy/reference فقط. لا تضف ميزات جديدة هنا إلا إذا كان العمل إصلاحاً يحافظ على مرجع parity أثناء الانتقال.

## ملاحظات تقنية

- يعتمد المستودع على `pnpm` workspace.
- استخدام `pnpm-lock.yaml` لضمان اعتمادية قابلة للتكرار.
- أسماء الحزم داخل الـ workspace تشمل `@archive/next` و`@archive/core`، مع بقاء `@archive/app` و`archive-server` كحزم legacy.
- جميع الحزم تُدار داخل نفس المستودع.

## للمطورين

- اعمل في فرع مستقل لكل ميزة أو إصلاح.
- استخدم `pnpm install` من جذر المشروع.
- شغل `pnpm run verify` قبل فتح أي PR؛ وللتحقق الحي الكامل شغل `pnpm run verify:laravel-next:live`.
- في بناء Next.js الإنتاجي اضبط `ARCHIVE_API_BASE_URL` وقت البناء، وليس عند التشغيل فقط.

---

مسار / Masar هي نقطة انطلاق لتطوير منصة أرشيف ميديا متكاملة، وتوفر أساسًا نظيفًا للعمل بين واجهة مستخدم متقدمة وخادم إنتاج مرن.
