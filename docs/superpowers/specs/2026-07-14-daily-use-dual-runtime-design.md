# تصميم جاهزية الاستخدام اليومي والتشغيل المزدوج

**الحالة:** معتمدة ومحوّلة إلى مهام تنفيذية في `TASKS.md` بتاريخ 2026-07-14.

## الهدف

إتاحة Archive Suite للاستخدام اليومي في مؤسسة عبر مسارين رسميين متكافئين: Docker على Windows/Linux وتشغيل Native بلا Docker على Windows/Linux، ثم التحقق منهما ميدانيًا قبل إصدار `v1.0.0`.

## نتيجة تقييم النسخة الأولى

التقييم السابق كان **6/10**: الاتجاه صحيح، لكنه لم يكن قابلاً للتنفيذ بأمان دون تفصيل إضافي. نقاط القوة كانت اعتماد Setup كمدخل واحد، ومساواة Docker وNative في عقد القبول، واختبار المنتج حسب الأدوار. الفجوات التي أغلقتها هذه المراجعة هي:

- `scripts/control-center.mjs` الحالي ملف واحد مرتبط مباشرة بـDocker Compose؛ لا توجد طبقة runtime تسمح بـNative.
- `setup update` الحالي ينفذ `git pull` وbuild من المصدر، وهذا يناقض عقد الإصدار immutable.
- أوامر Setup الحالية للنسخ والاستعادة تستخدم `pg_dump`/`psql` فقط، بينما عقد النسخ القانوني يشمل قاعدة البيانات والملفات والـmanifest/checksums.
- لا توجد أوامر Setup للتراجع أو الإزالة أو إعادة الربط ببيانات محفوظة.
- عقد المنصات يسمي profiles مثل `ocr` و`ai` و`observability`، بينما Compose الفعلي يستخدم `media` و`edge`؛ يجب منع مصدرَي حقيقة متعارضين.
- مصطلح «جميع السيناريوهات» لم يكن مربوطًا بمصفوفة اختبار قابلة للتتبع.

بعد تطبيق هذا التصميم في خطط مستقلة ومعايير القبول أدناه، تصبح المواصفة قابلة للتحويل إلى تنفيذ.

## القرار المعماري

يعتمد المنتج عقد تشغيل واحدًا (`infra/platform/compatibility.v1.json`) يحدد المنصات، الإصدارات، مسارات البيانات، profiles، المنافذ، الصحة، الأسرار، النسخ الاحتياطي والاستعادة. لا يغيّر Docker وNative سلوك التطبيق أو عقد API؛ يختلفان في آلية تثبيت وإدارة Next/Laravel/worker/Reverb وخدمات البيانات، مع بقاء عقد الصحة والسلوك واحدًا.

تظل بيانات كل مضيف تحت مسارات العقد الحالية: `C:\ArchiveSuite\data` في Windows و`/var/lib/archive-suite` في Linux. يجب أن تعمل أوامر الحالة والتشخيص والنسخ الاحتياطي والاستعادة والترقية والتراجع وفق واجهة موحّدة، وتنتج manifest قابلًا للقراءة الآلية.

## واجهة Setup ومسؤوليات المستخدمين

تكون واجهة `Setup`/Control Center نقطة الدخول والتحكم العامة الوحيدة للتثبيت والتشغيل، لا مجرد launcher لـDocker. تبقى ملفات `setup.bat` و`setup.sh` و`Setup-Archive.bat` launchers رقيقة تستدعي نفس Control Center؛ ولا يطلب الدليل من المشغل تنفيذ أوامر Docker أو systemd أو Services يدويًا في الحالات الطبيعية.

تقدم Setup وضعًا تفاعليًا ووضعًا غير تفاعلي قابلًا للأتمتة، مع أوامر متسقة في Docker وNative لـ: الفحص المسبق، اختيار المسار والـprofile، التثبيت/إعادة التهيئة، إنشاء المدير الآمن، البدء/الإيقاف/إعادة التشغيل، الحالة وhealth والسجلات، إعداد الرابط العام، تدوير الأسرار، حالة/ترحيل القاعدة الآمن، النسخ والنسخ المتاحة والاستعادة، التحديث والتراجع، diagnostics وsupport bundle.

واجهة الأوامر العامة المستهدفة هي:

```text
setup wizard [--mode=docker|native] [--platform=windows|linux] [--source=online|offline]
setup plan --config=<file>                     # معاينة صرفة بلا كتابة
setup install|repair|uninstall --config=<file>
setup start|stop|restart|status|health|logs
setup backup|backups|restore|verify-backup
setup update --version=<semver>
setup rollback [--version=<semver>]
setup diagnostics|support-bundle
setup export-config|import-config
```

