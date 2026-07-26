<?php

namespace App\Services\Media;

use App\Models\MediaJob;

/**
 * The v1 in-process adapter. It preserves the existing processor behavior
 * while presenting the same narrow contract that an independent worker uses.
 */
class LocalMediaJobExecutor implements MediaJobExecutor
{
    public function __construct(
        private readonly MediaProcessor $processor,
        private readonly string $executorName = 'local-v1',
    )
    {
    }

    public function name(): string
    {
        return $this->executorName;
    }

    public function execute(MediaJob $job): array
    {
        return $this->processor->process($job);
    }
}
