# Deploy Archive Suite on a Hostinger VPS

[العربية](hostinger-vps.ar.md) · [Documentation](../../docs/README.md)

This guide deploys the supported Laravel and Next.js stack from
`infra/docker-compose.yml` through Control Center.

## Requirements

- Ubuntu 24.04 LTS or another supported Linux distribution.
- Docker Engine with Compose v2, Node.js 22.13 or newer, and pnpm.
- A domain whose DNS record points to the VPS for public deployment.

## 1. Prepare the host

Create a non-root operator account and expose only SSH, HTTP, and HTTPS:

```bash
sudo adduser archive
sudo usermod -aG sudo archive
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

Install Docker Engine from its official repository, add the operator to the
Docker group, sign in again, and confirm that `docker compose version` works.

## 2. Install and deploy

```bash
git clone https://github.com/ahmedahmed1223/archive-suite.git
cd archive-suite
pnpm install --frozen-lockfile
pnpm setup
```

Control Center creates `infra/.env`, replaces default secrets with strong
values, and starts the supported Compose stack. Store the administrator
password shown during the first run in a password manager.

For non-interactive provisioning:

```bash
node scripts/control-center.mjs deploy
```

## 3. Configure the domain and verify

```bash
node scripts/control-center.mjs set-url
node scripts/control-center.mjs deploy
node scripts/control-center.mjs health
```

Set DNS before making the service public. Caddy obtains and renews TLS
certificates when the domain reaches ports 80 and 443 on this host.

## Operate and maintain

Use Control Center for routine operations:

```bash
node scripts/control-center.mjs status
node scripts/control-center.mjs logs
node scripts/control-center.mjs backup
node scripts/control-center.mjs update
```

See the [deployment guide](../../DEPLOYMENT.md) and
[Control Center reference](../../docs/control-center.md) for restoration,
configuration, and update procedures.
