# V1-208E — Docker release adapter

## التعديل

- أضيف release descriptor مغلق وschema، مع صورة immutable version+digest لكل خدمة وprofile.
- أضيف compose إصدار مستقل لا يحتوي `build:`؛ adapter التثبيت/الإصلاح يطلب `up -d` فقط.
- أضيف تحقق offline فعلي قبل Compose: manifest مغلق وchecksums وربط image ref/version/profile؛ يفرض `pull_policy: never` للـoffline.
- بقي مسار Compose المبني من المصدر تطويرياً صريحاً؛ لا يستخدم adapter المستخدم `--build`.
- تظل `plan` و`import-config` صِرفين، وتظل update/rollback/uninstall غير منفذة هنا.

## دليل الاختبار

- RED: اختبارات release descriptor وadapter وسيناريو user release Compose قبل التنفيذ.
- GREEN: `node --test scripts/control-center.test.mjs scripts/control-center/installation-manifest.test.mjs scripts/control-center/runtime-adapter.test.mjs scripts/control-center/release-descriptor.test.mjs scripts/platform-contract.test.mjs` — 56/56.
- `node --check scripts/control-center.mjs` و`node --check scripts/control-center/release-descriptor.mjs` و`git diff --check` نجحت.
- لم ينجح `pnpm verify:infra` في البيئة المحلية المعروفة: Node الحالي v24 خارج خط المشروع 22، وDocker لا يملك وصولاً إلى config المستخدم ويعيد مشكلة `--env-file`. لم يُدّع نجاحه.
