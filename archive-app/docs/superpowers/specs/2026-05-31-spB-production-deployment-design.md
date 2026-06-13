# المشروع الفرعي B — نسخة الإنتاج (PostgreSQL/Prisma + Docker + Hostinger + AI Studio) — التصميم

> جزء من معلم «الفصل إلى ٣ مستودعات + نسخة إنتاج قابلة للنشر»
> (`2026-05-31-three-repo-split-shared-core-design.md` + spA).
> spA انتهى (المنفذ ١١ دالّة في الثلاثة). spB يبني عليه طبقة النشر.

## الهدف

جعل `archive-server` قابلًا للنشر على Hostinger VPS عبر Docker، مع:
- **خلفية افتراضية: PostgreSQL + Prisma** (محوّل cloud-postgres-prisma جديد)
- **خلفية اختيارية: PocketBase** (المحوّل الموجود يبقى)
- **معالج بدء تشغيل في SPA** يختار الخلفية
- **frontend SPA** قابل للتشغيل في Google AI Studio (single-file HTML)

## الوضع الحالي

| المكوّن | الحالة |
|---------|--------|
| `@archive/core v1.1.0` | منشور، ١١ دالّة في `StorageProvider` (مع snapshot/replaceAll) |
| `archive-app` | SPA على IndexedDB، يستهلك v1.1.0، build:spa = single-file HTML |
| `archive-server` | محوّل cloud-pocketbase يطبّق ١١ دالّة + verify أخضر |
| Docker | لا يوجد Dockerfile أو compose في `archive-server` |
| Postgres | لا يوجد محوّل |
| Setup wizard في SPA | يوجد V1OnboardingWizard لكن لا يختار backend |
| AI Studio packaging | غير موجود |

## المقاربة المعتمدة — تنفيذ على ٥ شطور مستقلّة

كل شطر = PR قائم بذاته، لا يكسر السابق، يضيف قيمة فورًا.

### الشطر B١ — محوّل `cloud-postgres-prisma` في `archive-server`

**ملفات جديدة:**
- `archive-server/prisma/schema.prisma` — Generic-row table per store (`uid TEXT PK, data JSONB, syncVersion INT, lastModifiedBy JSONB`) — يطابق shape محوّل PocketBase
- `archive-server/src/adapters/cloud-postgres-prisma/storage.js` — ينفّذ ١١ دالّة عبر Prisma client
- `archive-server/src/adapters/cloud-postgres-prisma/mapping.js` — نفس `SNAPSHOT_COLLECTION_BY_DOMAIN_KEY` (تُعاد المشاركة من cloud-pocketbase/mapping.js)
- `archive-server/scripts/verify-postgres-adapter.mjs` — اختبارات ضدّ Prisma in-memory mock + اختبار تكاملي يستخدم `pg-mem`
- `archive-server/src/bootstrap/registerCloudProviders.js` — يقبل `{ backend: "postgres" | "pocketbase", url }` ويوجّه بناءً عليه

**سبب اختيار Generic-row JSONB:**
- نفس shape المحوّل الحالي للـ PocketBase — لا تباين في snapshot/replaceAll
- يدعم الـ custom fields الديناميكي للأرشيف (`metadata` كـ JSONB)
- migrations بسيطة (جدول واحد لكل store، نفس بنية الـ rows)
- Postgres JSONB له indexing فعّال (GIN)
- لا يربطنا بـ schema rigid — يبقى المنفذ هو العقد

**Tradeoff مقبول:** نفقد بعض type safety الـ Prisma (الـ `data` هو `Json`)، لكن نكسب توافقًا كاملًا مع المحوّل الآخر و مع الـ payload format للـ SPA. القرار: العقد فوق Prisma.

**Verify:**
- اختبار وحدة: كل دالّة من ١١ تعمل على mock client
- اختبار تكاملي: `pg-mem` يحاكي Postgres في الذاكرة، روند-تريب snapshot→replaceAll
- `isStorageProvider(provider) === true`

