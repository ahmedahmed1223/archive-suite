<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SearchApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['archive.api_key' => 'test-secret']);
    }

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
                ['uid' => 'clip-001', 'title' => 'Riyadh archive interview', 'description' => 'City planning'],
                ['uid' => 'clip-002', 'title' => 'Jeddah archive package', 'description' => 'Coastal story'],
                ['uid' => 'clip-003', 'title' => 'Sports segment', 'description' => 'Match highlights'],
            ],
        ], $this->authHeaders())->assertOk();
    }

    /**
     * @return array<string, string>
     */
    private function authHeaders(): array
    {
        return ['X-Archive-Api-Key' => 'test-secret'];
    }
}
