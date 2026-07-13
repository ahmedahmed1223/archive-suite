<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HealthApiTest extends TestCase
{
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

        $this->getJson('/api/v1/health')
            ->assertStatus(503)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('checks.redis', false)
            ->assertJsonPath('checks.db', true)
            ->assertJsonPath('checks.storage', true);
    }
}