كل أمر يملك `--json` بنتيجة ثابتة (`ok`, `code`, `message`, `details`, `nextActions`) وexit code غير صفري عند الفشل، ويظل السلوك التفاعلي غلافًا لنفس الدوال لا مسار تنفيذ منفصلًا.

تختبر النسخة من منظور أربع شخصيات صريحة:

- **مشغل النظام:** ينفذ الرحلات الكاملة في Setup، ولا يرى أسرارًا في الحالة أو diagnostics أو support bundle.
- **مدير المؤسسة (admin):** ينشئ إعداد المؤسسة، يدعو المستخدمين، يدير الصلاحيات، ويستعيد من عطل قابل للتحكم دون إمكانية فقد المدير الأخير.
- **أمين الأرشيف (editor):** يرفع مادة، يصفها وينظمها ويبحث عنها ويشغّل سير عمل مسموحًا له فقط.
- **المشاهد (viewer):** يتصفح ويبحث ويصل إلى ما خُوّل له فقط، ولا يستطيع الوصول إلى أي فعل كتابة أو إدارة أو تشغيل وسائط لا يملكها.

كل رحلة Setup تغيّر الحالة يجب أن تطلب تأكيدًا واضحًا، تعرض أثر الإجراء والبيانات المتأثرة، تنشئ نسخة احتياطية قبل الترحيل أو الاستعادة حيث يلزم، وتنتج نتيجة ناجحة/فاشلة قابلة للبرمجة مع تعليمات تعافٍ آمنة. تقبل القيم الحساسة عبر إدخال مخفي أو متغيرات بيئة/ملف إعداد محدود الصلاحية؛ لا تُطبع في المخرجات أو الـmanifest أو السجلات.

## بنية Setup المستهدفة

يُقسّم Control Center بدل استمرار نمو الملف الأحادي إلى وحدات صغيرة ذات عقود ثابتة:

- **CLI/UI shell:** تحليل الأوامر والأسئلة والعرض العربي/الإنجليزي وإخراج JSON.
- **Configuration schema:** يتحقق من ملف declarative ويحوّله إلى installation plan قبل أي كتابة.
- **Platform contract:** المصدر الوحيد للمنصات والإصدارات والمسارات والقدرات المدعومة.
- **Runtime adapters:** `docker`, `windows-native`, `linux-native` تنفذ العقد نفسه: install/start/stop/status/logs/exec/update/rollback/uninstall.
- **Operations:** النسخ والاستعادة والترحيل والأسرار وdiagnostics مستقلة عن runtime وتستدعي adapter عند الحاجة.
- **Installation manifest:** يسجل الإصدار، source، mode، المنصة، profile، capabilities، digests/checksums، الخدمات، مسارات البيانات، آخر نسخة ناجحة والإصدار السابق القابل للتراجع، دون أسرار.
- **Redaction layer:** تنقّي المخرجات والملفات التشخيصية لجميع adapters قبل عرضها أو حفظها.

تكون عمليات `install`, `repair`, `update`, `rollback` و`uninstall` حالات قابلة للاستئناف وليست سلسلة أوامر عمياء. يُسجل آخر step ناجح، وتكون إعادة التشغيل idempotent، ولا تعني فشل خطوة حذف التثبيت أو البيانات القائمة.

## خيارات Setup المغطاة

لا تعني «جميع الخيارات» قبول أي تركيب غير محدود؛ تعني تغطية كل خيار معلن في schema وعقد المنصات بمسار نجاح أو رفض آمن ومختبر:

- mode: Docker أو Native.
- platform: Windows 10/11 أو Linux المدعوم في العقد.
- source: online artifacts أو offline bundle.
- install intent: fresh، repair، reconfigure، update، rollback، uninstall، reconnect-data.
- access: local، intranet، public TLS.
- runtime profile: `core` إلزامي، و`media` و`edge` اختياريان.
- capabilities: `ocr` ضمن media، و`ai` كتكوين مزود اختياري، و`observability` كقدرة تشغيلية؛ ليست أسماء Compose profiles مستقلة.
- data services: PostgreSQL مُدار أو endpoint خارجي؛ Native يستخدم database queue/cache افتراضيًا لتجنب تبعية Redis غير موثوقة على Windows، ويمكن اختيار Redis-compatible endpoint خارجي بعد فحصه. Docker يبقي Redis المُدار.
- storage: محلي افتراضي أو مزود خارجي معلن، ولا يُقبل المزود قبل اختبار الاعتماد والقراءة/الكتابة.
- data policy عند uninstall: إبقاء البيانات افتراضيًا؛ الحذف النهائي خيار منفصل يتطلب كتابة عبارة تأكيد ونسخة احتياطية ناجحة.

