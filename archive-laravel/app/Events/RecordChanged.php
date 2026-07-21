<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * V1-758B: fired whenever a storage_rows record is written through the HTTP
 * bulk-upsert path (RecordsController::bulk()). Dispatched ONLY from there -
 * never from AutomationRuleRunner - so an automation action writing back to
 * storage_rows can never re-trigger itself (see AutomationRuleRunner's
 * class docblock for the full loop-prevention note).
 */
class RecordChanged
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param array<string, mixed> $record
     */
    public function __construct(
        public readonly string $store,
        public readonly string $uid,
        public readonly array $record,
        public readonly bool $wasCreated,
    ) {
    }
}
