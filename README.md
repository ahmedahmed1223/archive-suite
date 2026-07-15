# مسار / Masar

منصة أرشيف ميديا ذكية مبنية لتشغيل تجربة فيديو متكاملة في بيئة محلية وسحابة.

هذا المستودع هو monorepo يعتمد الآن **Next.js + Laravel** كمسار التطوير الأساسي:

- `archive-next/` — canonical frontend بواجهة Next.js 16 + TypeScript.
- `archive-laravel/` — canonical backend/API مبني على Laravel 13.

> أُزيلت حزم legacy نهائياً بتاريخ 2026-07-12 وتبقى متاحة فقط عبر تاريخ git.

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
pnpm install --frozen-lockfile
```

خط الأدوات المدعوم للمسار القانوني محفوظ آلياً في
`infra/platform/toolchain.v1.json`: Node.js 22.23.1 (خط 22 فقط)، pnpm 11.9.0،
PHP 8.4.23، وComposer 2.9.5. يوفر Docker نسختي PHP وComposer، فلا يلزم تثبيتهما
على المضيف.

### تشغيل الواجهة الأمامية

```powershell
pnpm run dev
```

يشغّل هذا الأمر Laravel داخل Docker وNext.js محلياً. لا تحتاج PHP/Composer محلياً.

### تشغيل أجزاء منفردة

```powershell
pnpm run dev:next       # Next.js فقط
pnpm run dev:laravel    # Laravel API فقط عبر Docker
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
```

`verify:laravel-next:live` يبني Next.js مع `ARCHIVE_API_BASE_URL` موجهاً إلى Laravel ثم يشغّل اختبار Playwright على المسار الإنتاجي. عند تشغيل build إنتاجي يدوي، اضبط نفس المتغير وقت البناء حتى تُولد rewrites:

```powershell
$env:ARCHIVE_API_BASE_URL="https://api.example.com/api/v1"
pnpm run build:next
```

## النشر عبر Docker

استخدم Control Center لنشر الحزمة القانونية Laravel + Next.js من
`infra/docker-compose.yml`. ينشئ `infra/.env`، يولّد الأسرار الناقصة، ثم يدير
`docker compose up -d --build` للمسار نفسه:

```bash
pnpm setup
# أو: pnpm deploy
```

## CI/CD والمراقبة

اعتمد المشروع **GitHub Actions** كمسار CI/CD الافتراضي:

- `.github/workflows/ci.yml` — تحقق Laravel + Next، عقود API، build، hygiene، واختبارات Laravel.
- `.github/workflows/docker.yml` — تحقق Compose الافتراضي، بناء صورة Next، ونشر اختياري إلى GHCR عند tags أو تشغيل يدوي.

تكامل Sentry اختياري ولا يرسل أي أحداث بدون DSN. لإرسال أخطاء الواجهة والخادم اضبط:

```bash
SENTRY_DSN=
SENTRY_LARAVEL_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=<git-sha-or-version>
```

ولرفع source maps من GitHub Actions أضف أسرار المستودع:

```text
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN
```

## النشر الموجّه

`Setup-Archive.bat` / `setup.sh` هما مشغلا Control Center للحزمة القانونية Laravel + Next:

```bash
# Windows:
.\Setup-Archive.bat                    # القائمة: 1 = Quick start، q/0 = خروج
.\Setup-Archive.bat change-admin-password --generate
# Linux/macOS:
bash setup.sh change-admin-password --generate
bash setup.sh deploy               # أو: pnpm setup / pnpm deploy
```

يفحص البيئة، يولّد الأسرار، ويرفع الحزمة المُحصّنة. التفاصيل في [`DEPLOYMENT.md`](DEPLOYMENT.md).

### إعداد Cloud وFileStore

- كلمة مرور `ADMIN_PASSWORD` تظهر في معالج البداية لأول دخول فقط؛ يمكن توليدها أو تغييرها لاحقًا عبر `Setup-Archive.bat change-admin-password --generate`.
- `PGADMIN_PASSWORD` مخصّصة لتسجيل الدخول إلى واجهة pgAdmin، بينما `POSTGRES_PASSWORD` مخصّصة لاتصال قاعدة البيانات المحفوظ داخلها.
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

## ملاحظات تقنية

- يعتمد المستودع على `pnpm` workspace.
- استخدام `pnpm-lock.yaml` لضمان اعتمادية قابلة للتكرار.
- الحزمة الوحيدة في الـ workspace هي `@archive/next`؛ التشارك مع `archive-laravel` يمر عبر عقد `docs/api/archive-contract.openapi.json`.
- أُزيلت حزم legacy بتاريخ 2026-07-12 وتبقى متاحة فقط عبر تاريخ git.

## للمطورين

- اعمل في فرع مستقل لكل ميزة أو إصلاح.
- استخدم `pnpm install --frozen-lockfile` من جذر المشروع.
- شغل `pnpm run verify` قبل فتح أي PR؛ وللتحقق الحي الكامل شغل `pnpm run verify:laravel-next:live`.
- في بناء Next.js الإنتاجي اضبط `ARCHIVE_API_BASE_URL` وقت البناء، وليس عند التشغيل فقط.

---

مسار / Masar هي نقطة انطلاق لتطوير منصة أرشيف ميديا متكاملة، وتوفر أساسًا نظيفًا للعمل بين واجهة مستخدم متقدمة وخادم إنتاج مرن.
