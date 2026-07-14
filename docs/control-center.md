# Masar Control Center

A single English-first console to **install, operate, configure, and maintain** the
canonical Masar stack (**Laravel API + Next.js**, `infra/docker-compose.yml`).
The **Deploy** action provisions `.env` secrets and runs `docker compose up -d --build`
against that canonical Compose file.

## Launch

| Platform | Command |
|----------|---------|
| Windows  | double-click `Setup-Archive.bat`, or `Setup-Archive.bat <command>` |
| Linux / macOS | `bash setup.sh`, or `bash setup.sh <command>` |
| Any      | `pnpm control`, or `node scripts/control-center.mjs [command]` |

With no argument it opens the interactive menu. With a command it runs that action
non-interactively (good for automation / scheduled tasks).

The interactive menu uses one start path: **1 = Quick start**. Both **0** and
**q** exit, so `q` is no longer a deploy/start shortcut.

## Capabilities

| Group | Menu options | Non-interactive command |
|-------|--------------|-------------------------|
| **Quick** | Guided setup (wizard) · Quick start · First-run guide · Doctor | `wizard` `quick` `first-run` `doctor [--mode=docker\|native] [--platform=<id>]` |
| **Deploy** | Deploy / Re-provision (Laravel + Next.js) | `deploy` |
| **Server** | Status · Start · Stop · Restart · Logs · Health | `status` `start` `stop` `restart` `logs` `health` |
| **Configure** | View configuration · Edit a setting · Set public URL | `config` `set-url` |
| **Security** | Generate password · Change admin password · Rotate Reverb secrets | `generate-password` `change-admin-password` `rotate-secrets` |
| **Database** | Migration status (artisan) · Apply migrations (artisan) | `migrate-status` `migrate` |
| **Backups** | Backup now · List backups · Restore backup | `backup` `backups` `restore` |
| **Maintain** | Diagnostics (`pnpm verify`) · Update & rebuild | `diagnostics` `update` |
| — | Help | `help` |

### Examples

```bash
node scripts/control-center.mjs status      # show running services
node scripts/control-center.mjs health      # probe /api/v1/health (Laravel, proxied through Next :3000)
node scripts/control-center.mjs backup      # pg_dump to infra/backups/
node scripts/control-center.mjs update      # pull -> install -> build -> docker compose up -d --build
node scripts/control-center.mjs generate-password
node scripts/control-center.mjs change-admin-password --generate
node scripts/control-center.mjs change-admin-password --email=admin@example.com --password=New-Strong-Password-123
```

## Profiles: core / media / edge

`infra/docker-compose.yml` and `infra/docker-compose.laravel-next.yml` use native Compose
`profiles:` to let operators run a lighter stack:

| Profile | Services | When you need it |
|---------|----------|-------------------|
| core (no profile) | postgres · redis · laravel · laravel-fpm · laravel-worker · laravel-reverb · next | Always on |
| `media` | ocr | OCR jobs (heavy PaddleOCR image). Without it, OCR media jobs fail with a job-level error — the stack still boots fine, since `laravel-fpm`/`laravel-worker` only call the OCR service lazily per-job, never at startup |
| `edge` | caddy (`docker-compose.yml` only) | Public TLS termination |

Control Center starts the core stack by default. The Setup wizard records an explicit
optional selection in `ARCHIVE_COMPOSE_PROFILES`; a shell value (comma-separated) overrides
it for one command. `media` enables optional media processing/OCR and its resource burden;
`edge` enables public TLS termination. Capabilities such as `ocr` and `ai` are never Docker
Compose profiles:

```bash
node scripts/control-center.mjs start                              # core only
ARCHIVE_COMPOSE_PROFILES=media node scripts/control-center.mjs start  # core + OCR, no Caddy
```

## Safety

- **Every `.env` write is backed up first** to `infra/.env.bak-<timestamp>`.
- **Secrets are masked** in `config` output (any key ending in `SECRET`, `PASSWORD`,
  `TOKEN`, `KEY`, `DSN`, `URL`).
- **Restore is destructive** — it overwrites the current database and requires an
  explicit `y` confirmation.
- **Rotate secrets** regenerates `REVERB_APP_KEY`/`REVERB_APP_SECRET` — realtime clients
  drop and the Next.js image must be rebuilt (`deploy` or `update`). `LARAVEL_APP_KEY` is
  never rotated automatically because that invalidates encrypted data.
- **Change admin password** updates `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`, backs the
  file up first, and applies the password to the existing Laravel user when the `laravel`
  service is running. Use `--env-only` to skip the live database update.
- Most config/security changes take effect after **Server: restart**.

## Requirements

- Node 22+ and Docker with Compose v2 (`docker compose`).
- Reads `infra/.env`; controls `infra/docker-compose.yml` (the canonical
  Laravel + Next.js stack).
- Backups live in `infra/backups/archive-<timestamp>.sql`.

## Notes

- Cross-platform: the `.bat`/`.sh` are thin launchers around one Node core
  (`scripts/control-center.mjs`).
- Tests: `node --test scripts/control-center.test.mjs` (menu render, router, masked
  config, empty-state guidance).
- User account management (create/disable users) is done in-app on the **Users** admin
  page; the console covers operator-level credentials, first-login password recovery,
  and secret rotation.
