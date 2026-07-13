# Archive Suite — Kubernetes data services reference

The canonical production application path is Laravel + Next through
`infra/docker-compose.yml`. Kubernetes application deployment is not supported
for V1 because no published canonical Laravel/Next image digests are available
to check into this repository safely.

`kubectl apply -k infra/k8s/` therefore provisions only the reference data
services:

- PostgreSQL 17, pinned as `postgres:17-alpine@sha256:...`.
- Redis 7, pinned as `redis:7-alpine@sha256:...`.

Legacy application Deployments were removed from the deployable set because
their placeholder images had no published digest to verify. Kubernetes cannot
become a supported application deployment path until a future release workflow
supplies verified canonical `version@digest` image references.

Before applying the data-services reference, replace every `CHANGE_ME` value in
`secret.yaml`. Then run:

```bash
kubectl apply -k infra/k8s/
kubectl -n archive rollout status deployment/redis
kubectl -n archive rollout status statefulset/postgres
```

To remove these resources:

```bash
kubectl delete -k infra/k8s/
```

PersistentVolumeClaims may require separate, intentional deletion.
