<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\RightsDecision;
use App\Models\RightsRecord;
use Carbon\Carbon;

class RightsEnforcementService
{
    public function __construct(private readonly RightsDecisionService $decisions) {}

    /**
     * Enforce rights for an item before allowing an operation.
     * Returns the decision; caller must check allowed() and respond with reason.
     */
    public function enforceForItem(
        string $itemId,
        string $usage,
        string $territory = 'global',
        string $platform = 'web',
        ?Carbon $requestTime = null,
    ): RightsDecision {
        $requestTime ??= now();

        $record = RightsRecord::query()
            ->where('item_id', $itemId)
            ->first();

        return $this->decisions->decide($record, $usage, $territory, $platform, $requestTime);
    }
}
