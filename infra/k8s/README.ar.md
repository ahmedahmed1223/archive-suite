# مرجع خدمات البيانات في Kubernetes

[English](README.md) · [فهرس التوثيق](../../docs/README.ar.md)

ينشئ هذا المجلد PostgreSQL وRedis بوصفهما خدمتي بيانات على Kubernetes. يعمل
التطبيق عبر Docker أو التشغيل المباشر دون حاويات (Native) على Windows وLinux؛
ولا تنشر هذه الموارد خدمات Laravel أو Next.js.

يستخدم ملف kustomization صورًا مثبتة لـPostgreSQL 17 وRedis 7. قبل التطبيق،
استبدل كل قيمة `CHANGE_ME` في `secret.yaml` بقيمة من مخزن الأسرار لديك.

```bash
kubectl apply -k infra/k8s/
kubectl -n archive rollout status deployment/redis
kubectl -n archive rollout status statefulset/postgres
```

لإزالة أحمال العمل:

```bash
kubectl delete -k infra/k8s/
```

تحتفظ مطالبات التخزين الدائم بالبيانات، وقد تحتاج إلى حذف مستقل ومقصود. تحقق
من النسخ الاحتياطية قبل حذف أي مطالبة تخزين.
