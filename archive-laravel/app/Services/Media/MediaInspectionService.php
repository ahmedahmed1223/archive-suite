<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Models\MediaInspection;
use App\Models\MediaJob;
use Illuminate\Support\Str;
use RuntimeException;

final class MediaInspectionService
{
    public function __construct(private readonly ReviewSessionService $identity) {}

    /** @return array{recordStore: string, recordUid: string} */
    public function assertRecordExists(string $recordUid, ?string $store = null): array
    {
        return $this->identity->assertRecordExists($recordUid, $store);
    }

    /** @param array<int, array<string, mixed>> $artifacts */
    public function persistCompletedProbe(MediaJob $job, array $artifacts): void
    {
        if (! in_array($job->operation, ['media_probe', 'media_qc'], true)) return;

        $type = $job->operation === 'media_qc' ? 'qc' : 'probe';
        $report = $this->report($artifacts, $type);
        if ($report === null) return;

        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->identity->assertRecordExists($job->record_id);
            $versionToken = $this->identity->resolveVersionToken($recordStore, $recordUid, null);
        } catch (RuntimeException) {
            // Standalone processing jobs cannot claim an archival inspection.
            return;
        }

        $inspection = MediaInspection::query()->firstOrNew(['media_job_id' => $job->id]);
        if (! $inspection->exists) $inspection->id = (string) Str::uuid();

        $inspection->forceFill([
            'record_store' => $recordStore,
            'record_uid' => $recordUid,
            'inspection_type' => $type,
            'status' => $type === 'qc' ? (string) ($report['status'] ?? 'failed') : 'completed',
            'version_token' => $versionToken,
            'report' => $report,
            'media_job_id' => $job->id,
            'created_by' => $job->created_by,
            'completed_at' => $job->completed_at ?? now(),
        ])->save();
    }

    public function isCurrentVersion(MediaInspection $inspection): bool
    {
        try {
            return $this->identity->resolveVersionToken($inspection->record_store, $inspection->record_uid, null) === $inspection->version_token;
        } catch (RuntimeException) {
            return false;
        }
    }

    /** @param array<int, array<string, mixed>> $artifacts
     *  @return array<string, mixed>|null */
    private function report(array $artifacts, string $type): ?array
    {
        $kind = $type === 'qc' ? 'media_qc_report' : 'media_probe_report';
        foreach ($artifacts as $artifact) {
            if (($artifact['kind'] ?? null) === $kind && is_array($artifact['report'] ?? null)) return $artifact['report'];
        }
        return null;
    }
}
