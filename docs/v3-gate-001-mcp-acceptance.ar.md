# V3-GATE-001: دليل قبول MCP المحلي

**النتيجة:** مكتمل في بيئة الاختبار المحلية. تحقق عميل Node مستقل شغّله Codex
وخارج عملية الخادم من `stdio` وHTTP محلي يعمل في Docker مع PostgreSQL تجريبي.
لا يعد هذا قبولًا
لإنتاج مستقل؛ يحتاج الإنتاج تهيئة ونطاق OAuth خاصين به.

## ما تثبته الشجرة

- يسجل `archive-laravel/routes/ai.php` النقلين: HTTP عند `/api/v1/mcp` مع
  `auth:api`، و`stdio` باسم `archive-mcp` عبر
  `php artisan mcp:start archive-mcp`.
- يعرّف `ArchiveMcpServer` خمس أدوات ومورد سجل. أداة
  `create-review-request-tool` تنشئ مسودة مراجعة بشرية فقط ولا تطبق تعديلًا على
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

هذه نتيجة قبول فعلية للنقل المحلي `stdio`. وتفصل نتيجة القبول النهائية أدناه
بين اختبار Laravel الداخلي والقبول الشبكي المحلي عبر HTTP.

## نتيجة القبول المحلي النهائية

أجري القبول بواسطة عميل Node مستقل شغّله Codex، وهو خارج عملية الخادم، في بيئة
اختبار محلية فقط. لم تُسجل أي قيمة اعتماد أو رمز أو مفتاح في هذا الدليل.

| النقل والعميل | العملية | النتيجة الموثقة |
| --- | --- | --- |
| `stdio` وعميل Node مستقل | `initialize` | نجح؛ `protocolVersion` هو `2025-11-25` واسم الخادم `Archive Suite MCP Server`. |
| `stdio` وعميل Node مستقل | `tools/list` | نجح؛ أعاد خمس أدوات: `search-records-tool` و`get-record-tool` و`list-archive-types-tool` و`get-system-status-tool` و`create-review-request-tool`. |
| HTTP محلي وعميل Node مستقل | OAuth discovery | نجح برمز HTTP `200` من Laravel في Docker مع PostgreSQL تجريبي. |
| HTTP محلي وعميل Node مستقل | `initialize` برمز OAuth محلي | نجح برمز HTTP `200`؛ أعاد `protocolVersion` `2025-11-25` و`Archive Suite MCP Server`. |
| HTTP محلي وعميل Node مستقل | `tools/list` | نجح برمز HTTP `200`؛ أعاد الأدوات الخمس نفسها: `search-records-tool` و`get-record-tool` و`list-archive-types-tool` و`get-system-status-tool` و`create-review-request-tool`. |

عميل Node المستقل الذي شغّله Codex هو العميل الخارجي عن عملية الخادم المستخدم
في هذا القبول المحلي؛ لذلك لا يبقى حاجب HTTP أو حاجب عميل خارجي لهذه البوابة.
وتستلزم بيئة إنتاج مستقلة عنوانها وتكوين OAuth الخاصين بها، لكن ذلك متطلب نشر
منفصل وليس حاجب قبول V3-GATE-001.

## إعادة إنتاج قبول `stdio`

شغّل أولًا تحضير الصورة وvolume التبعيات عبر المسار المعتمد. لا يحمل الأمر
أي سر أو ملف بيئة إنتاج:

```powershell
$taskDockerConfig = 'D:\archiveaq\Arch_App\.worktrees\codex-v1.3\.tmp\docker-config-v3-gate-001'
New-Item -ItemType Directory -Force -Path $taskDockerConfig | Out-Null
$env:DOCKER_CONFIG = $taskDockerConfig
node scripts/laravel-docker.mjs test tests/Feature/ArchiveMcpAcceptanceTest.php tests/Feature/ArchiveMcpServerTest.php tests/Feature/ArchiveMcpToolsTest.php tests/Feature/ArchiveMcpReviewRequestTest.php
```

ثم ينشئ الأمر التالي عملية Docker من Node ويرسل JSON-RPC خامًا إلى إدخال
`stdio`؛ لا يمر الإدخال في أنبوبة PowerShell، ولذلك لا يضاف BOM:

```powershell
$taskDockerConfig = 'D:\archiveaq\Arch_App\.worktrees\codex-v1.3\.tmp\docker-config-v3-gate-001'
$env:DOCKER_CONFIG = $taskDockerConfig
node -e "const {spawn}=require('node:child_process'); const args=['run','-i','--rm','-v',process.cwd()+':/app','-v','archive-laravel-vendor:/app/archive-laravel/vendor','-w','/app/archive-laravel','archive-laravel-runtime-test','sh','-lc','test -f .env || cp .env.example .env; test -f vendor/autoload.php || composer install --no-interaction --no-progress --quiet; php artisan mcp:start archive-mcp']; const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']}); child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr); child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'v3-gate-001',version:'1.3'}}})+'\n'); child.on('exit',code=>process.exit(code ?? 1));"
```

المدخل المرسل هو:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"v3-gate-001","version":"1.3"}}}
```

والمخرجات المنقحة الكافية لإثبات القبول هي:

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-11-25","capabilities":{"tools":{"listChanged":false},"resources":{"listChanged":false},"prompts":{"listChanged":false}},"serverInfo":{"name":"Archive Suite MCP Server","version":"1.0.0"}}}
```

## حد الإنتاج

النتائج أعلاه تخص Docker وPostgreSQL التجريبيين محليًا فقط. عند نشر مثيل
مستقل، يملك مسؤول النشر عنوان الخدمة وتكوين OAuth وبيانات الاعتماد الخاصة
بالبيئة. لا تنقل هذه الوثيقة أي قيمة حساسة بين البيئات.
