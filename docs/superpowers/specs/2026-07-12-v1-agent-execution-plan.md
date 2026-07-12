# خطة تنفيذ V1 عبر الوكلاء

> تُنفذ لاحقاً بعد اعتماد تقرير الجاهزية. لا تعمل المهام المتوازية على الملفات نفسها، ويجب أن تنتج كل مهمة اختبارات ودليلاً وتحديثاً موجزاً في `ChangeLog.md`.

## قواعد التنفيذ

- فرع إصدار `codex/v1-release-readiness` من commit نظيف بعد مراجعة حذف legacy.
- لكل حزمة: وكيل منفذ، ثم مراجع متطلبات، ثم مراجع جودة/أمن مستقل.
- يستخدم الوكيل الأقل تكلفة للوثائق والتعديلات الميكانيكية، والمتوسط للتنفيذ المعزول، والأقوى للأمن والبيانات والمراجعة النهائية.
- لا دمج إذا أخفق اختبار الحزمة أو تغير OpenAPI بلا تحديث عقد واختبار.
- commit صغير بعد كل مهمة مقبولة؛ لا تجمع مجالات مستقلة في commit واحد.
- `ChangeLog.md` يسجل النتيجة والاختبارات، بينما تفاصيل التصميم والقرارات تبقى في هذا المستند/ADR مناسب.

## الموجة 0 — تثبيت خط الأساس (تسلسلية)

- [ ] **V1-000 مراجعة cutover:** مراجعة 1700+ حذف، توحيد AGENTS/README/CLAUDE، ثم commit نظيف.
- [ ] **V1-001 قفل النطاق:** مصفوفة كل route: V1، admin-only، experimental، hidden؛ feature flags افتراضية آمنة.
- [ ] **V1-002 versioning/legal:** اعتماد الاسم والترخيص وSemVer وsupport window ونسخة `1.0.0-rc.1`.
- [ ] **V1-003 reproducibility:** إصلاح clean install، حفظ نسخ Node/pnpm/PHP/Composer ونتائج baseline.
- [ ] **V1-004 canonical deployment truth:** توحيد `Setup-Archive.bat` و`setup.sh` وControl Center وworkflow وقوالب env على compose القانوني الواحد؛ إزالة PocketBase و`deploy-legacy` وملفات/أوامر `docker-compose.postgres.yml` من المسار العام أو عزلها خارج الحزمة. يثبت اختبار CLI أن كل أمر يعرض ويستدعي نفس manifest.
- [ ] **V1-005 platform contract:** إنشاء compatibility matrix قابلة للقراءة آلياً تحدد Windows 10/11 وWindows Server وLinux، وDocker/Native، والإصدارات الدنيا والموارد والمنافذ وملكية البيانات. يستهلكها `doctor` لتحديد الخيارات المسموحة بدلاً من نصوص ثابتة.

**بوابة W0:** clean tree + scope معتمد + release branch + baseline يعاد من الصفر + أمر إعداد واحد لا يعرض مساراً قانونياً قديماً.

## الموجة 1 — إغلاق مخاطر الأمن والبيانات (ثلاثة مسارات متوازية)

### المسار A: الهوية والصلاحيات

- [ ] **V1-101** إزالة admin defaults ورفض `CHANGE_ME`/secure-cookie false في production لكل compose variants.
- [ ] **V1-102** مصفوفة RBAC وPolicies لكل endpoint مع اختبارات `RoleMatrixApiTest`.
- [ ] **V1-103** قصر refresh cookie على `/auth/refresh` وإضافة Origin/CSRF/throttle وتحديث OpenAPI.
- [ ] **V1-104** share secrets في body/header لا query، وrate limiting قابل للإثبات.

### المسار B: الملفات والوسائط

- [ ] **V1-111** sandbox/containment وownership للـmedia jobs ومنع path traversal وarbitrary reads.
- [ ] **V1-112** upload validation: MIME+magic، UUID، quotas، quarantine وAV policy.
- [ ] **V1-113** timeouts/backoff/idempotency/cancel حقيقي للوظائف، مع تنقية الأخطاء والمسارات.

### المسار C: النسخ والاستعادة

