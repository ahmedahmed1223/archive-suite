# التثبيت السريع — Archive Suite

## المتطلبات

- [Node.js 18+](https://nodejs.org)
- [Docker Desktop](https://docs.docker.com/desktop/) (أو Docker Engine + Compose على Linux)

---

## الخطوات

### 1. استنساخ المستودع

```bash
git clone https://github.com/your-org/archive-suite.git
cd archive-suite
```

### 2. تشغيل معالج الإعداد

```bash
node scripts/setup.mjs
```

المعالج يقوم تلقائياً بـ:
- فحص Node.js و Docker
- اختيار وضع التشغيل (PocketBase للتطوير / PostgreSQL للإنتاج)
- توليد ملف `.env` بأسرار JWT عشوائية آمنة
- تشغيل حاويات Docker
- انتظار صحة النظام وفتح المتصفح

### 3. افتح التطبيق

```
http://localhost:8787
```

عند أول تشغيل ستظهر صفحة إنشاء حساب المشرف.

---

## أوامر مفيدة

```bash
# تطوير محلي (بدون Docker)
pnpm install
pnpm dev           # frontend على http://localhost:5173
pnpm server        # backend على http://localhost:3000

# بناء الإنتاج
pnpm build:spa     # SPA offline
pnpm build:cloud   # PocketBase cloud

# اختبارات
pnpm verify        # type-check + tests لجميع الحزم
pnpm --filter @archive/app run e2e   # Playwright E2E
```

## المساعدة

راجع [`CLAUDE.md`](./CLAUDE.md) للمزيد من التفاصيل حول بنية المشروع.
