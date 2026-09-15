<?php

namespace Tests\Feature;

use App\Models\RightsRecord;
use App\Models\RightsWindow;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RightsEnforcementTest extends TestCase
{
    use RefreshDatabase;

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
            'starts_at' => $now->subDay(),
            'ends_at' => $now->addDay(),
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

        $editor = $this->getEditorUser();

        $response = $this->actingAs($editor)->postJson('/api/v1/share', [
            'scope' => ['itemIds' => [$itemId]],
            'permission' => 'view',
        ]);

        $response->assertStatus(403);
        $this->assertTrue(isset($response->json()['reason']));
        $this->assertTrue(isset($response->json()['decidedBy']));
    }

    public function testShareLinkAllowedWithValidGrantedWindow(): void
    {
        $itemId = 'item-with-rights';
        $record = $this->createRightsRecord($itemId);
        $now = Carbon::now();
        $window = $this->createGrantedWindow($record, $now);

        $editor = $this->getEditorUser();

        $response = $this->actingAs($editor)->postJson('/api/v1/share', [
            'scope' => ['itemIds' => [$itemId]],
            'permission' => 'view',
        ]);

        // Valid granted window should allow sharing
        if ($response->status() !== 201) {
            // Debug: output response for investigation
            $this->fail('Expected 201 but got '.$response->status().': '.$response->json()['reason'] ?? json_encode($response->json()));
        }
        $response->assertStatus(201);
        $this->assertNotNull($response->json('token'));
    }
}