- [ ] **V1-121** تعريف backup كامل: PostgreSQL + storage volumes + manifest/checksums وتشفير اختياري واضح.
- [ ] **V1-122** جعل DR drill معزولاً وغير مدمر وإزالة endpoint الخطر حتى اكتماله.
- [ ] **V1-123** retention/pruning للجلسات وaudit/jobs/backups، وقياس RPO/RTO.

**بوابة W1:** مراجعة أمن مستقلة، tests المذكورة خضراء، وrestore disposable ناجح؛ يمنع الدمج الجزئي إذا بقي مسار arbitrary access أو data loss.

## الموجة 2 — التشغيل والتغليف (متوازية بعد W1)

- [ ] **V1-201 Control Center:** إصلاح الرمز legacy المفقود، إزالة الأوامر القديمة، واختبار help/deploy/status/health/backup/restore/update على Windows وLinux.
- [ ] **V1-202 production runtime:** استبدال PHP dev server، healthchecks عميقة، worker/Reverb readiness، وعدم كشف المنافذ الداخلية.
- [ ] **V1-203 migration safety:** preflight + prebackup + maintenance/drain + migrate-once + rollback/version compatibility.
- [ ] **V1-204 immutable images:** pin dependencies/digests، بناء الصورتين، smoke، scan، وعدم ترقية العملاء عبر `latest`.
- [ ] **V1-205 release supply chain:** SBOM، license inventory، checksums، signing/provenance، وGitHub Release workflow.
- [ ] **V1-206 offline bundle:** images save/load، compose versioned، env generator، مثبت ودليل، واختبار clean host بلا شبكة.
- [ ] **V1-207 local observability:** structured logs، rotation، metrics/alerts وsupport bundle منزوعة الأسرار دون Sentry.
- [ ] **V1-208 cross-platform installer:** ملفات موصى به/كامل/مخصص عبر `Setup-Archive.bat` و`setup.sh`، مع ملف إعداد declarative وinstallation manifest.
- [ ] **V1-209 Docker profiles:** تحويل compose القانوني إلى profiles `core`, `media`, `ocr`, `ai`, `observability`؛ تثبيت Online وOffline يستهلك صوراً version+digest ولا يبني من المصدر لدى العميل.
- [ ] **V1-210 native Windows:** توفير Native bundle موثق ينشئ خدمات Windows للمكونات web/queue/realtime، يثبت PostgreSQL وRedis وruntimes من حزمة موحدة أو مصادر المؤسسة، ويملك manifest وhealth/backup/update/rollback/uninstall.
- [ ] **V1-211 native Linux:** توفير Native bundle مكافئ بوحدات systemd للمكونات web/queue/realtime، وتهيئة PostgreSQL/Redis وملكية paths وlogrotate وmanifest والأوامر نفسها.
- [ ] **V1-212 parity matrix:** اختبارات acceptance مشتركة تقارن Docker وNative على Windows وLinux: install، restart، health، رحلة مادة، backup/restore، update/rollback، diagnostics، uninstall مع إبقاء البيانات.

**بوابة W2:** تثبيت/ترقية/تراجع وbackup/restore من الحزمة نفسها لكل صف مدعوم في مصفوفة Docker/Native وWindows/Linux، مع artifacts موقعة وimage digests محفوظة.

## الموجة 3 — المنتج وUX (متوازية)

- [ ] **V1-301 onboarding:** مؤسسة واحدة، إعداد التخزين، دعوة، أول مادة وأول بحث؛ تقدم محفوظ خادمياً.
- [ ] **V1-302 admin safety:** last-admin/self guards، impact confirmations، invitation lifecycle وaudit.
- [ ] **V1-303 responsive/accessibility:** 375/768/1280، zoom 200%، keyboard، screen reader sample، axe وscreenshots.
- [ ] **V1-304 data correctness:** cursor pagination/aggregations وإزالة الحدود الصامتة في analytics/search/collections.
- [ ] **V1-305 offline truth:** توثيق queue المحدودة وإزالة ادعاء PWA، أو تنفيذ PWA كاملة كقرار منفصل؛ الافتراضي الأول لـV1.
- [ ] **V1-306 language/help:** توحيد العربية، استبدال prompt/confirm، أدلة الأدوار وروابط مساعدة سياقية.
- [ ] **V1-307 performance:** dataset واقعي، بحث/رفع/ملفات كبيرة وعربية، budgets لـLCP/CLS وP95 متفق عليها.

