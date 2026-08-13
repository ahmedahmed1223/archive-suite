# مرجع خدمات البيانات في Kubernetes

[English](README.md) · [فهرس التوثيق](../../docs/README.ar.md)

ينشئ هذا المجلد PostgreSQL وRedis بوصفهما خدمتي بيانات على Kubernetes. يعمل
التطبيق عبر Docker أو التشغيل المباشر دون حاويات (Native) على Windows وLinux؛
ولا تنشر هذه الموارد خدمات Laravel أو Next.js.

في طبقة تطبيق Kubernetes التي تملك عُقد NVIDIA، استخدم
`whisper-gpu-worker-deployment.example.yaml` قالبًا لعامل Whisper المستقل.
استبدل `IMAGE_REFERENCE` بصورة موقعة وثابتة مبنية من
`archive-laravel/Dockerfile.worker-gpu`، ثم أضف النسخة إلى طبقة التطبيق.
يطلب القالب `nvidia.com/gpu: 1`، ويستهدف العُقد الموسومة
`nvidia.com/gpu.present=true`، ولا يستهلك إلا طابور `gpu`.

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
