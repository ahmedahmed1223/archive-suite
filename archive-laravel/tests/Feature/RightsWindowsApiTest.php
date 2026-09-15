<?php

namespace Tests\Feature;

use App\Models\MediaDerivative;
use App\Models\RightsRecord;
use App\Models\RightsWindow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * Windows are the only way to grant anything under the deny-by-default rule,
 * so these cases check the whole loop: an operator opens a window through the
 * API, and the enforcement preview then reports what the boundaries will
 * actually decide.
 */
class RightsWindowsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    /** @return array<string, string> */
    private function viewerHeaders(): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'rights-windows-viewer@example.test'],
            ['name' => 'Viewer', 'password' => Hash::make('secret-password'), 'role' => 'viewer'],
        );

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }

    private function record(string $itemId = 'item-1'): RightsRecord
    {
        return RightsRecord::query()->create([
            'id' => 'rr-'.$itemId,
            'item_id' => $itemId,
            'rights_holder' => 'Test Holder',
            'license_type' => 'LICENSED',
        ]);
    }

    /**
     * V2-GOV-001: every refusal leaves a trace. The request audit middleware
     * only records unsafe methods, so this is checked on a GET -- the case it
     * cannot see -- rather than on a share POST it would have logged anyway.
     */
    public function test_a_refused_derivative_download_is_audited_even_though_it_is_a_get(): void
    {
        // The stale-version gate runs before rights, so the derivative has to
        // match a real record source or the refusal never gets that far.
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'item-1',
            'data' => json_encode(['uid' => 'item-1', 'title' => 'Item one', 'checksum' => 'checksum-1'], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $derivative = MediaDerivative::query()->create([
            'id' => (string) Str::uuid(),
            'record_store' => 'archive-items',
            'record_uid' => 'item-1',
            'derivative_type' => 'thumbnail',
            'settings' => [],
            'settings_hash' => 'hash-1',
            'version_token' => 'record:checksum-1',
            'status' => 'ready',
            'storage_key' => 'item-1/derivatives/thumb.jpg',
        ]);

        $this->getJson("/api/v1/media-derivatives/{$derivative->id}/content", $this->authHeaders())
            ->assertForbidden();

        $log = DB::table('audit_logs')->where('event', 'rights.denied')->latest('id')->first();
        $this->assertNotNull($log, 'A refused download left no audit trail.');
        $this->assertSame('item-1', $log->resource_id);
        $metadata = json_decode((string) $log->metadata, true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame('editorial_reuse', $metadata['usage']);
        $this->assertSame('no_record', $metadata['decidedBy']);
    }

    public function test_an_editor_opens_a_window_and_the_item_becomes_shareable(): void
    {
        $this->record();

        $this->postJson('/api/v1/rights/item-1/windows', [
            'usage' => 'digital_public',
            'startsAt' => now()->subDay()->toISOString(),
            'endsAt' => now()->addDay()->toISOString(),
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('window.usage', 'digital_public')
            ->assertJsonPath('window.granted', true)
            // An empty list is "unrestricted", which is what the decision
            // service reads it as -- the two must not drift apart.
            ->assertJsonPath('window.territories', [])
            ->assertJsonPath('window.platforms', []);

        $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
            'permission' => 'view',
        ], $this->authHeaders())->assertCreated();
    }

    public function test_a_window_cannot_be_opened_before_the_rights_record_exists(): void
    {
        $this->postJson('/api/v1/rights/unknown-item/windows', [
            'usage' => 'broadcast',
        ], $this->authHeaders())->assertNotFound();

        $this->getJson('/api/v1/rights/unknown-item/windows', $this->authHeaders())->assertNotFound();
    }

    public function test_revoking_a_window_closes_the_item_again(): void
    {
        $record = $this->record();
        $windowId = $this->postJson('/api/v1/rights/item-1/windows', [
            'usage' => 'digital_public',
        ], $this->authHeaders())->assertCreated()->json('window.id');

        $this->patchJson("/api/v1/rights-windows/{$windowId}", ['granted' => false], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('window.granted', false);

        $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
        ], $this->authHeaders())
            ->assertForbidden()
            ->assertJsonPath('decidedBy', $windowId);

        $this->deleteJson("/api/v1/rights-windows/{$windowId}", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);
        $this->assertSame(0, $record->windows()->count());
    }

    public function test_a_viewer_cannot_open_or_change_a_window(): void
    {
        $this->record();
        $window = RightsWindow::query()->create([
            'id' => 'rw-1',
            'rights_record_id' => 'rr-item-1',
            'usage' => 'broadcast',
            'territories' => [],
            'platforms' => [],
            'granted' => true,
        ]);

        $viewer = $this->viewerHeaders();
        $this->postJson('/api/v1/rights/item-1/windows', ['usage' => 'broadcast'], $viewer)->assertForbidden();
        $this->patchJson("/api/v1/rights-windows/{$window->id}", ['granted' => false], $viewer)->assertForbidden();
        $this->deleteJson("/api/v1/rights-windows/{$window->id}", [], $viewer)->assertForbidden();
        $this->getJson('/api/v1/rights/item-1/windows', $viewer)->assertOk()->assertJsonCount(1, 'windows');
    }

    public function test_an_unknown_usage_is_refused_rather_than_stored_and_ignored(): void
    {
        $this->record();

        $this->postJson('/api/v1/rights/item-1/windows', ['usage' => 'podcast'], $this->authHeaders())
            ->assertStatus(422);
    }

    public function test_the_enforcement_preview_reports_what_the_boundaries_will_decide(): void
    {
        $this->record();
        $this->postJson('/api/v1/rights/item-1/windows', ['usage' => 'digital_public'], $this->authHeaders())->assertCreated();

        $response = $this->getJson('/api/v1/rights/item-1/enforcement', $this->authHeaders())->assertOk();

        $byUsage = collect($response->json('decisions'))->keyBy('usage');
        $this->assertTrue($byUsage['digital_public']['allowed']);
        $this->assertFalse($byUsage['broadcast']['allowed']);
        $this->assertSame('no_window_for_usage', $byUsage['broadcast']['decidedBy']);
    }

    public function test_an_item_with_no_rights_is_previewed_as_refused_not_allowed(): void
    {
        // The old preview answered "allowed" here while every boundary
        // refused. Nothing in the product may promise what the API denies.
        $response = $this->getJson('/api/v1/rights/item-without-rights/enforcement', $this->authHeaders())->assertOk();

        $this->assertNull($response->json('record'));
        foreach ($response->json('decisions') as $decision) {
            $this->assertFalse($decision['allowed']);
            $this->assertSame('no_record', $decision['decidedBy']);
        }
    }
}
