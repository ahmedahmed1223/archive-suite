# تثبيت Archive Suite للتطوير

[English](INSTALL.md) · [فهرس التوثيق](docs/README.ar.md)

استخدم هذا المسار عند العمل من نسخة محلية للمستودع. تعمل واجهة Next.js على
الجهاز، وتعمل خدمة Laravel عبر Docker؛ لذلك لا يلزم تثبيت PHP أو Composer
محليًا.

## المتطلبات

- Node.js بالإصدار `26.5.0` وpnpm بالإصدار `11.9.0`.
- Docker Desktop على Windows، أو Docker Engine مع Compose v2 على Linux.

## تشغيل بيئة التطوير

```bash
pnpm install --frozen-lockfile
pnpm dev
```

يشغّل الأمر Laravel عبر Docker وNext.js على الجهاز. استخدم `pnpm dev:next`
لتشغيل الواجهة وحدها، أو `pnpm dev:laravel` لتشغيل API وحدها.

قبل مشاركة أي تغيير، شغّل:

```bash
pnpm verify
pnpm verify:laravel-next:live
```

## أول تثبيت على جهاز

لتثبيت محلي مُدار عبر Docker، افتح `Setup-Archive.bat` على Windows أو شغّل
`bash setup.sh` على Linux. ابدأ بالمعالج `wizard` ليجهز الأسرار ويشغّل حزمة
Compose المدعومة ويتحقق من صحتها. راجع [دليل النشر](DEPLOYMENT.ar.md) قبل إتاحة
الخدمة على عنوان عام.
