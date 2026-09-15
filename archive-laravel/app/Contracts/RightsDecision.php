<?php

namespace App\Contracts;

readonly class RightsDecision
{
    public function __construct(
        public bool $allowed,
        public string $reason,
        public string $decidedBy,
    ) {}
}