يجب توحيد `infra/platform/compatibility.v1.json` وCompose وSetup على هذا الفصل بين runtime profiles وcapabilities، وتضيف بوابة CI تمنع أي اسم موجود في مصدر وغير موجود في الآخرين.

## أوضاع التطوير والإصدار

- أوامر `pnpm dev` وعمليات build من checkout تبقى للمطورين فقط.
- Setup الموزع للمستخدم لا ينفذ `git pull` ولا `pnpm install` ولا build من المصدر.
- online يحمّل artifacts محددة بـversion+digest ويتحقق من signature/checksum قبل التغيير.
- offline يستهلك الحزمة الموقعة نفسها من القرص ويتحقق منها دون شبكة.
- update ينشئ preflight ونسخة قانونية كاملة، يثبت الإصدار الجديد بجانب الحالي، يرحّل بأمر `archive:migrate-safe`، يبدّل الخدمة، ثم يجري health/user smoke. لا يُحذف الإصدار السابق حتى انتهاء نافذة التراجع.
- rollback يعيد artifact والتكوين السابقين؛ وإذا كانت migration غير قابلة للعكس، يستعيد النسخة السابقة الكاملة بعد تأكيد أثر فقد تغييرات ما بعد التحديث.

## تصميم Native

### Windows Native

- يشغل Next standalone وLaravel PHP CGI/FastCGI والعامل وReverb كخدمات Windows تحت حساب خدمة محدود الصلاحيات، عبر service wrapper مُثبت الإصدار ومدرج في SBOM.
- يستخدم PostgreSQL محليًا أو خارجيًا. baseline يستخدم Laravel database queue/cache وReverb أحادي العقدة؛ Redis-compatible endpoint خيار أداء/توسع لا شرط تثبيت.
- يدير Setup قواعد firewall والمنافذ وACL لمسارات البرنامج والبيانات والسجلات، ويزيل القواعد والخدمات التي أنشأها فقط.

### Linux Native

- يشغل Next standalone وPHP-FPM/واجهة HTTP والعامل وReverb والجدولة بوحدات systemd منفصلة تحت مستخدم خدمة غير تفاعلي.
- يستخدم PostgreSQL محليًا أو خارجيًا، وdatabase queue/cache baseline نفسه؛ Redis المحلي/الخارجي خيار مُتحقق منه.
- يدير Setup ملكية المسارات وlogrotate وfirewall عند اختياره، ولا يعدّل إعدادات نظام لم يسجل ملكيتها في manifest.

تُبنى artifacts Native من نفس commit وإصدار صور Docker، وتحتوي الملفات الضرورية للتشغيل فقط، مع SBOM/checksums/signing. يستخدم Next ناتج `output: "standalone"` الموجود، وتثبت نسخة PHP/Composer والعامل المتوافقة مع عقد toolchain.

## نطاق التنفيذ

### 1. أساس التشغيل والتثبيت

- إكمال V1-208: مثبت موحد ومدروس لـDocker على Windows وLinux، يستهلك إعدادًا declarative وmanifest إصدار.
- توسيع Setup ليعرض مسارات Docker وNative والـprofiles والخيارات المتاحة بحسب المنصة، ويرفض الخيارات غير المدعومة قبل أي كتابة.
- ترقية `doctor` من رفض Native المخطط إلى preflight حقيقي يوضح المتطلبات، أخطاء قابلة للإصلاح، وحالة الخدمات.
- منع أي تثبيت من استخدام `latest` أو build من المصدر للمستخدم النهائي؛ تظل الصور/artifacts مرتبطة بإصدار وdigest/checksum.
- استبدال أوامر النسخ/الاستعادة القديمة داخل Setup باستدعاء عقد Laravel القانوني الكامل؛ لا يبقى `pg_dump` المنفرد معروضًا كنسخة قابلة للاستعادة الكاملة.
- إضافة update/rollback/uninstall/reconnect-data قبل اعتبار Setup شاملًا.

### 2. التشغيل Native

