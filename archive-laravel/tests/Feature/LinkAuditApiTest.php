<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class LinkAuditApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_flags_a_relation_whose_target_no_longer_exists(): void
    {
        $this->seedRecord('item-1');
        $this->seedRelation('item-1', 'item-missing');

        $this->getJson('/api/v1/link-audit', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(1, 'brokenLinks')
            ->assertJsonPath('brokenLinks.0.sourceRecordId', 'item-1')
            ->assertJsonPath('brokenLinks.0.targetRecordId', 'item-missing')
            ->assertJsonPath('brokenLinks.0.missingSource', false)
            ->assertJsonPath('brokenLinks.0.missingTarget', true);
    }

    public function test_it_does_not_flag_a_relation_between_two_existing_records(): void
    {
        $this->seedRecord('item-1');
        $this->seedRecord('item-2');
        $this->seedRelation('item-1', 'item-2');

        $this->getJson('/api/v1/link-audit', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'brokenLinks');
    }

    private function seedRecord(string $id): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $id,
            'data' => json_encode(['uid' => $id, 'id' => $id, 'title' => 'Record '.$id], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedRelation(string $sourceId, string $targetId): void
    {
        DB::table('record_relations')->insert([
            'id' => (string) Str::uuid(),
            'source_record_id' => $sourceId,
            'target_record_id' => $targetId,
            'type' => 'related_to',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