**بوابة W3:** رحلة end-to-end كاملة للأدوار الثلاثة، صفر serious/critical accessibility، ولا نتائج إجمالية مضللة.

## الموجة 4 — CI والتوثيق (تبدأ مبكراً وتغلق بعد W3)

- [ ] **V1-401 CI gates:** Next unit + Laravel + live Playwright + axe + artifacts وconsole-error failure.
- [ ] **V1-402 security gates:** Composer audit، pnpm audit، SAST/secrets، container scan وSBOM policy.
- [ ] **V1-403 release readiness:** يفحص clean tree/tag/version/license/changelog/artifacts/digests/migration/restore evidence، لا strings فقط.
- [ ] **V1-404 docs:** README/INSTALL/DEPLOYMENT canonical-only؛ install/upgrade/rollback/uninstall/backup/support/security.
- [ ] **V1-405 release notes:** ملاحظات مستخدم موجزة، known limitations، compatibility matrix وchecksums.

## الموجة 5 — RC والتجربة الميدانية

- [ ] **V1-501** إصدار داخلي Alpha وتشغيل game day لفشل DB/Redis/disk/worker/network.
- [ ] **V1-502** نشر `v1.0.0-rc.1` في 3–5 بيئات تغطي Windows وLinux، Docker وNative، ووضعي Online وOffline وفق مصفوفة الدعم.
- [ ] **V1-503** قياس install time، RPO/RTO، الأداء، الأعطال، واستيعاب المستخدمين دون telemetry خارجي إلزامي.
- [ ] **V1-504** تصنيف عيوب pilot: P0/P1 تغلق؛ P2 توثق أو تؤجل بقرار Product.
- [ ] **V1-505** إعادة full release rehearsal من checkout نظيف بلا cache.

## الموجة 6 — GA

- [ ] **V1-601 Go/No-Go:** توقيع Product/Security/Operations/Support.
- [ ] **V1-602** tag `v1.0.0` من commit مجمد، بناء artifacts مرة واحدة، ثم التحقق من التواقيع.
- [ ] **V1-603** نشر الصور والحزمة والدليل وملاحظات الإصدار وSBOM/checksums.
- [ ] **V1-604** اختبار تنزيل وتثبيت نهائي من artifacts العامة نفسها.
- [ ] **V1-605** فتح فترة مراقبة ودعم، وتحديد patch SLA ومسار `v1.0.1`.

## مصفوفة الاعتماد المختصرة

`W0 → W1 → W2 → RC → GA` إلزامي. يمكن تنفيذ موجتي UX وCI بالتوازي بعد W0، لكن لا تغلقان قبل دمج عقود الأمن والبيانات. تبدأ Native Windows وNative Linux بعد V1-005 وبالتوازي مع Docker profiles، ولا يبدأ pilot قبل W1 وW2 وW3 وW4.

## تعريف إنجاز أي مهمة

1. تغيير محدود النطاق مع اختبار يفشل قبله وينجح بعده عند ملاءمة ذلك.
2. تحديث OpenAPI/env/docs عند تغير العقد أو التشغيل.
3. لا secrets أو بيانات شخصية في logs/artifacts.
4. أوامر القبول ونتائجها موثقة.
5. مراجعة متطلبات ثم مراجعة جودة مستقلة.
6. إدخال موجز في `ChangeLog.md` وcommit واحد قابل للتراجع.

## بوابة الإصدار النهائية

```powershell
git status --porcelain
pnpm install --frozen-lockfile
node --test scripts/control-center.test.mjs scripts/wizard-i18n.test.mjs
pnpm release:verify
pnpm verify:laravel-next:live
docker compose --env-file <release.env> -f <release-compose.yml> config
```

وتستكمل داخل الحاويات بـComposer validate/audit وLaravel tests، ثم build/smoke/scan للصور، وتثبيت offline وrestore drill في بيئة معزولة. نجاح الأوامر وحده لا يكفي دون artifacts الأدلة وتوقيعات Go/No-Go.
