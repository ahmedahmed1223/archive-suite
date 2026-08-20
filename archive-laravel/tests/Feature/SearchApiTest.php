<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class SearchApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

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

    public function test_keyword_search_rehydrates_a_pool_from_the_database_cache(): void
    {
        config(['cache.default' => 'database']);
        Cache::clear();
        $this->seedRecords();

        $this->getJson('/api/v1/search?store=archive-items&q=riyadh&limit=10', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('records.0.uid', 'clip-001');

        $this->getJson('/api/v1/search?store=archive-items&q=riyadh&limit=10', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('records.0.uid', 'clip-001');
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

        $this->getJson('/api/v1/search?store=archive-items&q='.rawurlencode('اختبار قبول صوتي'), $this->authHeaders())
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

    /**
     * V3-PERF-005: backpressure + stable cache key for suggestions. The
     * underlying record pool is cached under one fixed key (independent of
     * `q` -- every keystroke used to trigger a fresh unbounded scan), so a
     * record created after the first request isn't visible in a second
     * request within the TTL window.
     */
    public function test_suggestions_pool_is_cached_across_requests(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'sugg-clip-001', 'title' => 'Suggestion cache alpha', 'type' => 'video']],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/search/suggestions?q=Suggestion%20cache&limit=8', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'suggestions');

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'sugg-clip-002', 'title' => 'Suggestion cache beta', 'type' => 'video']],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/search/suggestions?q=Suggestion%20cache&limit=8', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'suggestions');
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

    public function test_it_filters_by_record_date_and_description_completeness(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'dated-complete', 'title' => 'Complete', 'description' => 'Has a real description', 'eventDate' => '2026-07-01', 'type' => 'video'],
                ['uid' => 'dated-incomplete', 'title' => 'Incomplete', 'eventDate' => '2026-07-15', 'type' => 'video'],
            ],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/search?store=archive-items&dateFrom=2026-07-10&dateTo=2026-07-31&descriptionState=incomplete', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'dated-incomplete');
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

    /**
     * V3-PERF-005: cursor and limit are deliberately excluded from the cache
     * key (the pool is built once and paginated in-memory), so paging
     * through the same base query must reuse the pool as it was when page 1
     * was cached -- not silently rebuild against live data and splice in a
     * record that arrived after the fact.
     */
    public function test_paging_through_the_same_query_reuses_the_cached_pool(): void
    {
        $this->seedRecords();

        $firstPage = $this->getJson('/api/v1/search?q=archive&limit=1', $this->authHeaders())->assertOk();
        $cursor = $firstPage->json('nextCursor');
        $this->assertIsString($cursor);

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'clip-004-late', 'title' => 'Late archive arrival', 'type' => 'video']],
        ], $this->authHeaders())->assertOk();

        $secondPage = $this->getJson('/api/v1/search?q=archive&limit=5&cursor='.$cursor, $this->authHeaders())->assertOk();
        $uids = collect($secondPage->json('records'))->pluck('uid')->all();

        $this->assertNotContains('clip-004-late', $uids);
    }

    /**
     * Different queries must never share a cache entry: q=riyadh and
     * q=jeddah are two distinct requests within the same short TTL window,
     * and each must see its own matching record, not the other's.
     */
    public function test_different_queries_never_collide_in_the_cache(): void
    {
        $this->seedRecords();

        $riyadh = $this->getJson('/api/v1/search?store=archive-items&q=riyadh&limit=10', $this->authHeaders())->assertOk();
        $jeddah = $this->getJson('/api/v1/search?store=archive-items&q=jeddah&limit=10', $this->authHeaders())->assertOk();

        $this->assertSame('clip-001', $riyadh->json('records.0.uid'));
        $this->assertSame('clip-002', $jeddah->json('records.0.uid'));
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
