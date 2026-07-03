<?php

declare(strict_types=1);

namespace App\Services\Backup;

use RuntimeException;

class BackupException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}
