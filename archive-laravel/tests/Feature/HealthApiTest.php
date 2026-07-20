<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HealthApiTest extends TestCase
{
    public function test_health_endpoint_propagates_a_safe_correlation_id(): void
    {
        $this->withHeader('X-Request-ID', 'support-case-207')
            ->getJson('/api/v1/health')
            ->assertOk()
            ->assertHeader('X-Request-ID', 'support-case-207');
    }

    public function test_request_id_is_bound_to_the_structured_log_context(): void
    {
        Log::shouldReceive('withContext')
            ->once()
            ->with(['request_id' => 'e2e-support-207']);

        $this->withHeader('X-Request-ID', 'e2e-support-207')
            ->getJson('/api/v1/health')
            ->assertOk()
            ->assertHeader('X-Request-ID', 'e2e-support-207');
    }

    public function test_health_endpoint_replaces_an_unsafe_correlation_id(): void
    {
        $response = $this->withHeader('X-Request-ID', "secret\nheader")
            ->getJson('/api/v1/health');

        $response->assertOk();
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', (string) $response->headers->get('X-Request-ID'));
    }

    public function test_health_endpoint_reports_ok_with_all_checks_passing(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('checks.db', true)
            ->assertJsonPath('checks.redis', true)
            ->assertJsonPath('checks.storage', true)
            ->assertJsonStructure(['ok', 'backend', 'engine', 'uptimeSec', 'version', 'authRequired', 'checks']);
    }

    public function test_health_endpoint_returns_503_when_a_check_fails(): void
    {
        Storage::shouldReceive('disk')
            ->with('local')
            ->andThrow(new \RuntimeException('disk unavailable'));

        $this->getJson('/api/v1/health')
            ->assertStatus(503)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('checks.storage', false)
            ->assertJsonPath('checks.db', true);
    }

    public function test_health_endpoint_returns_503_when_redis_is_unavailable(): void
    {
        Cache::shouldReceive('put')
            ->once()
            ->andThrow(new \RuntimeException('redis unavailable'));
        // V1-712: the health endpoint also reads the dispatcher heartbeat via Cache::get().
        Cache::shouldReceive('get')->andReturn(null);

        $this->getJson('/api/v1/health')
            ->assertStatus(503)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('checks.redis', false)
            ->assertJsonPath('checks.db', true)
            ->assertJsonPath('checks.storage', true);
    }
}
