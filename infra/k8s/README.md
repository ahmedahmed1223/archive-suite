# Kubernetes data-services reference

[العربية](README.ar.md) · [Documentation](../../docs/README.md)

This directory provisions PostgreSQL and Redis as Kubernetes data services.
The supported application runtime is deployed with Docker or direct-host
operation (Native) on Windows and Linux; these manifests do not deploy the
Laravel or Next.js application services.

For a Kubernetes application overlay that has NVIDIA GPU nodes, use
`whisper-gpu-worker-deployment.example.yaml` as the dedicated Whisper worker
template. Replace `IMAGE_REFERENCE` with a signed immutable image built from
`archive-laravel/Dockerfile.worker-gpu`, then include the copied manifest in
that application overlay. It requests `nvidia.com/gpu: 1`, targets nodes
labeled `nvidia.com/gpu.present=true`, and consumes only the `gpu` queue.

The kustomization contains pinned PostgreSQL 17 and Redis 7 images. Before
applying it, replace every `CHANGE_ME` value in `secret.yaml` with a value from
your secret store.

```bash
kubectl apply -k infra/k8s/
kubectl -n archive rollout status deployment/redis
kubectl -n archive rollout status statefulset/postgres
```

To remove the workloads:

```bash
kubectl delete -k infra/k8s/
```

Persistent volume claims retain data and may require a separate, intentional
deletion. Confirm backups before deleting any claim.
