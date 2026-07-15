<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V1-731 (B07): independent, browsable, restorable trash.
 *
 * Deleting a record moves the whole storage_rows row into `trashed_records`
 * rather than destroying it, so /api/v1/records (and every other
 * storage_rows reader) sees it as gone while the payload survives for the
 * retention window.
 */
class TrashApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    // -- delete moves to trash instead of destroying -------------------------

    public function test_bulk_delete_moves_records_into_trash(): void
    {
        $this->seedRecords(['t-001' => 'First', 't-002' => 'Second']);

        $this->postJson('/api/v1/records/bulk-delete', [
            'store' => 'archive-items',
            'ids' => ['t-001'],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('results.0.deleted', true);

        // Gone from the live store.
        $this->getJson('/api/v1/records?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 't-002');

        // Present in the trash, payload intact.
        $this->getJson('/api/v1/trash', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.uid', 't-001')
            ->assertJsonPath('items.0.store', 'archive-items')
            ->assertJsonPath('items.0.record.title', 'First');
    }

    public function test_deleting_the_same_uid_twice_replaces_the_trash_entry(): void
    {
        $this->seedRecords(['dup-1' => 'Version one']);
        $this->deleteRecords('dup-1');

        $this->seedRecords(['dup-1' => 'Version two']);
        $this->deleteRecords('dup-1');

        $this->getJson('/api/v1/trash', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.record.title', 'Version two');
    }

    // -- browsing ------------------------------------------------------------

    public function test_trash_list_paginates_with_the_shared_envelope(): void
    {
        $this->seedRecords(['p-1' => 'One', 'p-2' => 'Two', 'p-3' => 'Three']);
        $this->deleteRecords('p-1', 'p-2', 'p-3');

        $first = $this->getJson('/api/v1/trash?limit=2&page=1', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'items')
            ->assertJsonPath('pagination.total', 3)
            ->assertJsonPath('pagination.page', 1)
            ->assertJsonPath('pagination.limit', 2)
            ->assertJsonPath('pagination.hasMore', true);

        $this->assertIsArray($first->json('items'));

        $this->getJson('/api/v1/trash?limit=2&page=2', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('pagination.page', 2)
            ->assertJsonPath('pagination.hasMore', false);
    }

    public function test_trash_list_filters_by_store_and_search_term(): void
    {
        $this->seedRecords(['f-1' => 'Cairo tape', 'f-2' => 'Alexandria reel']);
        $this->deleteRecords('f-1', 'f-2');

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'other-store',
            'records' => [['uid' => 'f-3', 'title' => 'Cairo elsewhere']],
        ], $this->authHeaders())->assertOk();

        $this->postJson('/api/v1/records/bulk-delete', [
            'store' => 'other-store',
            'ids' => ['f-3'],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/trash?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'items');

        $this->getJson('/api/v1/trash?q=cairo', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'items');

        $this->getJson('/api/v1/trash?store=archive-items&q=cairo', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.uid', 'f-1');
    }

    public function test_trash_list_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/trash')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    // -- restore -------------------------------------------------------------

    public function test_restore_returns_the_record_to_its_prior_state(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [[
                'uid' => 'r-001',
                'id' => 'r-001',
                'title' => 'Restore me',
                'description' => 'Full payload',
                'syncVersion' => 7,
            ]],
        ], $this->authHeaders())->assertOk();

        $this->deleteRecords('r-001');

        $this->postJson('/api/v1/trash/restore', [
            'store' => 'archive-items',
            'ids' => ['r-001'],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('count', 1)
            ->assertJsonPath('results.0.uid', 'r-001')
            ->assertJsonPath('results.0.restored', true);

        $this->getJson('/api/v1/records/r-001?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.title', 'Restore me')
            ->assertJsonPath('record.description', 'Full payload')
            ->assertJsonPath('record.syncVersion', 7);

        $this->getJson('/api/v1/trash', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'items');
    }

    public function test_restore_reports_false_for_unknown_ids(): void
    {
        $this->postJson('/api/v1/trash/restore', [
            'store' => 'archive-items',
            'ids' => ['never-existed'],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('count', 0)
            ->assertJsonPath('results.0.restored', false);
    }

    public function test_restore_refuses_to_clobber_a_live_record(): void
    {
        $this->seedRecords(['c-1' => 'Trashed copy']);
        $this->deleteRecords('c-1');

        // Same uid recreated while the old one sat in the trash.
        $this->seedRecords(['c-1' => 'Live copy']);

        $this->postJson('/api/v1/trash/restore', [
            'store' => 'archive-items',
            'ids' => ['c-1'],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('count', 0)
            ->assertJsonPath('results.0.restored', false)
            ->assertJsonPath('results.0.reason', 'conflict');

        $this->getJson('/api/v1/records/c-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.title', 'Live copy');

        // Still recoverable — a refused restore must not drop the trash entry.
        $this->getJson('/api/v1/trash', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'items');
    }

    public function test_restore_is_denied_for_viewers(): void
    {
        $this->postJson('/api/v1/trash/restore', [
            'store' => 'archive-items',
            'ids' => ['r-001'],
        ], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    // -- permanent delete ----------------------------------------------------

    public function test_purge_permanently_removes_trash_entries_for_admins(): void
    {
        $this->seedRecords(['x-1' => 'Doomed']);
        $this->deleteRecords('x-1');

        $this->postJson('/api/v1/trash/purge', [
            'store' => 'archive-items',
            'ids' => ['x-1'],
        ], $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('count', 1)
            ->assertJsonPath('results.0.purged', true);

        $this->getJson('/api/v1/trash', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'items');

        $this->assertDatabaseCount('trashed_records', 0);
    }

    public function test_purge_is_denied_for_editors(): void
    {
        $this->seedRecords(['x-2' => 'Safe']);
        $this->deleteRecords('x-2');

        // authHeaders() is an editor — permanent delete is admin-only.
        $this->postJson('/api/v1/trash/purge', [
            'store' => 'archive-items',
            'ids' => ['x-2'],
        ], $this->authHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);

        $this->assertDatabaseCount('trashed_records', 1);
    }

    // -- retention -----------------------------------------------------------

    public function test_trash_prune_deletes_only_entries_past_the_retention_window(): void
    {
        config(['archive.trash_retention_days' => 30]);

        $this->seedRecords(['old-1' => 'Old', 'new-1' => 'New']);
        $this->deleteRecords('old-1', 'new-1');

        DB::table('trashed_records')->where('uid', 'old-1')
            ->update(['deleted_at' => now()->subDays(31)]);

        $this->artisan('trash:prune')->assertExitCode(0);

        $this->assertDatabaseMissing('trashed_records', ['uid' => 'old-1']);
        $this->assertDatabaseHas('trashed_records', ['uid' => 'new-1']);
    }

    // -- helpers -------------------------------------------------------------

    /**
     * @param  array<string, string>  $titles  uid => title
     */
    private function seedRecords(array $titles): void
    {
        $records = [];
        foreach ($titles as $uid => $title) {
            $records[] = ['uid' => $uid, 'id' => $uid, 'title' => $title];
        }

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => $records,
        ], $this->authHeaders())->assertOk();
    }

    private function deleteRecords(string ...$ids): void
    {
        $this->postJson('/api/v1/records/bulk-delete', [
            'store' => 'archive-items',
            'ids' => array_values($ids),
        ], $this->authHeaders())->assertOk();
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        return $this->headersFor('viewer', 'trash-viewer@example.test');
    }

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        return $this->headersFor('admin', 'trash-admin@example.test');
    }

    /**
     * @return array<string, string>
     */
    private function headersFor(string $role, string $email): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => ucfirst($role),
                'password' => Hash::make('secret-password'),
                'role' => $role,
            ],
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
