# Archive Suite — Kubernetes Deployment

Raw Kubernetes manifests for deploying Archive Suite (Postgres backend) to any
Kubernetes cluster with an NGINX ingress controller and cert-manager.

## Prerequisites

| Component | Version |
|---|---|
| Kubernetes | 1.28+ |
| NGINX Ingress Controller | 1.9+ |
| cert-manager | 1.13+ |
| kubectl | 1.28+ |

Install cert-manager if not already present:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

Create a `ClusterIssuer` for Let's Encrypt (replace the email address):

```bash
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: you@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
EOF
```

## Quick start

### 1. Edit required values

Before applying, update these files:

**`secret.yaml`** — replace all `CHANGE_ME` placeholders:
```bash
# Generate Laravel APP_KEY for the worker
php artisan key:generate --show

# Generate a strong JWT secret
openssl rand -base64 48

# Generate a strong admin password
openssl rand -base64 24
```

**`ingress.yaml`** — replace `archive.example.com` with your actual domain.

**Deployment images** — replace placeholder image references in
`server-deployment.yaml`, `frontend-deployment.yaml`, and
`whisper-worker-deployment.yaml` with your actual image references. Set
`HF_TOKEN` in `secret.yaml` only if `WHISPER_DIARIZE=true`. The default worker
requests one `nvidia.com/gpu` because `WHISPER_DEVICE=cuda`; switch
`WHISPER_DEVICE`/`WHISPER_COMPUTE_TYPE` and remove the GPU limit for CPU-only
clusters.

### 2. Apply with kustomize

```bash
kubectl apply -k infra/k8s/
```

### 3. Verify rollout

```bash
kubectl -n archive rollout status deployment/server
kubectl -n archive rollout status deployment/frontend
kubectl -n archive rollout status deployment/redis
kubectl -n archive rollout status deployment/whisper-worker
kubectl -n archive rollout status statefulset/postgres

kubectl -n archive get pods
kubectl -n archive get ingress
```

### 4. Check TLS certificate

```bash
kubectl -n archive describe certificate archive-tls
```

## Resource summary

| File | Purpose |
|---|---|
| `namespace.yaml` | `archive` namespace |
| `configmap.yaml` | Non-secret environment variables |
| `secret.yaml` | Passwords and JWT secrets (edit before apply) |
| `postgres-pvc.yaml` | 10 Gi PVC for PostgreSQL data |
| `postgres-statefulset.yaml` | PostgreSQL 18 StatefulSet |
| `postgres-service.yaml` | ClusterIP service for postgres:5432 |
| `redis-deployment.yaml` | Redis cache/queue-adjacent service on port 6379 |
| `redis-service.yaml` | ClusterIP service for redis:6379 |
| `server-pvcs.yaml` | PVCs for uploaded files (5 Gi) and config (100 Mi) |
| `server-deployment.yaml` | Archive Server Node.js API on port 8787 |
| `server-service.yaml` | ClusterIP service for server:8787 |
| `whisper-worker-deployment.yaml` | Laravel queue worker image for ffmpeg/faster-whisper media jobs |
| `frontend-deployment.yaml` | nginx SPA + nginx ConfigMap |
| `frontend-service.yaml` | ClusterIP service for frontend:80 |
| `ingress.yaml` | NGINX Ingress with TLS termination |
| `hpa.yaml` | HPA: server scales 1–5 pods at 70 % CPU |
| `kustomization.yaml` | Kustomize entrypoint |

## Upgrading

```bash
# Update image tags in the deployment YAML files, then:
kubectl apply -k infra/k8s/

# Or patch a single deployment in-place:
kubectl -n archive set image deployment/server server=ghcr.io/OWNER/archive-server:v1.2.3
kubectl -n archive set image deployment/frontend frontend=ghcr.io/OWNER/archive-frontend:v1.2.3
```

## Uninstall

```bash
kubectl delete -k infra/k8s/
# PVCs are NOT deleted by kustomize delete — remove manually if you want to
# wipe data:
kubectl -n archive delete pvc --all
```
