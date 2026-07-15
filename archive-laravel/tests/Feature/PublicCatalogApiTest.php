<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PublicCatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_catalog_lists_only_published_records_with_public_safe_fields(): void
    {
        $this->seedCatalogRecords();

        $response = $this->getJson('/api/v1/public/catalog?limit=10')
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(2, 'records')
            ->assertJsonPath('records.0.uid', 'clip-published')
            ->assertJsonPath('records.0.id', 'item-published')
            ->assertJsonPath('records.0.title', 'Published clip')
            ->assertJsonPath('records.0.description', 'Safe description')
            ->assertJsonPath('records.0.type', 'video')
            ->assertJsonPath('records.0.subtype', 'interview')
            ->assertJsonPath('records.0.tags.0', 'public')
            ->assertJsonPath('records.1.uid', 'clip-status-published')
            ->assertJsonPath('nextCursor', null);

        $records = $response->json('records');
        $this->assertIsArray($records);

        foreach ($records as $record) {
            $this->assertSame(
                ['id', 'uid', 'title', 'description', 'type', 'subtype', 'tags', 'createdAt', 'updatedAt'],
                array_keys($record),
            );
            $this->assertArrayNotHasKey('filePath', $record);
            $this->assertArrayNotHasKey('metadata', $record);
            $this->assertArrayNotHasKey('workflowStatus', $record);
            $this->assertArrayNotHasKey('status', $record);
            $this->assertArrayNotHasKey('privateNote', $record);
        }
    }

    public function test_public_catalog_supports_cursor_pagination(): void
    {
        $this->seedCatalogRecords();

        $firstPage = $this->getJson('/api/v1/public/catalog?limit=1')
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-published');

        $cursor = $firstPage->json('nextCursor');
        $this->assertIsString($cursor);

        $this->getJson('/api/v1/public/catalog?limit=1&cursor='.$cursor)
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-status-published')
            ->assertJsonPath('nextCursor', null);
    }

    public function test_cursor_pagination_does_not_lose_records_when_uids_tie_across_stores(): void
    {
        // storage_rows PK is (store, uid): the same uid can exist in two stores,
        // so ordering/cursoring by uid alone has equal sort keys at page boundaries.
        $now = now();

        foreach ([
            ['store' => 'archive-items', 'uid' => 'tie-clip', 'id' => 'item-a'],
            ['store' => 'media-items', 'uid' => 'tie-clip', 'id' => 'item-b'],
            ['store' => 'archive-items', 'uid' => 'zz-last', 'id' => 'item-c'],
        ] as $seed) {
            DB::table('storage_rows')->insert([
                'store' => $seed['store'],
                'uid' => $seed['uid'],
                'data' => json_encode([
                    'uid' => $seed['uid'],
                    'id' => $seed['id'],
                    'title' => 'Published '.$seed['id'],
                    'type' => 'video',
                    'tags' => ['public'],
                    'workflowStatus' => 'published',
                ], JSON_THROW_ON_ERROR),
                'sync_version' => 1,
                'last_modified_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Walk every page with limit=1 so the page boundary falls exactly
        // between the two rows that share uid 'tie-clip'.
        $ids = [];
        $cursor = null;

        for ($page = 0; $page < 6; $page++) {
            $url = '/api/v1/public/catalog?limit=1'.($cursor !== null ? '&cursor='.urlencode($cursor) : '');
            $response = $this->getJson($url)->assertOk();

            foreach ($response->json('records') as $record) {
                $ids[] = $record['id'];
            }

            $cursor = $response->json('nextCursor');
            if ($cursor === null) {
                break;
            }
        }

        $this->assertCount(3, $ids, 'a record was lost or duplicated across page boundaries');
        sort($ids);
        $this->assertSame(['item-a', 'item-b', 'item-c'], $ids);
    }

    public function test_public_catalog_filters_published_records(): void
    {
        $this->seedCatalogRecords();

        $this->getJson('/api/v1/public/catalog?q=heritage&type=video&tag=public&limit=10')
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-published');

        $this->getJson('/api/v1/public/catalog?type=audio&limit=10')
            ->assertOk()
            ->assertJsonCount(0, 'records');
    }

    public function test_public_catalog_does_not_allow_writes(): void
    {
        $this->postJson('/api/v1/public/catalog', [
            'title' => 'Anonymous write attempt',
        ])->assertMethodNotAllowed();
    }

    private function seedCatalogRecords(): void
    {
        $now = now();

        foreach ([
            [
                'uid' => 'clip-draft',
                'data' => [
                    'uid' => 'clip-draft',
                    'id' => 'item-draft',
                    'title' => 'Draft clip',
                    'description' => 'Should stay private',
                    'type' => 'video',
                    'tags' => ['internal'],
                    'workflowStatus' => 'draft',
                    'filePath' => '/secret/draft.mp4',
                ],
            ],
            [
                'uid' => 'clip-published',
                'data' => [
                    'uid' => 'clip-published',
                    'id' => 'item-published',
                    'title' => 'Published clip',
                    'description' => 'Safe description',
                    'type' => 'video',
                    'subtype' => 'interview',
                    'tags' => ['public', 'heritage'],
                    'workflowStatus' => 'published',
                    'filePath' => '/secret/published.mp4',
                    'metadata' => ['camera' => 'A'],
                    'privateNote' => 'Do not expose',
                ],
            ],
            [
                'uid' => 'clip-status-published',
                'data' => [
                    'uid' => 'clip-status-published',
                    'id' => 'item-status-published',
                    'title' => 'Status published clip',
                    'description' => null,
                    'type' => 'image',
                    'subtype' => null,
                    'tags' => [],
                    'status' => 'published',
                ],
            ],
            [
                'uid' => 'clip-review',
                'data' => [
                    'uid' => 'clip-review',
                    'id' => 'item-review',
                    'title' => 'Review clip',
                    'description' => 'Should stay private',
                    'type' => 'audio',
                    'workflowStatus' => 'review',
                ],
            ],
        ] as $row) {
            DB::table('storage_rows')->insert([
                'store' => 'archive-items',
                'uid' => $row['uid'],
                'data' => json_encode($row['data'], JSON_THROW_ON_ERROR),
                'sync_version' => 1,
                'last_modified_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
