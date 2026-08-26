<?php

namespace App\Domain\Montage;

use RuntimeException;

/** Thrown with a field => message map when the timeline payload is invalid. */
class MontageValidationException extends RuntimeException
{
    /**
     * @param array<string, string> $errors
     */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Montage timeline validation failed.');
    }
}
