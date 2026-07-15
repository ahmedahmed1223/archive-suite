# V1-505 — بروفة إصدار نظيفة

هذه الأداة تؤتمت الجزء المحلي فقط من بروفة إصدار نظيفة. لا تثبت ادعاء اكتمال
V1-505: أدلة مضيف Windows نظيف، Linux نظيف، والمسارين Native تُجمع خارجيًا من
المضيفين المستقلين ثم تُرفق بقرار الإصدار.

## العقد

يجب أن تكون المدخلات ملف إصدار Docker offline مُنزّلًا (مثل
`archive-suite-offline-v*.tar.gz`) وملف `SHA256SUMS` من صفحة الإصدار نفسها. لا
تقرأ الأداة صورًا أو أرشيفات من الـworkspace، ولا تبني أو تسحب صورًا.

```powershell
node scripts/release-rehearsal.mjs --bundle C:\Downloads\archive-suite-offline-v1.0.0.tar.gz
```

الوضع الافتراضي `dry-run`: يتحقق من checksum العلوي فقط ويكتب خطة evidence ولا
يفك الأرشيف أو يشغّل Docker. للتنفيذ المحلي المقصود على مضيف نظيف:

```powershell
node scripts/release-rehearsal.mjs --bundle C:\Downloads\archive-suite-offline-v1.0.0.tar.gz --execute --evidence C:\evidence\v1-505.json
```

قبل الفك، تتحقق الأداة من `SHA256SUMS`. بعد الفك إلى مجلد مؤقت خاص بها، تفوّض
التحقق إلى `verify-bundle.mjs` المرفق في النسخة وتفوّض بروفة Docker إلى
`offline-bundle.mjs rehearse` مع `--pull never`. التنظيف محصور في مشروع Compose
الذي تنشئه البروفة؛ لا يوجد تنظيف عام لـDocker.

يسجل ملف evidence هوية المصدر وSHA للأرشيف والـmanifest ومرجع كل image digest
والنسخ runtime ونتيجة السيناريو والتنظيف. يجب أن تبقى حقول clean-host وNative
`external-required` حتى إرفاق أدلة مستقلة؛ لا تغيّر الأداة حالة V1-505 في
`TASKS.md`.
