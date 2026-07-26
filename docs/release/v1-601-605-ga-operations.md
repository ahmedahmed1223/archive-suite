# V1-601 إلى V1-605 — قرار الإصدار والتشغيل والدعم

هذه إجراءات وقوالب قابلة للتدقيق للإصدار الأول. الحالة الافتراضية لكل خانة
هي `pending`؛ وجود هذا المستند لا يثبت Go أو إصداراً منشوراً أو تنزيلاً ناجحاً.

## V1-601: سجل Go/No-Go

يُنشأ سجل واحد موقّع لكل commit مجمّد. لا يسمح بالتوقيع عبر نسخ الاسم في ملف
Markdown؛ تحفظ التوقيعات أو سجلات الموافقة الموثوقة في نظام الأدلة، ويشار إليها
بـhash/URL منزوعة الأسرار.

| بوابة | الدليل المطلوب | Product | Security | Operations | Support | الحالة |
| --- | --- | --- | --- | --- | --- |
| لا مانع V1 مفتوح | ناتج V1-406 وTASKS | pending | pending | pending | pending | pending |
| قبول P5 | مصفوفة V1-806..814 وclean-host | pending | pending | pending | pending | pending |
| pilot | V1-502..504 والدفتر | pending | pending | pending | pending | pending |
| supply chain | SBOM/checksums/signatures/provenance | pending | pending | pending | pending | pending |
| التشغيل والدعم | runbooks وقناة استقبال العيوب | pending | pending | pending | pending | pending |

أي `failed` أو `external-required` أو `pending` يعني **NO-GO**. يسجل قرار
الاستثناء منفصلاً مع الأثر والمالك وتاريخ الانتهاء؛ لا يزيل المانع تلقائياً.

## V1-602: تجميد وإصدار immutable

1. ابدأ من commit الذي يطابق قرار Go، وأنشئ tag `v1.0.0` موقّعاً.
2. ابنِ artifacts مرة واحدة في runner نظيف، ثم احفظ `sourceCommit` وversion
   وimage digests وSBOM وchecksums والتوقيع وprovenance في manifest غير قابل
   للتعديل.
3. تحقق أن `package.json` و`infra/platform/release.v1.json` وmanifest وtag
   متطابقة. يمنع تعديل tag أو إعادة بناء artifact تحت نفس version.
4. إذا تغير مصدر أو digest أو توقيع، ألغِ القرار وأنشئ إصداراً/قراراً جديداً؛
   لا تستبدل ملفاً منشوراً في مكانه.

قالب manifest الأدنى:

```json
{
  "version": "1.0.0",
  "sourceCommit": "<40-hex>",
  "tag": "v1.0.0",
  "artifacts": [{"name": "...", "sha256": "...", "signature": "...", "provenance": "..."}],
  "images": [{"id": "...", "digest": "sha256:..."}],
  "sbom": "...",
  "createdAt": "RFC3339"
}
```

## V1-603: نشر artifacts

لا ينشر الناشر إلا ملفات manifest V1-602 نفسها: صور Docker، bundle offline،
حزم Windows Native وLinux Native، الدليل، ملاحظات الإصدار، SBOM، checksums
والتواقيع. قبل الإعلان، يتحقق الناشر من:

- تطابق checksum وsignature مع manifest؛
- عدم وجود credentials أو ملفات تطوير في الحزمة؛
- ثبات روابط التنزيل العامة واحتفاظها بالإصدار؛
- عدم نشر build جديد بعد اجتياز V1-604.

يسجل النشر وقتاً وURL وhash ومالكاً في journal append-only. الفشل يعيد الحالة
إلى `publish-failed` ولا يسمح باستبدال الملف المتضرر بصمت.

## V1-604: بروتوكول تنزيل خارجي

ينفذه مشغل مستقل من روابط عامة وعلى clean hosts، مرتين على الأقل: online وoffline.
المصدر الوحيد المسموح هو artifacts المنشورة ووسائط offline المقابلة، لا workspace
ولا registry خاص ولا cache مطور. لكل محاولة تحفظ البيئة وURL وhash والتحقق من
التوقيع ونتيجة التثبيت/الصحة والتنظيف في evidence manifest. لا تغلق المهمة هذه
القوالب أو اختبار محلي.

## V1-605: فتح التشغيل والدعم

قبل الإتاحة العامة يجب أن تكون العناصر الآتية منشورة ومملوكة:

| المجال | الحد الأدنى | المالك | الحالة |
| --- | --- | --- | --- |
| الصحة | dashboard محلي وتنبيهات وحدود واضحة | Operations | pending |
| النسخ والاستعادة | runbook وRPO/RTO وخطوات تحقق | Operations | pending |
| التحديث والتراجع | runbook مع شروط توقف وrollback | Release owner | pending |
| الاستجابة | شدة P0–P2، SLA ومسار تصعيد | Support | pending |
| استقبال العيوب | قناة معلنة، نموذج تقرير، رابط triage | Support/Product | pending |
| الخصوصية | قواعد تنقيح السجلات وحزمة الدعم | Security/Support | pending |

تفتح قناة الدعم فقط بعد إرفاق روابط هذه العناصر في سجل Go/No-Go. عيب P0 بعد
الإطلاق يفعّل runbook التراجع/الاحتواء ولا يعدل manifest أو artifacts المنشورة.