### الشطر B٢ — Dockerization (server + frontend + Postgres + بدائل)

**ملفات جديدة في `archive-server`:**
- `Dockerfile.server` — Node.js 20-alpine + Prisma + بدء `pocketbase serve` أو Express wrapper حسب env
- `Dockerfile.pocketbase` — يحمل PocketBase binary للـ Linux
- `docker-compose.postgres.yml` — Postgres 16 + server-postgres + frontend (nginx)
- `docker-compose.pocketbase.yml` — pocketbase + frontend
- `docker-compose.dev.yml` — مع hot reload للتطوير
- `.env.example` — `BACKEND=postgres|pocketbase`, `DATABASE_URL`, `POCKETBASE_URL`, `JWT_SECRET`
- `nginx/default.conf` — يخدم SPA من `/dist`، يفوّض `/api/*` و `/pb/*` للـ server

**ملف جديد في `archive-app`:**
- `Dockerfile.frontend` — multi-stage: build SPA ثم nginx alpine

**معماريّة:**
```
┌─────────────────────────────────────────────┐
│ Hostinger VPS (Ubuntu)                      │
│ ┌─────────────────────────────────────────┐ │
│ │ Caddy (reverse proxy + Let's Encrypt)   │ │
│ └────────────┬────────────────────────────┘ │
│              │                              │
│   ┌──────────┴───────┐                      │
│   ▼                  ▼                      │
│ ┌─────┐         ┌─────────┐  ┌───────────┐ │
│ │SPA  │         │ Server  │──▶ Postgres  │ │
│ │nginx│         │ Node    │  │ (volume)  │ │
│ └─────┘         └─────────┘  └───────────┘ │
│                       │                     │
│                       ▼                     │
│                  ┌───────────┐              │
│                  │PocketBase │              │
│                  │(optional) │              │
│                  └───────────┘              │
└─────────────────────────────────────────────┘
```

**Verify:**
- `docker compose -f docker-compose.postgres.yml up` يشغّل الـ stack محلياً
- `curl http://localhost/api/health` يعيد 200
- `curl http://localhost/` يعيد الـ SPA HTML

### الشطر B٣ — Setup wizard في SPA لاختيار الـ backend

**ملفات معدّلة:**
- `archive-app/src/features/onboarding/V1OnboardingWizard.jsx` — خطوة جديدة `backend-choice`: PocketBase / Postgres / Local-only
- `archive-app/src/stores/slices/settingsSlice.js` — يحفظ `settings.ui.backend` و `settings.ui.backendUrl`
- `archive-app/src/bootstrap/registerLocalProviders.js` — يقرأ الاختيار عند البوت
- `archive-app/src/main.js` — يطبّق التوجيه قبل `startVideoArchive()`

**ملف جديد:**
- `archive-app/src/bootstrap/registerByBackendChoice.js` — يوجّه إلى local/postgres/pocketbase حسب الاختيار

**خطوة Setup wizard:**
```
┌─────────────────────────────────────────────┐
│ أين تريد حفظ بياناتك؟                       │
├─────────────────────────────────────────────┤
│ ◉ هذا الجهاز فقط (IndexedDB)                │
│   سريع، لا يحتاج خادمًا، لا يتزامن           │
│                                              │
│ ○ خادم Postgres (موصى به للفرق)             │
│   عنوان الخادم: ____________________         │
│                                              │
│ ○ خادم PocketBase                            │
│   عنوان الخادم: ____________________         │
└─────────────────────────────────────────────┘
```

### الشطر B٤ — Hostinger deployment guide + Caddy config

