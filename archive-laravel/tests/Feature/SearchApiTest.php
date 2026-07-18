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

    public function test_it_searches_arabic_text_stored_in_json_records(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [[
                'uid' => 'audio-arabic-001',
                'title' => 'اختبار قبول صوتي حي',
                'type' => 'audio',
                'tags' => ['اختبار'],
            ]],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/search?store=archive-items&q='.rawurlencode('اختبار قبول صوتي') , $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'audio-arabic-001');
    }

    public function test_transcript_mode_returns_only_matching_timed_cues(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [[
                'uid' => 'oral-history-001',
                'title' => 'مقابلة تاريخ شفهي',
                'type' => 'video',
                'transcript' => "WEBVTT\n\n00:01:23.000 --> 00:01:27.000\nذاكرة المدينة\n",
            ]],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/search?mode=transcript&q='.rawurlencode('ذاكرة'), $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('facets.mode', 'transcript')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'oral-history-001')
            ->assertJsonPath('records.0.match.kind', 'transcript')
            ->assertJsonPath('records.0.match.excerpt', 'ذاكرة المدينة')
            ->assertJsonPath('records.0.match.timestampSeconds', 83);
    }

    public function test_it_returns_bounded_search_suggestions(): void
    {
        $this->seedRecords();

        $this->getJson('/api/v1/search/suggestions?q=riy&limit=8', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('suggestions.0.kind', 'record')
            ->assertJsonPath('suggestions.0.value', 'Riyadh archive interview');
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

    public function test_it_supports_advanced_field_clauses_and_quoted_values(): void
    {
        $this->seedRecords();

        $this->getJson('/api/v1/search?store=archive-items&q=type%3Avideo%20AND%20description%3A%22City%20planning%22&semantic=true&limit=10', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('facets.mode', 'advanced')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-001');
    }

    public function test_advanced_search_respects_not_and_and_before_or_and_existing_filters(): void
    {
        $this->seedRecords();

        $this->getJson('/api/v1/search?store=archive-items&type=video&q=tag%3Ariyadh%20OR%20tag%3Ajeddah%20AND%20NOT%20status%3Adraft&limit=10', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('facets.mode', 'advanced')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'clip-001');
    }

    public function test_it_rejects_invalid_advanced_search_syntax(): void
    {
        $this->seedRecords();

        foreach (['unknown:value', 'type:', 'type:"unterminated', 'type:video AND'] as $query) {
            $this->getJson('/api/v1/search?store=archive-items&q='.rawurlencode($query), $this->authHeaders())
                ->assertUnprocessable()
                ->assertJsonValidationErrors('q');
        }
    }

    public function test_it_rejects_advanced_search_queries_with_too_many_tokens(): void
    {
        $this->seedRecords();
        $query = implode(' ', array_fill(0, 129, 'type:video'));

        $this->getJson('/api/v1/search?store=archive-items&q='.rawurlencode($query), $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
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
