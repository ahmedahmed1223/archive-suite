<?php

declare(strict_types=1);

namespace App\Services\System;

use RuntimeException;

class SystemControlException extends RuntimeException
{
    /**
     * ponytail: named apiCode, not code — Exception already declares a
     * (non-readonly) $code property and PHP forbids redeclaring it readonly.
     */
    public function __construct(
        string $message,
        public readonly int $status = 400,
        public readonly ?string $apiCode = null,
    ) {
        parent::__construct($message);
    }
}
