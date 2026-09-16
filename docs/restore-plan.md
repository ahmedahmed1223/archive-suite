# Restore plan

[العربية](restore-plan.ar.md) · [Operations runbook](operations-runbook.md)

What a backup protects, how to restore it, and how the loss is actually
measured. Every number here is read from the system's own state rather than
assumed.

## What a backup contains

`php artisan archive:backup-run` writes `backup-<timestamp>.json.gz` with a
`.sha256` sidecar beside it. The archive is **self-contained**: database rows
**and file content** together, streamed off disk one file at a time so only a
single chunk is ever resident however large the archive grows. With encryption
enabled the archive is encrypted and stays streamable and verifiable.

The practical consequence: restoring one archive brings back both the data and
the media. No separate object-storage snapshot is needed to complete a restore.

## What stops a corrupt restore

Before any live data is touched:

1. **Whole-archive gate.** If a `.sha256` sidecar exists and does not match,
   the restore aborts and live data is untouched. A sidecar that is present but
   wrong means the file was corrupted or tampered with after it was written,
   and that always aborts.
2. **Per-file gate.** Every file's checksum is verified before it is written.
3. **Legacy archives.** Archives written before the sidecar existed restore on
   the structural validation instead and are flagged unverified rather than
   refused — refusing them would have bricked every historical restore.

The database write runs inside a transaction with a pre-restore snapshot.
Filesystem writes are necessarily outside it: a filesystem does not roll back.

## Procedure

```
# 1. What is available, and which is newest
php artisan archive:backup-list --json

# 2. Verify before deciding anything
php artisan archive:backup-verify backup-2026-09-16T03-00-00-000000.json.gz

# 3. Preview what would come back (stores and record counts), applying nothing
#    POST /api/v1/system/backups/preview  {"name": "..."}

# 4. Restore — destructive, and --force is the explicit consent
php artisan archive:backup-restore backup-2026-09-16T03-00-00-000000.json.gz --force

# 5. Prove the outcome
php artisan files:verify-integrity --json
php artisan audit:verify-chain --json
```

Restore is also available at `POST /api/v1/system/backups/restore` for an
admin, and the outcome — success or failure — is recorded as a notification to
the account that ran it.

## Measuring RPO and RTO

- **RPO** is measured directly: the age of the most recent successful backup,
  i.e. "if we lost the database now, this is the most we would lose". No backup
  yet means **unbounded** exposure, never zero.
- **RTO** comes from the duration of the last real restore drill
  (`backup:dr-drill`). Before the first drill it is reported explicitly as
  not-yet-measured rather than as an invented figure.

```
php artisan dr:report                 # RPO, RTO, and the source of each
php artisan backup:dr-drill --force   # disposable environments only
```

> **The drill is a real restore over the current database.** There is no way
> to measure a restore's duration without performing one. The command
> therefore requires `--force`, the endpoint requires `"confirm": true`, and
> neither belongs on production. Measure RTO on a copy of production, not on
> production.

`GET /api/v1/system/dr-probe` (admin) returns `lastBackupAt`,
`lastBackupName`, `lastRestoreTestAt`, `lastRestoreTestOk` and `rpoHours`.

## Prerequisites before launch

1. **Confirm the scheduler is actually running.** `archive:backup-run` is now
   scheduled daily at 03:00 (before 2026-09-16 only the sweep was), but a
   schedule is worthless if `php artisan schedule:work` is not up — check that
   `dr-probe`'s `lastBackupAt` really advances.
2. **Run `backup:dr-drill --force` once, on a copy of production.** Until then
   RTO is meaningless, and there is no evidence that restore works on this
   environment at all.
3. **Keep a copy off the machine.** Backups are written to the same disk they
   protect; losing the host loses them with it.
4. **Confirm `dr-probe` reports `lastRestoreTestOk` true** and an `rpoHours`
   the owner accepts.

## If a restore fails

- **Checksum gate failed:** live data was not touched. Try the previous archive
  after `archive:backup-verify`.
- **Failure partway through file writes:** the database is restored and the
  files partially. `files:verify-integrity --json` names what is missing or
  mismatched; re-run the restore from the same archive, since file writes are
  idempotent per path.
- **Archive with no sidecar:** it restores and logs an "integrity unverified"
  warning. Treat it as a restore that still needs verification, not as a
  trusted one.
