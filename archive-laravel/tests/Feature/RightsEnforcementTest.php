<?php

namespace Tests\Feature;

use App\Models\RightsRecord;
use App\Models\RightsWindow;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RightsEnforcementTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    private function createRightsRecord(string $itemId): RightsRecord
    {
        return RightsRecord::query()->create([
            'id' => 'rr-'.$itemId,
            'item_id' => $itemId,
            'rights_holder' => 'Test Holder',
            'license_type' => 'standard',
        ]);
    }

    private function createGrantedWindow(RightsRecord $record, Carbon $now): RightsWindow
    {
        return RightsWindow::query()->create([
            'id' => 'rw-'.$record->id,
            'rights_record_id' => $record->id,
            'usage' => 'digital_public',
            // copy(): Carbon is mutable, so subDay()/addDay() on the same
            // instance would cancel out and leave ends_at sitting on "now".
            'starts_at' => $now->copy()->subDay(),
            'ends_at' => $now->copy()->addDay(),
            'territories' => [],
            'platforms' => [],
            'granted' => true,
        ]);
    }

    private function getEditorUser(): User
    {
        return User::factory()->create();
    }

    public function testShareLinkRejectedWhenNoRightsRecord(): void
    {
        $itemId = 'item-no-rights';

        $response = $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => [$itemId]],
            'permission' => 'view',
        ], $this->authHeaders());

        $response->assertStatus(403);
        $this->assertTrue(isset($response->json()['reason']));
        $this->assertTrue(isset($response->json()['decidedBy']));
    }

    public function testShareLinkAllowedWithValidGrantedWindow(): void
    {
        $itemId = 'item-with-rights';
        $record = $this->createRightsRecord($itemId);
        $now = Carbon::now();
        $this->createGrantedWindow($record, $now);

        $response = $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => [$itemId]],
            'permission' => 'view',
        ], $this->authHeaders());

        $response->assertStatus(201);
        $this->assertNotNull($response->json('token'));
    }
}
