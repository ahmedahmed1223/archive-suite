<?php

declare(strict_types=1);

namespace App\Services\Settings;

use RuntimeException;

class LockedSettingException extends RuntimeException
{
    public function __construct(public readonly string $source, string $message)
    {
        parent::__construct($message);
    }
}
