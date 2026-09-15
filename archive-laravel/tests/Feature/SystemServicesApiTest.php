<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class SystemServicesApiTest extends TestCase
{
    public function test_system_services_endpoint_returns_all_services(): void
    {
        $response = $this->getJson('/api/v1/system/services');

        $response->assertOk()
            ->assertJsonStructure([
                'ok',
                'services' => [
                    'ffmpeg' => ['state', 'reason'],
                    'ffprobe' => ['state', 'reason'],
                    'whisper' => ['state', 'reason'],
                    'reverb' => ['state', 'reason'],
                    'gpu' => ['state', 'reason'],
                    'storage' => [],
                ],
            ]);

        $data = $response->json('services');
        foreach (['ffmpeg', 'ffprobe', 'whisper', 'reverb', 'gpu'] as $service) {
            $this->assertIn($data[$service]['state'], ['available', 'requires_setup', 'down']);
            $this->assertTrue(
                is_string($data[$service]['reason']) || $data[$service]['reason'] === null,
                "Reason for {$service} must be string or null"
            );
        }
    }

    public function test_system_services_returns_valid_states(): void
    {
        $response = $this->getJson('/api/v1/system/services');
        $response->assertOk();

        $data = $response->json('services');
        $validStates = ['available', 'requires_setup', 'down'];

        foreach ($data as $serviceName => $service) {
            if (is_array($service) && isset($service['state'])) {
                $this->assertIn(
                    $service['state'],
                    $validStates,
                    "Service {$serviceName} has invalid state: {$service['state']}"
                );
            }
        }
    }

    public function test_system_services_response_has_ok_flag(): void
    {
        $response = $this->getJson('/api/v1/system/services');

        $response->assertOk()
            ->assertJson(['ok' => true]);
    }
}
