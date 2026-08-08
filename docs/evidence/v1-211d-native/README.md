# V1-211D — قبول Linux Native داخل Docker/systemd

## النتيجة

نجحت دورة القبول الحية الكاملة لمنصة `linux-native`:

`install → systemd PID 1 → ست خدمات active → HTTP → uninstall → cleanup`

استُخدمت حاوية Debian بصلاحية `--privileged` و`cgroupns=host`، مع PostgreSQL
وRedis خارجيين داخل شبكة Docker معزولة. شغّل الاختبار مسار Control Center
الفعلي، ولم يستخدم adapter وهمياً في التثبيت أو الإزالة.

## الحزمة

- الالتزام: `de23251b05ff1131b3524f216c8cea0570ceb4e3`
- الإصدار: `1.0.0`
- عدد عناصر سجل الحزمة: `21351`
- بصمة `SHA256SUMS`: `66dd0414550837d33da2008ab37486d86e4333a9ea70856d2cfa0e2206f77520`

عولجت الحزمة القديمة الموجودة قبل القبول؛ كانت تحتوي روابط pnpm مطلقة إلى
مجلد البناء في المستودع، ولم يكن سجل `SHA256SUMS` مغلقاً عليها. حزمة القبول
الجديدة مادية ولا تعتمد على روابط Windows عند نقلها إلى Linux.

## ما أثبته الاختبار

- كتابة `.env` و`Caddyfile` و`php-fpm.conf` قبل تشغيل الخدمات.
- تشغيل `archive-http` و`archive-next` و`archive-php-fpm` و`archive-worker`
  و`archive-reverb` و`archive-scheduler` تحت `systemd`.
- استجابة HTTP عبر Caddy على `127.0.0.1:8443`.
- إزالة الوحدات الست وجذر التطبيق المملوك بالـmanifest.
- الاحتفاظ بمسار التخزين الخارجي وعدم حذف PostgreSQL أو Redis باعتبارهما
  خدمتين خارجيتين.
- حذف حاويات الاختبار وشبكته وإثبات غيابها بعد الدورة.

التفاصيل الآلية المنزوعة الأسرار موجودة في
[`final-manifest.json`](final-manifest.json). لا يثبت هذا الدليل قبول
`windows-native`، ولا يغيّر وحده حالة المنصة إلى `supported` قبل اكتمال قبول
Windows ومراجعة بوابة الإصدار المشتركة.
