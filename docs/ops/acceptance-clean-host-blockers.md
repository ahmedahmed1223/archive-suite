# قبول clean-host الخارجي — عوائق التشغيل

[English](acceptance-clean-host-blockers.en.md) · [فهرس التوثيق](../README.ar.md)

تدعم منصة القبول المحلية تعريف المزودين وحفظ الأدلة، لكنها لا تستطيع أن تدّعي قبول Windows أو Linux نظيفًا من محطة تطوير Docker/WSL2. لا يقبل `wsl2-linux` الحقل `cleanHost: true` في العقد عمدًا.

| الدليل | المالك المطلوب | الحالة المحلية |
| --- | --- | --- |
| Windows Native clean-host، online/offline، update/rollback | Operations | يحتاج جهاز أو VM Windows نظيفًا وartifact موقّعًا |
| Linux Native clean-host، online/offline، update/rollback | Operations | يحتاج جهاز أو VM Linux نظيفًا وartifact موقّعًا |
| Hyper-V Windows/Linux | Operations | يحتاج Hyper-V متاحًا وصلاحية checkpoint |
| دليل خارجي موقّع | Release + Security | يستورد فقط عبر provider `external` ولا يولّد محليًا |

كل تشغيل خارجي يجب أن يرفق manifest من دون أسرار: commit، version، digests، موارد المزود، نتائج السيناريوهات، لقطات ما قبل السيناريوهات المدمرة، وروابط الأدلة. يظل `blocked-capability` مانعًا لـRC وGA للمنصة المعلنة حتى يصل هذا الدليل.
