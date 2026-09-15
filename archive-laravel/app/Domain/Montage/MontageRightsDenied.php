<?php

namespace App\Domain\Montage;

/**
 * A source item in the revision being exported has no granted broadcast
 * window. Carries the deciding clause, not just a refusal, so the user can
 * see which rights entry to fix (docs/v2-rights-decision-design.ar.md).
 */
class MontageRightsDenied extends \RuntimeException
{
    public function __construct(
        public readonly string $itemId,
        public readonly string $denialReason,
        public readonly string $decidedBy,
    ) {
        parent::__construct($denialReason);
    }
}
