<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class SearchApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_searches_records_by_keyword(): void
    {
        $this->seedRecords();

        $this->getJson('/api/v1/search?store=archive-items&q=riyadh&limit=10', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-001')
            ->assertJsonPath('facets.mode', 'keyword');
    }

    public function test_it_supports_search_cursor_pagination(): void
    {
        $this->seedRecords();

        $firstPage = $this->getJson('/api/v1/search?q=archive&limit=1', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records');

        $cursor = $firstPage->json('nextCursor');
        $this->assertIsString($cursor);

        $this->getJson('/api/v1/search?q=archive&limit=5&cursor='.$cursor, $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-002')
            ->assertJsonPath('nextCursor', null);
    }

    public function test_it_filters_with_backend_facets(): void
    {
        $this->seedRecords();

        $response = $this->getJson('/api/v1/search?store=archive-items&type=video&tag=city&status=review&limit=10', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-001')
            ->assertJsonPath('facets.mode', 'keyword')
            ->assertJsonPath('facets.total', 1)
            ->assertJsonPath('facets.types.0.value', 'video')
            ->assertJsonPath('facets.tags.0.label', 'city')
            ->assertJsonPath('facets.statuses.0.value', 'review');

        $this->assertSame(1, $response->json('facets.types.0.count'));
    }

    public function test_it_rejects_unauthenticated_search_requests(): void
    {
        $this->getJson('/api/v1/search?q=archive')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    private function seedRecords(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'clip-001', 'title' => 'Riyadh archive interview', 'description' => 'City planning', 'type' => 'video', 'tags' => ['city', 'riyadh'], 'workflowStatus' => 'review'],
                ['uid' => 'clip-002', 'title' => 'Jeddah archive package', 'description' => 'Coastal story', 'type' => 'video', 'tags' => ['city', 'jeddah'], 'workflowStatus' => 'draft'],
                ['uid' => 'clip-003', 'title' => 'Sports segment', 'description' => 'Match highlights', 'type' => 'video', 'tags' => ['sports'], 'workflowStatus' => 'published'],
            ],
        ], $this->authHeaders())->assertOk();
    }

}
