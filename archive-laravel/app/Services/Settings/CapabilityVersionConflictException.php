<?php

declare(strict_types=1);

namespace App\Services\Settings;

use RuntimeException;

class CapabilityVersionConflictException extends RuntimeException
{
    public function __construct(public readonly string $key, public readonly int $currentVersion)
    {
        parent::__construct("The {$key} capability changed since it was loaded.");
    }
}
