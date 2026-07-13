<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Backup\BackupService;
use Illuminate\Console\Command;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * V1-203: the compose `laravel` service previously ran `migrate --force` on
 * every container start with no preflight, no backup, no maintenance window,
 * and nothing stopping two containers from migrating concurrently. This
 * command replaces that raw call with a safer sequence:
 *
 *   1. Preflight  — skip everything (fast exit 0) when nothing is pending.
 *   2. Backup     — snapshot via BackupService before touching the schema.
 *   3. Maintenance — `down` only while migrations are actually pending.
 *   4. Migrate    — `--isolated` so a second container can't double-run.
 *   5. Recover    — `up` on success; stay down + print rollback steps on
 *      failure, because bringing a half-migrated schema back online is worse
 *      than a visible maintenance page.
 */
class MigrateSafe extends Command
{
    protected $signature = 'archive:migrate-safe {--skip-backup : Skip the pre-migration backup}';

    protected $description = 'Preflight-checked, backed-up, maintenance-windowed migration runner safe for concurrent container starts';

    public function handle(BackupService $backups): int
    {
        $pending = $this->pendingMigrationNames();

        if ($pending === []) {
            $this->components->info('No pending migrations — nothing to do.');

            return self::SUCCESS;
        }

        $this->components->info(sprintf('%d pending migration(s): %s', count($pending), implode(', ', $pending)));

        $backupName = null;

        if ($this->option('skip-backup')) {
            $this->components->warn('Skipping pre-migration backup (--skip-backup).');
        } elseif ($this->isEmptyDatabase()) {
            $this->components->info('Database has no tables yet (first boot) — skipping backup.');
        } else {
            try {
                $backupName = $backups->run()['name'];
                $this->components->info("Pre-migration backup created: {$backupName}");
            } catch (Throwable $e) {
                $this->components->error('Pre-migration backup failed: '.$e->getMessage());
                $this->components->error('Aborted before touching the schema — nothing was migrated.');

                return self::FAILURE;
            }
        }

        // Maintenance only starts here — after a successful (or deliberately
        // skipped) backup, and only because pending migrations exist.
        $this->call('down', $this->downOptions());
        $this->components->warn('Application is now in maintenance mode.');

        $migrationSucceeded = false;

        try {
            $exitCode = $this->runMigration();
            $migrationSucceeded = $exitCode === self::SUCCESS;

            if (! $migrationSucceeded) {
                $this->components->error("migrate exited with status {$exitCode}.");
            }
        } catch (Throwable $e) {
            $this->components->error('Migration threw an exception: '.$e->getMessage());
        } finally {
            // The decision lives here so it's made exactly once, on every
            // path (success, failed exit code, or exception): only lift
            // maintenance mode once the schema is confirmed sane.
            if ($migrationSucceeded) {
                $this->call('up');
                $this->components->info('Migrations applied — application is back online.');
            } else {
                $this->printRollbackInstructions($backupName);
            }
        }

        return $migrationSucceeded ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return list<string>
     */
    private function pendingMigrationNames(): array
    {
        $migrator = app('migrator');
        $paths = array_unique(array_merge($migrator->paths(), [database_path('migrations')]));
        $files = $migrator->getMigrationFiles($paths);
        $ran = $migrator->repositoryExists() ? $migrator->getRepository()->getRan() : [];

        return array_values(array_diff(array_keys($files), $ran));
    }

    private function isEmptyDatabase(): bool
    {
        try {
            return Schema::getTableListing(schemaQualified: false) === [];
        } catch (Throwable) {
            // Can't tell — assume non-empty so we err toward taking a backup.
            return false;
        }
    }

    /**
     * @return array<string, string>
     */
    private function downOptions(): array
    {
        $secret = config('archive.migration_maintenance_secret');

        return $secret ? ['--secret' => $secret] : [];
    }

    private function runMigration(): int
    {
        $canIsolate = Cache::getStore() instanceof LockProvider;

        if (! $canIsolate) {
            $this->components->warn(sprintf(
                'Cache store [%s] does not support atomic locks — running migrate without --isolated. '
                .'Concurrent containers are not protected against a double-run.',
                config('cache.default')
            ));
        }

        $options = ['--force' => true];

        if ($canIsolate) {
            $options['--isolated'] = true;
        }

        return $this->call('migrate', $options);
    }

    private function printRollbackInstructions(?string $backupName): void
    {
        $this->components->error('Application left in maintenance mode — do not run `php artisan up` until the schema is confirmed sane.');

        if ($backupName !== null) {
            $this->components->error('Rollback:');
            $this->line("    php artisan tinker --execute=\"app(\\App\\Services\\Backup\\BackupService::class)->restore('{$backupName}')\"");
            $this->line('    php artisan up');
        } else {
            $this->components->error(
                'No pre-migration backup was taken (empty database or --skip-backup). '
                .'Fix the migration or restore from your own snapshot, then run: php artisan up'
            );
        }
    }
}
