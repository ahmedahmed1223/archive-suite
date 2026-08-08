# Deploy Masar with Docker

[العربية](DEPLOYMENT.md) · [Documentation](docs/README.md)

Deploy the Laravel + Next.js stack through Control Center and
`infra/docker-compose.yml`.

## Before you deploy

- Install Docker with Compose v2.
- Install Node.js `26.5.0` and pnpm `11.9.0` when running Control Center from
  source.
- For public access, prepare a DNS record for the server and an email address
  for TLS certificates.

## First run

Start with a read-only pre-flight check, then use the guided setup:

```bash
node scripts/control-center.mjs doctor
node scripts/control-center.mjs wizard
```

`wizard` lets an operator choose a local source build, an online release, or an
offline bundle. `quick` deploys and performs a health check in one step. The
lower-level `deploy` command provisions missing secrets in `infra/.env` and
starts the Compose stack.

```bash
node scripts/control-center.mjs quick
# or
node scripts/control-center.mjs deploy
node scripts/control-center.mjs health
```

## Operate safely

Use Control Center for status, logs, backup, update, and restore. Verify a
backup before restoring it; `restore` rejects a checksum-mismatched archive.
Public deployment requires the appropriate `.env` values, including a real
domain and `ARCHIVE_PUBLIC_DEPLOY=1`. See the [Control Center reference](docs/control-center.md)
and [operations guide](docs/ops/rc-launch-and-support.en.md).
