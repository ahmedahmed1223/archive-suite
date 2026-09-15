<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\RightsDecision;
use App\Models\AuditLog;
use App\Models\RightsRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Request;

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

        $decision = $this->decisions->decide($record, $usage, $territory, $platform, $requestTime);

        if (! $decision->allowed) {
            $this->recordRefusal($itemId, $usage, $territory, $platform, $decision);
        }

        return $decision;
    }

    /**
     * Every refusal is logged (docs/v2-rights-decision-design.ar.md). The
     * request audit middleware cannot stand in for this: it only records
     * unsafe methods, so a refused derivative download -- a GET -- left no
     * trace of having been refused at all.
     *
     * A failure to write the log must not turn a refusal into an error the
     * caller sees instead: the refusal itself is the security outcome, and it
     * still stands.
     */
    private function recordRefusal(string $itemId, string $usage, string $territory, string $platform, RightsDecision $decision): void
    {
        try {
            $request = Request::instance();
            $actor = $request->attributes->get('archive_user');

            AuditLog::query()->create([
                'action' => $request->method().' /'.$request->path(),
                'event' => 'rights.denied',
                'resource_type' => 'rights_record',
                'resource_id' => $itemId,
                'actor_id' => $actor instanceof User ? $actor->getKey() : null,
                'outcome' => 'denied',
                'status_code' => 403,
                'metadata' => [
                    'usage' => $usage,
                    'territory' => $territory,
                    'platform' => $platform,
                    'reason' => $decision->reason,
                    'decidedBy' => $decision->decidedBy,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        } catch (\Throwable) {
            // Intentionally swallowed: see the docblock above.
        }
    }
}
