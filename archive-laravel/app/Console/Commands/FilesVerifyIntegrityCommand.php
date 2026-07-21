<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use stdClass;

/**
 * V1-733: periodic integrity check for stored record attachments. Re-reads
 * each file from its disk and recomputes its sha256, comparing against the
 * checksum_sha256 recorded at upload time (RecordAttachmentsController).
 * A mismatch means silent corruption/bit-rot or an out-of-band edit; a
 * missing file means it was deleted outside the app. Both are logged to
 * audit_logs so V1-734's tamper-evident trail captures them.
 */
class FilesVerifyIntegrityCommand extends Command
{
    protected $signature = 'files:verify-integrity {--json : Print a single JSON result line to stdout instead of narration}';

    protected $description = 'Re-checksum stored record attachments against their recorded sha256 and flag corruption or missing files';

    public function handle(): int
    {
        $json = (bool) $this->option('json');
        $checked = 0;
        $failures = [];

        DB::table('record_attachments')->chunkById(200, function ($rows) use (&$checked, &$failures): void {
            foreach ($rows as $row) {
                $checked++;
                $failure = $this->verifyRow($row);

                if ($failure === null) {
                    continue;
                }

                $failures[] = $failure;
                AuditLog::query()->create([
                    'action' => 'files:verify-integrity',
                    'event' => 'attachment.integrity_failed',
                    'resource_type' => 'record_attachment',
                    'resource_id' => (string) $row->id,
                    'outcome' => 'failure',
                    'metadata' => $failure,
                ]);
            }
        }, column: 'id');

        $message = "Checked {$checked} attachment(s); ".count($failures).' failure(s).';

        if ($json) {
            $this->line(json_encode(['ok' => $failures === [], 'checked' => $checked, 'failures' => $failures, 'message' => $message], JSON_THROW_ON_ERROR));
        } elseif ($failures === []) {
            $this->info($message);
        } else {
            $this->error($message);
            foreach ($failures as $failure) {
                $this->line("  - {$failure['id']}: {$failure['reason']}");
            }
        }

        return $failures === [] ? 0 : 1;
    }

    /**
     * @return array{id: string, reason: string, path: string, expected?: string, actual?: string}|null
     */
    private function verifyRow(stdClass $row): ?array
    {
        $disk = Storage::disk($row->disk);

        if (! $disk->exists($row->path)) {
            return ['id' => (string) $row->id, 'reason' => 'missing', 'path' => $row->path];
        }

        $stream = $disk->readStream($row->path);
        if (! is_resource($stream)) {
            return ['id' => (string) $row->id, 'reason' => 'unreadable', 'path' => $row->path];
        }

        $context = hash_init('sha256');
        try {
            hash_update_stream($context, $stream);
        } finally {
            fclose($stream);
        }
        $actual = hash_final($context);

        if (! hash_equals((string) $row->checksum_sha256, $actual)) {
            return [
                'id' => (string) $row->id,
                'reason' => 'checksum_mismatch',
                'path' => $row->path,
                'expected' => $row->checksum_sha256,
                'actual' => $actual,
            ];
        }

        return null;
    }
}
