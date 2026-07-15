<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * V1-731: retention for the trash. Deletes trashed_records entries whose
 * deleted_at is older than config('archive.trash_retention_days')
 * (default 30 — a recycle bin is an undo window, not an archive; the record
 * itself is already gone from storage_rows, and backups are the long-term
 * recovery story, not this table).
 */
class TrashPruneCommand extends Command
{
    protected $signature = 'trash:prune';

    protected $description = 'Permanently delete trashed records older than the configured retention window';

    public function handle(): int
    {
        $days = (int) config('archive.trash_retention_days', 30);
        $cutoff = now()->subDays($days);

        $deleted = DB::table('trashed_records')->where('deleted_at', '<', $cutoff)->delete();

        $this->info("Pruned {$deleted} trashed record(s) older than {$days} days.");

        return 0;
    }
}
