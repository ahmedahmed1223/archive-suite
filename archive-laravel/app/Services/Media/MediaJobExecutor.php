<?php

namespace App\Services\Media;

use App\Models\MediaJob;

/**
 * Versioned boundary for the compute side of media processing.
 *
 * Laravel continues to own dispatch, lifecycle state, retries and audit
 * records. An executor is deliberately only allowed to turn a persisted job
 * into artifacts, which lets a CPU/GPU worker implementation be substituted
 * without giving it write access to the media_jobs state machine.
 */
interface MediaJobExecutor
{
    public function name(): string;

    public function execute(MediaJob $job): array;
}
