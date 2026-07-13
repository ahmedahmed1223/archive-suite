# دليل النشر — Archive Suite (إنتاج)

> **حالة cutover:** التطوير والتحقق الافتراضيان هما **Next.js + Laravel** (`pnpm dev`, `pnpm verify`)، و`Setup-Archive.bat` / `setup.sh` ينشران الحزمة القانونية Laravel + Next (`infra/docker-compose.yml`). الحزم القديمة (Node/SPA) ومعالج نشرها أُزيلت في 2026-07-12 وتبقى متاحة في تاريخ git فقط.
> عند بناء واجهة Next.js الإنتاجية للمسار الجديد، يجب ضبط `ARCHIVE_API_BASE_URL` وقت البناء (مثال: `https://api.example.com/api/v1`) حتى تُولد rewrites إلى Laravel داخل build.

انشر الحزمة القانونية **Laravel + Next.js** عبر **Control Center** الواحد على
**Linux** و**Windows**. يفحص المعالج البيئة، يولّد الأسرار، يكتب `.env`، ويرفع
`infra/docker-compose.yml` عبر Docker.

> للتفاصيل العميقة (النطاق، التخزين الخارجي، الترقية، المراقبة) راجع
> [`infra/deploy/hostinger-vps.md`](infra/deploy/hostinger-vps.md).

---

## المتطلبات

- [Docker](https://docs.docker.com/) + Docker Compose v2 (Docker Desktop على Windows، Docker Engine على Linux).
- [Node.js 22.13+](https://nodejs.org) (لتشغيل المعالج فقط).
- للوضع العام: **نطاق** يشير سجل DNS الخاص به إلى الخادم.

---

## التشغيل بالمعالج

> ملاحظة: النشر يتم عبر أمر `deploy` في Control Center، وهو ينشر الحزمة القانونية Laravel + Next من `infra/docker-compose.yml`. (معالج النشر القديم للنظام Node/Vite أُزيل في 2026-07-12 مع الحزم القديمة.)

### Windows
```powershell
.\Setup-Archive.bat deploy
```

### Linux / macOS
```bash
bash setup.sh deploy        # أو: pnpm deploy
```

أمر Deploy يجهّز `infra/.env` بالأسرار المطلوبة (مع نسخة احتياطية لأي ملف سابق)، يرفع حزمة Laravel + Next عبر Docker Compose، وينتظر فحص الصحة (الترحيلات وبذر المشرف تلقائيان). راجع `docs/control-center.md` للتفاصيل.

---

## وضع الوصول

### داخلي (intranet) — ابدأ هنا
شغّل `pnpm setup` أو `pnpm deploy` من الجذر، ثم استخدم العنوان الذي يطبعه
Control Center للحزمة القانونية. لا يحتاج الوضع الداخلي نطاقاً أو شهادة.

### عام (public) — لاحقاً
اضبط في `infra/.env` القيم `DOMAIN` و`ACME_EMAIL` و`ARCHIVE_PUBLIC_DEPLOY=1` ثم أعد تشغيل النشر:
```bash
pnpm deploy
```
يُصدر **Caddy** شهادة Let's Encrypt تلقائياً على 80/443 (بشرط أن DNS يشير للخادم).
التبديل داخلي↔عام لا يتطلب أي تغيير كود — فقط `.env`.

---

## غير تفاعلي (CI / أتمتة)

```bash
node scripts/control-center.mjs deploy
```
الأوامر الفردية في Control Center غير تفاعلية (status/start/health/backup...)؛ راجع `docs/control-center.md`.

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
# إيقاف أو إعادة تشغيل الحزمة القانونية
node scripts/control-center.mjs stop
node scripts/control-center.mjs update
```
الترحيلات تُطبَّق تلقائياً عند إقلاع الخادم. النسخ الاحتياطي المشفّر مُفعّل افتراضياً (راجع `BACKUP_*` في `.env`).
