<?php

namespace App\Services\Media;

use App\Services\Security\SecuritySettingsService;

class MediaJobQueueRouter
{
    public function __construct(private readonly SecuritySettingsService $securitySettings) {}

    public function queueFor(string $operation): string
    {
        return $operation === 'transcription'
            && $this->securitySettings->getSettings()['whisperDevice'] === 'cuda'
            ? 'gpu'
            : 'default';
    }
}
