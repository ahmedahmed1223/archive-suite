# Archive Suite — Docker Deployment with Security Hardening

## Overview

The Archive Suite is now deployed with **production-ready security hardening**:

- ✓ **All optional services enabled by default** (Redis, Whisper, Prometheus, Grafana, pgAdmin, OCR)
- ✓ **Capability dropping** — containers drop ALL capabilities, add only what's needed
- ✓ **Read-only root filesystems** — prevents unauthorized modifications
- ✓ **Least-privilege execution** — application images use unprivileged users and services drop Linux capabilities
- ✓ **Resource limits** — CPU and memory quotas per service prevent DoS
- ✓ **Health checks** — core runtime services include startup and liveness probes
- ✓ **Required secret validation** — startup fails when required production secrets are missing
- ✓ **Isolated network** — services communicate on internal bridge (10.0.9.0/24)
- ✓ **Security headers** — HSTS, CSP, X-Frame-Options, etc.

## Quick Start

### Prerequisites

- Docker & Docker Compose (v2.20+)
- A domain name (for HTTPS via Let's Encrypt) or use `localhost` for self-signed cert
- 8+ GB RAM and 50 GB disk for a typical setup

### 1. Clone and Setup

```bash
cd archive-server
cp .env.example .env
```

### 2. Generate and Set Strong Secrets

```bash
# Generate JWT secrets (use 3 different ones for better security)
openssl rand -base64 48 > jwt_auth.txt
openssl rand -base64 48 > jwt_share.txt
openssl rand -base64 48 > oauth_state.txt

# Generate password and backup encryption key
openssl rand -base64 32 > postgres_pass.txt
openssl rand -base64 32 > redis_pass.txt
openssl rand -base64 32 > admin_pass.txt
openssl rand -hex 32 > backup_key.txt

# Edit .env and insert values (marked CHANGE_ME_*)
nano .env
```

### 3. Set Environment Variables

Critical variables to update:

```env
# Domain setup
DOMAIN=your-domain.com
ACME_EMAIL=admin@your-domain.com

# Database
POSTGRES_PASSWORD=<paste from postgres_pass.txt>

# Authentication (use 3 separate secrets for better security)
JWT_AUTH_SECRET=<paste from jwt_auth.txt>
JWT_SHARE_SECRET=<paste from jwt_share.txt>
OAUTH_STATE_SECRET=<paste from oauth_state.txt>

# Admin user (change IMMEDIATELY after first login)
ADMIN_PASSWORD=<paste from admin_pass.txt>

# Cache & Search
REDIS_PASSWORD=<paste from redis_pass.txt>

# Persistent file storage inside the server container
DOCKER_FILE_STORE_DIR=/app/files

# UI Management Tools
PGADMIN_EMAIL=admin@your-domain.com
PGADMIN_PASSWORD=<generate strong password>
GRAFANA_PASSWORD=<generate strong password>

# Backup encryption (optional but recommended)
BACKUP_ENCRYPTION_KEY=<paste from backup_key.txt>
```

### 4. Deploy

```bash
# Build and start all services
docker compose -f docker-compose.postgres.yml up -d --build

# Verify services are running or healthy
docker compose -f docker-compose.postgres.yml ps

# Watch logs
docker compose -f docker-compose.postgres.yml logs -f server
```

### 5. Verify Deployment

```bash
# Check service status (health-checked services should be healthy)
docker compose -f docker-compose.postgres.yml ps

# Test HTTPS (should return 200 OK)
curl -I https://your-domain.com

# Check API health
curl https://your-domain.com/api/health

# View server logs for any errors
docker compose -f docker-compose.postgres.yml logs server
```

## Services

All services are now **enabled by default** (no profiles needed):

| Service | Port | Access | Purpose |
|---------|------|--------|---------|
| **Caddy** | 80, 443 | Public | Reverse proxy + TLS termination |
| **Frontend** | internal | Via Caddy | React SPA |
| **Server** | 8787 | Internal | API & authentication |
| **Postgres** | 5432 | Internal | Database backend |
| **Redis** | 6379 | Internal | Caching + search |
| **Whisper** | 8000 | Internal | Speech-to-text transcription |
| **pgAdmin** | 5050 | Local (127.0.0.1) | Database UI |
| **Prometheus** | 9090 | Local (127.0.0.1) | Metrics collection |
| **Grafana** | 3000 | Local (127.0.0.1) | Dashboards & alerts |
| **OCR** | 8788 | Internal | Arabic/multilingual text extraction |

### Access URLs

- **Public**: https://your-domain.com (SPA + API)
- **Local** (SSH tunnel recommended):
  - pgAdmin: http://localhost:5050
  - Prometheus: http://localhost:9090
  - Grafana: http://localhost:3000

## Security Features

### 1. Capability Dropping

Each container explicitly declares minimal Linux capabilities:

```yaml
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE  # Only for services that bind ports
```

### 2. Read-Only Root Filesystem

Production containers use ephemeral tmpfs for temporary data:

```yaml
read_only: true
tmpfs:
  - /tmp
  - /var/run
  - /var/cache/nginx
```

### 3. No-New-Privileges

```yaml
security_opt:
  - no-new-privileges:true
```

Prevents privilege escalation via setuid/setgid binaries.

### 4. Resource Limits

Each service declares CPU and memory quotas:

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

### 5. Health Checks

All services include startup and liveness probes:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U archive -d archive"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### 6. Isolated Network

Services communicate on an internal bridge network (10.0.9.0/24). Only Caddy is exposed publicly.

### 7. Security Headers

- **HSTS** (Strict-Transport-Security)
- **X-Content-Type-Options: nosniff**
- **X-Frame-Options: SAMEORIGIN**
- **CSP-Report-Only** (Content Security Policy)
- **Referrer-Policy: strict-origin-when-cross-origin**

## Monitoring & Logging

### Prometheus Metrics

Scraped every 15 seconds from the archive-server (`/metrics` endpoint):

```bash
# Access Prometheus dashboard (local-only)
ssh -L 9090:localhost:9090 user@your-domain.com
# Then open: http://localhost:9090
```

### Grafana Dashboards

Pre-configured dashboards track:
- Request latency and error rates
- Database query performance
- Cache hit/miss ratios
- System resource usage

```bash
# Access Grafana (local-only)
ssh -L 3000:localhost:3000 user@your-domain.com
# Then open: http://localhost:3000
# Login: admin / <GRAFANA_PASSWORD from .env>
```

### Application Logs

```bash
# View server logs
docker compose -f docker-compose.postgres.yml logs -f server

# View frontend logs
docker compose -f docker-compose.postgres.yml logs -f frontend

# View Postgres logs
docker compose -f docker-compose.postgres.yml logs -f postgres

# View all logs
docker compose -f docker-compose.postgres.yml logs -f
```

## Development

For local development with hot reload:

```bash
# Use the dev override (HTTP-only, exposes ports)
docker compose -f docker-compose.postgres.yml \
  -f docker-compose.dev.yml \
  up -d --build

# Access the app
# - Frontend: http://localhost:8080
# - pgAdmin: http://localhost:5050
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3000
```

## Backups

Automated backups are enabled by default and stored in `archive-server/backups/`:

```env
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=7
BACKUP_RETENTION_WEEKS=4
BACKUP_RETENTION_MONTHS=3
BACKUP_ENCRYPTION_KEY=<strong key>
```

### Manual Backup

```bash
# Create a manual snapshot
docker compose -f docker-compose.postgres.yml exec server \
  pnpm --filter archive-server run backup:create

# List backups
ls -lh archive-server/backups/

# Restore from backup (offline operation)
docker compose -f docker-compose.postgres.yml down
# ... edit backup file or restore database ...
docker compose -f docker-compose.postgres.yml up -d
```

## Database Migrations

Migrations run automatically at server startup:

```bash
# Manual migration (if needed)
docker compose -f docker-compose.postgres.yml exec server \
  pnpm --filter archive-server run prisma:migrate

# View migration status
docker compose -f docker-compose.postgres.yml exec server \
  pnpm --filter archive-server run prisma:status
```

## Troubleshooting

### Services not starting?

```bash
# Check service status
docker compose -f docker-compose.postgres.yml ps

# View logs for specific service
docker compose -f docker-compose.postgres.yml logs postgres
docker compose -f docker-compose.postgres.yml logs server

# Restart a service
docker compose -f docker-compose.postgres.yml restart server
```

### Database connection issues?

```bash
# Check if postgres is healthy
docker compose -f docker-compose.postgres.yml exec postgres \
  pg_isready -U archive -d archive

# Reset database (WARNING: deletes all data)
docker compose -f docker-compose.postgres.yml down -v
docker compose -f docker-compose.postgres.yml up -d
```

### Redis not connecting?

```bash
# Verify Redis is running
docker compose -f docker-compose.postgres.yml exec redis \
  redis-cli -a "$REDIS_PASSWORD" ping

# Check connection string in .env
echo $REDIS_URL
```

### API not responding?

```bash
# Check server health endpoint
curl https://your-domain.com/api/health

# Check server logs
docker compose -f docker-compose.postgres.yml logs -f server

# Verify API port is accessible
docker compose -f docker-compose.postgres.yml exec frontend \
  curl -I http://server:8787/api/health
```

## Kubernetes Deployment

For production multi-node clusters, see `archive-server/k8s/` for:

- Deployment manifests (archive-server, archive-frontend)
- StatefulSets (postgres, redis)
- Services (ClusterIP, LoadBalancer)
- PersistentVolumeClaims
- NetworkPolicies
- PodSecurityPolicies

Or use the Helm chart in `archive-server/helm/`:

```bash
helm install archive-suite ./archive-server/helm \
  --set domain=your-domain.com \
  --set postgresPassword=$(openssl rand -base64 32) \
  ...
```

## Security

For detailed security configuration, best practices, and hardening checklist, see **[SECURITY.md](./SECURITY.md)**.

Key points:
- Required production secrets must be set before exposing the stack
- Generate long random secrets (32+ chars recommended); do not keep CHANGE_ME placeholders
- Rotate critical secrets (POSTGRES_PASSWORD, JWT_*_SECRET) quarterly
- Run Trivy vulnerability scans on base images regularly
- Keep Docker and base images up-to-date

## Performance Tuning

Adjust resource limits based on your workload:

```yaml
# In docker-compose.postgres.yml, adjust per service:
deploy:
  resources:
    limits:
      cpus: '4'        # Increase for high-throughput workloads
      memory: 2G       # Increase for large datasets
    reservations:
      cpus: '2'        # Reserve for guaranteed availability
      memory: 1G
```

## Support & Issues

- **Documentation**: See `archive-server/README.md` and `archive-server/AGENTS.md`
- **Issues**: Report bugs on GitHub with logs from `docker compose logs`
- **Security vulnerabilities**: Email security@example.com (do not open public issues)

---

**Archive Suite** — Intelligent Media Archival Platform. Containerized, hardened, and production-ready.
