<?php

namespace Tests\Feature;

use App\Services\Search\EmbeddingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class SemanticSearchTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_semantic_search_degrades_to_keyword_fallback_on_sqlite(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'clip-001', 'title' => 'Riyadh archive interview', 'description' => 'City planning', 'type' => 'video'],
                ['uid' => 'clip-002', 'title' => 'Jeddah archive package', 'description' => 'Coastal story', 'type' => 'video'],
            ],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/search?store=archive-items&q=riyadh&semantic=true&limit=10', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('facets.mode', 'keyword-fallback')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-001');
    }

    public function test_embedding_service_is_disabled_on_sqlite_even_with_flags_set(): void
    {
        config(['embeddings.enabled' => true, 'embeddings.api_key' => 'sk-test']);

        $this->assertFalse(app(EmbeddingService::class)->isEnabled());
    }

    public function test_embedding_service_is_disabled_without_an_api_key(): void
    {
        config(['embeddings.enabled' => true, 'embeddings.api_key' => null]);

        $this->assertFalse(app(EmbeddingService::class)->isEnabled());
    }

    public function test_embed_returns_null_without_an_api_key(): void
    {
        config(['embeddings.enabled' => true, 'embeddings.api_key' => null]);

        $this->assertNull(app(EmbeddingService::class)->embed('hello world'));
    }

    public function test_embeddings_sync_command_reports_disabled_and_exits_zero(): void
    {
        config(['embeddings.enabled' => false]);

        $this->artisan('embeddings:sync', ['--store' => 'records'])
            ->assertExitCode(0)
            ->expectsOutputToContain('disabled');
    }
}
