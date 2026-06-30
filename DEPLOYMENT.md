# دليل النشر — Archive Suite (إنتاج)

> **حالة cutover:** التطوير والتحقق الافتراضيان انتقلا إلى **Next.js + Laravel** (`pnpm dev`, `pnpm verify`). وصفة Docker أدناه ما زالت **legacy deployment** مبنية حول Node/SPA إلى أن تُستبدل حزمة الإنتاج بـ Laravel/Next. لا تستخدمها كأساس لميزات جديدة.
> عند بناء واجهة Next.js الإنتاجية للمسار الجديد، يجب ضبط `ARCHIVE_API_BASE_URL` وقت البناء (مثال: `https://api.example.com/api/v1`) حتى تُولد rewrites إلى Laravel داخل build.

نشر النظام legacy الكامل على **PostgreSQL** عبر **معالج موجّه واحد** يعمل على **Linux** و**Windows**.
المعالج يفحص البيئة، يولّد الأسرار، يكتب `.env`، ويرفع الحزمة المُحصّنة عبر Docker.

> للتفاصيل العميقة (النطاق، التخزين الخارجي، الترقية، المراقبة) راجع
> [`archive-server/DOCKER_DEPLOYMENT.md`](archive-server/DOCKER_DEPLOYMENT.md).

---

## المتطلبات

- [Docker](https://docs.docker.com/) + Docker Compose v2 (Docker Desktop على Windows، Docker Engine على Linux).
- [Node.js 22.12+](https://nodejs.org) (لتشغيل المعالج فقط).
- للوضع العام: **نطاق** يشير سجل DNS الخاص به إلى الخادم.

---

## التشغيل بالمعالج

### Windows
انقر نقراً مزدوجاً على **`Setup-Archive.bat`** (أو من الطرفية):
```powershell
.\Setup-Archive.bat
```

### Linux / macOS
```bash
bash setup.sh        # أو: pnpm deploy
```

المعالج يقودك عبر:
1. فحص البيئة (OS / Node / Docker).
2. **وضع الوصول:** داخلي (intranet) أو عام (نطاق + HTTPS).
3. حساب المشرف.
4. توليد كل الأسرار تلقائياً (PostgreSQL / Redis / JWT / pgAdmin / Grafana / تشفير النسخ الاحتياطي).
5. تكاملات اختيارية (SMTP، AI).
6. كتابة `archive-server/.env` (مع نسخة احتياطية لأي ملف سابق).
7. بوابة الجاهزية (`pnpm security:baseline`).
8. اختيار الحزمة: كاملة أو **خفيفة** (`--lite`، بلا OCR/Whisper/مراقبة).
9. رفع الحزمة + انتظار الصحة (الترحيلات وبذر المشرف تلقائيان).
10. ملخّص بالعناوين وبيانات الدخول (تُعرض **مرة واحدة** — احفظها).

---

## وضع الوصول

### داخلي (intranet) — ابدأ هنا
التطبيق يُنشر على منفذ مضيف للوصول عبر الشبكة المحلية:
```
http://SERVER_IP:8080
```
يُستخدم تجاوز [`archive-server/docker-compose.intranet.yml`](archive-server/docker-compose.intranet.yml)
(يكشف `frontend:8080` ويعطّل Caddy). لا حاجة لنطاق أو شهادة.

### عام (public) — لاحقاً
أعد تشغيل المعالج واختر "عام"، وأدخل النطاق + بريد ACME:
```bash
node scripts/deploy-wizard.mjs --public --domain=archive.example.com --acme-email=ops@example.com
```
يضبط المعالج `DOMAIN`/`ACME_EMAIL`/`ARCHIVE_PUBLIC_DEPLOY=1`، ويُصدر **Caddy** شهادة Let's Encrypt
تلقائياً على 80/443 (بشرط أن DNS يشير للخادم). التبديل داخلي↔عام لا يتطلب أي تغيير كود — فقط `.env`.

---

## غير تفاعلي (CI / أتمتة)

```bash
# عام، بلا أسئلة
node scripts/deploy-wizard.mjs --non-interactive --public \
  --domain=archive.example.com --acme-email=ops@example.com --skip-gate

# داخلي خفيف
node scripts/deploy-wizard.mjs --non-interactive --intranet --lite
```
يولّد كل الأسرار، يكتب `.env`، ويرفع الحزمة دون تدخّل.

---

## الوصول والإدارة

| الخدمة | العنوان | ملاحظة |
|--------|---------|--------|
| التطبيق | `:8080` (داخلي) / `https://<domain>` (عام) | نقطة دخول المستخدمين |
| pgAdmin (واجهة SQL) | `http://127.0.0.1:5050` | **محلي فقط** — للوصول البعيد: نفق SSH |
| Postgres (DBeaver…) | `localhost:15432` db=`archive` | لأدوات SQL سطح المكتب |
| Grafana (مراقبة) | `http://127.0.0.1:3000` | محلي فقط، غير متاح في `--lite` |

**أمان:** لوحات الإدارة وقاعدة البيانات مربوطة على `127.0.0.1` فقط ولا تُعرَّض للإنترنت.
للوصول إليها عن بُعد على خادم Linux استخدم نفق SSH:
```bash
ssh -L 5050:127.0.0.1:5050 -L 3000:127.0.0.1:3000 user@server
```

---

## تطبيق المستخدم النهائي (GUI)

التطبيق **PWA** قابل للتثبيت: من المتصفح (Edge/Chrome) → "تثبيت التطبيق" → نافذة مستقلة بأيقونة الأرشيف
في قائمة ابدأ/المنصّة، تعمل كأنها تطبيق سطح مكتب.

---

## التشغيل عند الإقلاع

- جميع الحاويات مضبوطة على `restart: unless-stopped` → تُعاد تلقائياً بعد إعادة تشغيل الجهاز.
- **Windows:** فعّل "Start Docker Desktop when you log in" من إعدادات Docker Desktop.
- **Linux:** تأكّد أن خدمة Docker مُفعّلة: `sudo systemctl enable docker`.

---

## الإيقاف والترقية

```bash
cd archive-server
# إيقاف (البيانات تبقى في الأحجام)
docker compose -f docker-compose.postgres.yml [-f docker-compose.intranet.yml] [-f docker-compose.lite.yml] down
# ترقية بعد سحب تغييرات
git pull && docker compose -f docker-compose.postgres.yml ... up -d --build
```
الترحيلات تُطبَّق تلقائياً عند إقلاع الخادم. النسخ الاحتياطي المشفّر مُفعّل افتراضياً (راجع `BACKUP_*` في `.env`).
