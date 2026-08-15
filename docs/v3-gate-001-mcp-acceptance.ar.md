# V3-GATE-001: دليل قبول MCP وحاجب البيئة

**النتيجة:** محجوب في بيئة العمل الحالية؛ لم يُدّع نجاح اتصال HTTP أو `stdio`
أو عميل MCP خارجي.

## ما تثبته الشجرة

- يسجل `archive-laravel/routes/ai.php` النقلين: HTTP عند `/api/v1/mcp` مع
  `auth:api`، و`stdio` باسم `archive-mcp` عبر
  `php artisan mcp:start archive-mcp`.
- يعرّف `ArchiveMcpServer` خمس أدوات ومورد سجل. أداة
  `create_review_request` تنشئ مسودة مراجعة بشرية فقط ولا تطبق تعديلًا على
  السجل.
- توجد اختبارات تغطي OAuth discovery والتسجيل الديناميكي وطلب `initialize`
  المصرح به في `ArchiveMcpAcceptanceTest.php` و`ArchiveMcpServerTest.php`؛
  وهي دليل تصميم واختبار قابل للتشغيل، وليست قبول اتصال حيًا ما دامت البيئة
  أدناه غير مكتملة.

## سجل الحاجب القابل لإعادة التنفيذ

نفذت الأوامر التالية من جذر الـworktree في 2026-08-15، من دون إدخال أسرار:

```powershell
$checks = [ordered]@{
  php = (Get-Command php -ErrorAction SilentlyContinue).Source
  docker = (Get-Command docker -ErrorAction SilentlyContinue).Source
  composerVendor = (Test-Path 'archive-laravel\vendor\autoload.php')
  laravelEnv = (Test-Path 'archive-laravel\.env')
  mcpInspectorPackage = (Test-Path 'node_modules\@modelcontextprotocol\inspector')
}; $checks | ConvertTo-Json
docker version --format '{{.Client.Version}}/{{.Server.Version}}'
docker compose -f infra/docker-compose.laravel-next.yml ps
npx --no-install @modelcontextprotocol/inspector --version
```

| مسار القبول | الدليل الفعلي | النتيجة | الحاجب |
| --- | --- | --- | --- |
| HTTP اليدوي | Docker CLI موجود (`29.7.2/29.7.2`) لكن `docker compose ... ps` توقف قبل تشغيل أي خدمة | لم يُنفذ طلب `initialize` حي | لا يوجد `archive-laravel/.env` وتطلب Compose قيمة `POSTGRES_PASSWORD` على الأقل؛ لا توجد نقطة URL أو رموز OAuth مسموح بها للاختبار |
| `stdio` اليدوي | `php` غير متاح و`archive-laravel/vendor/autoload.php` غير موجود | لم يبدأ `php artisan mcp:start archive-mcp` | PHP وتبعيات Composer غير موجودة في الـworktree |
| عميل خارجي | `node_modules/@modelcontextprotocol/inspector` غير موجود؛ أمر `npx --no-install` رفض تنزيل الحزمة | لم يتصل عميل خارجي | لا توجد حزمة عميل مثبتة، ولا يسمح هذا الدليل بتنزيلها أو استخدام اعتماد خارجي من دون تفويض |

## بروتوكول الاستئناف

بعد أن يوفر مسؤول النشر بيئة اختبار معزولة وبيانات اعتماد قصيرة العمر، يعاد
القبول بهذه الترتيب، مع إخفاء القيم الحساسة من السجل:

1. تحقق من discovery والتسجيل الديناميكي وOAuth ثم أرسل `initialize` إلى
   `POST /api/v1/mcp` برمز ذي النطاق `mcp:use`.
2. شغّل `php artisan mcp:start archive-mcp` داخل حاوية Laravel نفسها، وأرسل
   طلب JSON-RPC `initialize` عبر `stdio`، ثم اختبر قراءة سجل فقط.
3. استخدم عميل MCP خارجيًا مثبتًا مسبقًا (مثل Inspector) مع عنوان HTTP
   والاعتماد قصير العمر نفسهما، واختبر `initialize` وقائمة الأدوات.
4. سجّل رمز الحالة/اسم الأداة/وقت التنفيذ فقط، ولا تسجل الرمز أو كلمة مرور أو
   مسار تخزين خاص.

لا ينتقل هذا الحاجب إلى «مقبول» إلا بعد إرفاق مخرجات الخطوات الثلاث من مثيل
فعلي. تشغيل الاختبارات الوحدوية أو رؤية تعريف المسارات لا يكفيان وحدهما.
