<?php

namespace App\Services\Media;

use App\Models\MediaJob;

interface MediaProcessor
{
    /**
     * Process a media job and return artifacts.
     *
     * @return array<int, array<string, mixed>>
     */
    public function process(MediaJob $job): array;
}
