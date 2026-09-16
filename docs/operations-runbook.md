# Operations runbook

[العربية](operations-runbook.ar.md) · [Admin guide](admin-guide.md) ·
[Restore plan](restore-plan.md)

What an operator needs to keep version 2 running: how it comes up, what to
check daily, and what to do at the first sign of trouble. Every procedure here
comes from a command or route that exists in this repository, not from general
practice.

## Runtime topology

Docker is the supported path. `infra/docker-compose.release.yml` describes nine
services:

| Service | Role | If it is down |
| --- | --- | --- |
| `postgres` | Database | Everything stops |
| `redis` | Sessions, cache, broadcasting | Sessions and live updates degrade |
| `laravel-fpm` | API request handling | The app stops answering |
| `laravel` | Application server | As above |
| `laravel-worker` | Media queue: probe, QC, derivatives, transcription | Uploads are accepted and never processed |
| `laravel-reverb` | Live broadcasting | Panels fall back to polling |
| `next` | User interface | No interface |
| `ocr` | Text extraction from images and documents | OCR jobs sit in the queue |
| `caddy` | Front door and TLS | No external access |

**`laravel-worker` is the one that is easy to forget.** Uploads succeed without
it and look healthy: the record is created, and probe, QC and the proxy never
arrive. Its absence reads as slowness, not as an outage.

## Health checks

- `GET /api/v1/health` — the deep check the Compose healthchecks use.
- `GET /api/v1/system/services` — state of ffmpeg, ffprobe, whisper, Reverb,
  GPU and the storage connectors. The UI shows it on `/media/jobs`.
- `GET /api/v1/system/dr-probe` — restore readiness (admin only). See the
  [restore plan](restore-plan.md).

## Scheduled work

Run by `php artisan schedule:work` inside the application container:

| Command | Cadence | Purpose |
| --- | --- | --- |
| `uploads:dispatch-scheduled` | every minute | Release due scheduled uploads |
| `uploads:recover-scheduled` | every 5 minutes | Reclaim uploads stranded by a lost worker |
| `tasks:check-escalations` | every 15 minutes | Escalate overdue tasks |
| `metrics:capture` | hourly | The sample the storage forecast is built from |
| `uploads:cleanup-scheduled` | hourly | Clear upload leftovers |
| `sessions:prune`, `audit:prune`, `metrics:prune`, `trash:prune`, `media:prune-jobs` | daily | Trim expired data |
| `audit:verify-chain` | daily | Verify the audit log chain |
| `files:verify-integrity` | daily | Re-check file checksums |
| `archive:backup-run` | daily 03:00 | Create the backup |
| `backup:cleanup` | daily 04:00 | Delete backups past the retention window |

Creation runs an hour before the sweep, deliberately. Before 2026-09-16 only
the sweep was scheduled — retention ran against backups nothing was creating,
so RPO stayed unbounded on any install that had not added its own cron.

## Daily routine

1. Open `/status` and confirm the queues are not backing up.
2. Open `/media/jobs` and read the service status panel: anything `down` or
   `requires_setup` is a disabled capability, not a passing blip.
3. Open `/errors` and work the actionable failures. A failed job is
   reprocessed from that page when the operation accepts a retry.
4. Confirm a backup exists from the last 24 hours:
   `php artisan archive:backup-list --json`.

## Operating commands

Run inside the application container (`docker compose exec laravel …`):

```
php artisan archive:backup-run --json        # back up now
php artisan archive:backup-list --json       # available backups
php artisan archive:backup-verify <name>     # check one backup's integrity
php artisan dr:report                        # RPO/RTO report
php artisan files:verify-integrity --json    # re-check file checksums
php artisan audit:verify-chain --json        # audit chain integrity
php artisan archive:migrate-safe             # migrate behind a fresh backup
```

`archive:migrate-safe` takes a backup first, leaves maintenance mode on and
exits non-zero if the migration fails — use it instead of bare `migrate` when
upgrading.

`backup:dr-drill` is deliberately not in that list: it restores over the
current database and belongs on a disposable copy. See the
[restore plan](restore-plan.md).

## Common symptoms

| Symptom | First check | Usual cause |
| --- | --- | --- |
| Upload succeeds, no proxy appears | `docker compose ps laravel-worker` | Worker stopped, or the queue is not being consumed |
| Every share or export is refused | `GET /api/v1/rights/{itemId}/enforcement` | No rights window covers the usage — refusal is the designed default |
| Service status panel empty or refused | The user's session and role | The page needs an admin session |
| Transcript never matches a search | The transcript's format | Timed search reads VTT cues with timing lines only |
| "No permission" on an admin page | The user's role | A permission boundary, not a fault; retrying will not change it |

## Pre-release gates

```
pnpm verify                      # contracts, types, build, hygiene, Laravel and Next tests
pnpm verify:laravel-next:live    # Playwright against a live Laravel and Next
pnpm release:verify              # the above plus installers, security and release-doc readiness
```

The intake-to-approval live acceptance needs a real media processor:

```
MEDIA_PROCESSOR=real ARCHIVE_E2E_SPECS=e2e/v2-release-acceptance.authed.spec.ts pnpm verify:laravel-next:live
```
