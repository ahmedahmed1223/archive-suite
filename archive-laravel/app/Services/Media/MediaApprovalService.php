<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Models\MediaInspection;
use App\Models\MediaQcOverride;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use RuntimeException;

final class MediaApprovalService
{
    public function __construct(private readonly MediaInspectionService $inspections) {}

    public function override(MediaInspection $inspection, User $actor, string $reason): MediaQcOverride
    {
        if (Gate::forUser($actor)->denies('media.qc.override')) {
            throw new RuntimeException('forbidden');
        }
        if ($inspection->inspection_type !== 'qc' || $inspection->status !== 'failed') {
            throw new RuntimeException('qc_not_failed');
        }
        if (! $this->inspections->isCurrentVersion($inspection)) {
            throw new RuntimeException('stale_qc');
        }
        if (trim($reason) === '') {
            throw new RuntimeException('override_reason_required');
        }

        return MediaQcOverride::query()->firstOrCreate(
            ['media_inspection_id' => $inspection->id],
            [
                'id' => (string) Str::uuid(), 'record_store' => $inspection->record_store,
                'record_uid' => $inspection->record_uid, 'version_token' => $inspection->version_token,
                'reason' => trim($reason), 'overridden_by' => $actor->id, 'overridden_at' => now(),
            ],
        );
    }

    public function isOverridden(MediaInspection $inspection): bool
    {
        return MediaQcOverride::query()->where('media_inspection_id', $inspection->id)->exists();
    }

    /** @param array<int, array<string, mixed>> $sources @return array<string, string> */
    public function exportBlockingFailures(array $sources): array
    {
        $errors = [];
        foreach ($sources as $source) {
            $recordStore = $source['recordStore'] ?? null;
            $recordId = $source['recordId'] ?? null;
            $versionToken = $source['sourceVersionToken'] ?? null;
            if (! is_string($recordStore) || ! is_string($recordId) || ! is_string($versionToken)) {
                continue;
            }
            $inspection = MediaInspection::query()->where([
                'record_store' => $recordStore, 'record_uid' => $recordId,
                'inspection_type' => 'qc', 'status' => 'failed', 'version_token' => $versionToken,
            ])->latest('completed_at')->first();
            if ($inspection instanceof MediaInspection && ! $this->isOverridden($inspection)) {
                $errors["qc.$recordId"] = 'Current source QC failed and has not received an authorized override.';
            }
        }

        return $errors;
    }
}
