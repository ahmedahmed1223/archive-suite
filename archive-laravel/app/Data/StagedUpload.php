<?php

declare(strict_types=1);

namespace App\Data;

/**
 * V1-712: immutable result of UploadStager::stage() — a verified quarantine
 * artifact ready to be attached to a ScheduledUpload row. Deliberately does
 * not include the originating session id; the controller already has that.
 */
final class StagedUpload
{
    public function __construct(
        public readonly string $disk,
        public readonly string $path,
        public readonly string $fileName,
        public readonly int $size,
        public readonly string $checksum,
    ) {}
}