**ملفات جديدة:**
- `archive-server/deploy/hostinger-vps.md` — خطوات النشر (SSH، Docker install، compose up، DNS، Caddy)
- `archive-server/deploy/Caddyfile` — تكوين Caddy للـ HTTPS التلقائي + reverse proxy
- `archive-server/deploy/systemd/archive-server.service` — يشغّل docker compose عند الإقلاع
- `archive-server/deploy/backup-cron.sh` — backup يومي لـ Postgres + ملفات PocketBase إلى مجلد محلي
- README سهل القراءة لمالك Hostinger بدون خبرة DevOps متقدّمة

### الشطر B٥ — Google AI Studio packaging

**ملفات جديدة:**
- `archive-app/scripts/build-aistudio.mjs` — يبني SPA كـ single-file HTML، يحقن إعداد افتراضي `backend: "local"`
- `archive-app/aistudio.config.json` — manifest لـ AI Studio (إن وجد)
- `archive-app/docs/aistudio-deployment.md` — خطوات رفع SPA إلى Google AI Studio

**ملاحظة:** AI Studio يدعم الـ apps كـ single HTML + JS embedded. SPA يبنى الآن إلى single file أصلاً (`build:spa`). الشطر هذا يضيف فقط: حقن إعداد افتراضي، تعطيل setup wizard، توثيق.

---

## الترتيب التنفيذي

| ترتيب | شطر | المستودع | يعتمد على | جلسات تقديريّة |
|------|-----|----------|-----------|----------------|
| 1 | B٢ — Docker compose مع PocketBase الحالي | archive-server | spA | ١ |
| 2 | B١ — محوّل Postgres + Prisma | archive-server | (لا) | ٢ |
| 3 | B٢ يكمل — compose مع Postgres | archive-server | B١ | ٠.٥ |
| 4 | B٤ — Hostinger guide + Caddy | archive-server | B٢ | ١ |
| 5 | B٣ — Setup wizard في SPA | archive-app | B١ | ١.٥ |
| 6 | B٥ — AI Studio packaging | archive-app | (لا) | ٠.٥ |

**المجموع التقديري:** ٦.٥ جلسات. هذه الجلسة ستنجز B٢ (Docker الأساسي) وتبدأ B١.

## معايير القبول

- `docker compose up` يشغّل الـ stack كاملًا محليًا (postgres + server + spa) في < 30 ثانية
- `npm run verify` في `archive-server` يجتاز اختبارات المحوّلين (PocketBase + Postgres)
- جلسة استيراد/استعادة عبر السحابة تنجح في كلا الخلفيتين
- مستخدم Hostinger يستطيع نشر النسخة في < 30 دقيقة باتباع `deploy/hostinger-vps.md`
- معالج بدء التشغيل في SPA يعرض الخيارات الثلاثة ويحفظها بشكل صحيح
- SPA build للـ AI Studio يفتح ويعمل في بيئة AI Studio

## المخاطر والتخفيف

| الخطر | التخفيف |
|------|---------|
| **حجم spB** | تنفيذ على ٥ شطور مستقلّة، كل واحد قابل للنشر منفصلًا |
| **Prisma migration drift في الإنتاج** | استخدام `prisma migrate deploy` (لا `migrate dev`) في Docker entrypoint |
| **Postgres data loss عند إعادة تشغيل docker** | volume خارجي مذكور صراحة في compose |
| **Caddy لا يستطيع الحصول على شهادة** | توثيق DNS pre-check + fallback to self-signed للاختبار |
| **Setup wizard يكسر الـ flow الحالي للمستخدمين** | الخيار الافتراضي «هذا الجهاز فقط» يطابق السلوك الحالي |
| **AI Studio لا يدعم IndexedDB** | اختبار مبكر؛ إن لم يدعم، استخدام in-memory store fallback |

## غير-أهداف (لجلسات لاحقة)

- AI provider implementations (Gemini/Claude) — جلسة منفصلة
- Multi-user auth عبر Postgres — Phase 3 لاحقة
- Realtime sync — Phase 3
- Mobile app — خارج النطاق
