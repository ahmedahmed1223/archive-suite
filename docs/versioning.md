# Versioning & Support Policy (V1-002)

**Product:** Masar (archive-suite) · **License:** MIT (root `LICENSE`)

## SemVer

الإصدارات تتبع [SemVer 2.0.0](https://semver.org): `MAJOR.MINOR.PATCH`

- **MAJOR** — كسر في عقد الـ API (`docs/api/archive-contract.openapi.json`) أو صيغة البيانات/النسخ الاحتياطي دون مسار ترقية تلقائي.
- **MINOR** — ميزات جديدة متوافقة رجعيًا.
- **PATCH** — إصلاحات فقط.
- ما قبل الإصدار: `-rc.N` / `-beta.N` — تُنشر تحت وسمها فقط ولا تحرّك `latest` (انظر `release.yml`).

الإصدار الحالي في `package.json` (`version`) هو مصدر الحقيقة، ويُطلق رسميًا بدفع tag مطابق `v<version>` — البوابة الكاملة تعمل قبل أي نشر.

## نافذة الدعم

| السلسلة | الدعم |
|---------|-------|
| أحدث MINOR في أحدث MAJOR | إصلاحات وأمان — كامل |
| الـ MINOR السابق مباشرة | إصلاحات أمنية فقط، 6 أشهر من صدور اللاحق |
| ما قبل ذلك | لا دعم — الترقية مطلوبة |

- إصدارات `-rc`/`-beta` لا تحمل أي التزام دعم.
- الترحيلات (schema/backup format) تحافظ على التوافق ضمن نفس الـ MAJOR؛ أي استثناء يوثق في ملاحظات الإصدار وخطة ترقية.
