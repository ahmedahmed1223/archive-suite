<?php

namespace App\Domain\Montage;

use RuntimeException;

/** Thrown when a write arrives against a revision other than the current one. */
class MontageRevisionConflict extends RuntimeException
{
    public function __construct(
        public readonly int $currentRevision,
        public readonly int $expectedRevision,
    ) {
        parent::__construct("Revision conflict: expected $expectedRevision, current is $currentRevision.");
    }
}
