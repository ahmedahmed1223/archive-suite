<?php

declare(strict_types=1);

namespace App\Services\System;

use RuntimeException;

class SystemControlException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}
