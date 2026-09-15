<?php

declare(strict_types=1);

namespace App\Services\Preservation;

use Illuminate\Support\Facades\DB;

/**
 * Read-only preservation readiness for the administration surface.
 *
 * This deliberately reports the absence of a preservation-copy pipeline rather
 * than treating the current source or a display proxy as a preservation copy.
 * It also reports only the latest recorded per-file check; it never performs a
 * potentially expensive full archive scan on an HTTP request.
 */
final class PreservationReadinessService
{
    /**
     * @return array{
     *   layer: array{status: 'requires_setup', versioning: 'per_asset'},
     *   integrity: array{status: 'not_checked'|'verified'|'attention', lastCheckedAt: string|null}
     * }
     */
    public function summary(): array
    {
        $latest = DB::table('file_health_checks')
            ->orderByDesc('checked_at')
            ->first(['status', 'checked_at']);

        $integrityStatus = match ($latest?->status) {
            'match' => 'verified',
            'missing', 'mismatch', 'error' => 'attention',
            default => 'not_checked',
        };

        return [
            'layer' => [
                'status' => 'requires_setup',
                'versioning' => 'per_asset',
            ],
            'integrity' => [
                'status' => $integrityStatus,
                'lastCheckedAt' => $latest?->checked_at,
            ],
        ];
    }
}
