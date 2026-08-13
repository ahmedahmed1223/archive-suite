<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Ai\Agents\ArchiveAssistantAgent;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * AI-802/AI-804: the HTTP surface for ArchiveAssistantAgent. Exercised
 * entirely through the SDK's own fake (see AI-801's AiSdkProviderTest) so
 * this suite never calls the live OpenRouter API.
 */
class ArchiveAssistantAgentTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->postJson('/api/v1/ai/assistant/ask', ['message' => 'hello'])
            ->assertUnauthorized();
    }

    public function test_it_answers_with_structured_sources_without_hitting_the_network(): void
    {
        ArchiveAssistantAgent::fake([[
            'answer' => 'The sunset harbor interview covers the 2019 restoration.',
            'sources' => [['recordId' => 'item-1', 'title' => 'Sunset Harbor Interview']],
        ]]);

        $this->postJson('/api/v1/ai/assistant/ask', ['message' => 'find the sunset harbor interview'], $this->authHeaders())
            ->assertOk()
            ->assertJson([
                'ok' => true,
                'answer' => 'The sunset harbor interview covers the 2019 restoration.',
                'sources' => [['recordId' => 'item-1', 'title' => 'Sunset Harbor Interview']],
            ]);

        ArchiveAssistantAgent::assertPrompted('find the sunset harbor interview');
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'ai.assistant.completed',
            'resource_type' => 'ai_assistant',
        ]);
    }

    public function test_it_rejects_a_request_when_the_user_daily_budget_is_exhausted(): void
    {
        $headers = $this->authHeaders();
        $userId = User::query()->where('email', 'admin@example.test')->value('id');
        AuditLog::query()->create([
            'action' => 'AI assistant request',
            'event' => 'ai.assistant.completed',
            'resource_type' => 'ai_assistant',
            'actor_id' => $userId,
            'outcome' => 'success',
            'status_code' => 200,
            'metadata' => ['estimatedCents' => 9999],
        ]);

        $this->postJson('/api/v1/ai/assistant/ask', ['message' => 'second request'], $headers)
            ->assertStatus(429)
            ->assertJsonPath('code', 'RATE_LIMITED');
    }

    public function test_sources_default_to_an_empty_array(): void
    {
        ArchiveAssistantAgent::fake([['answer' => 'Nothing relevant was found.', 'sources' => []]]);

        $this->postJson('/api/v1/ai/assistant/ask', ['message' => 'find something obscure'], $this->authHeaders())
            ->assertOk()
            ->assertJson(['ok' => true, 'sources' => []]);
    }

    public function test_it_requires_a_message(): void
    {
        $this->postJson('/api/v1/ai/assistant/ask', [], $this->authHeaders())
            ->assertStatus(422);
    }
}
