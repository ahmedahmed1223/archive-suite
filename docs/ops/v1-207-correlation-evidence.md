# V1-207 — دليل إغلاق correlation E2E القانوني

**التاريخ:** 2026-07-13 · **البيئة:** الستاك القانوني `infra/docker-compose.yml`
(صور Next وLaravel القانونية المبنية من HEAD، خلف Caddy بشهادة CA داخلية على
`DOMAIN=localhost`، وقت التشغيل الإنتاجي nginx+php-fpm من V1-202).

> يستوفي شرط إعادة الفتح (02d9d05): «rehearsal يشغّل صور Next وLaravel القانونية
> خلف Caddy واعتماداتهما، يثبت المعرّف نفسه في response وسجلات Caddy وNext
> وLaravel» — لا محاكاة upstream هذه المرة؛ التطبيقان القانونيان نفساهما.

## البرهان 1 — معرّف صريح من العميل

طلب: `GET https://localhost/api/v1/health` مع `X-Request-ID: v1207-proof-explicit-1966`

| الموضع | النتيجة |
|--------|---------|
| ترويسة الاستجابة `X-Request-Id` | `v1207-proof-explicit-1966` ✅ (HTTP 200) |
| سجل Caddy JSON (`request_id` عبر `log_append`) | ظهور 1 ✅ |
| سجل Next (event JSON) | ظهور 1 ✅ |
| سجل Laravel (nginx access JSON، حقل `request_id`) | ظهور 1 ✅ |

## البرهان 2 — معرّف مولَّد (بدون ترويسة واردة)

طلب بلا `X-Request-ID` → الاستجابة حملت `ba475d8e-9437-45ad-beb4-c52573e27230`
(36 محرفًا، UUID مولَّد داخل السلسلة):

| الموضع | النتيجة |
|--------|---------|
| ترويسة الاستجابة | ✅ |
| سجل Caddy | ظهور 1 ✅ |
| سجل Next | ظهور 1 ✅ |
| سجل Laravel (nginx) | ظهور 1 ✅ |

## اكتشافان أصلحهما التشغيل الحقيقي (قيمة الفحص العميق)

1. **ملكية volume التخزين:** فحص `/api/v1/health` العميق أرجع
   `checks.storage:false` أول إقلاع — الـ volume ورث ملفات root من عهد `php -S`
   بينما fpm يكتب بـ `www-data`. الإصلاح: `chown` عند إقلاع `laravel-fpm` في
   ملفَي compose (دائم، لا يدوي).
2. **`DOMAIN` المحلي:** كان `example.com` في `.env` فحاول Caddy إصدار شهادة
   ACME حقيقية وفشل TLS محليًا؛ ضُبط `DOMAIN=localhost` (CA داخلي).

## إعادة التنفيذ

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
RID="proof-$$"
curl -sk -D - -o /dev/null -H "X-Request-ID: $RID" https://localhost/api/v1/health | grep -i x-request-id
for c in archive-caddy archive-ln-next archive-ln-laravel; do docker logs $c 2>&1 | grep -c "$RID"; done
```
