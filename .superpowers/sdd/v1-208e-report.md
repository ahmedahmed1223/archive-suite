# V1-208E — Docker release adapter

## التعديل

- أضيف release descriptor مغلق وschema، مع صورة immutable version+digest لكل خدمة وprofile.
- أضيف compose إصدار مستقل لا يحتوي `build:`؛ adapter التثبيت/الإصلاح يطلب `up -d` فقط.
- أضيف تحقق offline فعلي قبل Compose: manifest مغلق وchecksums وربط image ref/version/profile؛ يفرض `pull_policy: never` للـoffline.
- بقي مسار Compose المبني من المصدر تطويرياً صريحاً؛ لا يستخدم adapter المستخدم `--build`.
- تصحيح مراجعة: كل lifecycle للمستخدم صار يستمد release context من manifest، وتُحمّل offline archives وتُفحص قبل Compose. Compose الإصدار يصف stack core الكامل ويجعل media/edge اختيارية فعلاً.
- تصحيح مراجعة ثانٍ: أصبحت حزمة core offline تتضمن postgres/redis/laravel/fpm/worker/reverb/next فقط، وتطابق `source` immutable للعقد. يثبت اختبار happy-path البنية الكاملة ثم load/tag/inspect قبل Compose؛ Reverb وCaddy في release Compose يحملان البيئة والحجوم والاعتمادات القانونية عند تشغيلهما.
- تصحيح مراجعة ثالث: rehearsal core يتحقق من HTTP بدلاً من HTTPS/edge، وتُولّد inventory الفعلية داخل الحزمة من مراجع workflow الموقعة (`NEXT_IMAGE`/`LARAVEL_IMAGE` ومراجع runtime)، مع رفض الغياب أو المراجع غير immutable قبل pull.
- تصحيح مراجعة رابع: يقبل builder مراجع workflow digest-only، ويطبعها في manifest. تطبّع Setup offline `v` في version وتقبل مراجع التطبيق الموقعة في bundle بعد تحقق سلامة الحزمة، بينما تبقى runtime مقيدة بعقد الإصدار. اختبار E2E يبني bundle بصورة workflow ثم يمرره إلى Setup offline والتحقق/load/tag/inspect.
- تصحيح مراجعة خامس: تطبّع pipeline أيضاً `:vX.Y.Z@digest` إلى `:X.Y.Z@digest` في sources وbundle refs، فيطابق عقد Setup. يغطي اختبار E2E الواحد builder الفعلي ثم Setup وload/tag/inspect.
- تظل `plan` و`import-config` صِرفين، وتظل update/rollback/uninstall غير منفذة هنا.

## دليل الاختبار

- RED: اختبارات release descriptor وadapter وسيناريو user release Compose قبل التنفيذ.
- GREEN: `node --test scripts/offline-bundle.test.mjs scripts/control-center.test.mjs scripts/control-center/installation-manifest.test.mjs scripts/control-center/runtime-adapter.test.mjs scripts/control-center/release-descriptor.test.mjs scripts/platform-contract.test.mjs` — 73/73.
- `node --check scripts/control-center.mjs` و`node --check scripts/control-center/release-descriptor.mjs` و`git diff --check` نجحت.
- لم ينجح `pnpm verify:infra` في البيئة المحلية المعروفة: Node الحالي v24 خارج خط المشروع 22، وDocker لا يملك وصولاً إلى config المستخدم ويعيد مشكلة `--env-file`. لم يُدّع نجاحه.
