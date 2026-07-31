<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class RecordChangeImpactApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_delete_preview_lists_related_work_and_blocks_unresolved_conflicts(): void
    {
        DB::table('storage_rows')->insert(['store' => 'archive-items', 'uid' => 'impact-1', 'data' => json_encode(['id' => 'impact-1', 'title' => 'Impact']), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('record_relations')->insert(['id' => 'relation-1', 'source_record_id' => 'impact-1', 'target_record_id' => 'other', 'type' => 'related', 'created_at' => now(), 'updated_at' => now()]);

        $this->postJson('/api/v1/records/impact-1/change-impact', ['operation' => 'delete'], $this->authHeaders())
            ->assertOk()->assertJsonPath('blocked', true)->assertJsonCount(1, 'relations');
    }
}