- V1-210 Windows: حزمة Native تثبّت الإصدارات المعتمدة أو تتحقق منها، تضبط PostgreSQL وRedis، وتسجّل خدمات Windows للتطبيق والعامل وrealtime والجدولة، مع صلاحيات ومسارات وسجلّات مملوكة لحساب خدمة محدود الصلاحيات.
- V1-211 Linux: حزمة مكافئة بوحدات `systemd` للتطبيق والعامل وrealtime والجدولة، وإعداد PostgreSQL/Redis، ومستخدم خدمة، وملكية مسارات، و`logrotate`.
- Native ليس محاكاة لـDocker: الملف الواحد للتكوين والـmanifest ومعايير الصحة والقبول هي الحدود المشتركة؛ ملفات الخدمة خاصة بالنظام فقط.

### 3. قبول تكافؤ المنصات

لكل من Windows Docker وWindows Native وLinux Docker وLinux Native، تنفذ نفس رحلة القبول عبر Setup: تثبيت على مضيف نظيف، إنشاء مدير آمن، تسجيل الدخول، إنشاء/رفع/بحث مادة، إعادة تشغيل المضيف، فحص health، نسخ واستعادة تتحقق من checksums، ترقية وتراجع، support bundle منزوعة الأسرار، وإزالة البرنامج مع الإبقاء على البيانات وإعادة ربطها.

تُعاد رحلة المنتج بعد كل تثبيت للشخصيات الأربع: admin وeditor وviewer عبر الواجهة، ومشغل النظام عبر Setup. تُنفذ اختبارات RBAC على المسارات ذاتها التي تستخدمها الشخصيات، وتتحقق اختبارات Control Center من أن كل أمر موثق متاح في الوضع الملائم أو مرفوض برسالة محددة، دون تنفيذ تغييرات عند استخدام `doctor` أو وضع المعاينة.

لا تتحول أي منصة من `conditional` أو `planned` إلى مدعومة رسميًا إلا مع دليل تشغيل حي لهذه الرحلة. macOS ليس ضمن التزام V1.

## مصفوفة السيناريوهات الإلزامية

يجب أن يحمل كل صف معرّف اختبار ودليل artifact؛ يغطي كل runtime مستهدف ما ينطبق من الصفوف التالية:

| المجموعة | السيناريوهات |
|---|---|
| تثبيت | fresh online، fresh offline، إعداد غير صالح، artifact/checksum/signature تالف، منفذ مشغول، مساحة/ذاكرة غير كافية، اعتماد مفقود، إعادة تشغيل المثبت بعد فشل متوسط |
| إعادة تهيئة | تغيير URL/وضع الوصول/profile/storage، تغيير آمن للأسرار، repair لملف خدمة مفقود، تشغيل الأمر مرتين بلا مضاعفة الخدمات أو البيانات |
| تشغيل | start/stop/restart بعد reboot، تعطل DB، تعطل cache/queue، تعطل worker/Reverb، امتلاء القرص، انتهاء شهادة، health جزئي وعودة الخدمة |
| بيانات | backup كامل، verify checksum، restore ناجح، رفض backup تالف، فشل منتصف restore مع بقاء الحالة الحية، retention، reconnect بعد uninstall مع إبقاء البيانات |
| إصدار | update ناجح، فشل تنزيل، فشل migration، فشل health بعد switch، rollback قبل/بعد migration، منع downgrade غير المتوافق |
| إزالة | إبقاء البيانات افتراضيًا، إزالة الخدمات والقواعد المملوكة فقط، رفض حذف البيانات بلا تأكيد صريح وbackup حديث |
| أمن | مدير ضعيف/افتراضي مرفوض، أسرار منقحة، ACL/ملكية خدمة، عدم فتح منافذ داخلية، support bundle بلا بيانات أو tokens |
| مستخدمون | admin onboarding وإدارة، editor ingest→describe→organize→search، viewer read-only، رفض كل فعل غير مصرح، ownership لعزل media jobs |
| UX | 375/768/1280، zoom 200%، keyboard، قارئ شاشة عينة، العربية/RTL، حالات loading/empty/error/retry، ملفات كبيرة وبحث عربي |

تعريف «اختبار النسخة حسب المستخدم» هو رحلة Playwright حية مستقلة لكل دور، بحسابات fixtures صريحة وبيانات معزولة، وليست إعادة استخدام token مدير لجميع المسارات. يجب ربط المسارات المصنفة في `RouteScopeTest` بمصفوفة role/route تمنع إضافة route بلا اختبار صلاحية أو استثناء موثق.

### 4. جاهزية المستخدم اليومي

