<?php

declare(strict_types=1);

namespace App\Services\Media;

use Illuminate\Support\Facades\DB;

/**
 * Builds the small operational-media payload needed by a page of archive
 * cards. Queries are page-batched: callers must never fan out into one
 * derivative/inspection request per record.
 */
final class RecordMediaSummaryService
{
    /**
     * @param  list<array<string, mixed>>  $records
     * @return array<string, array<string, mixed>> keyed by "store\0uid"
     */
    public function forPage(array $records): array
    {
        $summaries = [];
        $stores = [];
        $uids = [];
        $versionTokens = [];

        foreach ($records as $record) {
            $store = is_string($record['store'] ?? null) ? $record['store'] : null;
            $uid = is_string($record['uid'] ?? null) ? $record['uid'] : null;
            if ($store === null || $uid === null) {
                continue;
            }

            $key = self::key($store, $uid);
            $summaries[$key] = [
                'kind' => $this->kindFor($record),
                'durationSeconds' => $this->durationFor($record),
                'thumbnailDerivativeId' => null,
                'thumbnailStatus' => 'missing',
                'proxyStatus' => 'missing',
                'waveformStatus' => 'missing',
                'inspectionStatus' => 'missing',
            ];
            $stores[$store] = true;
            $uids[$uid] = true;
            $checksum = $record['checksum'] ?? null;
            $versionTokens[$key] = is_string($checksum) && trim($checksum) !== '' ? 'record:'.$checksum : null;
        }

        if ($summaries === []) {
            return [];
        }

        $derivatives = DB::table('media_derivatives')
            ->whereNull('attachment_id')
            ->whereIn('record_store', array_keys($stores))
            ->whereIn('record_uid', array_keys($uids))
            ->whereIn('derivative_type', ['thumbnail', 'proxy', 'waveform'])
            ->orderByDesc('updated_at')
            ->get();

        foreach ($derivatives as $derivative) {
            $key = self::key((string) $derivative->record_store, (string) $derivative->record_uid);
            if (! isset($summaries[$key]) || $versionTokens[$key] === null || $derivative->version_token !== $versionTokens[$key]) {
                continue;
            }

            $type = (string) $derivative->derivative_type;
            $statusField = $type.'Status';
            if ($summaries[$key][$statusField] !== 'missing') {
                continue;
            }

            $status = $this->derivativeStatus((string) $derivative->status);
            $summaries[$key][$statusField] = $status;
            if ($type === 'thumbnail' && $status === 'ready') {
                $summaries[$key]['thumbnailDerivativeId'] = (string) $derivative->id;
            }
        }

        $inspections = DB::table('media_inspections')
            ->whereIn('record_store', array_keys($stores))
            ->whereIn('record_uid', array_keys($uids))
            ->where('inspection_type', 'qc')
            ->orderByDesc('completed_at')
            ->orderByDesc('updated_at')
            ->get();

        foreach ($inspections as $inspection) {
            $key = self::key((string) $inspection->record_store, (string) $inspection->record_uid);
            if (! isset($summaries[$key]) || $versionTokens[$key] === null || $inspection->version_token !== $versionTokens[$key] || $summaries[$key]['inspectionStatus'] !== 'missing') {
                continue;
            }

            $summaries[$key]['inspectionStatus'] = $this->inspectionStatus((string) $inspection->status);
        }

        return $summaries;
    }

    public static function key(string $store, string $uid): string
    {
        return $store."\0".$uid;
    }

    /** @param array<string, mixed> $record */
    private function kindFor(array $record): string
    {
        $path = $record['fileName'] ?? $record['filePath'] ?? $record['path'] ?? '';
        $extension = strtolower(pathinfo(is_string($path) ? $path : '', PATHINFO_EXTENSION));

        return match (true) {
            in_array($extension, ['mov', 'mp4', 'mxf', 'webm'], true) => 'video',
            in_array($extension, ['wav', 'mp3', 'm4a'], true) => 'audio',
            in_array($extension, ['jpg', 'jpeg', 'png', 'tif', 'tiff'], true) => 'image',
            in_array($extension, ['pdf', 'doc', 'docx'], true) => 'document',
            default => 'unknown',
        };
    }

    /** @param array<string, mixed> $record */
    private function durationFor(array $record): ?float
    {
        $duration = $record['durationSeconds'] ?? null;

        return is_numeric($duration) && (float) $duration >= 0 ? (float) $duration : null;
    }

    private function derivativeStatus(string $status): string
    {
        return in_array($status, ['pending', 'processing', 'ready', 'failed'], true) ? $status : 'missing';
    }

    private function inspectionStatus(string $status): string
    {
        return in_array($status, ['passed', 'warning', 'failed', 'waived'], true) ? $status : 'pending';
    }
}
