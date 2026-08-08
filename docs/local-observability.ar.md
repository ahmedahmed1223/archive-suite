# المراقبة المحلية وتشخيص الدعم

[English](local-observability.md) · [فهرس التوثيق](README.ar.md)

تستخدم الحزمة المعتمدة سجلات Docker محلية دوارة وسجلات JSON للخدمات الأساسية.
ينتقل `X-Request-ID` عبر Caddy وNext.js إلى Laravel لتسهيل تتبع الطلب من دون
نسخ سجلات حساسة إلى قناة عامة.

شغّل فحص التنبيهات المحلي عبر:

```bash
node scripts/control-center.mjs observability
```

يفحص الأمر توقف الخدمات وعمق طابور Redis ومساحة القرص وعمر النسخ الاحتياطية
وتكرار الأخطاء. ابدأ بـ`health` و`status` قبل إعادة تشغيل خدمة، وأنشئ
`support-bundle` منقحًا عند فتح بلاغ.
