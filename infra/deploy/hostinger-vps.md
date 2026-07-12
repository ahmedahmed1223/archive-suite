# النشر على Hostinger VPS

هذا الدليل ينشر الحزمة القانونية **Laravel + Next.js** من
`infra/docker-compose.yml` عبر **Control Center**. لا تستخدم ملفات Compose
إضافية أو معالجات نشر أخرى.

## المتطلبات

- Ubuntu 24.04 LTS أو توزيعة Linux مدعومة.
- Docker Engine مع Compose v2 وNode.js 22.12+.
- نطاق يشير سجل DNS الخاص به إلى عنوان VPS عند النشر العام.

## 1. إعداد المضيف

أنشئ مستخدماً غير root، وافتح منافذ SSH وHTTP وHTTPS فقط:

```bash
sudo adduser archive
sudo usermod -aG sudo archive
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

ثبّت Docker Engine الرسمي ثم أضف مستخدم التشغيل إلى مجموعة Docker. بعد تسجيل
الدخول من جديد، تحقّق من `docker compose version` قبل المتابعة.

## 2. تنزيل ونشر Archive Suite

```bash
git clone https://github.com/ahmedahmed1223/archive-suite.git
cd archive-suite
pnpm install
pnpm setup
```

ينشئ Control Center `infra/.env` من النموذج القانوني، ويستبدل الأسرار الافتراضية
بقيم قوية، ثم يبني ويشغّل `infra/docker-compose.yml`. احتفظ بكلمة مرور المدير
التي يعرضها في أول تشغيل.

للنشر غير التفاعلي أو لإعادة provisioning:

```bash
node scripts/control-center.mjs deploy
```

## 3. ضبط النطاق والتحقق

استخدم Control Center لتحديث عنوان التطبيق، ثم أعد النشر:

```bash
node scripts/control-center.mjs set-url
node scripts/control-center.mjs deploy
node scripts/control-center.mjs health
```

اضبط سجل DNS قبل النشر العام. يدير Caddy الشهادة من الحزمة القانونية تلقائياً
عندما يكون النطاق قابلاً للوصول على المنفذين 80 و443.

## التشغيل والصيانة

استخدم أوامر Control Center بدلاً من تشغيل Docker مباشرة:

```bash
node scripts/control-center.mjs status
node scripts/control-center.mjs logs
node scripts/control-center.mjs backup
node scripts/control-center.mjs update
```

راجع [دليل النشر الرئيسي](../../DEPLOYMENT.md) و[مرجع Control Center](../../docs/control-center.md)
للتشغيل والاستعادة والترقية.
