# V3-GATE-001: دليل قبول MCP وحاجب البيئة

**النتيجة:** قبول `stdio` الأساسي مكتمل عبر مسار Docker المعتمد. لا يزال قبول
HTTP من مثيل حي وعميل MCP خارجي محجوبين؛ لا يدّعي هذا المستند نجاحهما.

## ما تثبته الشجرة

- يسجل `archive-laravel/routes/ai.php` النقلين: HTTP عند `/api/v1/mcp` مع
  `auth:api`، و`stdio` باسم `archive-mcp` عبر
  `php artisan mcp:start archive-mcp`.
- يعرّف `ArchiveMcpServer` خمس أدوات ومورد سجل. أداة
  `create_review_request` تنشئ مسودة مراجعة بشرية فقط ولا تطبق تعديلًا على
  السجل.
- توجد اختبارات تغطي OAuth discovery والتسجيل الديناميكي وطلب `initialize`
  المصرح به في `ArchiveMcpAcceptanceTest.php` و`ArchiveMcpServerTest.php`؛
  وهي دليل تصميم واختبار قابل للتشغيل.

## نتيجة المسار المعتمد

المسار المعتمد لا يعتمد على `php` أو `vendor` في جهاز المطور. يحدد
`scripts/laravel-docker.mjs` صورة `archive-laravel-runtime-test`، ويبنيها
بـ Docker، ثم يثبت Composer في volume باسم `archive-laravel-vendor` قبل
تشغيل Artisan.

نفذ هذا المسار في 2026-08-15 بعد تعيين `DOCKER_CONFIG` إلى دليل مؤقت قابل
للكتابة داخل الـworktree. كان ذلك لازمًا لأن إعداد Docker الافتراضي في حساب
Windows رفض الكتابة إلى `buildx`; ليس حاجبًا في Laravel أو في نقل `stdio`.

| الفحص | النتيجة الفعلية |
| --- | --- |
| اختبارات MCP عبر Docker | نجحت 17 حالة و88 تحققًا: OAuth discovery والتسجيل الديناميكي، رفض HTTP غير المصرح به وقبول `initialize` المصرح به في نواة Laravel، الأدوات والموارد، وطلب المراجعة. |
| `stdio` يدوي | أرسل عميل Node مستقل JSON-RPC خامًا، بلا BOM من PowerShell، إلى `php artisan mcp:start archive-mcp` داخل الحاوية. أعاد الخادم `result.protocolVersion: 2025-11-25` واسم `Archive Suite MCP Server` وإعلانات الأدوات والموارد. |

هذه نتيجة قبول فعلية للنقل المحلي `stdio`. اختبار HTTP أعلاه يجري في نواة
Laravel ولا يثبت عنوان HTTP منشورًا أو جلسة OAuth خارجية.

## سجل الحاجب القابل لإعادة التنفيذ

نفذت الفحوص التالية من جذر الـworktree في 2026-08-15، من دون إدخال أسرار:

```powershell
$checks = [ordered]@{
  docker = (Get-Command docker -ErrorAction SilentlyContinue).Source
  mcpInspectorPackage = (Test-Path 'node_modules\@modelcontextprotocol\inspector')
}; $checks | ConvertTo-Json
npm --version
npx --no-install @modelcontextprotocol/inspector --version
```

| مسار القبول | الدليل الفعلي | النتيجة | الحاجب |
| --- | --- | --- | --- |
| HTTP اليدوي من مثيل منشور | اختبارات Docker تتحقق من HTTP داخل Laravel، لكن لا يوجد عنوان مثيل حي أو رمز OAuth قصير العمر مخصص للاختبار | لم يُنفذ `initialize` عبر شبكة إلى مثيل منشور | يتطلب مسؤول النشر عنوان اختبار وبيانات اعتماد قصيرة العمر؛ لا يتعلق الحاجب بغياب `.env` محليًا |
| `stdio` اليدوي | `scripts/laravel-docker.mjs` والحاوية المعتمدة؛ استجابة `initialize` موثقة أعلاه | **مقبول** | لا يوجد |
| عميل خارجي | `node_modules/@modelcontextprotocol/inspector` غير موجود؛ أمر `npx --no-install` رفض تنزيل الحزمة | لم يتصل عميل خارجي | لا توجد حزمة عميل مثبتة، ولا يسمح هذا الدليل بتنزيلها أو استخدام اعتماد خارجي من دون تفويض |

## بروتوكول الاستئناف

بعد أن يوفر مسؤول النشر بيئة اختبار معزولة وبيانات اعتماد قصيرة العمر، يعاد
القبول بهذه الترتيب، مع إخفاء القيم الحساسة من السجل:

1. تحقق من discovery والتسجيل الديناميكي وOAuth ثم أرسل `initialize` إلى
   `POST /api/v1/mcp` برمز ذي النطاق `mcp:use`.
2. شغّل اختبار قراءة سجل عبر `stdio` في بيئة التشغيل المستهدفة؛ فقبول
   `initialize` الأساسي موثق بالفعل أعلاه.
3. استخدم عميل MCP خارجيًا مثبتًا مسبقًا (مثل Inspector) مع عنوان HTTP
   والاعتماد قصير العمر نفسهما، واختبر `initialize` وقائمة الأدوات.
4. سجّل رمز الحالة/اسم الأداة/وقت التنفيذ فقط، ولا تسجل الرمز أو كلمة مرور أو
   مسار تخزين خاص.

لا ينتقل الحاجبان المتبقيان إلى «مقبول» إلا بعد إرفاق مخرجات HTTP الحية
والعميل الخارجي. رؤية تعريف المسارات وحدها لا تكفي.
