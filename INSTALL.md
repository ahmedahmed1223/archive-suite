# التثبيت السريع — Archive Suite

## المتطلبات

- [Node.js 22.12+](https://nodejs.org)
- [Docker Desktop](https://docs.docker.com/desktop/) (أو Docker Engine + Compose على Linux)
- لا تحتاج PHP أو Composer محلياً؛ Laravel يعمل عبر Docker في سكربتات الجذر.

---

## الخطوات

### 1. استنساخ المستودع

```bash
git clone https://github.com/your-org/archive-suite.git
cd archive-suite
```

### 2. تشغيل النظام المعتمد للتطوير

```bash
pnpm install
pnpm dev
```

يفتح هذا المسار:

- Laravel API داخل Docker على `http://127.0.0.1:8950/api/v1`
- Next.js على `http://127.0.0.1:8951`
- rewrite داخلي من Next إلى Laravel عبر `ARCHIVE_API_BASE_URL`

للتحقق:

```bash
pnpm verify
pnpm verify:laravel-next:live
```

بوابة `verify:laravel-next:live` تبني Next.js بعد ضبط `ARCHIVE_API_BASE_URL` على Laravel. لو كان Laravel يعمل مسبقاً، يمكن إعادة استخدامه:

```bash
ARCHIVE_E2E_USE_EXISTING_LARAVEL=1 LARAVEL_PORT=8950 pnpm verify:laravel-next:live
```

### 3. معالج النشر legacy

معالج النشر الحالي ما زال يطلق حزمة Docker القديمة المبنية حول Node/SPA. استخدمه فقط عند الحاجة للـ legacy deployment إلى أن تُستبدل وصفات الإنتاج بـ Laravel/Next.

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

### 4. افتح التطبيق

```
http://127.0.0.1:8951      # Next.js + Laravel للتطوير
http://localhost:8080      # legacy Docker stack عند استخدام Setup-Archive
https://<your-domain>      # وضع عام
```

بيانات دخول المشرف تظهر في ملخّص المعالج عند انتهائه (مرة واحدة — احفظها).

---

## أوامر مفيدة

```bash
# تطوير محلي (Docker للـ Laravel)
pnpm install
pnpm dev           # Next.js + Laravel
pnpm dev:next      # Next.js فقط
pnpm dev:laravel   # Laravel API فقط عبر Docker

# بناء الإنتاج الجديد
ARCHIVE_API_BASE_URL=https://api.example.com/api/v1 pnpm build:next
pnpm build         # alias لـ build:next

# مسارات legacy للمقارنة فقط
pnpm dev:legacy
pnpm server:legacy
pnpm build:legacy

# اختبارات
pnpm verify        # cutover gate الرسمي
pnpm verify:laravel-next:live
pnpm verify:legacy # المرجع القديم عند الحاجة
```

## المساعدة

راجع [`CLAUDE.md`](./CLAUDE.md) للمزيد من التفاصيل حول بنية المشروع.
