# التثبيت الأصلي

[English](native-installation.md) · [فهرس التوثيق](README.ar.md)

يدعم مسار التشغيل الأصلي على Windows وLinux إلى جانب Docker. تشغّل الحزمة
الخدمات المعتمدة نفسها، Laravel وNext.js، من دون Docker على جهاز التشغيل.

## بناء الحزمة

ابنِ الحزمة على جهاز إعداد مخصص. يستخدم البناء Docker لتجهيز وقت تشغيل Laravel
المحمول، لكنه لا يفرض Docker على جهاز الاستخدام النهائي.

```powershell
pnpm bundle:windows-native -- --out=D:\MasarNative
```

```bash
pnpm bundle:linux-native -- --out=/srv/masar-native
```

احتفظ بملف `SHA256SUMS` الناتج بجوار الحزمة وتحقق منه قبل نقلها إلى جهاز
التثبيت.

## المتطلبات

- Windows 10 أو 11، أو Linux يعمل بـ`systemd`.
- PostgreSQL وRedis متاحان لخدمات التطبيق.
- إعدادات محمية لبيانات اعتماد الخدمات وعنوان التطبيق العام.

تدير الحزمة خدمات التطبيق. خذ نسخة احتياطية قبل الصيانة واتبع إجراءات الاستعادة
المعتمدة. راجع [دعم المنصات](platform-parity.ar.md) و[دليل التشغيل](ops/rc-launch-and-support.md).
