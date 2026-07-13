<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

/**
 * V1-123: retention for the audit_logs table. Deletes entries older than
 * config('archive.audit_log_retention_days') (default 365 — audit_logs is
 * the compliance trail, so the default is generous, not operational-log
 * short).
 */
class AuditPruneCommand extends Command
{
    protected $signature = 'audit:prune';

    protected $description = 'Delete audit log entries older than the configured retention window';

    public function handle(): int
    {
        $days = (int) config('archive.audit_log_retention_days', 365);
        $cutoff = now()->subDays($days);

        $deleted = AuditLog::query()->where('created_at', '<', $cutoff)->delete();

        $this->info("Pruned {$deleted} audit log entr(y/ies) older than {$days} days.");

        return 0;
    }
}
