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

### 2. تشغيل معالج النشر الموجّه

**Windows:** انقر نقراً مزدوجاً على `Setup-Archive.bat` — أو من الطرفية:

```powershell
.\Setup-Archive.bat
```

**Linux / macOS:**

```bash
bash setup.sh        # أو: pnpm deploy
```

المعالج يقودك خطوة بخطوة (PostgreSQL إنتاجي):
- فحص البيئة (Node.js / Docker / Compose)
- اختيار وضع الوصول: **داخلي (intranet)** أو **عام (نطاق + HTTPS)**
- ضبط حساب المشرف
- توليد كل الأسرار تلقائياً (PostgreSQL / Redis / JWT / pgAdmin / Grafana / تشفير النسخ الاحتياطي)
- كتابة `archive-server/.env` (مع نسخة احتياطية لأي ملف سابق)
- رفع الحزمة المُحصّنة عبر Docker وانتظار صحة النظام

> دليل النشر الكامل (الوضع الداخلي/العام، الإدارة، التشغيل عند الإقلاع، الترقية):
> [`DEPLOYMENT.md`](./DEPLOYMENT.md).

### 3. افتح التطبيق

```
http://localhost:8080      # وضع داخلي (أو http://SERVER_IP:8080 من جهاز آخر)
https://<your-domain>      # وضع عام
```

بيانات دخول المشرف تظهر في ملخّص المعالج عند انتهائه (مرة واحدة — احفظها).

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
