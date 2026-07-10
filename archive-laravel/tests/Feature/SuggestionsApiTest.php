<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class SuggestionsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_returns_deterministic_discovery_suggestions_from_archive_rows(): void
    {
        $this->seedArchiveRows();

        $response = $this->getJson('/api/v1/suggestions?context=discover', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);

        $suggestions = collect($response->json('suggestions'))->keyBy('key');

        $this->assertSame(2, $suggestions['discover:missing-tags']['count']);
        $this->assertSame(1, $suggestions['discover:missing-type']['count']);
        $this->assertSame(2, $suggestions['discover:duplicate-title']['count']);
        $this->assertSame('/archive', $suggestions['discover:missing-tags']['actionHref']);
    }

    public function test_it_returns_detail_suggestions_for_missing_record_metadata(): void
    {
        $this->seedArchiveRows();

        $response = $this->getJson('/api/v1/suggestions?context=detail&recordId=missing', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);

        $keys = collect($response->json('suggestions'))->pluck('key')->all();

        $this->assertContains('detail:missing:missing-description', $keys);
        $this->assertContains('detail:missing:missing-tags', $keys);
        $this->assertContains('detail:missing:missing-type', $keys);
        $this->assertContains('detail:missing:missing-source', $keys);
    }

    public function test_it_persists_feedback_and_hides_dismissed_suggestions_for_the_current_user(): void
    {
        $this->seedArchiveRows();

        $this->putJson('/api/v1/suggestions/discover%3Amissing-tags/feedback', [
            'value' => 'dismissed',
            'context' => 'discover',
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('feedback.value', 'dismissed');

        $this->getJson('/api/v1/suggestions?context=discover', $this->authHeaders())
            ->assertOk()
            ->assertJsonMissing(['key' => 'discover:missing-tags']);

        $other = User::query()->create([
            'name' => 'Other User',
            'email' => 'suggestions-other@example.test',
            'password' => Hash::make('secret-password'),
        ]);
        $otherToken = $this->postJson('/api/v1/auth/login', [
            'email' => $other->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/suggestions?context=discover', ['Authorization' => 'Bearer '.$otherToken])
            ->assertOk()
            ->assertJsonFragment(['key' => 'discover:missing-tags']);
    }

    public function test_it_rejects_invalid_context_feedback_and_missing_detail_records(): void
    {
        $this->getJson('/api/v1/suggestions?context=unknown', $this->authHeaders())
            ->assertUnprocessable();

        $this->getJson('/api/v1/suggestions?context=detail&recordId=missing', $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'record_not_found');

        $this->putJson('/api/v1/suggestions/discover%3Amissing-tags/feedback', ['value' => 'maybe'], $this->authHeaders())
            ->assertUnprocessable();
    }

    private function seedArchiveRows(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            [
                'store' => 'archive-items',
                'uid' => 'missing',
                'data' => json_encode(['uid' => 'missing', 'title' => 'Repeated title'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'store' => 'archive-items',
                'uid' => 'duplicate',
                'data' => json_encode(['uid' => 'duplicate', 'title' => 'Repeated title', 'description' => 'Complete', 'type' => 'video', 'tags' => ['news']], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'store' => 'archive-items',
                'uid' => 'untagged',
                'data' => json_encode(['uid' => 'untagged', 'title' => 'No tags', 'description' => 'Complete', 'type' => 'video'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }
}
