<?php

declare(strict_types=1);

namespace App\Services\Broadcast;

/**
 * MOS/MXF broadcast metadata is only usable once an external integration is
 * configured (MOS_ENDPOINT / MXF_ENDPOINT). Absent config, callers must show
 * an explicit "configuration required" state rather than a broken/empty one.
 */
class BroadcastMetadataService
{
    public function isConfigured(): bool
    {
        return filled(config('archive.broadcast.mos_endpoint')) || filled(config('archive.broadcast.mxf_endpoint'));
    }

    /**
     * @return array{mos: bool, mxf: bool}
     */
    public function integrations(): array
    {
        return [
            'mos' => filled(config('archive.broadcast.mos_endpoint')),
            'mxf' => filled(config('archive.broadcast.mxf_endpoint')),
        ];
    }
}
