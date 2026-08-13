<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordAiAssistApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_returns_review_required_assistance_without_mutating_the_record(): void
    {
        $headers = $this->authHeaders();
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'ai-record',
            'data' => json_encode([
                'uid' => 'ai-record',
                'title' => 'تقرير الأرشيف',
                'transcript' => 'زار أحمد مدينة دمشق لمناقشة مشروع الأرشيف. أكّد أحمد أن المشروع يحتاج إلى مراجعة لغوية.',
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('vocabulary_terms')->insert([
            'id' => 'term-damascus',
            'user_id' => User::query()->where('email', 'admin@example.test')->value('id'),
            'term' => 'دمشق',
            'kind' => 'place',
            'aliases' => null,
            'note' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/records/ai-record/ai-assist', [], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('reviewRequired', true)
            ->assertJsonPath('recordId', 'ai-record')
            ->assertJsonPath('entities.0.term', 'دمشق')
            ->assertJsonPath('entities.0.kind', 'place');

        $this->assertNotEmpty($response->json('summary'));
        $this->assertContains('دمشق', $response->json('suggestedTags'));
        $this->assertSame([], $response->json('changesApplied'));
        $this->assertSame('زار أحمد مدينة دمشق لمناقشة مشروع الأرشيف. أكّد أحمد أن المشروع يحتاج إلى مراجعة لغوية.', DB::table('storage_rows')->where('uid', 'ai-record')->value('data') ? json_decode((string) DB::table('storage_rows')->where('uid', 'ai-record')->value('data'), true, 512, JSON_THROW_ON_ERROR)['transcript'] : null);
    }
}
