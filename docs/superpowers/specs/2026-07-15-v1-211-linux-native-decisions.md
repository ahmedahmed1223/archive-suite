# V1-211 Linux Native — قرارات موثقة (بوابة الدفعة 4)

مكملة لقرارات Windows في `2026-07-15-v1-210-windows-native-decisions.md`. حالة المنصة تبقى `planned` حتى دليل clean-host الخارجي (V1-211D).

| القرار | الاختيار | البدائل المرفوضة ولماذا |
| --- | --- | --- |
| مدير الخدمات | **systemd** — وحدة منفصلة لكل خدمة (`archive-*.service`) مع `Restart=on-failure` وتقوية baseline (`NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, كتابة على storage/logs فقط) | SysV/openrc (خارج عقد المنصات)، عملية واحدة مشرفة (تخالف «وحدات systemd منفصلة» نصاً) |
| مستخدم الخدمة | **`archive`** غير تفاعلي (`/usr/sbin/nologin`، home على install root `/opt/archive-suite`) | مستخدم لكل خدمة (ACLs لينكس هنا ملكية مسار واحدة، عكس Windows حيث الحسابات الافتراضية مجانية الإدارة) |
| HTTP/PHP | **archive-http (Caddy)** أمام Next وphp-fpm (`-F` foreground تحت systemd) | مقابل FastCGI على Windows: php-fpm هو المسار القياسي على لينكس |
| Firewall | **اختياري** — خطوة `firewall-applied` تعمل فقط عند حقن التأثير (opt-in من المشغّل) | فرضه (العقد يجعله «اختياري» نصاً؛ توزيعات بلا firewalld/ufw موحد) |
| Logs | **logrotate** مملوك بالـmanifest على `/opt/archive-suite/logs` + journald عبر systemd | — |
| التوقيع | **توقيع منفصل (minisign/cosign) للـartifact** من release workflow؛ المانيفست يرفض حزمة بلا `signature/keyId` (`LINUX_PACKAGE_UNSIGNED`) | Authenticode (خاص بـWindows)؛ حِزم rpm/deb موقعة (تربطنا بمدير حزم توزيعة واحدة) |
| خدمة البيانات | نفس قرار Windows حرفياً — التنفيذ مشترك في `native-data-services.mjs` | — |

## الملفات

- `scripts/control-center/linux-services.mjs` — طوبولوجيا 6 وحدات systemd + مانيفست الحزمة الموقعة + SBOM (V1-211A)
- `scripts/control-center/linux-runtime-adapter.mjs` — خطوات ownership → logrotate → firewall(اختياري) → units فوق المحرك المشترك (V1-211B)
- `scripts/control-center/native-runtime-adapter.mjs`, `native-data-services.mjs` — المحرك وبوابة البيانات المشتركان مع Windows؛ غلافا `windows-*` حافظا على واجهتيهما واختباراتهما دون تغيير
- اختبارات V1-211C (فشل الاتصال → حجب، التعافي → repair يكمل، restart لكل الوحدات) في `linux-runtime-adapter.test.mjs`

## حدود

- update/rollback للينكس تبقى `unsupported` حتى تُحقن (نفس تذكرة Windows، مرتبطة بـV1-212).
- تركيب CLI مؤجل حتى مصفوفة V1-212C؛ PostgreSQL المحلي المُدار يتطلب تضمين الثنائيات في الحزمة.
