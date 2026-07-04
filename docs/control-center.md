# Masar Control Center

A single English-first console to **install, operate, configure, and maintain** the
canonical Masar stack (**Laravel API + Next.js**, `archive-server/docker-compose.yml`).
The **Deploy** action provisions `.env` secrets and runs `docker compose up -d --build`;
the old Node/Vite deployment wizard remains available as the explicit `deploy-legacy` command.

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
| **Quick** | Quick start · First-run guide · Doctor | `quick` `first-run` `doctor` |
| **Deploy** | Deploy / Re-provision (Laravel + Next.js) | `deploy` |
| **Server** | Status · Start · Stop · Restart · Logs · Health | `status` `start` `stop` `restart` `logs` `health` |
| **Configure** | View configuration · Edit a setting · Set public URL | `config` `set-url` |
| **Security** | Generate password · Change admin password · Rotate Reverb secrets | `generate-password` `change-admin-password` `rotate-secrets` |
| **Database** | Migration status (artisan) · Apply migrations (artisan) | `migrate-status` `migrate` |
| **Backups** | Backup now · List backups · Restore backup | `backup` `backups` `restore` |
| **Maintain** | Diagnostics (`pnpm verify`) · Update & rebuild | `diagnostics` `update` |
| **Legacy** | Legacy deploy wizard · admin · Prisma · DB provider | `deploy-legacy` `legacy:set-admin` `legacy:migrate-status` `legacy:migrate` `legacy:db-provider` |
| — | Help | `help` |

### Examples

```bash
node scripts/control-center.mjs status      # show running services
node scripts/control-center.mjs health      # probe /api/v1/health (Laravel, proxied through Next :3000)
node scripts/control-center.mjs backup      # pg_dump to archive-server/backups/
node scripts/control-center.mjs update      # pull -> install -> build -> docker compose up -d --build
node scripts/control-center.mjs generate-password
node scripts/control-center.mjs change-admin-password --generate
node scripts/control-center.mjs change-admin-password --email=admin@example.com --password=New-Strong-Password-123
```

## Safety

- **Every `.env` write is backed up first** to `archive-server/.env.bak-<timestamp>`.
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

- Node 22+ and Docker (with Compose v2 `docker compose`, or legacy `docker-compose`).
- Reads `archive-server/.env`; controls `archive-server/docker-compose.yml` (canonical
  Laravel + Next.js stack). For the HTTP-only dev variant run
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` from `archive-server/`.
- Backups live in `archive-server/backups/archive-<timestamp>.sql`.

## Notes

- Cross-platform: the `.bat`/`.sh` are thin launchers around one Node core
  (`scripts/control-center.mjs`).
- Tests: `node --test scripts/control-center.test.mjs` (menu render, router, masked
  config, empty-state guidance).
- User account management (create/disable users) is done in-app on the **Users** admin
  page; the console covers operator-level credentials, first-login password recovery,
  and secret rotation.
