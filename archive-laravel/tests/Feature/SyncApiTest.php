<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class SyncApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_lists_sync_log_entries_with_conflict_state(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            [
                'store' => 'archive-items',
                'uid' => 'synced-1',
                'data' => json_encode(['uid' => 'synced-1', 'title' => 'Synced record'], JSON_THROW_ON_ERROR),
                'sync_version' => 3,
                'last_modified_by' => json_encode(['id' => 'user-1', 'name' => 'Sync Bot'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'store' => 'archive-items',
                'uid' => 'unversioned-1',
                'data' => json_encode(['uid' => 'unversioned-1', 'title' => 'Local only record'], JSON_THROW_ON_ERROR),
                'sync_version' => null,
                'last_modified_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $response = $this->getJson('/api/v1/sync', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);

        $response->assertJsonPath('summary.total', 2);
        $response->assertJsonPath('summary.conflicts', 1);

        $entries = $response->json('entries');
        $this->assertIsArray($entries);

        $byUid = collect($entries)->keyBy('uid');
        $this->assertSame('synced', $byUid->get('synced-1')['status']);
        $this->assertSame(3, $byUid->get('synced-1')['syncVersion']);
        $this->assertSame('conflict', $byUid->get('unversioned-1')['status']);
        $this->assertNull($byUid->get('unversioned-1')['syncVersion']);
    }

    public function test_it_rejects_unauthenticated_sync_requests(): void
    {
        $this->getJson('/api/v1/sync')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_it_signals_more_sync_entries_exist_beyond_the_page_limit(): void
    {
        $now = now();
        $rows = [];
        for ($i = 0; $i < 4; $i++) {
            $rows[] = [
                'store' => 'archive-items',
                'uid' => "sync-page-{$i}",
                'data' => json_encode(['uid' => "sync-page-{$i}", 'title' => "Row {$i}"], JSON_THROW_ON_ERROR),
                'sync_version' => $i === 0 ? null : 1,
                'last_modified_by' => null,
                'created_at' => $now,
                'updated_at' => $now->copy()->addSeconds($i),
            ];
        }
        DB::table('storage_rows')->insert($rows);

        $response = $this->getJson('/api/v1/sync?limit=3', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('pagination.total', 4)
            ->assertJsonPath('pagination.limit', 3)
            ->assertJsonPath('pagination.page', 1)
            ->assertJsonPath('pagination.hasMore', true)
            // summary reflects the grand total across ALL rows, not just this page
            ->assertJsonPath('summary.total', 4)
            ->assertJsonPath('summary.conflicts', 1)
            ->assertJsonPath('summary.synced', 3);

        $this->assertCount(3, $response->json('entries'));
    }
}
