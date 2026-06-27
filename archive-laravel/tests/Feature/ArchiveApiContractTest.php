<?php

namespace Tests\Feature;

use Illuminate\Testing\Fluent\AssertableJson;
use Tests\TestCase;

class ArchiveApiContractTest extends TestCase
{
    public function test_it_serves_the_versioned_health_endpoint(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJson(fn (AssertableJson $json) => $json
                ->where('ok', true)
                ->where('backend', 'laravel')
                ->has('engine')
                ->has('uptimeSec')
                ->has('version')
                ->has('authRequired')
            );
    }

    public function test_it_serves_the_shared_openapi_contract(): void
    {
        $this->getJson('/api/v1/public/openapi.json')
            ->assertOk()
            ->assertJsonPath('openapi', '3.1.0')
            ->assertJsonPath('info.title', 'Archive Suite API Contract')
            ->assertJsonStructure([
                'paths' => [
                    '/health',
                    '/auth/login',
                    '/records',
                    '/rights',
                    '/share/{token}',
                ],
            ]);
    }
}
