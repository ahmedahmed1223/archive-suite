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

### 3. النشر عبر Control Center

`Setup-Archive.bat` / `setup.sh` ينشران الآن الحزمة القانونية **Laravel + Next.js** (`archive-server/docker-compose.yml`).

**Windows:** انقر نقراً مزدوجاً على `Setup-Archive.bat` — أو من الطرفية:

```powershell
.\Setup-Archive.bat
```

**Linux / macOS:**

```bash
bash setup.sh
```

خيار **Deploy** (أو الأمر `deploy`) يقوم بـ:
- إنشاء `archive-server/.env` من `.env.example` إن لم يوجد
- توليد الأسرار الناقصة تلقائياً (PostgreSQL / Redis / Reverb / `LARAVEL_APP_KEY`)
- `docker compose up -d --build` وطباعة العناوين (Next على :3000، Reverb على :8080، Caddy على 80/443)

داخل القائمة التفاعلية أصبح الخيار `1` هو **Quick start** فقط، و`q`/`0` للخروج.
لإدارة كلمات المرور من نفس الأداة:

```powershell
.\Setup-Archive.bat generate-password
.\Setup-Archive.bat change-admin-password --generate
.\Setup-Archive.bat change-admin-password --email=admin@example.com --password=New-Strong-Password-123
```

الأمر `change-admin-password` يحدّث `.env` بنسخة احتياطية، ويحاول تطبيق كلمة المرور
على مستخدم Laravel الموجود إذا كانت الحاوية شغالة.

الترحيلات تعمل تلقائياً داخل حاوية Laravel عند الإقلاع.

> معالج النشر القديم (Node/SPA) ما زال متاحاً كأمر صريح فقط:
> `Setup-Archive.bat deploy-legacy` أو `bash setup.sh deploy-legacy`.

> دليل النشر الكامل (الوضع الداخلي/العام، الإدارة، التشغيل عند الإقلاع، الترقية):
> [`DEPLOYMENT.md`](./DEPLOYMENT.md).

### 4. افتح التطبيق

```
http://127.0.0.1:8951      # Next.js + Laravel للتطوير
http://localhost:3000      # الحزمة القانونية عبر Setup-Archive (Next.js)
http://localhost:8080      # legacy Docker stack عند استخدام deploy-legacy
https://<your-domain>      # وضع عام
```

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
