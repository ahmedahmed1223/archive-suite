<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Ai\Agents\ArchiveAssistantAgent;
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
