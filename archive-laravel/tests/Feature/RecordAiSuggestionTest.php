<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Ai\Agents\RecordSuggestionAgent;
use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * AI-803: a suggestion is always born `pending` and only ever leaves that
 * state via an explicit human approve/reject call - store() never writes
 * to storage_rows, and neither does approve()/reject(). Exercised entirely
 * through RecordSuggestionAgent::fake() so this suite never hits the live
 * network or spends real OpenRouter credit.
 */
class RecordAiSuggestionTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_generates_a_pending_suggestion_and_logs_it(): void
    {
        $this->seedRecord('item-1', ['title' => 'Sunset Harbor', 'description' => 'Interview with the harbor master.']);
        RecordSuggestionAgent::fake([[
            'summary' => 'An interview about Sunset Harbor.',
            'tags' => ['interview', 'harbor'],
            'type' => 'video',
            'subtype' => 'interview',
        ]]);

        $this->postJson('/api/v1/records/item-1/ai-suggestions', [], $this->authHeaders())
            ->assertCreated()
            ->assertJson(fn ($json) => $json
                ->where('suggestion.status', 'pending')
                ->where('suggestion.summary', 'An interview about Sunset Harbor.')
                ->where('suggestion.tags', ['interview', 'harbor'])
                ->etc());

        $this->assertDatabaseHas('storage_rows', ['uid' => 'item-1']);
        $row = DB::table('storage_rows')->where('uid', 'item-1')->first();
        $this->assertStringNotContainsString('An interview about Sunset Harbor.', (string) $row->data);

        $log = AuditLog::query()->where('event', 'ai_suggestion.create')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame('success', $log->outcome);
    }

    public function test_it_requires_source_text(): void
    {
        $this->seedRecord('item-2', []);

        $this->postJson('/api/v1/records/item-2/ai-suggestions', [], $this->authHeaders())
            ->assertStatus(422)
            ->assertJson(['code' => 'ai_source_required']);
    }

    public function test_approve_and_reject_never_touch_the_record(): void
    {
        $this->seedRecord('item-3', ['title' => 'Original title', 'description' => 'Original description.']);
        RecordSuggestionAgent::fake([['summary' => 'A summary.', 'tags' => ['tag1']]]);

        $created = $this->postJson('/api/v1/records/item-3/ai-suggestions', [], $this->authHeaders())->json('suggestion');

        $this->postJson("/api/v1/ai-suggestions/{$created['id']}/approve", [], $this->authHeaders())
            ->assertOk()
            ->assertJson(['suggestion' => ['status' => 'approved']]);

        $row = DB::table('storage_rows')->where('uid', 'item-3')->first();
        $this->assertStringContainsString('Original title', (string) $row->data);

        $log = AuditLog::query()->where('event', 'ai_suggestion.approved')->latest('id')->first();
        $this->assertNotNull($log);
    }

    /** @param array<string, mixed> $data */
    private function seedRecord(string $uid, array $data): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode(['uid' => $uid, 'id' => $uid, ...$data], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
