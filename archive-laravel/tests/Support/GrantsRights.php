<?php

namespace Tests\Support;

use App\Models\RightsRecord;
use App\Models\RightsWindow;
use Illuminate\Support\Str;

/**
 * Rights are denied by default: an item with no recorded rights is not
 * shared and not exported (docs/v2-rights-decision-design.ar.md). Any test
 * that exercises a successful share, review link, or export therefore has to
 * state the clearance it is relying on instead of inheriting it silently.
 */
trait GrantsRights
{
    /**
     * Opens one granted, currently-valid window for this item and usage.
     * Empty territories/platforms mean "unrestricted", which is the point of
     * a default fixture: the caller is granting usage, not geography.
     */
    protected function grantRightsWindow(string $itemId, string $usage): RightsWindow
    {
        $record = RightsRecord::query()->firstOrCreate(
            ['item_id' => $itemId],
            [
                'id' => 'rr-'.Str::uuid(),
                'rights_holder' => 'Test Holder',
                'license_type' => 'standard',
            ],
        );

        return RightsWindow::query()->create([
            'id' => 'rw-'.Str::uuid(),
            'rights_record_id' => $record->id,
            'usage' => $usage,
            'starts_at' => now()->copy()->subDay(),
            'ends_at' => now()->copy()->addDay(),
            'territories' => [],
            'platforms' => [],
            'granted' => true,
        ]);
    }
}
