# دليل النشر — Archive Suite (إنتاج)

[English](DEPLOYMENT.en.md) · [فهرس التوثيق](docs/README.ar.md)

> يستخدم مسار Docker خدمات **Next.js + Laravel** عبر `infra/docker-compose.yml`.
> عند بناء واجهة Next.js للإنتاج، اضبط `ARCHIVE_API_BASE_URL` وقت البناء (مثال: `https://api.example.com/api/v1`) حتى تُولد rewrites إلى Laravel داخل build.

انشر الحزمة القانونية **Laravel + Next.js** عبر **Control Center** الواحد على
**Linux** و**Windows**. يفحص المعالج البيئة، يولّد الأسرار، يكتب `.env`، ويرفع
`infra/docker-compose.yml` عبر Docker.

> للتفاصيل العميقة (النطاق، التخزين الخارجي، الترقية، المراقبة) راجع
> [`infra/deploy/hostinger-vps.md`](infra/deploy/hostinger-vps.md).

---

## المتطلبات

- [Docker](https://docs.docker.com/) + Docker Compose v2 (Docker Desktop على Windows، Docker Engine على Linux).
- [Node.js 26.5.0](https://nodejs.org) و`pnpm 11.9.0` (لتشغيل المعالج من المصدر).
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

التطبيق **ليس PWA قابلاً للتثبيت** — لا يوجد `manifest.json` ولا service worker في `archive-next` الحالي
(القرار الموثق في V1-305: الأولوية لصحة قناة الكتابة أثناء الانقطاع، لا لتحويل التطبيق إلى PWA كاملة هذا الإصدار).
الوصول يكون عبر المتصفح مباشرة على `https://<domain>`.

**ما هو متاح فعلاً عند انقطاع الاتصال:** طابور تعديلات محلي (`localStorage`) في `archive-next/lib/offline-queue.ts`
يحفظ عمليات الكتابة (POST/PATCH/PUT/DELETE) أثناء الانقطاع ويعيد تشغيلها تلقائياً عند عودة الاتصال
(`archive-next/lib/offline-manager.ts`، last-write-wins عند تعارض نفس الـendpoint). هذا **ليس** offline كاملاً:
- لا تحميل offline للتطبيق نفسه — يتطلب اتصالاً فعالاً لفتح الصفحة أول مرة.
- لا تخزين مؤقت للقراءات (GET) — البيانات المعروضة هي آخر ما حُمِّل قبل الانقطاع فقط.
- الطابور مرتبط بعلامة تبويب المتصفح المفتوحة ولا يعمل في الخلفية (بلا Background Sync حقيقي).

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
