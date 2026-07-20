<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\ScheduledUpload;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * V1-712 Task 4: retention for terminal (cancelled/failed) scheduled_uploads
 * rows, mirroring MediaJobsPruneCommand's shape. 'scheduled'/'claimed'/
 * 'processing' rows are never in scope (excluded by the status filter
 * alone); 'completed' rows are excluded too -- they're the audit trail for a
 * created record, not clutter, and have no configured retention window.
 */
class CleanupScheduledUploads extends Command
{
    protected $signature = 'uploads:cleanup-scheduled';

    protected $description = 'Delete terminal (cancelled/failed) scheduled_uploads rows past their retention window.';

    public function handle(): int
    {
        $deleted = $this->pruneStatus('cancelled', (int) config('scheduled-uploads.cancelled_retention_hours', 24));
        $deleted += $this->pruneStatus('failed', (int) config('scheduled-uploads.failed_retention_hours', 168));

        $this->info("Pruned {$deleted} scheduled upload(s).");

        return 0;
    }

    private function pruneStatus(string $status, int $retentionHours): int
    {
        $cutoff = now()->subHours($retentionHours);
        $rows = ScheduledUpload::query()->where('status', $status)->where('updated_at', '<', $cutoff)->get();

        foreach ($rows as $row) {
            // Best-effort: an already-missing staged artifact (swept
            // separately, or never staged) isn't a reason to keep the row.
            if (Storage::disk($row->disk)->exists($row->staged_path)) {
                Storage::disk($row->disk)->delete($row->staged_path);
            }
            $row->delete();
        }

        return $rows->count();
    }
}
