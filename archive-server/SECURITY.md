# Archive Suite — Security Hardening & Best Practices

## Overview

The Archive Suite Docker infrastructure has been hardened with:
- **Capability dropping** — all containers drop ALL capabilities, add only what's needed
- **Read-only root filesystems** — ephemeral writable mounts only via tmpfs
- **Least-privilege execution** — application images use unprivileged users and services drop Linux capabilities
- **Resource limits** — CPU and memory quotas per service
- **No-new-privileges flag** — prevents privilege escalation via setuid binaries
- **Health checks** — core runtime services include startup and liveness probes
- **Required secret checks** — startup validation ensures required production secrets are present

## Quick Start (Production Deployment)

```bash
# 1. Copy and edit the environment file
cp archive-server/.env.example archive-server/.env

# 2. Generate strong secrets (using openssl)
openssl rand -base64 48  # For JWT secrets (3 different ones)
openssl rand -base64 32  # For passwords
openssl rand -hex 32     # For backup encryption key

# 3. Update .env with the generated secrets (marked CHANGE_ME_*)
# Required secrets:
#   - POSTGRES_PASSWORD
#   - JWT_AUTH_SECRET, JWT_SHARE_SECRET, OAUTH_STATE_SECRET
#   - ADMIN_PASSWORD
#   - REDIS_PASSWORD
#   - PGADMIN_PASSWORD, PGADMIN_EMAIL
#   - GRAFANA_PASSWORD

# 4. Build and deploy
docker compose -f archive-server/docker-compose.postgres.yml up -d --build

# 5. Verify services are running or healthy
docker compose -f archive-server/docker-compose.postgres.yml ps
```

## Security Features

### 1. Capability Dropping

Each container explicitly declares the minimal set of Linux capabilities it needs:

```yaml
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE  # Only for services that bind ports
```

**Services:**
- **postgres**: CHOWN, DAC_OVERRIDE, SETGID, SETUID (for database user/permission management)
- **server**: NET_BIND_SERVICE (for API port 8787)
- **frontend**: NET_BIND_SERVICE (for nginx port 80)
- **caddy**: NET_BIND_SERVICE (for ports 80/443)
- **redis, whisper, prometheus, grafana, ocr**: ALL dropped (read-only or no privilege escalation needed)

### 2. Read-Only Root Filesystem

Production containers use Compose `read_only: true` with ephemeral mounts:

```yaml
read_only: true
tmpfs:
  - /tmp
  - /var/run
  - /var/cache/nginx
```

This prevents:
- Malicious code from modifying binaries or system files
- Accidental data corruption or unauthorized writes
- Container escape via root filesystem manipulation

**Writable volumes** (persisted data) are explicitly declared and limited to app-specific paths (e.g., `/app/config`, `/app/files`).

### 3. Non-Root Execution

All services run as non-root users:

```dockerfile
# In Dockerfile.server
USER node

# In Dockerfile.frontend
USER nginx
```

Postgres and other services drop to their dedicated users at startup.

### 4. Resource Limits

Each service declares CPU and memory limits (prevents DoS):

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
    reservations:
      cpus: '1'
      memory: 512M
```

**Current allocation:**
- **postgres**: 2 CPU / 1GB limit, 1 CPU / 512MB reserved
- **server**: 4 CPU / 2GB limit, 2 CPU / 1GB reserved
- **frontend**: 1 CPU / 512MB limit, 512m / 256MB reserved
- **caddy**: 1 CPU / 256MB limit, 512m / 128MB reserved
- **redis**: 1 CPU / 512MB limit, 500m / 256MB reserved
- **whisper**: 2 CPU / 2GB limit, 1 CPU / 1GB reserved
- **prometheus**: 1 CPU / 512MB limit, 500m / 256MB reserved
- **grafana**: 1 CPU / 512MB limit, 500m / 256MB reserved
- **ocr**: 2 CPU / 2GB limit, 1 CPU / 1GB reserved

Adjust based on your VPS / Kubernetes node capacity.

### 5. No-New-Privileges

```yaml
security_opt:
  - no-new-privileges:true
```

Prevents a process from gaining additional privileges (e.g., via setuid/setgid).

### 6. Health Checks

All services include `healthcheck` directives:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U archive -d archive"]
  interval: 10s
  timeout: 5s
  retries: 5
```

Docker Swarm and Kubernetes respect these for orchestration decisions.

### 7. Secret Validation at Startup

The server validates critical secrets on boot:

