<?php

declare(strict_types=1);

namespace Tests\Feature;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;
use Tests\TestCase;

/**
 * AI-801: a minimal agent used only to prove the SDK is wired end-to-end
 * (config -> provider -> agent call) via the SDK's own fake, never a real
 * product feature - that starts with AI-802's read-only archive assistant.
 */
class PingAgent implements Agent
{
    use Promptable;

    public function instructions(): string
    {
        return 'You are a connectivity test agent.';
    }
}

/**
 * AI-801: laravel/ai is adopted with a single explicitly configured
 * provider (OpenRouter) - config/ai.php never leaks its key to
 * archive-next, and calls are exercised through the SDK's own fakes so
 * this suite never hits the live network or spends real OpenRouter credit.
 */
class AiSdkProviderTest extends TestCase
{
    public function test_openrouter_is_the_single_configured_provider(): void
    {
        $this->assertSame('openrouter', config('ai.default'));
        $this->assertSame('openrouter', config('ai.providers.openrouter.driver'));
        $this->assertNotEmpty(config('ai.providers.openrouter.key'));
    }

    public function test_a_prompt_round_trips_through_the_sdk_without_hitting_the_network(): void
    {
        PingAgent::fake(['pong']);

        $response = (new PingAgent)->prompt('ping');

        $this->assertSame('pong', $response->text);
        PingAgent::assertPrompted('ping');
    }
}
