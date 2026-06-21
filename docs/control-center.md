# Archive Control Center

A single English-first console to **install, operate, configure, and maintain** the
Archive Suite stack. It replaces the old one-shot setup launcher — the deployment
wizard is now just the **Deploy** action inside it.

## Launch

| Platform | Command |
|----------|---------|
| Windows  | double-click `Setup-Archive.bat`, or `Setup-Archive.bat <command>` |
| Linux / macOS | `bash setup.sh`, or `bash setup.sh <command>` |
| Any      | `pnpm control`, or `node scripts/control-center.mjs [command]` |

With no argument it opens the interactive menu. With a command it runs that action
non-interactively (good for automation / scheduled tasks).

## Capabilities

| Group | Menu options | Non-interactive command |
|-------|--------------|-------------------------|
| **Deploy** | Deploy / Re-provision | `deploy` |
| **Server** | Status · Start · Stop · Restart · Logs · Health | `status` `start` `stop` `restart` `logs` `health` |
| **Configure** | View configuration · Edit a setting · Set public URL | `config` `set-url` |
| **Security** | Set admin credentials · Rotate secrets | `set-admin` `rotate-secrets` |
| **Database** | Migration status · Apply migrations · Switch DB provider | `migrate-status` `migrate` `db-provider` |
| **Backups** | Backup now · List backups · Restore backup | `backup` `backups` `restore` |
| **Maintain** | Diagnostics (verify) · Update & rebuild | `diagnostics` `update` |
| — | Help | `help` |

### Examples

```bash
node scripts/control-center.mjs status      # show running services
node scripts/control-center.mjs health      # probe /api/health
node scripts/control-center.mjs backup      # pg_dump to archive-server/backups/
node scripts/control-center.mjs update      # pull -> install -> build:cloud -> migrate -> restart
```

## Safety

- **Every `.env` write is backed up first** to `archive-server/.env.bak-<timestamp>`.
- **Secrets are masked** in `config` output (any key ending in `SECRET`, `PASSWORD`,
  `TOKEN`, `KEY`, `DSN`, `URL`).
- **Restore is destructive** — it overwrites the current database and requires an
  explicit `y` confirmation.
- **Rotate secrets** invalidates existing sessions / share links / OAuth state — users
  must sign in again, and the stack must be restarted.
- Most config/security changes take effect after **Server: restart**.

## Requirements

- Node 22+ and Docker (with Compose v2 `docker compose`, or legacy `docker-compose`).
- Reads `archive-server/.env`; controls `archive-server/docker-compose.postgres.yml`.
- Backups live in `archive-server/backups/archive-<timestamp>.sql`.

## Notes

- Cross-platform: the `.bat`/`.sh` are thin launchers around one Node core
  (`scripts/control-center.mjs`).
- Tests: `node --test scripts/control-center.test.mjs` (menu render, router, masked
  config, empty-state guidance).
- User account management (create/disable users) is done in-app on the **Users** admin
  page; the console covers operator-level credentials and secret rotation.