```
✗ JWT_SECRET (or JWT_AUTH_SECRET) is required.
✗ ADMIN_PASSWORD is required for ARCHIVE_PUBLIC_DEPLOY=1.
```

Missing required production secrets fail immediately. Generate long random values and do not keep CHANGE_ME placeholders.

## Network Security

### Isolated Bridge Network

```yaml
networks:
  archive:
    driver: bridge
    ipam:
      config:
        - subnet: 10.0.9.0/24
```

- Services communicate on an internal network (10.0.9.0/24)
- **Only** Caddy (reverse proxy) is exposed publicly (ports 80/443)
- Database, Redis, internal APIs are NOT accessible from the host
- Services can reach each other only via internal DNS

### Port Exposure

**Public (via Caddy):**
- 80 (HTTP redirect to HTTPS)
- 443 (HTTPS with Let's Encrypt or self-signed cert)

**Local-only (localhost only):**
- 5050 (pgAdmin UI — bind to 127.0.0.1 only)
- 9090 (Prometheus — bind to 127.0.0.1 only)
- 3000 (Grafana — bind to 127.0.0.1 only)

**Internal network only (no host exposure):**
- 5432 (Postgres)
- 6379 (Redis)
- 8787 (API server)
- 8090 (PocketBase, if used)
- 8000 (Whisper)
- 8788 (OCR)

## Image Security

### Base Image Selection

- **postgres:17-alpine** — minimal, ~90MB
- **node:24-alpine** — minimal, ~165MB
- **nginx:1.29-alpine** — minimal, ~42MB
- **caddy:2.11-alpine** — minimal, ~62MB
- **redis:7-alpine** — minimal, ~49MB
- **prom/prometheus:v3.0.1** — well-maintained, frequently updated
- **grafana/grafana:11.4.0** — upstream maintained

Alpine reduces attack surface and CVE exposure vs. Debian/Ubuntu bases.

### Vulnerability Scanning

Use **Trivy** (aquasec/trivy:latest) manually or integrate it into CI/CD:

```bash
# Scan base images
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity HIGH,CRITICAL postgres:17-alpine
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity HIGH,CRITICAL node:24-alpine
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity HIGH,CRITICAL nginx:1.29-alpine

# Scan built images
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity HIGH,CRITICAL archive-suite-server:latest
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity HIGH,CRITICAL archive-suite-frontend:latest
```

### Minimal Attack Surface

Each Dockerfile:
- Uses multi-stage builds (production stage only includes runtime dependencies)
- Removes unnecessary packages (`apk del apk-tools`)
- Freezes lockfiles (`--frozen-lockfile`) for reproducible builds
- Does not include build tools, dev dependencies, or package managers in the final image

## Environment & Secrets Management

### .env Best Practices

1. **Never commit .env to Git** — add to `.gitignore`
2. **Generate strong secrets** — use `openssl rand -base64 48` or `openssl rand -hex 32`
3. **Rotate secrets regularly** — at least quarterly
4. **Use strong passwords** — minimum 32 characters, include uppercase/lowercase/numbers/symbols
5. **Document required secrets** — see `.env.example` for all required fields

### Secret Rotation (Postgres Backend)

```bash
# 1. Update .env with new POSTGRES_PASSWORD
POSTGRES_PASSWORD=new_strong_password

# 2. Stop the server and bring down the stack
docker compose -f docker-compose.postgres.yml down

# 3. Optionally backup the data
cp -r postgres_data postgres_data.backup

# 4. Update Postgres password (manual SQL or via pgAdmin)
# Or bring up fresh: docker compose -f docker-compose.postgres.yml up -d
# The database will be recreated with the new password

# 5. Restart the stack
docker compose -f docker-compose.postgres.yml up -d
```

## Monitoring & Compliance

### Prometheus Metrics

The stack scrapes metrics from the archive-server (`/metrics` endpoint) every 15 seconds:

```yaml
prometheus:
  image: prom/prometheus:v3.0.1
  volumes:
    - ./deploy/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - prometheus_data:/prometheus
```

Accessible at **http://localhost:9090** (local-only).

### Grafana Dashboards

Pre-configured dashboards track:
- Request latency and error rates
- Database query performance
- Cache hit/miss ratios
- System resource usage (CPU, memory, disk)
- Authentication/authorization events

Accessible at **http://localhost:3000** (local-only).
Default credentials: **admin** / `${GRAFANA_PASSWORD}` (set in .env)

### Security Headers (Caddy + nginx)

**Caddy** (edge):
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy-Report-Only: ...
```

**nginx** (frontend):
```
Cache-Control: no-store, must-revalidate
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
CSP-Report-Only: ...
```

These headers prevent:
- Man-in-the-middle attacks (HSTS)
- MIME-type sniffing
- Clickjacking
- Referrer leakage

## Rate Limiting

The API enforces per-client-IP rate limits:

```env
RATE_LIMIT_RPC_MAX=600         # 600 RPC calls per minute
RATE_LIMIT_LOGIN_MAX=10        # 10 login attempts per minute
RATE_LIMIT_WINDOW_MS=60000     # 60-second sliding window
```

Protects against:
- Brute-force login attacks
- Denial-of-service (resource exhaustion)
- Scraping/automated access

## Data Encryption

### In Transit

- **Caddy** terminates TLS for all external traffic (HTTP redirects to HTTPS)
- **Redis** uses password authentication (no TLS configured; use a VPN or private network in production)
- **Postgres** connects over TCP (set `sslmode=require` in DATABASE_URL for production)

### At Rest

- **Backups** — encrypted with AES-256-CBC (set `BACKUP_ENCRYPTION_KEY` in .env)
- **Database** — Postgres full-disk encryption recommended at the VPS/container storage level
- **Redis** — no built-in encryption; data is plaintext in memory (isolate on private network)
- **Volumes** — use encrypted storage pools if available (e.g., `dm-crypt` on Linux, encrypted RAID on bare metal)

### Sensitive Secrets

- **JWT_AUTH_SECRET, JWT_SHARE_SECRET, OAUTH_STATE_SECRET** — never logged or exposed
- **ADMIN_PASSWORD** — hashed with bcrypt before storage
- **POSTGRES_PASSWORD, REDIS_PASSWORD** — passed only via environment (not logged)
- **API keys (OpenAI, etc.)** — server-side only, never sent to the SPA

## Deployment Checklist

- [ ] Generate strong secrets (32+ chars, mixed case, numbers, symbols)
- [ ] Update `.env` with generated secrets
- [ ] Set `DOMAIN` and `ACME_EMAIL` for HTTPS
- [ ] Point DNS A/AAAA records to the VPS public IP
- [ ] Run `docker compose -f docker-compose.postgres.yml up -d --build`
- [ ] Verify services are running or healthy: `docker compose -f docker-compose.postgres.yml ps`
- [ ] Test HTTPS: curl -I https://DOMAIN (should return 200 OK)
- [ ] Log in to the app and change the initial admin password
- [ ] Verify Prometheus at http://localhost:9090 (from VPS terminal or SSH tunnel)
- [ ] Verify Grafana at http://localhost:3000 (from VPS terminal or SSH tunnel)
- [ ] Set up automated backups (see BACKUP_ENCRYPTION_KEY in .env)
- [ ] Document secret rotation schedule (quarterly or per compliance requirements)

## Kubernetes Deployment

For production multi-node clusters, use the pre-configured Kubernetes manifests in `archive-server/k8s/`:

- **Deployment** (archive-server, archive-frontend)
- **StatefulSet** (postgres, redis)
- **Service** (ClusterIP, LoadBalancer)
- **PVC** (persistent volumes for databases)
- **NetworkPolicy** (isolate services by namespace)
- **PodSecurityPolicy** / **PodSecurityStandards** (enforce non-root, read-only, etc.)

Refer to `archive-server/helm/` for Helm chart deployment.

## Regular Maintenance

1. **Weekly**: Check Prometheus alerts and Grafana dashboards
2. **Monthly**: Review and rotate non-essential secrets
3. **Quarterly**: Rotate critical secrets (POSTGRES_PASSWORD, JWT_*_SECRET)
4. **Quarterly**: Run Trivy vulnerability scans on base images; rebuild if CVEs found
5. **As-needed**: Review audit logs (if enabled) for suspicious activity

## Incident Response

If a secret is compromised:

1. **Immediately rotate** the compromised secret in .env
2. **Rebuild and redeploy** affected services: `docker compose -f docker-compose.postgres.yml up -d --build`
3. **Invalidate sessions** — consider rotating JWT_AUTH_SECRET to log out all users
4. **Audit logs** — check for unauthorized access during the exposure window
5. **Post-incident** — document the root cause and implement preventive measures

## Additional Resources

- **Postgres Security**: https://www.postgresql.org/docs/current/sql-syntax.html
- **Docker Security Best Practices**: https://docs.docker.com/engine/security/
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **CIS Docker Benchmark**: https://www.cisecurity.org/benchmark/docker/
- **Kubernetes Security**: https://kubernetes.io/docs/concepts/security/
