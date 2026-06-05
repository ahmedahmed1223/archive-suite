# archive-server

نسخة **الإنتاج (السيرفر)** لتطبيق أرشيف الفيديو. تعتمد النواة المشتركة
`@archive/core` داخل `pnpm` workspace، وتضيف محوّلات السحابة وخادم PocketBase
وحاويات Docker.

## النطاق الحالي

- **خلفيتان للبيانات** خلف منفذ `@archive/core` (11 دالّة):
  - **`cloud-postgres-prisma`** (افتراضي للإنتاج) — Prisma 7 + driver adapter `@prisma/adapter-pg`، نموذج صفّ عام `storage_rows` (`store`+`uid` مفتاح مركّب، `data` JSONB). `replaceAll` ذرّي عبر transaction.
  - **`cloud-pocketbase`** — عميل PocketBase محقون، نفس التعيين العام.
- **RPC API server** (`src/api/`) — خادم HTTP بسيط (Node built-in، بلا Express) يعرض الـ 11 دالّة عبر `POST /api/rpc`. الـ SPA (محوّل `cloud-http`) يناديه؛ nginx يفوّض `/api/*` إليه.
- **خادم الإقلاع** `src/index.js` — يقرأ `BACKEND` ويُنشئ Prisma client (postgres) أو PocketBase client، ثم يشغّل الـ API.
- **Docker** — `docker-compose.yml` (PocketBase) و `docker-compose.postgres.yml` (Postgres 18 + خادم RPC) + Caddy للـ HTTPS.
- **اختبارات حتمية** (27+) بعملاء وهميين (بلا خوادم حيّة) + smoke حيّ لـ Postgres (`scripts/smoke-postgres-live.mjs`).

> الإصدارات المثبّتة (أحدث مستقرّة): PocketBase **0.39.0** · pocketbase SDK **0.27** · Prisma **7.8** · PostgreSQL **18** · Node **22** (runtime).

## البنية

```
src/adapters/cloud-postgres-prisma/  storage.js (StorageProvider عبر Prisma 7) + mapping.js
src/adapters/cloud-pocketbase/       storage.js + mapping.js
src/api/rpcHandler.js + server.js    RPC dispatcher + HTTP server (11 دالّة)
src/index.js                         خادم الإقلاع (postgres/pocketbase) → يشغّل الـ API
src/bootstrap/registerCloudProviders.js   يوجّه حسب BACKEND ويسجّل المحوّل
prisma/schema.prisma + migrations/   نموذج storage_rows + migration مُلتزَمة
prisma.config.mjs                    إعداد Prisma 7 (datasource.url)
pocketbase/                          pb_schema.json + Dockerfile + README
scripts/verify-*.mjs                 اختبارات المحوّلين + الـ API
```

## تشغيل الخادم محليًا (Postgres)

```bash
# Postgres على منفذ، ثم migrate + API
export DATABASE_URL="postgresql://archive:test@localhost:5432/archive"
pnpm --filter archive-server exec prisma migrate deploy
BACKEND=postgres pnpm --filter archive-server start
# فحص: curl http://127.0.0.1:8787/api/health → {"ok":true,"backend":"postgres"}
```

## التطوير

```bash
pnpm install              # من جذر المستودع
pnpm run verify:server    # اختبارات الخادم، Node بلا خوادم حيّة
```

## التشغيل المحلي بـ Docker (full stack)

اختر خلفية واحدة:

**PocketBase (الأبسط):**
```bash
cp .env.example .env       # DOMAIN=localhost
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# SPA على http://localhost:8080، إدارة PB على http://localhost:8090/_/
```

**PostgreSQL (موصى للفرق):**
```bash
cp .env.example .env       # عدّل POSTGRES_PASSWORD
docker compose -f docker-compose.postgres.yml up -d --build
# يطبّق Prisma migrations تلقائيًّا عند الإقلاع
```

## النشر على Hostinger VPS (إنتاج)

```bash
git clone https://github.com/ahmedahmed1223/archive-server.git
cd archive-server
cp .env.example .env       # DOMAIN + ACME_EMAIL (+ POSTGRES_PASSWORD إن اخترت Postgres)
docker compose up -d --build                                  # PocketBase
# أو:
docker compose -f docker-compose.postgres.yml up -d --build   # Postgres
```

Caddy يحصل تلقائيًّا على شهادة Let's Encrypt للـ DOMAIN ويفوّض كل شيء
خلف TLS. الـ stack يستهلك ~512MB RAM + قرص بحجم بياناتك.

دليل خطوة-بخطوة في [`deploy/hostinger-vps.md`](deploy/hostinger-vps.md) (قيد التحضير في B٤).

## الخلفيات المتوفّرة

| الخلفية | الـ compose | المحوّل | متى تختارها |
|---------|------------|---------|-------------|
| **PocketBase** | `docker-compose.yml` | `src/adapters/cloud-pocketbase/` | الأسهل، admin UI، نسخ احتياطي ملف SQLite واحد |
| **PostgreSQL + Prisma** | `docker-compose.postgres.yml` | `src/adapters/cloud-postgres-prisma/` | للفِرق الأكبر، الاستعلامات المركّبة، transactions ذرّية عبر المخازن |

كلا المحوّلين ينفّذان نفس منفذ `@archive/core` (11 دالّة)، ولهما **نفس
شكل** snapshot/replaceAll — استيراد/تصدير ينتقل بينهما بلا تحويل.

## الاستهلاك للنواة

مثبّت داخل الـ workspace: `"@archive/core": "workspace:1.2.1"`.
الترقية = تحديث نسخة `@archive/core` واعتمادات workspace المتأثرة في نفس التغيير.
