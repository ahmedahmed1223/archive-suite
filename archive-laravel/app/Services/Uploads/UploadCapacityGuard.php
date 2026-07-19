<?php

namespace App\Services\Uploads;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

/**
 * Extracted from UploadsController (V1-711) so the same disk-space/quota
 * check applies identically to single-shot and chunked uploads instead of
 * being duplicated per controller.
 */
class UploadCapacityGuard
{
    /**
     * Rejects an incoming upload before it touches disk when it would leave
     * less than the configured safety margin of free space, or push usage
     * past the configured storage quota.
     */
    public function assertAvailable(string $disk, int $incomingBytes): ?JsonResponse
    {
        if (config("filesystems.disks.{$disk}.driver") !== 'local') {
            return null;
        }

        $root = Storage::disk($disk)->path('');
        $free = @disk_free_space($root);
        $total = @disk_total_space($root);

        if ($free === false || $total === false) {
            return null;
        }

        $minFreeBytes = (int) config('ingest.min_free_bytes', 100 * 1024 * 1024);
        if ($free - $incomingBytes < $minFreeBytes) {
            return response()->json([
                'ok' => false,
                'error' => 'Not enough free disk space to accept this upload.',
                'code' => 'insufficient_disk_space',
            ], 507);
        }

        $quotaBytes = config('ingest.storage_quota_bytes');
        if ($quotaBytes !== null && ($total - $free) + $incomingBytes > (int) $quotaBytes) {
            return response()->json([
                'ok' => false,
                'error' => 'Storage quota exceeded.',
                'code' => 'storage_quota_exceeded',
            ], 413);
        }

        return null;
    }
}
