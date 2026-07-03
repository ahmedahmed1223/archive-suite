<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class DiscoverApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_returns_discovery_sections_from_archive_records(): void
    {
        $this->seedDiscoveryRecords();

        $response = $this->getJson('/api/v1/discover?limit=2', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(6, 'sections');

        $sections = collect($response->json('sections'))->keyBy('key');

        $this->assertSame(['explore', 'trending', 'random', 'active', 'forgotten', 'needsMetadata'], $sections->keys()->all());
        $this->assertCount(2, $sections['active']['records']);
        $this->assertSame('complete-new', $sections['active']['records'][0]['uid']);
        $this->assertSame('missing-metadata', $sections['needsMetadata']['records'][0]['uid']);
        $this->assertSame('old-complete', $sections['forgotten']['records'][0]['uid']);

        $allUids = collect($response->json('sections'))
            ->flatMap(fn (array $section): array => array_column($section['records'], 'uid'))
            ->all();
        $this->assertNotContains('security-settings', $allUids);
    }

    public function test_it_rejects_unauthenticated_discover_requests(): void
    {
        $this->getJson('/api/v1/discover')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    private function seedDiscoveryRecords(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            [
                'store' => 'system',
                'uid' => 'security-settings',
                'data' => json_encode([
                    'uid' => 'security-settings',
                    'title' => 'Internal settings row',
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'store' => 'archive-items',
                'uid' => 'complete-new',
                'data' => json_encode([
                    'uid' => 'complete-new',
                    'title' => 'Complete new item',
                    'description' => 'Ready for use',
                    'type' => 'video',
                    'tags' => ['news'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now->copy()->subDays(1),
                'updated_at' => $now->copy()->subHours(1),
            ],
            [
                'store' => 'archive-items',
                'uid' => 'missing-metadata',
                'data' => json_encode([
                    'uid' => 'missing-metadata',
                    'title' => 'Needs work',
                    'tags' => [],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now->copy()->subDays(2),
                'updated_at' => $now->copy()->subDays(2),
            ],
            [
                'store' => 'archive-items',
                'uid' => 'old-complete',
                'data' => json_encode([
                    'uid' => 'old-complete',
                    'title' => 'Old complete item',
                    'description' => 'Still valid',
                    'type' => 'audio',
                    'tags' => ['archive'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now->copy()->subDays(60),
                'updated_at' => $now->copy()->subDays(60),
            ],
        ]);
    }
}
