<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RelationsGraphApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_returns_manual_and_inferred_relations_from_archive_records_only(): void
    {
        $this->seedArchiveRecords();

        $createResponse = $this->postJson('/api/v1/relations', [
            'sourceId' => 'item-source',
            'targetId' => 'item-related',
            'type' => 'references',
            'note' => 'verified transcript',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('relation.sourceId', 'item-source')
            ->assertJsonPath('relation.targetId', 'item-related')
            ->assertJsonPath('relation.type', 'references');

        $relationId = $createResponse->json('relation.id');
        $this->assertIsString($relationId);

        $response = $this->getJson('/api/v1/relations/graph?limit=20', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);

        $nodeIds = collect($response->json('nodes'))->pluck('id')->all();
        $edgeKinds = collect($response->json('edges'))->pluck('kind')->all();

        $this->assertContains('item-source', $nodeIds);
        $this->assertContains('item-related', $nodeIds);
        $this->assertContains('item-suggested', $nodeIds);
        $this->assertNotContains('security-settings', $nodeIds);
        $this->assertContains('manual', $edgeKinds);
        $this->assertContains('shared-tag', $edgeKinds);
        $this->assertSame(1, $response->json('stats.manualEdgeCount'));
        $this->assertGreaterThanOrEqual(1, $response->json('stats.inferredEdgeCount'));
    }

    public function test_it_filters_the_graph_to_a_record_neighborhood_and_deletes_relations(): void
    {
        $this->seedArchiveRecords();

        $relationId = $this->postJson('/api/v1/relations', [
            'sourceId' => 'item-source',
            'targetId' => 'item-related',
            'type' => 'related_to',
        ], $this->authHeaders())
            ->assertCreated()
            ->json('relation.id');

        $focusedResponse = $this->getJson('/api/v1/relations/graph?recordId=item-source&limit=20', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('stats.focusId', 'item-source');

        $focusedNodeIds = collect($focusedResponse->json('nodes'))->pluck('id')->all();
        $this->assertContains('item-source', $focusedNodeIds);
        $this->assertContains('item-related', $focusedNodeIds);
        $this->assertNotContains('unconnected-item', $focusedNodeIds);

        $this->deleteJson('/api/v1/relations/'.$relationId, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/relations/graph?recordId=item-source&limit=20', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('stats.manualEdgeCount', 0);
    }

    public function test_it_updates_manual_relations(): void
    {
        $this->seedArchiveRecords();

        $relationId = $this->postJson('/api/v1/relations', [
            'sourceId' => 'item-source',
            'targetId' => 'item-related',
            'type' => 'related_to',
            'note' => 'old note',
        ], $this->authHeaders())
            ->assertCreated()
            ->json('relation.id');

        $this->patchJson('/api/v1/relations/'.$relationId, [
            'type' => 'references',
            'note' => 'updated from detail page',
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('relation.type', 'references')
            ->assertJsonPath('relation.note', 'updated from detail page');

        $this->getJson('/api/v1/relations/graph?recordId=item-source&limit=20', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('edges.0.type', 'references')
            ->assertJsonPath('edges.0.note', 'updated from detail page');
    }

    public function test_it_builds_the_graph_from_the_full_archive_before_applying_the_display_limit(): void
    {
        $this->seedArchiveRecords();
        $oldestDate = now()->subYears(3);

        for ($index = 0; $index < 230; $index++) {
            DB::table('storage_rows')->insert([
                'store' => 'archive-items',
                'uid' => "filler-$index",
                'data' => json_encode([
                    'uid' => "filler-$index",
                    'id' => "filler-$index",
                    'title' => "Filler $index",
                    'type' => 'video',
                    'tags' => ['bulk'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => now()->subMinutes($index),
                'updated_at' => now()->subMinutes($index),
            ]);
        }

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'old-source',
            'data' => json_encode([
                'uid' => 'old-source',
                'id' => 'old-source',
                'title' => 'Old Source',
                'type' => 'document',
                'tags' => ['deep-archive'],
            ], JSON_THROW_ON_ERROR),
            'created_at' => $oldestDate,
            'updated_at' => $oldestDate,
        ]);

        $this->postJson('/api/v1/relations', [
            'sourceId' => 'old-source',
            'targetId' => 'item-source',
            'type' => 'references',
        ], $this->authHeaders())->assertCreated();

        $response = $this->getJson('/api/v1/relations/graph?recordId=old-source&limit=8', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('stats.focusId', 'old-source');

        $nodeIds = collect($response->json('nodes'))->pluck('id')->all();
        $this->assertContains('old-source', $nodeIds);
        $this->assertContains('item-source', $nodeIds);
        $this->assertSame(1, $response->json('stats.manualEdgeCount'));
    }

    public function test_it_rejects_invalid_relation_requests(): void
    {
        $this->seedArchiveRecords();

        $this->postJson('/api/v1/relations', [
            'sourceId' => 'item-source',
            'targetId' => 'item-source',
            'type' => 'related_to',
        ], $this->authHeaders())->assertUnprocessable();

        $this->postJson('/api/v1/relations', [
            'sourceId' => 'item-source',
            'targetId' => 'missing',
            'type' => 'related_to',
        ], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'record_not_found');
    }

    public function test_it_rejects_unauthenticated_relation_graph_requests(): void
    {
        $this->getJson('/api/v1/relations/graph')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    private function seedArchiveRecords(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            [
                'store' => 'system',
                'uid' => 'security-settings',
                'data' => json_encode([
                    'uid' => 'security-settings',
                    'title' => 'Internal settings row',
                    'tags' => ['history'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'store' => 'archive-items',
                'uid' => 'item-source',
                'data' => json_encode([
                    'uid' => 'item-source',
                    'id' => 'item-source',
                    'title' => 'Source Video',
                    'type' => 'video',
                    'tags' => ['history', 'interview'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'store' => 'archive-items',
                'uid' => 'item-related',
                'data' => json_encode([
                    'uid' => 'item-related',
                    'id' => 'item-related',
                    'title' => 'Transcript File',
                    'type' => 'document',
                    'tags' => ['transcript'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'store' => 'archive-items',
                'uid' => 'item-suggested',
                'data' => json_encode([
                    'uid' => 'item-suggested',
                    'id' => 'item-suggested',
                    'title' => 'Suggested Context',
                    'type' => 'video',
                    'tags' => ['history'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'store' => 'archive-items',
                'uid' => 'unconnected-item',
                'data' => json_encode([
                    'uid' => 'unconnected-item',
                    'id' => 'unconnected-item',
                    'title' => 'Unconnected',
                    'type' => 'audio',
                    'tags' => ['solo'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }
}
