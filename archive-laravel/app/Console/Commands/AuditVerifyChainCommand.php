<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

/**
 * V1-734: walks the audit_logs hash chain in id order and recomputes each
 * row's hash from its stored fields + prev_hash, comparing against the
 * stored hash and the linkage to the previous row. A mismatch means the row
 * was altered, or a row was deleted/reordered, after being written.
 */
class AuditVerifyChainCommand extends Command
{
    protected $signature = 'audit:verify-chain {--json : Print a single JSON result line to stdout instead of narration}';

    protected $description = 'Verify the tamper-evident hash chain across audit_logs';

    public function handle(): int
    {
        $json = (bool) $this->option('json');
        $previousHash = null;
        $checked = 0;

        foreach (AuditLog::query()->orderBy('id')->cursor() as $log) {
            $checked++;

            if ($log->prev_hash !== $previousHash) {
                return $this->reportBrokenChain($json, (int) $log->id, "prev_hash does not match the previous row's hash.", $checked);
            }

            if ($log->hash !== $log->computeHash()) {
                return $this->reportBrokenChain($json, (int) $log->id, 'stored hash does not match recomputed hash - row was altered.', $checked);
            }

            $previousHash = $log->hash;
        }

        $message = "Verified {$checked} audit log entr(y/ies); chain intact.";

        if ($json) {
            $this->line(json_encode(['ok' => true, 'checked' => $checked, 'message' => $message], JSON_THROW_ON_ERROR));
        } else {
            $this->info($message);
        }

        return 0;
    }

    private function reportBrokenChain(bool $json, int $id, string $reason, int $checked): int
    {
        $message = "Audit log chain broken at id={$id} after checking {$checked} entr(y/ies): {$reason}";

        if ($json) {
            $this->line(json_encode(['ok' => false, 'brokenAtId' => $id, 'checked' => $checked, 'message' => $message], JSON_THROW_ON_ERROR));
        } else {
            $this->error($message);
        }

        return 1;
    }
}
