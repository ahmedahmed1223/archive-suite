# تطوير المنصة إلى الإصدارات الحالية

## الهدف

ترقية بيئة التطوير والـCI إلى الإصدارات الحالية من runtimes والحزم والخدمات، مع ترحيل بيانات PostgreSQL المحلية من 17 إلى 18 واختيار PostgreSQL 18 كالإصدار الوحيد المعتمد. لا يشمل النطاق نشرًا، أو إصدار صور، أو دفعًا إلى GitHub.

## القرارات

- يعتمد المشروع Node.js 24.18.0 وpnpm الحالي المتوافق معه في الـCI وDocker وقيود `engines` وعقد المنصة.
- يعتمد PostgreSQL 18 عبر `pgvector/pgvector:0.8.5-pg18`، وتزال مراجع PostgreSQL 17 من المسار القانوني.
- ترقية بيانات التطوير تكون غير مدمرة: تؤخذ نسخة SQL، ويُشغّل PostgreSQL 18 على data directory جديد، ثم تستعاد النسخة وتتحقق healthchecks وامتداد `vector`. لا يحذف التنفيذ volume 17 تلقائيًا.
- تحدّث صور التطوير/الاختبار إلى إصدارات محددة ومثبتة بالـdigest: Redis 8.8، Caddy 2.11.4، PHP 8.5، Composer 2.10، Python 3.13، وNode 24.18.
- تحدّث حزم pnpm وComposer المباشرة إلى أحدث الإصدارات. تتضمن الترقية الكبرى TypeScript 7 وVitest 4 وAI SDK 7 وموفريه 4 وPHPUnit 13؛ يصلح الكود والاختبارات لأي breaking changes ناتجة.
- يبقى Next.js 16.2.10 كما هو لأنه أحدث إصدار متاح وقت الجرد. تبقى React 19.2.7 وReact DOM 19.2.7 كما هما للسبب نفسه.
- أي digest تستخدمه Compose أو Kubernetes أو release manifest يحدّث في كل مصدر حقيقة، لأن فحوص reproducibility تتطلب التطابق حتى لو لم يُستخدم مسار النشر حاليًا.

## النطاق والملفات

1. **العقد والـCI:** `package.json`، `archive-next/package.json`، `pnpm-lock.yaml`، workflows، و`infra/platform/{toolchain,compatibility,release}.v1.json`.
2. **Laravel:** `archive-laravel/composer.json` و`composer.lock`، و`archive-laravel/Dockerfile.worker`.
3. **الخدمات:** Dockerfiles للـNext وOCR/Whisper وCompose وKubernetes والـoffline/release inventories التي تقرأ منها الاختبارات.
4. **بيانات PostgreSQL:** سكربت تطوير صريح قابل لإعادة التشغيل، يوثق backup وrestore ولا ينفذ حذف volume قديم.
5. **التوافق:** تعديلات محدودة في المصدر والاختبارات عند فشل typecheck/unit/Laravel/Playwright بسبب تحديث رئيسي.

## تدفق ترحيل PostgreSQL للتطوير

1. يفحص السكربت وجود volume أو حاوية PostgreSQL 17 ويوقف العمل برسالة واضحة إن لم يجد مصدر بيانات متوقعًا.
2. ينشئ dump منطقيًا قابلًا للاستعادة في مسار مؤقت خارج volume البيانات، ولا يمس volume 17.
3. ينشئ data directory/volume PostgreSQL 18 منفصلًا، ويشغّل صورة pgvector 18، ويستعيد dump ثم يثبت امتداد `vector` عبر migrations الموجودة.
4. يتحقق من `pg_isready`، ووجود schema المتوقعة، وتشغيل Laravel migration/status. عند أي فشل يبقى volume 17 سليمًا وتُطبع خطوة الاستعادة.
5. لا يحذف المستخدم volume 17 إلا بعد التحقق اليدوي من بيئة التطوير الجديدة.

## التحقق

- فحص النسخ الثابتة وصلاحية Compose/Kubernetes/release manifests.
- `pnpm install --lockfile-only` ثم typecheck وunit tests وNext build.
- Composer validate/Laravel tests على PHP 8.5.
- اختبار PostgreSQL migration على volume تطوير معزول، ثم live Laravel + Next Playwright.
- `pnpm run verify` و`pnpm run release:verify` حيث تسمح البيئة المحلية.

## خارج النطاق

- أي نشر فعلي، أو تغيير hosts، أو push/commit تلقائي.
- حذف volume PostgreSQL 17 أو بيانات المستخدم دون أمر صريح لاحق.
