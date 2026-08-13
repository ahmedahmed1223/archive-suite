<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Ai\Agents\ArchiveAssistantAgent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * AI-802: the HTTP surface for ArchiveAssistantAgent. Exercised entirely
 * through the SDK's own fake (see AI-801's AiSdkProviderTest) so this
 * suite never calls the live OpenRouter API.
 */
class ArchiveAssistantAgentTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->postJson('/api/v1/ai/assistant/ask', ['message' => 'hello'])
            ->assertUnauthorized();
    }

    public function test_it_answers_via_the_agent_without_hitting_the_network(): void
    {
        ArchiveAssistantAgent::fake(['There are no matching records.']);

        $this->postJson('/api/v1/ai/assistant/ask', ['message' => 'find the sunset harbor interview'], $this->authHeaders())
            ->assertOk()
            ->assertJson(['ok' => true, 'text' => 'There are no matching records.']);

        ArchiveAssistantAgent::assertPrompted('find the sunset harbor interview');
    }

    public function test_it_requires_a_message(): void
    {
        $this->postJson('/api/v1/ai/assistant/ask', [], $this->authHeaders())
            ->assertStatus(422);
    }
}