- V1-301: رحلة onboarding محفوظة خادميًا: مؤسسة، تخزين، دعوة، أول مادة، وأول بحث؛ تستأنف بعد إعادة الدخول.
- V1-303: تغطية axe والاستجابة عند 375/768/1280 والـzoom 200% ولوحة المفاتيح وعينة قارئ شاشة، بما في ذلك الصفحات المصادَق عليها والبيانات الحية، مع مراجعة بصرية.
- V1-306: عربية موحدة، بدائل آمنة لـ`prompt`/`confirm`، وأدلة مرتبطة بالسياق والأدوار.
- V1-307: baseline قابل للتكرار على 100 ألف سجل عربي و10 آلاف ملف وعينة رفع 1GB. حدود القبول على جهاز baseline المحدد في عقد الموارد: LCP p75 ≤ 2.5s، CLS p75 ≤ 0.1، INP p75 ≤ 200ms، API P95 للبحث ≤ 1.5s وفتح السجل ≤ 1s، وبدء جلسة الرفع ≤ 2s دون احتساب زمن نقل الملف. تُقاس Docker وNative بالأداة والبيانات نفسيهما، وأي استثناء يحتاج قرار إصدار موثقًا.
- لا توسع ميزات AI أو PWA؛ تبقى اختيارية أو موثقة كما هي حتى يقرر المنتج خلاف ذلك.

### 5. إطلاق تجريبي ثم عام

- V1-501..505: Alpha وgame-day لفشل DB/Redis/القرص/العامل/الشبكة، ثم RC في 3–5 بيئات منفصلة، وقياس فعلي لـRPO/RTO والتثبيت والأداء، وإغلاق P0/P1 قبل rehearsal نظيف.
- V1-601..605: اعتماد Product/Security/Operations/Support، tag ثابت، artifacts وSBOM وتواقيع، تنزيل وتثبيت نهائيان من artifacts العامة، ثم فتح المراقبة والدعم.

## الاعتماديات وترتيب التسليم

النطاق كبير على خطة تنفيذ واحدة؛ يُقسّم إلى خطط مستقلة، كل واحدة تنتج برنامجًا قابلًا للاختبار:

1. **P1 — Setup core وV1-208:** schema وmanifest وruntime adapter interface وDocker adapter وplan/install/repair والـprofiles الموحدة.
2. **P2 — دورة حياة الإصدار:** backup القانوني وonline/offline artifacts وupdate/rollback/uninstall/reconnect-data.
3. **P3 — Windows Native (V1-210):** artifacts وخدمات Windows وACL/firewall وقبول clean host.
4. **P4 — Linux Native (V1-211):** artifacts وsystemd/ownership/logrotate/firewall وقبول clean host.
5. **P5 — تكافؤ المنصات:** harness مشترك ومصفوفة السيناريوهات وأدلة Windows/Linux × Docker/Native.
6. **P6 — المستخدم اليومي:** V1-301/303/306/307 ورحلات admin/editor/viewer والـperformance budgets.
7. **P7 — RC/GA:** V1-501..505 ثم V1-601..605.

لا تبدأ P3/P4 قبل تثبيت interface في P1، ويمكن تنفيذهما بالتوازي. تبدأ P6 بعد تثبيت fixtures والعقد في P1، ولا تنتظر اكتمال Native. P5 يدمج نتائج P2/P3/P4/P6، ثم تكون P7 البوابة النهائية.

## معايير عدم الإطلاق

- غياب دليل قبول حي لأي منصة معلن دعمها.
- فشل النسخ/الاستعادة أو الترقية/التراجع أو تسرب أسرار في diagnostics.
- مسارات مصادَق عليها غير مغطاة بحد الوصولية المتفق عليه، أو عيوب P0/P1 مفتوحة من الـpilot.
- الاعتماد على تحقق خارجي غير منفذ لميزة مفعلة في البيئة المستهدفة (مثل GPU للتفريغ العربي، S3/Dropbox، ODBC أو embeddings/vision).
- وجود خيار ظاهر في Setup بلا صف قبول ناجح، أو اختلاف بين خيارات interactive و`--config`/`--json`.
- استمرار `git pull`/build من المصدر أو نسخة DB-only في Setup الموزع للمستخدم.
- تعذر التراجع أو إعادة الربط بالبيانات بعد uninstall على أي runtime معلن دعمه.

## خارج النطاق

- دعم macOS الرسمي.
- تغيير public API أو إعادة إحياء الحزم legacy.
- بناء PWA كاملة أو تفعيل AI/OCR افتراضيًا.
